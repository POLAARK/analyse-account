import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity()
export class Token {
  @PrimaryColumn({ type: "varchar", length: 255 })
  address: string;

  @Column({ type: "varchar", length: 20 })
  symbol: string;

  @Column({ type: "bigint" })
  decimals: bigint;
}
