import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs';
const filePath = 'src/data/wallet-tracked/wallet.json';
let fileContent = '';

export default {
	data: new SlashCommandBuilder()
		.setName('analysewallet')
		.setDescription('Analyse a wallet performance')
		.addStringOption(option => option
			.setName('target')
			.setDescription('The wallet to analyse')
			.setRequired(true)),
		async execute(interaction) {
			const wallet = interaction.options.getString('target') ?? 'No wallet provided';
			
		},
};