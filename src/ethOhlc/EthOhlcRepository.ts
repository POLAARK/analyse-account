import { EthOhlc } from "ethOhlc/ETHohlc";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import { DataSource } from "typeorm";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { inject, injectable } from "inversify";
import { IEthOhlcRepository } from "./IEthOhlcRepository";

@injectable()
export class EthOhlcRepository extends TypeOrmRepository<EthOhlc> implements IEthOhlcRepository {
  constructor(@inject(SERVICE_IDENTIFIER.DataSource) dataSource: DataSource) {
    super(EthOhlc, dataSource);
  }

  async findClosestRecord(inputTimestamp: number): Promise<EthOhlc | undefined> {
    const closestRecord = await this.repository
      .createQueryBuilder("EthOhlc")
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
    const result = await this.repository
      .createQueryBuilder("ethOhlc")
      .select("ethOhlc.timestampOpen")
      .orderBy("ethOhlc.timestampOpen", "DESC")
      .getOne();
    return result?.timestampOpen;
  }
}
