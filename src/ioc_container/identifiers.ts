const SERVICE_IDENTIFIER = {
  EthOhlcRepository: Symbol.for("IEthOhlcRepository"),
  DataSource: Symbol.for("Datasource"),
  EthOhlcService: Symbol.for("EthOhlcService"),
  JsonRpcProviderManager: Symbol.for("JsonRpcProviderManager"),
  TokenRepository: Symbol.for("TokenRepository"),
  Logger: Symbol.for("Logger"),
  TokenService: Symbol.for("TokenService"),
  TransactionService: Symbol.for("TransactionService"),
  TransactionRepository: Symbol.for("TransactionRepository"),
  TokenHistoryRepository: Symbol.for("TokenHistoryRepository"),
  EtherscanApiService: Symbol.for("EtherscanApiService"),
  WalletRepository: Symbol.for("WalletRepository"),
  TokenHistoryService: Symbol.for("TokenHistoryService"),
  WalletService: Symbol.for("WalletService"),
  TransactionStreamer: Symbol.for("TransactionStreamer"),
  RpcProviders: Symbol.for("RpcProviders"),
};

export default SERVICE_IDENTIFIER;
