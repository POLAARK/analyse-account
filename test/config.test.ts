import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ConfigObject } from "../src/config/Config";

test("loads a valid RPC configuration", () => {
  withConfig(
    {
      rpcConfigs: {
        network: "mainnet",
        urls: ["https://rpc.example.com"],
        tokenAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.equal(new ConfigObject(file).rpcConfigs?.network, "mainnet"),
  );
});

test("rejects malformed RPC URLs", () => {
  withConfig(
    {
      rpcConfigs: {
        network: "mainnet",
        urls: ["not-a-url"],
        tokenAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.throws(() => new ConfigObject(file), /must contain HTTP\(S\) URLs/),
  );
});

test("rejects malformed contract addresses", () => {
  withConfig(
    {
      rpcConfigs: {
        network: "mainnet",
        urls: ["https://rpc.example.com"],
        tokenAddress: "not-an-address",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.throws(() => new ConfigObject(file), /must be EVM addresses/),
  );
});

test("rejects credential-bearing RPC URLs", () => {
  withConfig(
    {
      rpcConfigs: {
        network: 1,
        urls: ["https://user:secret@rpc.example.com"],
        tokenAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.throws(() => new ConfigObject(file), /must contain HTTP\(S\) URLs/),
  );
});

test("rejects a missing network", () => {
  withConfig(
    {
      rpcConfigs: {
        urls: ["https://rpc.example.com"],
        tokenAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.throws(() => new ConfigObject(file), /network must be a name or chain ID/),
  );
});

test("rejects an invalid chain ID", () => {
  withConfig(
    {
      rpcConfigs: {
        network: -1,
        urls: ["https://rpc.example.com"],
        tokenAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        poolAddress: "0x4028daac072e492d34a3afdbef0ba7e35d8b55c4",
      },
    },
    (file) => assert.throws(() => new ConfigObject(file), /network must be a name or chain ID/),
  );
});

function withConfig(value: unknown, assertion: (file: string) => void): void {
  const directory = mkdtempSync(path.join(tmpdir(), "analyse-account-"));
  const file = path.join(directory, "config.json");
  try {
    writeFileSync(file, JSON.stringify(value));
    assertion(file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
