import { ConfigObject } from "../config/Config";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { IEthOhlcService } from "../ethOhlc";
import * as fs from "fs";
import { container } from "../ioc_container/container";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import path from "path";
import { fileURLToPath } from "url";
import type { IWalletRepository, IWalletService } from "../wallet";
import { TransactionStreamerService } from "../streamer/TransactionStreamerService";
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

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
    const ethOhlcService = container.get<IEthOhlcService>(SERVICE_IDENTIFIER.EthOhlcService);
    const walletRepository = container.get<IWalletRepository>(SERVICE_IDENTIFIER.WalletRepository);
    const walletService = container.get<IWalletService>(SERVICE_IDENTIFIER.WalletService);
    const streamer = container.get(TransactionStreamerService);

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

    const configObject = new ConfigObject(path.join(dirname, "../config/configFile.json"));
    if (!configObject.rpcConfigs) {
      throw new Error("Invalid config: rpcConfigs is required");
    }
    await ethOhlcService.getEthOhlc(
      configObject.rpcConfigs.tokenAddress,
      configObject.rpcConfigs.poolAddress
    );
    await streamer.setWalletList([walletAddress]);
    await streamer.buildWalletTransactionHistory();
    await walletService.createWalletTradingHistory(walletAddress, timestamp, false);

    const wallet = await walletRepository.find({
      where: { address: walletAddress },
      relations: ["tokenHistories"],
    });

    if (!wallet) {
      throw Error("No wallet created for this walletAddress");
    }

    const walletData = JSON.stringify(wallet[0], null, 2);

    const filepath = path.join(dirname, `${walletAddress}Data.json`);

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
