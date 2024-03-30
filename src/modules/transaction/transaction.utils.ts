import { LogDescription } from "ethers";
import fs from "fs";
import { PerformanceMeasurer } from "../performance/PerformanceMeasurer";
import { EthOhlcRepository } from "../../repository/EthOhlcRepository";

type OhlcEntry = {
  timestamp_open: number;
  date_open: string;
  price_open: number;
  price_high: number;
  price_low: number;
  price_close: number;
};

//TODO : automatical OHCL data update from last timestamp;
export async function getETHtoUSD(
  ethOhlcRepository: EthOhlcRepository,
  valueInETH: number,
  timestamp: number
) {
  const perf = new PerformanceMeasurer();
  perf.start("getETHtoUSD");
  const currentOhlc = await ethOhlcRepository.findClosestRecord(timestamp);
  perf.stop("getETHtoUSD");
  const value: number =
    valueInETH * ((Number(currentOhlc.priceOpen) + Number(currentOhlc.priceClose)) / 2);
  return value;
}

export function determineTransactionType(
  accountAddress: string,
  parsedLog: LogDescription
): "IN" | "OUT" {
  if (parsedLog.args[0].toUpperCase() == accountAddress.toUpperCase()) {
    return "OUT";
  }
  if (parsedLog.args[1].toUpperCase() == accountAddress.toUpperCase()) {
    return "IN";
  }
  return;
}

export function BigIntDivisionForAmount(amount: bigint, decimals: bigint) {
  if (amount / decimals <= 1000000n) {
    return parseFloat((Number(amount / 10n ** 6n) / Number(decimals / 10n ** 6n)).toFixed(3));
  } else return amount / decimals;
}
