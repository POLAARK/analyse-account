import { DataSource } from "typeorm";
import { createOrmConfig } from "./ormconfig";

let appDataSource: DataSource | undefined;

export function getAppDataSource(): DataSource {
  appDataSource ??= new DataSource({
    logging: process.env.DB_LOGGING === "true",
    ...createOrmConfig(),
  });
  return appDataSource;
}
