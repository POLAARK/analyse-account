import { IBlockchainScanApiService, EtherscanApiService } from "blockchainProvider";
import { Container } from "inversify";
import { DataSource } from "typeorm";
import { appDataSource } from "../app";
import { EthOhlcRepository, EthOhlService, IEthOhlcRepository, IEthOhlcService } from "../ethOhlc";
import { IJsonRpcProviderManager, JsonRpcProviderManager } from "../jsonRpcProvider";
import { ILogger, Logger } from "../logger";
import { ITokenRepository, ITokenService, TokenRepository, TokenService } from "../token";
import { ITokenHistoryRepository, TokenHistoryRepository } from "../tokenHistory";
import {
  ITransactionRepository,
  ITransactionService,
  TransactionRepository,
  TransactionService,
} from "../transaction";
import SERVICE_IDENTIFIER from "./identifiers";
import { IWalletRepository, WalletRepository } from "wallet";

let container = new Container();
container.bind<IEthOhlcRepository>(SERVICE_IDENTIFIER.EthOhlcRepository).to(EthOhlcRepository);
container.bind<DataSource>(SERVICE_IDENTIFIER.DataSource).toConstantValue(appDataSource);
container.bind<IEthOhlcService>(SERVICE_IDENTIFIER.EthOhlcService).to(EthOhlService);
container
  .bind<IJsonRpcProviderManager>(SERVICE_IDENTIFIER.JsonRpcProviderManager)
  .to(JsonRpcProviderManager);
container.bind<ITokenRepository>(SERVICE_IDENTIFIER.TokenRepository).to(TokenRepository);
container.bind<ILogger>(SERVICE_IDENTIFIER.Logger).to(Logger);
container.bind<ITokenService>(SERVICE_IDENTIFIER.TokenService).to(TokenService);
container.bind<ITransactionService>(SERVICE_IDENTIFIER.TransactionService).to(TransactionService);

container
  .bind<ITransactionRepository>(SERVICE_IDENTIFIER.TransactionService)
  .to(TransactionRepository);

container
  .bind<ITokenHistoryRepository>(SERVICE_IDENTIFIER.TokenHistoryRepository)
  .to(TokenHistoryRepository);

container
  .bind<IBlockchainScanApiService>(SERVICE_IDENTIFIER.EtherscanApiService)
  .to(EtherscanApiService);

container.bind<IWalletRepository>(SERVICE_IDENTIFIER.WalletRepository).to(WalletRepository);

export { container };
