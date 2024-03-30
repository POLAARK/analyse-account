import { EthOhlc } from "entity/ETHohlc";
import { GenericRepository } from "./genericRepository";
import { DataSource } from "typeorm";

export class EthOhlcRepository extends GenericRepository<EthOhlc> {
  // Assuming you have a predefined data source like `appDataSource`
  constructor(private dataSource: DataSource) {
    super(EthOhlc, dataSource);
  }

  async findClosestRecord(inputTimestamp: number): Promise<EthOhlc | undefined> {
    const closestRecord = await this.createQueryBuilder("EthOhlc")
      .where("ethOhlc.timestampOpen > :lowerBound AND ethOhlc.timestampOpen < :upperBound", {
        lowerBound: inputTimestamp - 120,
        upperBound: inputTimestamp + 120,
      })
      .orderBy(`ABS(ethOhlc.timestampOpen - :inputTimestamp)`, "ASC")
      .setParameter("inputTimestamp", inputTimestamp)
      .getOne();

    return closestRecord;
  }
  async findLastRecordTimestamp(): Promise<number | undefined> {
    const result = await this.createQueryBuilder("ethOhlc")
      .select("ethOhlc.timestampOpen")
      .orderBy("ethOhlc.timestampOpen", "DESC")
      .getOne();
    return result?.timestampOpen;
  }
}
