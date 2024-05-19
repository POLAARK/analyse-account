export interface IEthOhlcService {
  fetchDataWithParams(url: string, params: any): Promise<any>;
  getEthOhlc(
    tokenAddress: string,
    poolAddress: string,
    startTimestamp?: number,
    endTimestamp?: number
  ): Promise<void>;
  getETHtoUSD(valueInETH: number, timestamp: number): Promise<number>;
}
