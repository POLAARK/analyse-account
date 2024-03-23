import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Wallet } from "./Wallet";

@Entity()
export class TokenHistory {
  @ManyToOne(() => Wallet, (wallet) => wallet.tokenHistories)
  @JoinColumn({ name: "walletAddress" })
  wallet: Wallet;

  @PrimaryColumn({ type: "varchar", length: 50 })
  tokenAddress: string;

  @PrimaryColumn()
  walletAddress: string;

  @Column({ type: "varchar", length: 20 })
  tokenSymbol: string;

  @Column({ type: "float" })
  EthGained: number;

  @Column({ type: "float" })
  EthSpent: number;

  @Column({ type: "float" })
  USDSpent: number;

  @Column({ type: "float" })
  USDGained: number;

  @Column({ type: "int" })
  numberOfTx: number;

  @Column({ type: "bigint" })
  lastTxBlock: number;

  @Column({ type: "float" })
  performanceUSD: number;

  @Column({ type: "varchar", length: 5, nullable: true })
  pair: string;
}
