import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";
import { Logger } from "./logger/Logger";

const logger = new Logger();

config({ path: "src/../.env" });
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
if (!clientId) {
  throw new Error("Please provide CLIENT_ID");
}
if (!token) {
  throw new Error("Please provide DISCORD_TOKEN");
}
if (!guildId) {
  throw new Error("Please provide GUILD_ID");
}

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, "./discord");

const commandFiles = fs.readdirSync(foldersPath).filter((file) => file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  logger.info(filePath);
  const command = await import(filePath);
  // logger.info(command);
  if ("data" in command.default && "execute" in command.default) {
    commands.push(command.default.data.toJSON());
  } else {
    logger.info(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data: any = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    // .catch(() => {});
    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
