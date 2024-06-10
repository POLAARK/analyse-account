import { EthOhlc } from "../ethOhlc/EthOhlc";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import { DataSource } from "typeorm";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { inject, injectable } from "inversify";
import { type IEthOhlcRepository } from "./IEthOhlcRepository";
import { CustomError } from "~/error/customError";

@injectable()
export class EthOhlcRepository extends TypeOrmRepository<EthOhlc> implements IEthOhlcRepository {
  constructor() {
    super(EthOhlc);
  }

  async findClosestRecord(inputTimestamp: number): Promise<EthOhlc> {
    const closestRecord = await this.repository
      .createQueryBuilder("EthOhlc")
      .where("ethOhlc.timestampOpen > :lowerBound AND ethOhlc.timestampOpen < :upperBound", {
        lowerBound: inputTimestamp - 120,
        upperBound: inputTimestamp + 120,
      })
      .orderBy(`ABS(ethOhlc.timestampOpen - :inputTimestamp)`, "ASC")
      .setParameter("inputTimestamp", inputTimestamp)
      .getOne();
    if (!closestRecord) throw new CustomError("Can't find closest record on DB");
    return closestRecord;
  }
  async findLastRecordTimestamp(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder("ethOhlc")
      .select("ethOhlc.timestampOpen")
      .orderBy("ethOhlc.timestampOpen", "DESC")
      .getOne();
    if (!result) throw new CustomError("Can't find last record timestamp on DB");

    return result?.timestampOpen;
  }
}
