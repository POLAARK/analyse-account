import "reflect-metadata";
import { appDataSource } from "./app";
import { container } from "./ioc_container/container";
import SERVICE_IDENTIFIER from "./ioc_container/identifiers";
import type { ITransactionRepository, ITransactionService } from "./transaction";

appDataSource.initialize().then(async () => {
  await appDataSource.synchronize().catch((error) => {});

  // 0xc34cb409aad729bd8b05389ea8707c37b452cdbb9d3a413833001d4b96cf2f3f
  // const account = new Account("0x42a1ef5FfDaf134EB958814E443Db9c244375C8f");
  // const streamer = new TransactionStreamer([account]);
  const transactionService = container.get<ITransactionService>(
    SERVICE_IDENTIFIER.TransactionService
  );

  const transactionRepository = container.get<ITransactionRepository>(
    SERVICE_IDENTIFIER.TransactionRepository
  );
  // // TODO put this in repo
  const transaction = await transactionRepository.findOneBy({
    hash: "0xa7ce2bd6e006c7d093322be86e1923e646b47fffaff82e400e26a9aded51d310",
  });
  if (!transaction) {
    throw new Error("No transaction found.");
  }

  const transferSummaryFromLog = await transactionService.getTransactionTransferSummaryFromLog(
    transaction,
    "0x42a1ef5ffdaf134eb958814e443db9c244375c8f"
  );

  console.log(transferSummaryFromLog);
});
