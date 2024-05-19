import fs from "fs";
import path from "path";

const directories = [
  "src/constants",
  "src/ethOhlc",
  "src/genericRepository",
  "src/jsonRpcProvider",
  "src/logger",
  "src/token",
  "src/tokenHistory",
  "src/jsonRpcProvider",
  "src/transaction",
  "src/utils",
  "src/blockchainProvider",
  "src/wallet",
];

directories.forEach((directory) => {
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".ts") && file !== "index.ts");

  const exports = files
    .map((file) => {
      const importPath = `./${file.replace(".ts", "")}`;
      return `export * from '${importPath}';`;
    })
    .join("\n");

  fs.writeFileSync(path.join(directory, "index.ts"), exports, "utf8");
  console.log(`Generated index.ts for ${directory}`);
});
