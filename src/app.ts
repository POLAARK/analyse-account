import { Client, Collection, Events, GatewayIntentBits, TextChannel } from "discord.js";
import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";
import "reflect-metadata";
import { ormConfig } from "./ormconfig";

import { DataSource } from "typeorm";
import { Logger } from "./logger";
import type { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: __dirname + "/../.env" });

const logger = new Logger();
export const appDataSource = new DataSource({
  logging: true,
  ...(ormConfig as MysqlConnectionOptions),
});
appDataSource
  .initialize()
  .then(async () => {
    await appDataSource.synchronize().catch((error) => {
      logger.error("Synchronize error : ");
      logger.error(error);
    });

    const token: string | undefined = process.env.DISCORD_TOKEN;
    if (!token) {
      logger.error("No discord Token for the app");
      throw new Error("No discord token provided ");
    }
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
  })
  .catch((error) => {
    logger.error("Init error");
    console.log(error);
    if (error instanceof AggregateError) {
      logger.error("AggregateError detected. Details:");
      error.errors.forEach((err, index) => {
        logger.error(`Error ${index + 1}:`, err);
      });
    } else {
      logger.error(error);
    }
  });
