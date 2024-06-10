import type { BlockchainTransaction } from "./BlockchainTypes";

export interface IBlockchainScanApiService {
  getNormalTransactions(
    address: string,
    startBlock: number,
    endBlock?: number,
    offset?: number
  ): Promise<BlockchainTransaction[]>;

  constructGlobalTransactionHistory(
    address: string,
    startBlock: number,
    endBlock?: number,
    offset?: number
  ): Promise<BlockchainTransaction[]>;

  getInternalTransactions(
    address: string,
    startBlock: number,
    endBlock: number,
    offset: number
  ): Promise<BlockchainTransaction[]>;
}
