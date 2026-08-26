import type { Config, RpcConfig } from "../types/config";
import { isAddress, Network } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { getRpcConfigPath } from "./configPath";

export class ConfigObject {
  public rpcConfigs: RpcConfig | undefined;

  constructor(configFilePath: string = getRpcConfigPath()) {
    this.createConfig(configFilePath);
  }

  private createConfig(configFilePath: string) {
    const configFile = fs.readFileSync(path.resolve(configFilePath), "utf8");
    let config: unknown;
    try {
      config = JSON.parse(configFile);
    } catch (_error) {
      throw new Error("Failed to parse config file");
    }
    this.validateConfig(config);
  }

  private validateConfig(config: unknown): asserts config is Config {
    if (!config || typeof config !== "object" || !("rpcConfigs" in config)) {
      throw new Error("Invalid config: rpcConfigs is required");
    }

    const rpcConfigs = config.rpcConfigs;
    if (!rpcConfigs || typeof rpcConfigs !== "object") {
      throw new Error("Invalid config: rpcConfigs must be an object");
    }

    const candidate = rpcConfigs as Record<string, unknown>;
    if (!isSupportedNetwork(candidate.network)) {
      throw new Error("Invalid config: rpcConfigs.network must be a name or chain ID");
    }
    if (
      !Array.isArray(candidate.urls) ||
      candidate.urls.length === 0 ||
      !candidate.urls.every(isHttpUrl)
    ) {
      throw new Error("Invalid config: rpcConfigs.urls must contain HTTP(S) URLs");
    }
    if (!isAddress(candidate.tokenAddress) || !isAddress(candidate.poolAddress)) {
      throw new Error("Invalid config: tokenAddress and poolAddress must be EVM addresses");
    }

    this.rpcConfigs = rpcConfigs as RpcConfig;
  }
}

function isSupportedNetwork(value: unknown): boolean {
  if (
    !(
      (typeof value === "string" && value.trim() === value && value.length > 0) ||
      (typeof value === "number" && Number.isSafeInteger(value))
    )
  ) {
    return false;
  }
  try {
    return Network.from(value).chainId > 0n;
  } catch {
    return false;
  }
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
    );
  } catch {
    return false;
  }
}
