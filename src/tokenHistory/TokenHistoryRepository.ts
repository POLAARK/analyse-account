import { ERROR_SAVING_ENTITY_IN_DATABASE } from "../constants/errors";
import { CustomError } from "../error/customError";
import { inject, injectable } from "inversify";
import { Logger } from "../logger/Logger";
import { TokenHistory } from "../tokenHistory/TokenHistory";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { type ITokenHistoryRepository } from "./ITokenHistoryRepository";

@injectable()
export class TokenHistoryRepository
  extends TypeOrmRepository<TokenHistory>
  implements ITokenHistoryRepository
{
  // Assuming you have a predefined data source like `appDataSource`
  constructor(@inject(SERVICE_IDENTIFIER.Logger) private readonly logger: Logger) {
    super(TokenHistory);
  }

  async saveOrUpdateTokenHistory(entity: TokenHistory, maxRetries = 3): Promise<TokenHistory> {
    let attempts = 1;
    while (attempts < maxRetries) {
      try {
        //   const existingEntity = await this.repository.findOne({
        //     where: {
        //       tokenAddress: entity.tokenAddress,
        //       walletAddress: entity.walletAddress,
        //     },
        //   });

        //   if (existingEntity) {
        //     // Update the existing entity
        //     const updatedEntity = Object.assign(existingEntity, entity);
        return await this.repository.save(entity);
        // } else {
        //   // Insert new entity
        //   return await this.repository.save(entity);
        // }
      } catch (err: any) {
        if (err.code === "ER_DUP_ENTRY" && attempts < maxRetries) {
          // Retry in case of a duplicate entry error
          this.logger.info(`Duplicate entry detected, retrying... (attempt ${attempts + 1})`);
          attempts++;
        } else {
          if (err instanceof CustomError) throw err;
          throw new CustomError(
            ERROR_SAVING_ENTITY_IN_DATABASE,
            `Error saving or updating entity in DB after ${attempts} attempts`,
            err
          );
        }
      }
    }

    throw new CustomError(
      ERROR_SAVING_ENTITY_IN_DATABASE,
      `Error saving or updating entity in DB after ${maxRetries} attempts`,
      new Error("Maximum retries reached")
    );
  }

  async findAllByAddress(address: string): Promise<TokenHistory[]> {
    return await this.repository.find({
      where: { walletAddress: address },
    });
  }
}
