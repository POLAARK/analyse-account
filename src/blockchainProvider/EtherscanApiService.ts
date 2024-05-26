import { inject, injectable } from "inversify";
import { BlockchainTransaction } from "./BlockchainTypes";
import { fetchHttpJson } from "../utils/fetchUtils";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { ILogger } from "../logger/ILogger";
import { IBlockchainScanApiService } from "./IBlockchainScanApiService";
import dotenv from "dotenv";
@injectable()
export class EtherscanApiService implements IBlockchainScanApiService {
  #RETRY_COUNT: number = 3;
  #endpoint: string;
  #API_KEYS = process.env.ETHERSCAN_API_KEY;
  constructor(@inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger) {
    this.#endpoint = "https://api.etherscan.io/";
  }
  async getNormalTransactions(
    address: string,
    startBlock: number,
    endBlock: number = 99999999,
    offset: number = 2000
  ): Promise<BlockchainTransaction[]> {
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
      response = await fetchHttpJson(this.#endpoint + parameters, {}, this.logger);
    } catch (error) {
      if (error.statusCode === 429 || error.message.includes("rate limit")) {
        this.logger.error("Rate limit reached, retrying in 15 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 900000));
        response = await fetchHttpJson(this.#endpoint + parameters, {}, this.logger);
      } else {
        throw Error(error);
      }
    }
    if (response.message == "No transactions found") {
      this.logger.error("No transaction found for this chain : " + this.#endpoint);
    } else {
      if (response.status !== "1" || response.message !== "OK") {
        this.logger.error(response);
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
  ): Promise<BlockchainTransaction[]> {
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
      response = await fetchHttpJson(this.#endpoint + parameters, {}, this.logger);
    } catch (error) {
      if (error.statusCode === 429 || error.message.includes("rate limit")) {
        this.logger.error("Rate limit reached, retrying in 15 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 900000));
        response = await fetchHttpJson(this.#endpoint + parameters, {}, this.logger);
      } else {
        throw Error(error);
      }
    }
    if (response.message == "No transactions found") {
      this.logger.error("No transaction found for this chain : " + this.#endpoint);
    } else {
      if (response.status !== "1" || response.message !== "OK") {
        this.logger.error(response);
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
  ): Promise<BlockchainTransaction[]> {
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
    const accountTransactionHistory: BlockchainTransaction[] = [
      ...normalTransactionhistory,
      ...internalTransactionhistory,
    ].sort((a, b) => a.timeStamp - b.timeStamp);

    const uniqueTransactions: BlockchainTransaction[] = accountTransactionHistory.reduce(
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
