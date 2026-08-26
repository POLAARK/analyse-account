import type { DataSourceOptions } from "typeorm";
import { EthOhlc } from "./ethOhlc/ETHohlc";
import { Token } from "./token/Token";
import { TokenHistory } from "./tokenHistory/TokenHistory";
import { Transaction } from "./transaction/Transaction";
import { Wallet } from "./wallet/Wallet";

export function createOrmConfig(): DataSourceOptions {
  const port = Number(process.env.DB_PORT ?? "3306");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("DB_PORT must be a valid TCP port");
  }

  return {
    type: "mysql",
    host: process.env.DB_HOST ?? "127.0.0.1",
    port,
    username: requiredEnv("DB_USERNAME"),
    password: process.env.DB_PASSWORD ?? "",
    database: requiredEnv("DB_DATABASE"),
    entities: [EthOhlc, Token, TokenHistory, Transaction, Wallet],
    synchronize: false,
  };
}

function requiredEnv(name: "DB_USERNAME" | "DB_DATABASE"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
