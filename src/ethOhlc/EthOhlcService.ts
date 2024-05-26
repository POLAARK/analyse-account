import { appDataSource } from "app.js";
import { ERROR_FETCHING_DATA, ERROR_SAVING_ENTITY_IN_DATABASE } from "constants/errors";
import { CustomError } from "error/customError";
import { IEthOhlcRepository } from "ethOhlc";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { ILogger } from "logger";
import { EthOhlc } from ".";
import { IEthOhlcService } from "./IEthOhlcService";
import { PerformanceMeasurer } from "performance/PerformanceMeasurer";

const MAX_RECORDS_PER_REQUEST = 2500; // Assuming this is your limit
const SECONDS_PER_MINUTE = 60; // 60 seconds in a minute

@injectable()
export class EthOhlService implements IEthOhlcService {
  constructor(
    @inject(SERVICE_IDENTIFIER.EthOhlcRepository)
    private readonly ethOhlcRepository: IEthOhlcRepository,
    @inject(SERVICE_IDENTIFIER.Logger)
    private readonly logger: ILogger
  ) {
    appDataSource;
  }

  async getETHtoUSD(valueInETH: number, timestamp: number) {
    const perf = new PerformanceMeasurer();
    perf.start("getETHtoUSD");
    const currentOhlc = await this.ethOhlcRepository.findClosestRecord(timestamp);
    perf.stop("getETHtoUSD");
    const value: number =
      valueInETH * ((Number(currentOhlc.priceOpen) + Number(currentOhlc.priceClose)) / 2);
    return value;
  }

  async getEthOhlc(
    tokenAddress: string,
    poolAddress: string,
    startTimestamp?: number,
    endTimestamp?: number
  ): Promise<void> {
    const syveKey = process.env.SYVE_API_KEY;
    console.log("Here");

    let current_start = startTimestamp
      ? startTimestamp
      : await this.ethOhlcRepository.findLastRecordTimestamp();
    const current_end = endTimestamp ? endTimestamp : new Date().getTime();

    const base_params = {
      key: syveKey,
      token_address: tokenAddress,
      pool_address: poolAddress,
      price_type: "price_token_usd_robust_tick_1",
      interval: "1m",
      max_size: "2500",
    };

    while (current_start < current_end) {
      const next_end = Math.min(
        current_start + MAX_RECORDS_PER_REQUEST * SECONDS_PER_MINUTE,
        current_end
      );
      let alreadySaved = false;
      const url = "https://api.syve.ai/v1/price/historical/ohlc";
      const params = {
        ...base_params,
        from_timestamp: current_start.toString(),
        until_timestamp: next_end.toString(),
      };

      const response = await this.fetchDataWithParams(url, params);
      const data = response["data"];

      for (const arrElem of data) {
        try {
          const ethohlc = new EthOhlc();
          ethohlc.timestampOpen = arrElem.timestamp_open;
          ethohlc.dateOpen = new Date(arrElem.date_open);
          ethohlc.priceOpen = arrElem.price_open;
          ethohlc.priceHigh = arrElem.price_high;
          ethohlc.priceLow = arrElem.price_low;
          ethohlc.priceClose = arrElem.price_close;
          await this.ethOhlcRepository.save(ethohlc);
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY") {
            alreadySaved = true;
            break;
          }
          throw new CustomError(
            ERROR_SAVING_ENTITY_IN_DATABASE,
            `can't save ETHohlc in database for entry ${arrElem.timestamp_open}`,
            error
          );
        }
      }

      if (alreadySaved) break;

      current_start = next_end;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("end saved data");
    console.log(current_start);
    return;
  }

  async fetchDataWithParams(url: string, params: any): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${query}`;

    try {
      const response = await fetch(fullUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error(`API request failed with status code ${response.status}`);
      }
      return response.json();
    } catch (error) {
      this.logger.error("Error fetching data:", error);
      throw new CustomError(ERROR_FETCHING_DATA, `Error fetching ohlc data using syve Ai`);
    }
  }
}
