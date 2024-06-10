import type { IGenericRepository } from "../genericRepository/IGenericRepository";
import { Wallet } from "./Wallet";

export interface IWalletRepository extends IGenericRepository<Wallet> {
  findOneByAddress(address: string): Promise<Wallet>;
}
