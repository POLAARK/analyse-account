import {
  ALL_PROVIDERS_FAILED,
  ERROR_EXECUTING_RPC_REQUEST,
  INVALID_CONFIG,
  METHOD_DOES_NOT_EXIST,
} from "../constants/errors";
import { JsonRpcProvider, TransactionReceipt } from "ethers";
import { CustomError } from "../error/customError";
import { ConfigObject } from "../config/Config";
import type { IJsonRpcProviderManager } from "./IJsonRpcProviderManager";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import type { ILogger } from "../logger";

@injectable()
export class JsonRpcProviderManager implements IJsonRpcProviderManager {
  currentProviderIndex: number;
  configObject = new ConfigObject();
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
      this.rpcProviders.push({
        url,
        provider: provider,
        callNumber: 0,
      });
    }
    this.currentProviderIndex = 0;
  }

  async callProviderMethod<T>(methodName: string, args: unknown[], timeout = 1000): Promise<T> {
    let attempts = 0;
    while (attempts < this.rpcProviders.length) {
      try {
        const provider = this.rpcProviders[this.currentProviderIndex];
        this.logger.info(
          `Method ${methodName} called with provider ${this.currentProviderIndex} for the ${provider.callNumber} time`,
        );
        this.rpcProviders[this.currentProviderIndex].callNumber += 1;
        const result: T = await this.callProviderMethodWithTimeout<T>(
          provider.provider,
          methodName,
          args,
          timeout,
        );
        // We have to make sure we have a result
        if (methodName === "getTransactionReceipt" && !(result as TransactionReceipt).logs) {
          throw new Error("No logs for this receipt, retry");
        }
        return result;
      } catch (error) {
        if (error instanceof ProviderTimeoutError) {
          this.logger.error("TIMEOUT ERROR RETRY");
        } else {
          this.logger.error(`Provider call failed for ${methodName}`);
        }
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.rpcProviders.length;
        attempts++;
        await this.delay(100);
      }
    }
    throw new CustomError(ALL_PROVIDERS_FAILED, `All providers failed for method ${methodName}.`);
  }

  async callProviderMethodWithTimeout<T>(
    provider: JsonRpcProvider,
    methodName: string,
    args: unknown[],
    timeout = 3500,
  ): Promise<T> {
    const method: unknown = provider[methodName as keyof JsonRpcProvider];
    if (typeof method !== "function") {
      throw new CustomError(METHOD_DOES_NOT_EXIST, methodName);
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProviderTimeoutError(methodName)), timeout);
      const providerMethod = method as (...methodArguments: unknown[]) => T | PromiseLike<T>;
      Promise.resolve(providerMethod.apply(provider, args))
        .then(resolve)
        .catch(() => reject(new CustomError(ERROR_EXECUTING_RPC_REQUEST, methodName)))
        .finally(() => clearTimeout(timer));
    });
  }

  getCurrentProvider(): JsonRpcProvider {
    return this.rpcProviders[this.currentProviderIndex].provider;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class ProviderTimeoutError extends Error {
  constructor(methodName: string) {
    super(`Timeout occurred for ${methodName}`);
    this.name = "ProviderTimeoutError";
  }
}
