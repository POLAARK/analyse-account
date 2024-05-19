import { inject, injectable } from "inversify";
import { DataSource } from "typeorm";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { ITransactionRepository } from "./ITransactionRepository";
import { Transaction } from "./Transaction";

@injectable()
export class TransactionRepository
  extends TypeOrmRepository<Transaction>
  implements ITransactionRepository
{
  constructor(@inject(SERVICE_IDENTIFIER.DataSource) dataSource: DataSource) {
    super(Transaction, dataSource);
  }
}
