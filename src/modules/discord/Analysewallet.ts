import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import * as fs from "fs";
import { TokenHistory } from "src/model/historical-token-trading";
import { Account } from "../account/Account";
import { TransactionStreamer } from "../streamer/TransactionStreamer";
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
      (Date.now() - 365 * 24 * 60 * 60 + (365 * 24 * 60 * 60) / 2) / 1000;
    await interaction.reply("Analyse started");
    const account = new Account(wallet);

    const streamer = new TransactionStreamer([account]);
    streamer.builtAccountTransactionHistory(timestamp);
    account.getAccountTransactions();
    let message: string = "";
    // const token_history: TokenHistory = await DebankAPi.seeActions();
    // for (let token of token_history.token_value_traded) {
    //   message +=
    //     token.token_name +
    //     "on " +
    //     token.chain +
    //     " : " +
    //     token.value.toString() +
    //     "  " +
    //     token.token_address +
    //     "\n";
    // }
    await interaction.reply(message);
  },
};

// const account = new Account("");

// const streamer = new TransactionStreamer([account]);
// await streamer.builtAccountTransactionHistory()
// await account.getAccountTransactions();
