// services/TokenService.ts
import { inject, injectable } from "inversify";
import { Contract, Interface, isAddress } from "ethers";
import { erc20 } from "../abis/erc20";
import {
  MULTICALL3_ADDRESS,
  MULTICALL_BATCH_SIZE,
  MULTICALL_CALL_TIMEOUT_MS,
  multicall3,
} from "../abis/multicall3";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import type { IJsonRpcProviderManager } from "../jsonRpcProvider/IJsonRpcProviderManager";
import type { ILogger } from "../logger/ILogger";
import type { ITokenRepository } from "./ITokenRepository";
import type { ITokenService, TokenDetailsBatch } from "./ITokenService";
import type { Token } from "./Token";

const DEFAULT_TOKEN_SYMBOL = "ERR_TOKEN_SYMBOL";
const DEFAULT_TOKEN_DECIMALS = 18;

const MULTICALL_INTERFACE = new Interface(multicall3);
const TOKEN_METADATA_INTERFACE = new Interface([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

interface Multicall3Call {
  target: string;
  allowFailure: boolean;
  callData: string;
}

type MetadataMethod = "symbol" | "decimals";

@injectable()
export class TokenService implements ITokenService {
  constructor(
    @inject(SERVICE_IDENTIFIER.TokenRepository) private tokenRepository: ITokenRepository,
    @inject(SERVICE_IDENTIFIER.Logger) private logger: ILogger,
    @inject(SERVICE_IDENTIFIER.JsonRpcProviderManager)
    private readonly jsonRpcProviderManager: IJsonRpcProviderManager,
  ) {}

  async getTokenDetails(
    address: string,
    contractERC20: Contract,
  ): Promise<{ tokenSymbol: string; tokenDecimals: bigint }> {
    try {
      const token: Token | null = await this.tokenRepository.findOneByAddress(address);

      if (token) {
        return {
          tokenSymbol: token.symbol,
          tokenDecimals: BigInt(token.decimals),
        };
      } else {
        // Token not found, fetch details from the contract
        const tokenDecimals = BigInt(await contractERC20.decimals());
        const tokenSymbol = await contractERC20.symbol();

        // Check if the token is important and save it if it is
        // A failed cache write keeps legacy semantics: it lands in the catch below.
        await this.saveIfImportant(address, tokenSymbol, tokenDecimals);

        return { tokenSymbol, tokenDecimals };
      }
    } catch (err: any) {
      // Handle errors that may occur during the fetch process
      if (err.code === "CALL_EXCEPTION") {
        this.logger.warn("Token does not expose expected metadata");
      } else {
        this.logger.error("Token metadata request failed");
      }

      // Return default values in case of an error
      return {
        tokenSymbol: DEFAULT_TOKEN_SYMBOL,
        tokenDecimals: BigInt(DEFAULT_TOKEN_DECIMALS),
      };
    }
  }

  /**
   * Resolve metadata for many tokens with one Multicall3 eth_call per batch of
   * MULTICALL_BATCH_SIZE unique addresses. Cached tokens never enter the payload.
   * Every requested valid address receives an entry keyed by lowercase address,
   * using the same defaults as the single-token path when resolution fails.
   */
  async getTokenDetailsBatch(addresses: string[]): Promise<Map<string, TokenDetailsBatch>> {
    const detailsByAddress = new Map<string, TokenDetailsBatch>();

    // Dedupe case-insensitively; the first-seen casing drives repository and fallback calls.
    const seenOriginalCasing = new Map<string, string>();
    for (const rawAddress of addresses ?? []) {
      if (typeof rawAddress !== "string" || !isAddress(rawAddress)) continue;
      const key = rawAddress.toLowerCase();
      if (!seenOriginalCasing.has(key)) seenOriginalCasing.set(key, rawAddress);
    }

    // Cache-first so known tokens neither enter the multicall payload nor overwrite cached rows.
    const uncached: string[] = [];
    for (const [key, original] of seenOriginalCasing) {
      try {
        const token = await this.tokenRepository.findOneByAddress(original);
        if (token) {
          detailsByAddress.set(key, {
            tokenSymbol: token.symbol,
            tokenDecimals: Number(token.decimals),
          });
          continue;
        }
      } catch {
        // A failing cache lookup falls through to the chain read.
      }
      uncached.push(original);
    }

    for (let offset = 0; offset < uncached.length; offset += MULTICALL_BATCH_SIZE) {
      await this.executeMulticallBatch(
        uncached.slice(offset, offset + MULTICALL_BATCH_SIZE),
        detailsByAddress,
      );
    }

    return detailsByAddress;
  }

  /** Shared cache-write policy of the single-token path: persist only USD/ETH-ish symbols. */
  private async saveIfImportant(
    address: string,
    tokenSymbol: string,
    tokenDecimals: bigint | number,
  ): Promise<void> {
    if (!tokenSymbol.includes("USD") && !tokenSymbol.includes("ETH")) return;

    const token: Token = {
      address,
      decimals: BigInt(tokenDecimals),
      symbol: tokenSymbol,
    };
    await this.tokenRepository.save(token);
  }

  /**
   * One aggregate3 eth_call per chunk. Subcalls run with allowFailure=true so a
   * reverting token cannot sink its neighbours; failing pairs are re-resolved through
   * the existing single-token path, which owns the identical error defaults.
   */
  private async executeMulticallBatch(
    chunk: string[],
    detailsByAddress: Map<string, TokenDetailsBatch>,
  ): Promise<void> {
    const calls: Multicall3Call[] = [];
    for (const target of chunk) {
      calls.push(
        {
          target,
          allowFailure: true,
          callData: TOKEN_METADATA_INTERFACE.encodeFunctionData("symbol"),
        },
        {
          target,
          allowFailure: true,
          callData: TOKEN_METADATA_INTERFACE.encodeFunctionData("decimals"),
        },
      );
    }

    let rawReturnData: string;
    try {
      rawReturnData = await this.jsonRpcProviderManager.callProviderMethod<string>(
        "call",
        [
          {
            to: MULTICALL3_ADDRESS,
            data: MULTICALL_INTERFACE.encodeFunctionData("aggregate3", [calls]),
          },
          "latest",
        ],
        MULTICALL_CALL_TIMEOUT_MS,
      );
    } catch {
      this.logger.error("Multicall metadata request failed");
      await this.resolveViaSinglePath(chunk, detailsByAddress);
      return;
    }

    let results: { success: boolean; returnData: string }[];
    try {
      // decodeFunctionResult keeps the fragment's named tuple fields (success, returnData).
      results = MULTICALL_INTERFACE.decodeFunctionResult("aggregate3", rawReturnData)[0];
      if (results.length !== calls.length) throw new Error("Unexpected result count");
    } catch {
      this.logger.error("Malformed multicall response");
      await this.resolveViaSinglePath(chunk, detailsByAddress);
      return;
    }

    // Result order mirrors the interleaved [symbol, decimals] submissions per address.
    const fetched = new Map<string, Partial<TokenDetailsBatch>>();
    for (let index = 0; index < results.length; index++) {
      const address = chunk[Math.floor(index / 2)];
      const method: MetadataMethod = index % 2 === 0 ? "symbol" : "decimals";
      const partial = fetched.get(address) ?? {};
      fetched.set(address, partial);
      if (!results[index].success) continue;
      try {
        const decoded = TOKEN_METADATA_INTERFACE.decodeFunctionResult(
          method,
          results[index].returnData,
        );
        if (method === "symbol") partial.tokenSymbol = String(decoded[0]);
        else partial.tokenDecimals = Number(decoded[0]);
      } catch {
        // Undecodable payloads are treated like failed subcalls.
      }
    }

    const pendingFallback: string[] = [];
    for (const address of chunk) {
      const resolved = fetched.get(address);
      if (
        typeof resolved?.tokenSymbol === "string" &&
        typeof resolved?.tokenDecimals === "number"
      ) {
        detailsByAddress.set(address.toLowerCase(), resolved as TokenDetailsBatch);
        try {
          // New path only: a broken cache must not discard freshly decoded metadata.
          await this.saveIfImportant(address, resolved.tokenSymbol, resolved.tokenDecimals);
        } catch {
          this.logger.error("Token metadata cache write failed");
        }
      } else {
        pendingFallback.push(address);
      }
    }

    await this.resolveViaSinglePath(pendingFallback, detailsByAddress, true);
  }

  /**
   * Re-resolve given addresses through the untouched single-token path, preserving
   * its cache reads, cache writes, log messages, and error defaults.
   */
  private async resolveViaSinglePath(
    addresses: string[],
    detailsByAddress: Map<string, TokenDetailsBatch>,
    countOnlyLog = false,
  ): Promise<void> {
    if (!addresses.length) return;
    if (countOnlyLog) {
      this.logger.warn(`Falling back to single-token lookups for ${addresses.length} tokens`);
    }

    for (const address of addresses) {
      try {
        const contractERC20 = new Contract(
          address,
          erc20,
          this.jsonRpcProviderManager.getCurrentProvider(),
        );
        const details = await this.getTokenDetails(address, contractERC20);
        detailsByAddress.set(address.toLowerCase(), {
          tokenSymbol: details.tokenSymbol,
          tokenDecimals: Number(details.tokenDecimals),
        });
      } catch {
        detailsByAddress.set(address.toLowerCase(), {
          tokenSymbol: DEFAULT_TOKEN_SYMBOL,
          tokenDecimals: DEFAULT_TOKEN_DECIMALS,
        });
      }
    }
  }
}
