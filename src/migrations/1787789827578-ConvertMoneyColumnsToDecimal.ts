import type { MigrationInterface, QueryRunner } from "typeorm";

const TOKEN_HISTORY_MONEY_COLUMNS = ["EthGained", "EthSpent", "USDSpent", "USDGained"] as const;

export class ConvertMoneyColumnsToDecimal1787789827578 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `wallet` MODIFY COLUMN `performanceUSD` DECIMAL(38,18) NOT NULL",
    );
    for (const column of TOKEN_HISTORY_MONEY_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE \`token_history\` MODIFY COLUMN \`${column}\` DECIMAL(38,18) NOT NULL`,
      );
    }
    await queryRunner.query(
      "ALTER TABLE `token_history` MODIFY COLUMN `performanceUSD` DECIMAL(38,18) NOT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `wallet` MODIFY COLUMN `performanceUSD` FLOAT NOT NULL");
    for (const column of TOKEN_HISTORY_MONEY_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE \`token_history\` MODIFY COLUMN \`${column}\` FLOAT NOT NULL`,
      );
    }
    await queryRunner.query(
      "ALTER TABLE `token_history` MODIFY COLUMN `performanceUSD` FLOAT NOT NULL",
    );
  }
}
