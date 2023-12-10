import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs';
import { TokenHistory } from 'src/model/historical-token-trading';
import { ApiDebank } from '../api-endpoints/ApiForkDebank.js';
// import { ApiDebank } from './modules/api-endpoints/ApiForkDebank.js';

export default {
	data: new SlashCommandBuilder()
		.setName('analysewallet')
		.setDescription('Analyse a wallet performance')
		.addStringOption(option => option
			.setName('target')
			.setDescription('The wallet to analyse')
			.setRequired(true))
		.addNumberOption(option => option
			.setName('timestamp')
			.setDescription('Since when we cant to analyse this wallet timestamp in sec')
			.setRequired(false)),
		async execute(interaction) {
			const wallet : string = interaction.options.getString('target');
			const timestamp : number =  interaction.options.getNumber('timestamp') ?? (Date.now() - 2629800000)/1000;
			await interaction.reply('Analyse started');
			const DebankAPi = new ApiDebank(wallet);
			let message : string = ''
			const token_history : TokenHistory = await DebankAPi.seeActions();
			for (let token of token_history.token_value_traded){
				message += token.token_name + 'on ' + token.chain +' : ' + token.value.toString() + '  ' + token.token_address + '\n'
			}	
			await interaction.reply(message);
		},
};