import {
  type ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  type InteractionReplyOptions,
  MessageFlags,
  type TextChannel,
} from "discord.js";
import dotenv from "dotenv";
import { isAddress } from "ethers";
import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "reflect-metadata";
import { ConfigObject } from "./config/Config";
import { getAppDataSource } from "./dataSource";
import type { IEthOhlcService } from "./ethOhlc";
import { container } from "./ioc_container/container";
import SERVICE_IDENTIFIER from "./ioc_container/identifiers";
import { Logger } from "./logger";
import { TransactionStreamerService } from "./streamer/TransactionStreamerService";
import type { IWalletRepository, IWalletService } from "./wallet";
import type { RpcConfig } from "./types/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = new Logger();

async function handleCliMode(
  walletAddress: string,
  timestampSeconds: number,
  rpcConfig: RpcConfig,
): Promise<void> {
  const ethOhlcService = container.get<IEthOhlcService>(SERVICE_IDENTIFIER.EthOhlcService);
  const walletRepository = container.get<IWalletRepository>(SERVICE_IDENTIFIER.WalletRepository);
  const walletService = container.get<IWalletService>(SERVICE_IDENTIFIER.WalletService);
  const streamer = container.get(TransactionStreamerService);

  logger.info(`Starting wallet analysis from ${new Date(timestampSeconds * 1000).toISOString()}`);

  await ethOhlcService.getEthOhlc(rpcConfig.tokenAddress, rpcConfig.poolAddress);
  streamer.setWalletList([walletAddress]);
  await streamer.buildWalletTransactionHistory();
  await walletService.createWalletTradingHistory(walletAddress, timestampSeconds, false);

  const wallet = await walletRepository.find({
    where: { address: walletAddress },
    relations: { tokenHistories: true },
  });
  console.log(JSON.stringify(wallet, null, 2));
}

async function runDiscordMode(token: string): Promise<void> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  const channelId = process.env.CHANNEL_ID;
  const commands = new Collection<string, DiscordCommand>();

  const commandsPath = path.join(dirname, "discord");
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = (await import(`./discord/${file}`)) as Record<string, unknown>;
    const command = commandModule.default;
    if (isDiscordCommand(command)) {
      commands.set(command.data.name, command);
    } else {
      logger.info(`[WARNING] ${filePath} is missing a required data or execute property.`);
    }
  }

  client.on("ready", async () => {
    if (!channelId) return;
    const channel = client.channels.cache.get(channelId);
    if (channel) await (channel as TextChannel).send("Connected");
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch {
      logger.error("Discord command failed");
      const response: InteractionReplyOptions = {
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) await interaction.followUp(response);
      else await interaction.reply(response);
    }
  });

  await client.login(token);
}

interface DiscordCommand {
  data: { name: string };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

function isDiscordCommand(value: unknown): value is DiscordCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { data?: unknown; execute?: unknown };
  return (
    !!candidate.data &&
    typeof candidate.data === "object" &&
    "name" in candidate.data &&
    typeof candidate.data.name === "string" &&
    typeof candidate.execute === "function"
  );
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const cliInput = parseCliInput(args);
  dotenv.config({ path: path.join(dirname, "../.env"), quiet: true });
  const discordToken = cliInput ? undefined : process.env.DISCORD_TOKEN;
  if (!cliInput && !discordToken) throw new Error("DISCORD_TOKEN is required in Discord mode");

  const rpcConfig = new ConfigObject().rpcConfigs;
  if (!rpcConfig) throw new Error("Invalid config: rpcConfigs is required");

  const dataSource = getAppDataSource();
  await dataSource.initialize();

  if (!cliInput) {
    await runDiscordMode(discordToken as string);
    return;
  }

  try {
    await handleCliMode(cliInput.walletAddress, cliInput.timestampSeconds, rpcConfig);
  } finally {
    await dataSource.destroy();
  }
}

function parseCliInput(args: string[]): { walletAddress: string; timestampSeconds: number } | null {
  if (args.length === 0) return null;

  const walletAddress = args[0];
  if (!isAddress(walletAddress)) throw new Error("Wallet address must be a valid EVM address");

  const timestampSeconds = args[1]
    ? Number(args[1])
    : Math.trunc(Date.now() / 1000 - (365 * 24 * 60 * 60) / 2);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds < 0) {
    throw new Error("Analysis timestamp must be non-negative Unix seconds");
  }
  return { walletAddress, timestampSeconds };
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  void main().catch(() => {
    logger.error("Initialization failed");
    process.exitCode = 1;
  });
}
