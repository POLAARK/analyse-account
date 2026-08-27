import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Wallet } from "../wallet/Wallet";
import { ColumnNumericTransformer, SCALE } from "../utils/moneyScale";

/**
 * Identifies the history of a wallet trading performance on a specific token
 */
@Entity()
export class TokenHistory {
  @ManyToOne((type) => Wallet)
  @JoinColumn({ name: "walletAddress" }) // 'walletAddress' is the column in TokenHistory
  wallet!: Wallet;

  @PrimaryColumn({ type: "varchar", length: 50 })
  tokenAddress!: string;

  @PrimaryColumn({ type: "varchar", length: 50 })
  walletAddress!: string;

  @Column({ type: "varchar", length: 20 })
  tokenSymbol!: string;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  EthGained!: bigint;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  EthSpent!: bigint;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  USDSpent!: bigint;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  USDGained!: bigint;

  @Column({ type: "int" })
  numberOfTx!: number;

  @Column({ type: "bigint" })
  lastTxBlock!: number;

  @Column({
    type: "decimal",
    precision: 38,
    scale: SCALE,
    transformer: new ColumnNumericTransformer(),
  })
  performanceUSD!: bigint;

  @Column({ type: "varchar", length: 5, nullable: true })
  pair!: string;
}
