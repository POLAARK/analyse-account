import {
  SlashCommandBuilder,
  AttachmentBuilder,
  Interaction,
  CommandInteraction,
} from "discord.js";
import * as fs from "fs";
import { Account } from "../account/Account";
import { TransactionStreamer } from "../streamer/TransactionStreamer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

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
  async execute(interaction: CommandInteraction) {
    const wallet = interaction.options.get("target", true).value;

    const timestampValue = interaction.options.get("timestamp")?.value;
    const timestamp = Number(
      timestampValue
        ? timestampValue
        : Date.now() / 1000 - 365 * 24 * 60 * 60 + (365 * 24 * 60 * 60) / 2
    );
    await interaction.reply("Analyse started");
    const account = new Account(String(wallet));

    const streamer = new TransactionStreamer([account]);
    streamer.builtAccountTransactionHistory();
    await account.getAccountTransactions(timestamp);

    const filename = `../../../data/histories/${wallet}History.json`;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const filepath = path.join(__dirname, filename);

    const attachment = new AttachmentBuilder(filepath, {
      name: `${wallet}History.json`,
    });

    await interaction.editReply({
      content: "Here is the analysis:",
      files: [attachment],
    });
  },
};
