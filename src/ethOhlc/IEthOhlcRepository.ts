import { EthOhlc } from "ethOhlc/ETHohlc";
import { IGenericRepository } from "genericRepository/IGenericRepository";

export interface IEthOhlcRepository extends IGenericRepository<EthOhlc> {
  findClosestRecord(inputTimestamp: number): Promise<EthOhlc | undefined>;
  findLastRecordTimestamp(): Promise<number | undefined>;
}
