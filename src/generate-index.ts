import fs from "node:fs";
import path from "node:path";

const directories = [
  "src/constants",
  "src/ethOhlc",
  "src/genericRepository",
  "src/jsonRpcProvider",
  "src/logger",
  "src/token",
  "src/tokenHistory",
  "src/transaction",
  "src/utils",
  "src/blockchainProvider",
  "src/wallet",
];
const checkOnly = process.argv.includes("--check");

directories.forEach((directory) => {
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".ts") && file !== "index.ts")
    .sort();

  const exports = files
    .map((file) => {
      const importPath = `./${file.replace(".ts", "")}`;
      return `export * from "${importPath}";`;
    })
    .join("\n");

  const indexPath = path.join(directory, "index.ts");
  const expected = `${exports}\n`;
  if (checkOnly) {
    if (!fs.existsSync(indexPath) || fs.readFileSync(indexPath, "utf8") !== expected) {
      console.error(`${indexPath} is stale; run npm run generate:index`);
      process.exitCode = 1;
    }
  } else {
    fs.writeFileSync(indexPath, expected, "utf8");
  }
});
