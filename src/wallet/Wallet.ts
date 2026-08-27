import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Transaction } from "../transaction/Transaction";
import { TokenHistory } from "../tokenHistory/TokenHistory";
import { ColumnNumericTransformer, SCALE } from "../utils/moneyScale";

@Entity()
export class Wallet {
  @PrimaryColumn({ type: "varchar", length: 50 })
  address!: string;

  @Column({ type: "bigint" })
  lastBlockUpdated!: number;

  @OneToMany(
    () => Transaction,
    (transaction) => transaction.wallet,
  )
  transactions!: Transaction[];

  @OneToMany(
    () => TokenHistory,
    (tokenHistory) => tokenHistory.wallet,
  )
  tokenHistories!: TokenHistory[];

  @Column({ type: "float" })
  numberOfTokensTraded!: number;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  performanceUSD!: bigint;

  @Column({ type: "int" })
  numberOfTxs!: number;

  @Column({ type: "bigint" })
  lastAnalysisTimestamp!: number;

  @Column({ type: "bigint" })
  startAnalysisTimestamp!: number;
}
