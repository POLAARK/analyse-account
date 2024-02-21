import {
  CommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import * as fs from "fs";
import { TokenHistory } from "src/model/historical-token-trading";
import { Account } from "../account/Account";
import { TransactionStreamer } from "../streamer/TransactionStreamer";
import path from "path";
// import { ApiDebank } from './modules/api-endpoints/ApiForkDebank.js';

export default {
  data: new SlashCommandBuilder()
    .setName("analysewallet")
    .setDescription("Analyse a wallet performance")
    .addStringOption((option) =>
      option
        .setName("target")
        .setDescription("The wallet to analyse")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("timestamp")
        .setDescription("Since when we cant to analyse this wallet timestamp")
        .setRequired(false)
    ),
  async execute(interaction) {
    const wallet: string = interaction.options.getString("target");
    const timestamp: number =
      interaction.options.getNumber("timestamp") ??
      Date.now() / 1000 - 365 * 24 * 60 * 60 + (365 * 24 * 60 * 60) / 2;
    await interaction.reply("Analyse started");
    const account = new Account(wallet);

    const streamer = new TransactionStreamer([account]);
    streamer.builtAccountTransactionHistory(timestamp);
    const walletBalanceHistory = account.getAccountTransactions();

    const jsonString = JSON.stringify(this.data, null, 2);

    const filename = `${this.address}_analysis.json`;
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, jsonString);

    const attachment = new AttachmentBuilder(filepath, { name: filename });

    await interaction.reply({
      content: "Here is the analysis:",
      files: [attachment],
    });

    fs.unlinkSync(filepath);
    await interaction.reply(walletBalanceHistory);
  },
};
