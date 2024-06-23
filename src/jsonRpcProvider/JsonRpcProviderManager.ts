import {
  ALL_PROVIDERS_FAILED,
  ERROR_EXECUTING_RPC_REQUEST,
  INVALID_CONFIG,
  METHOD_DOES_NOT_EXIST,
} from "../constants/errors";
import { JsonRpcProvider, TransactionReceipt } from "ethers";
import { CustomError } from "../error/customError";
import path from "path";
import { fileURLToPath } from "url";
import { ConfigObject } from "../config/Config";
import type { IJsonRpcProviderManager } from "./IJsonRpcProviderManager";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import type { ILogger } from "../logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

@injectable()
export class JsonRpcProviderManager implements IJsonRpcProviderManager {
  currentProviderIndex: number;
  configObject = new ConfigObject(path.join(__dirname, "../config/configFile.json"));
  rpcProviders: { url: string; provider: JsonRpcProvider; callNumber: number }[] = [];
  constructor(@inject(SERVICE_IDENTIFIER.Logger) private readonly logger: ILogger) {
    if (
      (this.configObject.rpcConfigs && !this.configObject.rpcConfigs.urls.length) ||
      !this.configObject.rpcConfigs?.network
    ) {
      throw new CustomError(INVALID_CONFIG);
    }
    const network = this.configObject.rpcConfigs.network;
    for (const url of this.configObject.rpcConfigs.urls) {
      const provider = new JsonRpcProvider(url, network);
      this.rpcProviders.push({ url, provider, callNumber: 0 });
    }
    this.logger.info(this.rpcProviders);
    this.currentProviderIndex = 0;
  }

  async callProviderMethod<T>(methodName: string, args: any[], timeout = 1000): Promise<T> {
    let attempts = 0;
    while (attempts < this.rpcProviders.length) {
      try {
        const provider = this.rpcProviders[this.currentProviderIndex];
        this.logger.info(
          `Method : ${methodName} called with ${provider.url} for the ${provider.callNumber} time`
        );
        this.rpcProviders[this.currentProviderIndex].callNumber += 1;
        const result: T = await this.callProviderMethodWithTimeout<T>(
          provider.provider,
          methodName,
          args,
          timeout
        );
        // We have to make sure we have a result
        if (methodName == "getTransactionReceipt" && !(result as TransactionReceipt).logs) {
          throw new Error("No logs for this receipt, retry");
        }
        return result;
      } catch (error) {
        if (error == `timeout occured for ${methodName}`) {
          this.logger.error("TIMEOUT ERROR RETRY");
        } else {
          this.logger.error(error);
        }
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.rpcProviders.length;
        attempts++;
      }
    }
    throw new CustomError(ALL_PROVIDERS_FAILED, `All providers failed for method ${methodName}.`);
  }

  async callProviderMethodWithTimeout<T>(
    provider: JsonRpcProvider,
    methodName: string,
    args: any[],
    timeout = 3500
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutTriggered = false;
      const timer = setTimeout(() => {
        timeoutTriggered = true;
        reject(`timeout occured for ${methodName}`);
      }, timeout);

      const method = provider[methodName as keyof JsonRpcProvider] as Function;

      if (!method) {
        clearTimeout(timer);
        reject(new CustomError(METHOD_DOES_NOT_EXIST, `${methodName}`));
      }

      method
        .apply(provider, args)
        .then((result: T) => {
          if (!timeoutTriggered) {
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error: any) => {
          if (!timeoutTriggered) {
            clearTimeout(timer);
            reject(
              new CustomError(
                ERROR_EXECUTING_RPC_REQUEST,
                `${methodName} on provider ${JSON.stringify(provider._getConnection())}`,
                error
              )
            );
          }
        });
    });
  }

  getCurrentProvider(): JsonRpcProvider {
    return this.rpcProviders[this.currentProviderIndex].provider;
  }
}
