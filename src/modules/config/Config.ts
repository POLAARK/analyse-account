import { Config, RpcConfig } from "../../types/config";
import fs from "fs";
import path from "path";

export class ConfigObject {
  public rpcConfigs: RpcConfig;

  constructor(configFilePath: string) {
    this.createConfig(configFilePath);
  }

  private createConfig(configFilePath: string) {
    const configFile = fs.readFileSync(path.resolve(configFilePath), "utf8");
    let config: Config;
    try {
      config = JSON.parse(configFile);
    } catch (error) {
      throw new Error("Failed to parse config file");
    }
    this.validateConfig(config);
  }

  private validateConfig(config: Config): void {
    if (!config.rpcConfigs) {
      throw new Error("Invalid config: rpcConfigs is required");
    }
    this.rpcConfigs = config.rpcConfigs;
  }
}
