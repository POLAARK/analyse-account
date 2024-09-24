// import { Client, Collection, Events, GatewayIntentBits, TextChannel } from "discord.js";
// import dotenv from "dotenv";
// import * as fs from "fs";
// import path from "path";
// import "reflect-metadata";
// import { ormConfig } from "./ormconfig";
// import { DataSource } from "typeorm";
// import { Logger } from "./logger";
// import type { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions.js";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// dotenv.config({ path: __dirname + "/../.env" });

// const logger = new Logger();
// export const appDataSource = new DataSource({
//   logging: true,
//   ...(ormConfig as MysqlConnectionOptions),
// });
// appDataSource
//   .initialize()
//   .then(async () => {
//     await appDataSource.synchronize().catch((error) => {
//       logger.error("Synchronize error : ");
//       logger.error(error);
//     });

//     const token: string | undefined = process.env.DISCORD_TOKEN;
//     if (!token) {
//       logger.error("No discord Token for the app");
//       throw new Error("No discord token provided ");
//     }
//     const client: any = new Client({
//       intents: [
//         GatewayIntentBits.Guilds,
//         GatewayIntentBits.GuildMessages,
//         GatewayIntentBits.MessageContent,
//         GatewayIntentBits.GuildMessageReactions,
//       ],
//     });

//     const channelId = process.env.CHANNEL_ID;

//     client.commands = new Collection();

//     const commandsPath = __dirname + "/discord/";
//     const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));

//     for (const file of commandFiles) {
//       const filePath = path.join(commandsPath, file);
//       const { default: command } = await import(`./discord/${file}`);

//       // Set a new item in the Collection with the key as the command name and the value as the exported module
//       if ("data" in command && "execute" in command) {
//         client.commands.set(command.data.name, command);
//       } else {
//         logger.info(
//           `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
//         );
//       }
//     }
//     client.on("ready", async () => {
//       const channel = client.channels.cache.get(channelId);
//       (channel as TextChannel).send("Connected");
//     });

//     client.on(Events.InteractionCreate, async (interaction: any) => {
//       if (!interaction.isChatInputCommand()) {
//         logger.info(interaction);
//         return;
//       }
//       const command = interaction.client.commands.get(interaction.commandName);

//       if (!command) {
//         console.error(`No command matching ${interaction.commandName} was found.`);
//         return;
//       }

//       try {
//         await command.execute(interaction);
//       } catch (error) {
//         console.error(error);
//         if (interaction.replied || interaction.deferred) {
//           await interaction.followUp({
//             content: "There was an error while executing this command!",
//             ephemeral: true,
//           });
//         } else {
//           await interaction.reply({
//             content: "There was an error while executing this command!",
//             ephemeral: true,
//           });
//         }
//       }
//     });

//     client.login(token);
//   })
//   .catch((error) => {
//     logger.error("Init error");
//     console.log(error);
//     if (error instanceof AggregateError) {
//       logger.error("AggregateError detected. Details:");
//       error.errors.forEach((err, index) => {
//         logger.error(`Error ${index + 1}:`, err);
//       });
//     } else {
//       logger.error(error);
//     }
//   });

import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  TextChannel,
  AttachmentBuilder,
} from "discord.js";
import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";
import "reflect-metadata";
import { ormConfig } from "./ormconfig";
import { DataSource } from "typeorm";
import { Logger } from "./logger";
import { fileURLToPath } from "url";
import { CommandInteraction } from "discord.js";
import { container } from "./ioc_container/container";
import type { IEthOhlcService } from "./ethOhlc";
import SERVICE_IDENTIFIER from "./ioc_container/identifiers";
import type { IWalletRepository, IWalletService } from "./wallet";
import { TransactionStreamerService } from "./streamer/TransactionStreamerService";
import type { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions.js";
import { ConfigObject } from "./config/Config";
const filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
const token: string | undefined = process.env.DISCORD_TOKEN;

if (!token) {
  console.log("No discord Token for the app");
  throw new Error("No discord token provided ");
}

const logger = new Logger();

export const appDataSource = new DataSource({
  logging: true,
  ...(ormConfig as MysqlConnectionOptions),
});

// Function to handle CLI mode
async function handleCliMode(walletAddress: string, timestamp: number) {
  try {
    // Get the services and repository from the continaer
    const ethOhlcService = container.get<IEthOhlcService>(SERVICE_IDENTIFIER.EthOhlcService);
    // TODO : Repository should not be accessed, we should acces it using the service layer
    const walletRepository = container.get<IWalletRepository>(SERVICE_IDENTIFIER.WalletRepository);
    const walletService = container.get<IWalletService>(SERVICE_IDENTIFIER.WalletService);
    const streamer = container.get(TransactionStreamerService);

    if (typeof walletAddress !== "string") {
      throw new Error("Wallet Address has to be a string");
    }

    logger.info(`Starting analysis for: ${walletAddress} from ${new Date(timestamp)}`);

    const configObject = new ConfigObject(path.join(__dirname, "./config/configFile.json"));
    if (!configObject.rpcConfigs) {
      throw new Error("Invalid config: rpcConfigs is required");
    }

    await ethOhlcService.getEthOhlc(
      configObject.rpcConfigs.tokenAddress,
      configObject.rpcConfigs.poolAddress
    );
    streamer.setWalletList([walletAddress]);
    // Create the transactionHistory for the wallet
    await streamer.buildWalletTransactionHistory();
    // Using the algorithm traduce the transaction history into a trading history
    await walletService.createWalletTradingHistory(walletAddress, timestamp, false);
    
    const wallet = await walletRepository.find({
      where: { address: walletAddress },
      relations: ["tokenHistories"],
    });

    const walletData = JSON.stringify(wallet, null, 2);
    console.log(walletData);
  } catch (error) {
    logger.error("Error during CLI mode execution:");
    logger.error(error);
  }
}

// Main initialization function
async function init() {
  // npm run prod address fromTimestamp --> activate CLI mode
  if (process.argv.length > 2) {
    const walletAddress = process.argv[2];
    const timestamp = process.argv[3]
      ? parseInt(process.argv[3], 10)
      : Math.trunc(Date.now() / 1000 - (365 * 24 * 60 * 60) / 2);
    console.log(walletAddress, timestamp);
    await handleCliMode(walletAddress, timestamp);
  } else {
    // If we don't run using CLI we run it using Discord
    const client: any = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    const channelId = process.env.CHANNEL_ID;

    client.commands = new Collection();

    const commandsPath = __dirname + "/discord/";
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const { default: command } = await import(`./discord/${file}`);

      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.info(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
    client.on("ready", async () => {
      const channel = client.channels.cache.get(channelId);
      (channel as TextChannel).send("Connected");
    });

    client.on(Events.InteractionCreate, async (interaction: any) => {
      if (!interaction.isChatInputCommand()) {
        logger.info(interaction);
        return;
      }
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        }
      }
    });

    client.login(token);
  }
}

appDataSource.initialize().then(async () => {
  await appDataSource.synchronize().catch((error: any) => {
    logger.error("Synchronize error : ");
    logger.error(error);
  });
  await init().catch((error) => {
    logger.error("Initialization error:");
    console.error(error);
  });
});
