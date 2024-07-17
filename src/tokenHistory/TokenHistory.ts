import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Wallet } from "../wallet/Wallet";

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

  @Column({ type: "float" })
  EthGained!: number;

  @Column({ type: "float" })
  EthSpent!: number;

  @Column({ type: "float" })
  USDSpent!: number;

  @Column({ type: "float" })
  USDGained!: number;

  @Column({ type: "int" })
  numberOfTx!: number;

  @Column({ type: "bigint" })
  lastTxBlock!: number;

  @Column({ type: "float" })
  performanceUSD!: number;

  @Column({ type: "varchar", length: 5, nullable: true })
  pair!: string;
}
