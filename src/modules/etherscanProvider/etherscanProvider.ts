import { EtherscanProvider, Networkish, BlockTag } from "ethers"; //^v6
import { fetchHttpJson } from "../../utils/fetchUtils";
import { logger } from "../logger/Logger";
import { EtherscanHistory, EtherscanTransaction } from "../../types/etherscanHistory";

export default class MyEtherscanProvider {
  #API_KEYS: string;
  #RETRY_COUNT: number = 3;
  #endpoint: string;
  constructor(apiKey?: string) {
    this.#API_KEYS = apiKey;
    this.#endpoint = "https://api.etherscan.io/";
    // const endpoints = fetchJsonFile('src/modules/api-endpoints/endpoints.json');
    // this.#endpoint = endpoints[nameNetwork];
    // this.#API_KEYS  = process.env['API_' + nameNetwork];
  }

  async getNormalTransactions(
    address: string,
    startBlock: number,
    endBlock: number = 99999999,
    offset: number = 2000
  ): Promise<EtherscanTransaction[]> {
    const count = 0;
    const parameters =
      `api` +
      `?module=account` +
      `&action=txlist` +
      `&address=${address}` +
      `&startblock=${startBlock}` +
      `&endblock=${endBlock}` +
      `&page=1` +
      `&offset=${offset}` +
      `&sort=asc` +
      `&apikey=${this.#API_KEYS}`;
    let response: any;
    try {
      response = await fetchHttpJson(this.#endpoint + parameters);
    } catch (error) {
      if (error.statusCode === 429 || error.message.includes("rate limit")) {
        logger.error("Rate limit reached, retrying in 15 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 900000));
        response = await fetchHttpJson(this.#endpoint + parameters);
      } else {
        throw Error(error);
      }
    }
    if (response.message == "No transactions found") {
      logger.error("No transaction found for this chain : " + this.#endpoint);
    } else {
      if (response.status !== "1" || response.message !== "OK") {
        logger.error(response);
        throw new Error(
          `error getNormalTransactions (network : ${this.#endpoint} / address : ${address}) -> ${
            response.message
          }`
        );
      }
    }

    return response.result;
  }

  async getInternalTransactions(
    address: string,
    startBlock: number,
    endBlock: number = 99999999,
    offset: number = 2000
  ): Promise<EtherscanTransaction[]> {
    const count = 0;
    const parameters =
      `api` +
      `?module=account` +
      `&action=txlistinternal` +
      `&address=${address}` +
      `&startblock=${startBlock}` +
      `&endblock=${endBlock}` +
      `&page=1` +
      `&offset=${offset}` +
      `&sort=asc` +
      `&apikey=${this.#API_KEYS}`;
    let response: any;
    try {
      response = await fetchHttpJson(this.#endpoint + parameters);
    } catch (error) {
      if (error.statusCode === 429 || error.message.includes("rate limit")) {
        logger.error("Rate limit reached, retrying in 15 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 900000));
        response = await fetchHttpJson(this.#endpoint + parameters);
      } else {
        throw Error(error);
      }
    }
    if (response.message == "No transactions found") {
      logger.error("No transaction found for this chain : " + this.#endpoint);
    } else {
      if (response.status !== "1" || response.message !== "OK") {
        logger.error(response);
        throw new Error(
          `error getInternalTransactions (network : ${this.#endpoint} / address : ${address}) -> ${
            response.message
          }`
        );
      }
    }
    return response.result;
  }

  async constructGlobalTransactionHistory(
    address: string,
    startBlock: number,
    endBlock: number = 99999999,
    offset: number = 2000
  ): Promise<EtherscanTransaction[]> {
    const normalTransactionhistory = await this.getNormalTransactions(
      address,
      startBlock,
      endBlock,
      offset
    );
    const internalTransactionhistory = await this.getInternalTransactions(
      address,
      startBlock,
      endBlock,
      offset
    );
    const accountTransactionHistory: EtherscanTransaction[] = [
      ...normalTransactionhistory,
      ...internalTransactionhistory,
    ].sort((a, b) => a.timeStamp - b.timeStamp);

    const uniqueTransactions: EtherscanTransaction[] = accountTransactionHistory.reduce(
      (acc, transaction) => {
        if (!acc.some((t) => t.hash === transaction.hash)) {
          acc.push(transaction);
        }
        return acc;
      },
      []
    );

    return uniqueTransactions;
  }
}
