import { Account } from "./modules/account/Account.js";
import { TransactionStreamer } from "./modules/streamer/TransactionStreamer.js";
const account = new Account("0xee98c1feb5946b83ffcb787048c90dd392217be2");
const streamer = new TransactionStreamer([account]);
// await streamer.builtAccountTransactionHistory();
for (let transaction of account.transactionList) {
  if (transaction.blockNumber == 18985997) {
    const transactionTransferSummary = await account.getTransactionTransferSummary(transaction);
    await account.updateBalances({
      transferTxSummary: [...transactionTransferSummary],
    });
  }
}

// await streamer.builtAccountTransactionHistory();
// await account.getAccountTransactions();
// const transaction = account.getAccountTransaction(
//   "0xb4e671a38fad09e8f1d24c91509a6875ea02b332438b41383c74ec68e8bd9eb8"
// );
// await account.processTransaction(transaction);
