import { Account } from "./modules/account/Account.js";
import { TransactionStreamer } from "./modules/streamer/TransactionStreamer.js";
const account = new Account("0x3682757ab9D9a1B98124f6b5907eBf44586EE813")

const streamer = new TransactionStreamer([account])
streamer.builtAccountTransactionHistory()
await account.getAccountTransactions();
// const transaction = account.getAccountTransaction('0xf18138bc0fbff1e5e92a614bad19720b574caee8d764c4dceac5173ff241c908')
// await account.processTransaction(transaction);