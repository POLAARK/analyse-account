import { ERROR_SAVING_ENTITY_IN_DATABASE } from "constants/errors";
import { CustomError } from "modules/error/customError";
import { logger } from "modules/logger/Logger";
import { DataSource, Repository } from "typeorm";
import { EntityTarget } from "typeorm/common/EntityTarget";

export class GenericRepository<T> extends Repository<T> {
  constructor(target: EntityTarget<T>, dataSource: DataSource) {
    super(target, dataSource.createEntityManager());
  }

  async saveEntity(entity: T): Promise<T> {
    try {
      const savedEntity = await this.save<T>(entity);
      return savedEntity;
    } catch (err) {
      logger.error(err);
      throw new CustomError(
        ERROR_SAVING_ENTITY_IN_DATABASE,
        `Error saving entity ${this.target} in DB`, // To test
        err
      );
    }
  }
}
