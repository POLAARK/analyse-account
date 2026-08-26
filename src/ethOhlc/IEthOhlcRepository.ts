import { EthOhlc } from "../ethOhlc/ETHohlc";
import { type IGenericRepository } from "../genericRepository/IGenericRepository";

export interface IEthOhlcRepository extends IGenericRepository<EthOhlc> {
  findClosestRecord(inputTimestamp: number): Promise<EthOhlc>;
  findLastRecordTimestamp(): Promise<number>;
}
