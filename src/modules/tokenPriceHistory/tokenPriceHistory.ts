import { EthOhlc } from "../../entity/ETHohlc";
import * as fs from "fs";
import * as path from "path";
import { appDataSource } from "app.js";
import { Repository } from "typeorm";
import util from "util";
import stream from "stream";
import make from "stream-json";
import StreamArray from "stream-json/streamers/StreamArray.js";
export class tokenPriceService {
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
}
