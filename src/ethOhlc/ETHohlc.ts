import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity()
export class EthOhlc {
  @PrimaryColumn({ type: "bigint" })
  @Index()
  timestampOpen!: number;

  @Column({ type: "timestamp" })
  dateOpen!: Date;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  priceOpen!: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  priceHigh!: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  priceLow!: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  priceClose!: number;
}
