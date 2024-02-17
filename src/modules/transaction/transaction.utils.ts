import { LogDescription } from "ethers";
import fs from "fs";

type OhlcEntry = {
  timestamp_open: number;
  date_open: string;
  price_open: number;
  price_high: number;
  price_low: number;
  price_close: number;
};

export function getETHtoUSD(valueInETH: number, timestamp: number) {
  //TODO: implement the ETH to USD.
  const data = fs.readFileSync("src/../data/total_ohlc_ETH.json", "utf8");
  const entries: OhlcEntry[] = JSON.parse(data).reverse();

  let previousEntry: OhlcEntry | null = null;

  for (const entry of entries) {
    if (entry.timestamp_open > timestamp) {
      return (
        valueInETH *
        ((previousEntry.price_open + previousEntry.price_close) / 2)
      );
    }
    previousEntry = entry;
  }
  return valueInETH * ((entries[-1].price_open + entries[-1].price_close) / 2);
}

export function determineTransactionType(
  accountAddress: string,
  parsedLog: LogDescription
): "IN" | "OUT" {
  if (parsedLog.args[0] == accountAddress) {
    return "OUT";
  }
  if (parsedLog.args[1] == accountAddress) {
    return "IN";
  }
  return;
}

export function BigIntDivisionForAmount(amount: bigint, decimals: bigint) {
  if (amount / decimals <= 1000000n) {
    return parseFloat(
      (Number(amount / 10n ** 6n) / Number(decimals / 10n ** 6n)).toFixed(3)
    );
  } else return amount / decimals;
}
