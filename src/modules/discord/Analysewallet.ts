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
import { walletRepository } from "modules/repository/Repositories";
import { logger } from "modules/logger/Logger";

export default {
  data: new SlashCommandBuilder()
    .setName("analysewallet")
    .setDescription("Analyse a wallet performance")
    .addStringOption((option) =>
      option.setName("target").setDescription("The wallet to analyse").setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("timestamp")
        .setDescription("Since when we cant to analyse this wallet timestamp")
        .setRequired(false)
    ),
  async execute(interaction: CommandInteraction) {
    const walletAddress = interaction.options.get("target", true).value;
    if (typeof walletAddress !== "string") {
      throw new Error("Wallet Address has to be a string");
    }
    const timestampValue = interaction.options.get("timestamp")?.value;
    const timestamp = Number(
      timestampValue
        ? timestampValue
        : Date.now() / 1000 - 365 * 24 * 60 * 60 + (365 * 24 * 60 * 60) / 2
    );
    await interaction.reply("Analyse started");
    const account = new Account(String(walletAddress));

    const streamer = new TransactionStreamer([account]);
    await streamer.builtAccountTransactionHistory();
    await account.getAccountTradingHistory(timestamp);
    const wallet = await walletRepository.findOne({
      where: { address: walletAddress },
      relations: ["tokenHistories"],
    });

    const walletData = JSON.stringify(wallet, null, 2);

    // Temp file path
    const filepath = path.join(__dirname, `${walletAddress}Data.json`);

    // Write data to the temp file
    fs.writeFileSync(filepath, walletData);

    // Create the attachment
    const attachment = new AttachmentBuilder(filepath, {
      name: `${walletAddress}Data.json`,
    });

    // Send the attachment in Discord
    await interaction.editReply({
      content: "Here is the analysis:",
      files: [attachment],
    });

    // Delete the temp file
    fs.unlinkSync(filepath);
  },
};
