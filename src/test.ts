import { Account } from "./modules/account/Account.js";
import { TransactionStreamer } from "./modules/streamer/TransactionStreamer.js";
const account = new Account("0xee98c1feb5946b83ffcb787048c90dd392217be2");
const streamer = new TransactionStreamer([account]);
// await streamer.builtAccountTransactionHistory();
for (let transaction of account.transactionList) {
  if (transaction.blockNumber == 18932173) {
    const transactionTransferSummary = await account.getTransactionTransferSummary(transaction);
    await account.updateBalances({
      transferTxSummary: [...transactionTransferSummary],
    });
  }
}

// await streamer.builtAccountTransactionHistory();
// await account.getAccountTransactions();
// const transaction = account.getAccountTransaction(
//   "0xf18138bc0fbff1e5e92a614bad19720b574caee8d764c4dceac5173ff241c908"
// );
// await account.processTransaction(transaction);
