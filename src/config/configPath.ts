import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function getRpcConfigPath(): string {
  return path.resolve(process.env.RPC_CONFIG_PATH ?? path.join(dirname, "configFile.json"));
}
