import { Wallet } from "./Wallet";

export interface IWalletService {
  updateWalletTimestamps(timestamp: number, wallet: Wallet);
  createWalletTradingHistory(address: string, timestamp: number): Promise<void>;
  updateWalletSummary(wallet: Wallet);
}
