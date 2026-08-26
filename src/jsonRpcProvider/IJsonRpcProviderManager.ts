import { JsonRpcProvider } from "ethers";

export interface IJsonRpcProviderManager {
  callProviderMethod<T>(methodName: string, args: unknown[], timeout?: number): Promise<T>;
  getCurrentProvider(): JsonRpcProvider;
}
