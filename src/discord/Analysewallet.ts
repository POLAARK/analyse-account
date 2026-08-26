import { ConfigObject } from "../config/Config";
import {
  AttachmentBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { isAddress } from "ethers";
import type { IEthOhlcService } from "../ethOhlc";
import { container } from "../ioc_container/container";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import type { IWalletRepository, IWalletService } from "../wallet";
import { TransactionStreamerService } from "../streamer/TransactionStreamerService";

const DEFAULT_ANALYSIS_PERIOD_SECONDS = (365 * 24 * 60 * 60) / 2;

export default {
  data: new SlashCommandBuilder()
    .setName("analysewallet")
    .setDescription("Analyse a wallet performance")
    .addStringOption((option) =>
      option.setName("target").setDescription("The wallet to analyse").setRequired(true),
    )
    .addNumberOption((option) =>
      option
        .setName("timestamp")
        .setDescription("Since when we cant to analyse this wallet timestamp")
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const ethOhlcService = container.get<IEthOhlcService>(SERVICE_IDENTIFIER.EthOhlcService);
    const walletRepository = container.get<IWalletRepository>(SERVICE_IDENTIFIER.WalletRepository);
    const walletService = container.get<IWalletService>(SERVICE_IDENTIFIER.WalletService);
    const streamer = container.get(TransactionStreamerService);

    const walletAddress = interaction.options.get("target", true).value;
    if (typeof walletAddress !== "string" || !isAddress(walletAddress)) {
      throw new Error("Wallet address must be a valid EVM address");
    }
    const timestamp =
      interaction.options.getNumber("timestamp") ??
      Math.trunc(Date.now() / 1000 - DEFAULT_ANALYSIS_PERIOD_SECONDS);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new Error("Analysis timestamp must be non-negative Unix seconds");
    }
    await interaction.reply("Analyse started");

    const configObject = new ConfigObject();
    if (!configObject.rpcConfigs) {
      throw new Error("Invalid config: rpcConfigs is required");
    }
    await ethOhlcService.getEthOhlc(
      configObject.rpcConfigs.tokenAddress,
      configObject.rpcConfigs.poolAddress,
    );
    await streamer.setWalletList([walletAddress]);
    await streamer.buildWalletTransactionHistory();
    await walletService.createWalletTradingHistory(walletAddress, timestamp, false);

    const wallet = await walletRepository.find({
      where: { address: walletAddress },
      relations: { tokenHistories: true },
    });

    if (wallet.length === 0) {
      throw Error("No wallet created for this walletAddress");
    }

    const walletData = JSON.stringify(wallet[0], null, 2);
    const attachment = new AttachmentBuilder(Buffer.from(walletData), {
      name: `${walletAddress}Data.json`,
    });

    await interaction.editReply({
      content: "Here is the analysis:",
      files: [attachment],
    });
  },
};
