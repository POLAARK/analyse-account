import { EthOhlc } from "../../entity/ETHohlc";
import * as fs from "fs";
import * as path from "path";
import { appDataSource } from "app.js";
import { Repository } from "typeorm";
import util from "util";
import stream from "stream";
import make from "stream-json";
import StreamArray from "stream-json/streamers/StreamArray.js";
import dotenv from "dotenv";
import { CustomError } from "modules/error/customError";
import { ERROR_FETCHING_DATA, ERROR_SAVING_ENTITY_IN_DATABASE } from "constants/errors";
import { logger } from "modules/logger/Logger";
import { EthOhlcRepository } from "../../repository/EthOhlcRepository";

const MAX_RECORDS_PER_REQUEST = 2500; // Assuming this is your limit
const SECONDS_PER_MINUTE = 60; // 60 seconds in a minute

export class TokenPriceService {
  ethOhlcRepository = new EthOhlcRepository(appDataSource);
  constructor() {
    appDataSource;
  }

  async processFile(filePath: string) {
    const ETHohlcRepository: Repository<EthOhlc> = appDataSource.getRepository(EthOhlc);
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    await util.promisify(stream.pipeline)(
      fileStream,
      StreamArray.withParser(),
      async function (parsedArrayEntriesIterable) {
        for await (const { key: arrIndex, value: arrElem } of parsedArrayEntriesIterable) {
          try {
            const ethohlc = new EthOhlc();
            ethohlc.timestampOpen = arrElem.timestamp_open;
            ethohlc.dateOpen = new Date(arrElem.date_open);
            ethohlc.priceOpen = arrElem.price_open;
            ethohlc.priceHigh = arrElem.price_high;
            ethohlc.priceLow = arrElem.price_low;
            ethohlc.priceClose = arrElem.price_close;
            await ETHohlcRepository.save(ethohlc);
          } catch (error) {
            console.error("Failed to process item:", error);
          }
        }
      }
    );

    console.log("All data has been processed and saved.");
  }

  async getTokenPriceHistory(
    tokenAddress: string,
    poolAddress: string,
    startTimestamp?: number,
    endTimestamp?: number
  ) {
    const syveKey = process.env.SYVE_API_KEY;
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

      const response = await this.getData(url, params);
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

  async getData(url: string, params: any): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${query}`;

    try {
      const response = await fetch(fullUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error(`API request failed with status code ${response.status}`);
      }
      return response.json();
    } catch (error) {
      logger.error("Error fetching data:", error);
      throw new CustomError(ERROR_FETCHING_DATA, `Error fetching ohlc data using syve Ai`);
    }
  }
}
