import { Client, TextChannel, GatewayIntentBits, Events, Collection, CommandInteraction } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });
import * as fs from 'fs';
import path from 'path';


const token : string = process.env.DISCORD_TOKEN;
// Create a new Discord client
const client : any = new Client({intents : [GatewayIntentBits.Guilds]});

// The ID of the channel where the bot should write the message
const channelId = process.env.CHANNEL_ID;

client.commands = new Collection();

const commandsPath = "dist/modules/discord/";
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = (await import(`./modules/discord/${file}`))?.default;
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}
client.on('ready', async () => {
    const channel = client.channels.cache.get(channelId);
    (channel as TextChannel).send('Connected');
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()){
        console.log(interaction);
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
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(token);