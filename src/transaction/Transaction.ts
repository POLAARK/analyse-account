import { Entity, Column, Index, PrimaryColumn, ManyToOne } from "typeorm";
import { Wallet } from "../wallet/Wallet";

@Entity()
export class Transaction {
  @PrimaryColumn({ type: "varchar", length: 255, nullable: false })
  hash!: string;

  @Index()
  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  wallet!: Wallet;

  @Column("bigint")
  blockNumber!: number;

  @Column("bigint")
  timeStamp!: number;

  @Index()
  @Column({ type: "varchar", length: 50, nullable: true })
  fromAddress!: string;

  @Index()
  @Column({ type: "varchar", length: 50, nullable: true })
  toAddress!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  value!: string;

  @Column("bigint")
  gas!: number;

  @Column({ type: "text", nullable: true })
  input!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  contractAddress!: string;
}
