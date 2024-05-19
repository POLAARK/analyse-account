import { DataSource, FindManyOptions, FindOptionsWhere, Repository } from "typeorm";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { IGenericRepository } from "./IGenericRepository";
import { inject, injectable } from "inversify";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";

@injectable()
export class TypeOrmRepository<T> implements IGenericRepository<T> {
  repository: Repository<T>;
  constructor(
    target: EntityTarget<T>,
    @inject(SERVICE_IDENTIFIER.DataSource) private readonly dataSource: DataSource
  ) {
    this.repository = new Repository(target, dataSource.createEntityManager());
  }

  async save(entity: T): Promise<T> {
    return await this.repository.save<T>(entity);
  }

  async findOneBy(whereOptions: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T> {
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
