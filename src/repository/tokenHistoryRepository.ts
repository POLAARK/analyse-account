import { Token } from "entity/Token";
import { TokenHistory } from "entity/TokenHistory";
import { CustomError } from "modules/error/customError";
import { logger } from "modules/logger/Logger";
import { DataSource } from "typeorm";
import { GenericRepository } from "./genericRepository";
import { ERROR_SAVING_ENTITY_IN_DATABASE } from "constants/errors";

export class TokenHistoryRepository extends GenericRepository<TokenHistory> {
  // Assuming you have a predefined data source like `appDataSource`
  constructor(private dataSource: DataSource) {
    super(TokenHistory, dataSource);
  }

  async saveOrUpdateTokenHistory(entity: TokenHistory, maxRetries = 3): Promise<TokenHistory> {
    let attempts = 1;
    while (attempts < maxRetries) {
      try {
        const existingEntity = await this.findOne({
          where: {
            tokenAddress: entity.tokenAddress,
            walletAddress: entity.walletAddress,
          },
        });

        if (existingEntity) {
          // Update the existing entity
          const updatedEntity = Object.assign(existingEntity, entity);
          return await this.saveEntity(updatedEntity);
        } else {
          // Insert new entity
          return await this.saveEntity(entity);
        }
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY" && attempts < maxRetries) {
          // Retry in case of a duplicate entry error
          logger.info(`Duplicate entry detected, retrying... (attempt ${attempts + 1})`);
          attempts++;
        } else {
          if (err instanceof CustomError) throw err;
          throw new CustomError(
            ERROR_SAVING_ENTITY_IN_DATABASE,
            `Error saving or updating entity ${this.target} in DB after ${attempts} attempts`,
            err
          );
        }
      }
    }

    throw new CustomError(
      ERROR_SAVING_ENTITY_IN_DATABASE,
      `Error saving or updating entity ${this.target} in DB after ${maxRetries} attempts`,
      new Error("Maximum retries reached")
    );
  }
}
