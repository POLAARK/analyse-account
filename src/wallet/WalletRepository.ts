import { inject, injectable } from "inversify";
import { DataSource } from "typeorm";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { IWalletRepository } from "./IWalletRepository";
import { Wallet } from "./Wallet";

@injectable()
export class WalletRepository extends TypeOrmRepository<Wallet> implements IWalletRepository {
  constructor(@inject(SERVICE_IDENTIFIER.DataSource) dataSource: DataSource) {
    super(Wallet, dataSource);
  }
  async findOneByAddress(address: string): Promise<Wallet> {
    return await this.findOneBy({ address: address });
  }
}
