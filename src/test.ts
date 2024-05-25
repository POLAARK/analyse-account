import "reflect-metadata";
import { appDataSource } from "app.js";
import { TransactionReceipt } from "ethers";
import { container } from "ioc_container/container.js";
import SERVICE_IDENTIFIER from "ioc_container/identifiers.js";
import { JsonRpcProviderManager } from "jsonRpcProvider/JsonRpcProviderManager.js";

appDataSource.initialize().then(async () => {
  await appDataSource.synchronize().catch((error) => {});
  const jsonRpcProviderManager = container.get<JsonRpcProviderManager>(
    SERVICE_IDENTIFIER.JsonRpcProviderManager
  );
  const transactionReceipt = await jsonRpcProviderManager.callProviderMethod<TransactionReceipt>(
    "getTransactionReceipt",
    ["0xc34cb409aad729bd8b05389ea8707c37b452cdbb9d3a413833001d4b96cf2f3f"],
    1000
  );
  console.log(transactionReceipt);
  console.log(transactionReceipt.logs);
  // 0xc34cb409aad729bd8b05389ea8707c37b452cdbb9d3a413833001d4b96cf2f3f
  // const account = new Account("0x42a1ef5FfDaf134EB958814E443Db9c244375C8f");
  // const streamer = new TransactionStreamer([account]);

  // // TODO put this in repo
  // const transaction = await account.getAccountTransaction(
  //   "0xc092ae71d39ab60bea06fc83e8490e9363b5bf6848b36811c36dceaadec3ce27".toLowerCase()
  // );
  // const transactionTransferSummary = await account.getTransactionTransferSummary(transaction);
  // await account.updateBalances({
  //   transferTxSummary: [...transactionTransferSummary],
  // });
});

// await streamer.builtAccountTransactionHistory();
// await account.getAccountTransactions();
// const transaction = account.getAccountTransaction(
//   "0xb4e671a38fad09e8f1d24c91509a6875ea02b332438b41383c74ec68e8bd9eb8"
// );
// await account.processTransaction(transaction);
