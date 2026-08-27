import { Contract } from "ethers";

export interface TokenDetailsBatch {
  tokenSymbol: string;
  tokenDecimals: number;
}

export interface ITokenService {
  getTokenDetails(
    address: string,
    contractERC20: Contract,
  ): Promise<{ tokenSymbol: string; tokenDecimals: bigint }>;

  /**
   * Batched metadata resolution. Implementations dedupe input addresses and resolve
   * a complete entry (including error defaults) per address, keyed by lowercase address.
   * Optional so legacy stubs/consumers implementing the single-token surface keep working;
   * callers must feature-detect before use.
   */
  getTokenDetailsBatch?(addresses: string[]): Promise<Map<string, TokenDetailsBatch>>;
}
