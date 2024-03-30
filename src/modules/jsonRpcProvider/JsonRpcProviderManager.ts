import { JsonRpcProvider, TransactionReceipt, ethers } from "ethers";
import { ConfigObject } from "../config/Config";
import path from "path";
import { fileURLToPath } from "url";
import { CustomError } from "modules/error/customError";
import {
  ALL_PROVIDERS_FAILED,
  ERROR_EXECUTING_RPC_REQUEST,
  METHOD_DOES_NOT_EXIST,
} from "constants/errors";
import { logger } from "modules/logger/Logger";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export class JsonRpcProviderManager {
  providers: JsonRpcProvider[] = [];
  currentProviderIndex: number;
  configObject = new ConfigObject(path.join(dirname, "../config/configFile.json"));

  constructor() {
    for (const url of this.configObject.rpcConfigs.urls) {
      this.providers.push(new JsonRpcProvider(url, this.configObject.rpcConfigs.network));
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
        if (
          methodName == "getTransactionReceipt" &&
          result instanceof TransactionReceipt &&
          !result.logs
        ) {
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
    logger.error("ARE WE HERRREEEE ? ");
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
                `${methodName} on provider ${JSON.stringify(provider)}`,
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
