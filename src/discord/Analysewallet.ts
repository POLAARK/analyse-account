import { ConfigObject } from "config/Config";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AccountService } from "../account/AccountService";
import { TransactionStreamer } from "../streamer/TransactionStreamer";
import { container } from "ioc_container/container";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { IEthOhlcRepository, IEthOhlcService } from "ethOhlc";
import { walletRepository } from "modules/repository/Repositories";
import { IWalletRepository } from "wallet";
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
    const account = new AccountService(String(walletAddress));

    const streamer = new TransactionStreamer([account]);

    const configObject = new ConfigObject(path.join(dirname, "../config/configFile.json"));

    await ethOhlcService.getEthOhlc(
      configObject.rpcConfigs.tokenAddress,
      configObject.rpcConfigs.poolAddress
    );

    await streamer.builtAccountTransactionHistory();
    await account.getAccountTradingHistory(timestamp);
    const wallet = await walletRepository.findOneBy({
      where: { address: walletAddress },
      relations: ["tokenHistories"],
    });

    const walletData = JSON.stringify(wallet, null, 2);

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
