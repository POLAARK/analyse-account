import { injectable, unmanaged } from "inversify";
import {
  type EntityTarget,
  type FindManyOptions,
  type FindOptionsWhere,
  type ObjectLiteral,
  Repository,
} from "typeorm";
import { type IGenericRepository } from "./IGenericRepository";
import { getAppDataSource } from "~/dataSource";

@injectable()
export class TypeOrmRepository<T extends ObjectLiteral> implements IGenericRepository<T> {
  repository: Repository<T>;
  constructor(@unmanaged() target: EntityTarget<T>) {
    this.repository = getAppDataSource().getRepository(target);
  }

  async save(entity: T): Promise<T> {
    return await this.repository.save<T>(entity);
  }

  async findOneBy(whereOptions: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
    return await this.repository.findOneBy(whereOptions);
  }

  async findAll(): Promise<T[]> {
    return await this.repository.find();
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
