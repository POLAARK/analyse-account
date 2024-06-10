// services/TokenService.ts
import { inject, injectable } from "inversify";
import type { ITokenRepository } from "./ITokenRepository";
import type { ITokenService } from "./ITokenService";
import type { Token } from "./Token";
import type { ILogger } from "../logger/ILogger";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { Contract } from "ethers";

@injectable()
export class TokenService implements ITokenService {
  constructor(
    @inject(SERVICE_IDENTIFIER.TokenRepository) private tokenRepository: ITokenRepository,
    @inject(SERVICE_IDENTIFIER.Logger) private logger: ILogger
  ) {}

  async getTokenDetails(
    address: string,
    contractERC20: Contract
  ): Promise<{ tokenSymbol: string; tokenDecimals: bigint }> {
    try {
      let token: Token | undefined = await this.tokenRepository.findOneByAddress(address);

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
        if (tokenSymbol.includes("USD") || tokenSymbol.includes("ETH")) {
          token = {
            address: address,
            decimals: BigInt(tokenDecimals),
            symbol: tokenSymbol,
          };
          await this.tokenRepository.save(token);
        }

        return { tokenSymbol, tokenDecimals };
      }
    } catch (err: any) {
      // Handle errors that may occur during the fetch process
      if (err.code === "CALL_EXCEPTION") {
        this.logger.warn(`Call exception for token at address ${address}`);
      } else {
        this.logger.error(`Error fetching token details for address ${address}: ${err.message}`);
      }

      // Return default values in case of an error
      return {
        tokenSymbol: "ERR_TOKEN_SYMBOL",
        tokenDecimals: BigInt(18),
      };
    }
  }
}
