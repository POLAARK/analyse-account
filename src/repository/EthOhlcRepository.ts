import { EthOhlc } from "entity/ETHohlc";
import { GenericRepository } from "./genericRepository";
import { DataSource } from "typeorm";

export class EthOhlcRepository extends GenericRepository<EthOhlc> {
  // Assuming you have a predefined data source like `appDataSource`
  constructor(private dataSource: DataSource) {
    super(EthOhlc, dataSource);
  }

  async findClosestRecord(inputTimestamp: number): Promise<EthOhlc | undefined> {
    const closestRecord = await this.createQueryBuilder("entity")
      .where("entity.timestampColumn > :lowerBound AND entity.timestampColumn < :upperBound", {
        lowerBound: inputTimestamp - 60,
        upperBound: inputTimestamp + 60,
      })
      .orderBy(`ABS(entity.timestampColumn - :inputTimestamp)`, "ASC")
      .setParameter("inputTimestamp", inputTimestamp)
      .getOne();

    return closestRecord;
  }
}
