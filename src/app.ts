import "reflect-metadata";
import { Client, TextChannel, GatewayIntentBits, Events, Collection } from "discord.js";
import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";
import { logger } from "./modules/logger/Logger";
import { Transaction } from "./entity/Transaction";
import { Token } from "./entity/Token";

import { fileURLToPath } from "url";
import { dirname } from "path";
import { appDataSource } from "datasource";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
appDataSource;
dotenv.config({ path: __dirname + "/../.env" });

const token: string = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error("No discord Token for the app");
  throw new Error("No discord token provided ");
}
const client: any = new Client({ intents: [GatewayIntentBits.Guilds] });

const channelId = process.env.CHANNEL_ID;

client.commands = new Collection();

const commandsPath = __dirname + "/modules/discord/";
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = (await import(`./modules/discord/${file}`))?.default;
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

client.on(Events.InteractionCreate, async (interaction) => {
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
