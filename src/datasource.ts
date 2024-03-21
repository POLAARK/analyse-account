import "reflect-metadata";
import { ormConfig } from "ormconfig";
import { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions";
import { DataSource } from "typeorm";
import { logger } from "./modules/logger/Logger";
import { Transaction } from "./entity/Transaction";
import { Token } from "./entity/Token";

export const appDataSource = new DataSource({ ...(ormConfig as MysqlConnectionOptions) });

await appDataSource
  .initialize()
  .then(async () => {
    logger.info("Data Source have been initialize");
    await appDataSource.synchronize().then(() => {
      logger.info("Data tables have been synchronized ");
    });
  })
  .catch((error) => {
    logger.error("Init error : ");
    logger.error(error);
  });
