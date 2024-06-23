import { injectable } from "inversify";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import type { IWalletRepository } from "./IWalletRepository";
import { Wallet } from "./Wallet";

@injectable()
export class WalletRepository extends TypeOrmRepository<Wallet> implements IWalletRepository {
  constructor() {
    super(Wallet);
  }
  async findOneByAddress(address: string): Promise<Wallet | null> {
    return await this.findOneBy({ address: address });
  }
}
