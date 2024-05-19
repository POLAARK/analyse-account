import { JsonRpcProvider } from "ethers";

export interface IJsonRpcProviderManager {
  callProviderMethod<T>(methodName: string, args: any[], timeout?: number): Promise<T>;
  getCurrentProvider(): JsonRpcProvider;
}
