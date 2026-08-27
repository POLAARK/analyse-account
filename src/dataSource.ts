import { DataSource } from "typeorm";
import { createOrmConfig } from "./ormconfig";
import { ConvertMoneyColumnsToDecimal1787789827578 } from "./migrations/1787789827578-ConvertMoneyColumnsToDecimal";

let appDataSource: DataSource | undefined;

export function getAppDataSource(): DataSource {
  appDataSource ??= new DataSource({
    logging: process.env.DB_LOGGING === "true",
    ...createOrmConfig(),
    migrations: [ConvertMoneyColumnsToDecimal1787789827578],
    // Migration is executed explicitly by the operator (TypeORM CLI or a
    // reviewed release step); the application never alters the schema.
    migrationsRun: false,
    migrationsTableName: "migrations",
  });
  return appDataSource;
}
