import { type TransferTransaction } from "../transaction";

export interface ITokenHistoryService {
  updateWalletTokenHistory(
    {
      transferTxSummary,
    }: {
      transferTxSummary: TransferTransaction[];
    },
    address: string
  ): Promise<void>;
}
