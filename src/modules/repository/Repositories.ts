import { appDataSource } from "datasource";
import { Wallet } from "entity/Wallet";
import { Transaction } from "entity/Transaction";
import { Repository } from "typeorm";
import { TokenHistory } from "entity/TokenHistory";
import { Token } from "entity/Token";

export const walletRepository: Repository<Wallet> = appDataSource.getRepository(Wallet);
export const transactionRepository: Repository<Transaction> =
  appDataSource.getRepository(Transaction);
export const tokenHistoryRepository: Repository<TokenHistory> =
  appDataSource.getRepository(TokenHistory);
export const tokenRepository: Repository<Token> = appDataSource.getRepository(Token);
