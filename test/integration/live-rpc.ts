import "reflect-metadata";
import dotenv from "dotenv";
import path from "node:path";
import { getAppDataSource } from "../../src/dataSource";
import { container } from "../../src/ioc_container/container";
import SERVICE_IDENTIFIER from "../../src/ioc_container/identifiers";
import type { ITransactionRepository, ITransactionService } from "../../src/transaction";

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(".env"), quiet: true });
  const dataSource = getAppDataSource();
  await dataSource.initialize();
  try {
    const transactionService = container.get<ITransactionService>(
      SERVICE_IDENTIFIER.TransactionService,
    );
    const transactionRepository = container.get<ITransactionRepository>(
      SERVICE_IDENTIFIER.TransactionRepository,
    );
    const transaction = await transactionRepository.findOneBy({
      hash: "0xa7ce2bd6e006c7d093322be86e1923e646b47fffaff82e400e26a9aded51d310",
    });
    if (!transaction) throw new Error("No transaction found");

    const summary = await transactionService.getTransactionTransferSummaryFromLog(
      transaction,
      "0x42a1ef5ffdaf134eb958814e443db9c244375c8f",
    );
    console.log(summary);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
