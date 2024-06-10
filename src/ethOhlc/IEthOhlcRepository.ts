import { EthOhlc } from "../ethOhlc/EthOhlc";
import { type IGenericRepository } from "../genericRepository/IGenericRepository";

export interface IEthOhlcRepository extends IGenericRepository<EthOhlc> {
  findClosestRecord(inputTimestamp: number): Promise<EthOhlc>;
  findLastRecordTimestamp(): Promise<number>;
}
