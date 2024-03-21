import { Entity, Column, Index, PrimaryColumn } from "typeorm";

@Entity()
export class Transaction {
  @PrimaryColumn({ type: "varchar", length: 255 })
  hash: string;

  @Index()
  @Column({ type: "varchar", length: 255 })
  wallet_address: string;

  @Column("bigint")
  block_number: number;

  @Column("bigint")
  time_stamp: number;

  @Column("bigint")
  nonce: number;

  @Column({ type: "varchar", length: 255 })
  block_hash: string;

  @Column("int")
  transaction_index: number;

  @Index()
  @Column({ type: "varchar", length: 255 })
  from_address: string;

  @Index()
  @Column({ type: "varchar", length: 255 })
  to_address: string;

  @Column("bigint")
  value: number;

  @Column("bigint")
  gas: number;

  @Column("bigint")
  gas_price: number;

  @Column("tinyint")
  is_error: number;

  @Column("tinyint")
  txreceipt_status: number;

  @Column("text")
  input: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  contract_address: string;

  @Column("bigint")
  cumulative_gas_used: number;

  @Column("bigint")
  gas_used: number;

  @Column("bigint")
  confirmations: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  method_id: string;

  @Column({ type: "varchar", length: 60, nullable: true })
  function_name: string;
}
