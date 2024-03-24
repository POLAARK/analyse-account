import { Networkish } from "ethers";

export type Config = {
  rpcConfigs: RpcConfig;
  // TBD
};

export type RpcConfig = {
  network: Networkish;
  urls: string[];
};
