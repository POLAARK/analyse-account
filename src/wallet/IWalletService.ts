import { Wallet } from "./Wallet";

export interface IWalletService {
  updateWalletTimestamps(timestamp: number, wallet: Wallet): Promise<void>;
  createWalletTradingHistory(
    address: string,
    timestamp: number,
    concurrent?: boolean
  ): Promise<void>;
  updateWalletSummary(wallet: Wallet): Promise<void>;
}
