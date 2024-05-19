import {
  ALL_PROVIDERS_FAILED,
  ERROR_EXECUTING_RPC_REQUEST,
  INVALID_CONFIG,
  METHOD_DOES_NOT_EXIST,
} from "constants/errors";
import { JsonRpcProvider, TransactionReceipt } from "ethers";
import { CustomError } from "error/customError";
import { logger } from "logger/Logger";
import path from "path";
import { fileURLToPath } from "url";
import { ConfigObject } from "../config/Config";
import { IJsonRpcProviderManager } from "./IJsonRpcProviderManager";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export class JsonRpcProviderManager implements IJsonRpcProviderManager {
  providers: JsonRpcProvider[] = [];
  currentProviderIndex: number;
  configObject = new ConfigObject(path.join(dirname, "../config/configFile.json"));

  constructor() {
    if (!this.configObject.rpcConfigs.urls.length) {
      throw new CustomError(INVALID_CONFIG);
    }
    for (const url of this.configObject.rpcConfigs.urls) {
      let currentProvider = new JsonRpcProvider(url, this.configObject.rpcConfigs.network);
      console.log(currentProvider._getConnection());
      this.providers.push(currentProvider);
    }
    this.currentProviderIndex = 0;
  }

  async callProviderMethod<T>(methodName: string, args: any[], timeout = 1000): Promise<T> {
    let attempts = 0;
    while (attempts < this.providers.length) {
      try {
        const provider = this.providers[this.currentProviderIndex];
        const result: T = await this.callProviderMethodWithTimeout<T>(
          provider,
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
          // console.log("timeout on call jsonRpc method");
        } else {
          logger.error(error);
        }
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
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
        .catch((error) => {
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
    return this.providers[this.currentProviderIndex];
  }
}
