import { Contract } from "ethers";

export interface ITokenService {
  getTokenDetails(
    address: string,
    contractERC20: Contract
  ): Promise<{ tokenSymbol: string; tokenDecimals: bigint }>;
}
