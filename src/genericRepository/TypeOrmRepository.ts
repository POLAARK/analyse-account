import { injectable, unmanaged } from "inversify";
import { container } from "ioc_container/container";
import SERVICE_IDENTIFIER from "ioc_container/identifiers";
import { DataSource, FindManyOptions, FindOptionsWhere, Repository } from "typeorm";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { IGenericRepository } from "./IGenericRepository";

@injectable()
export class TypeOrmRepository<T> implements IGenericRepository<T> {
  repository: Repository<T>;
  dataSource = container.get<DataSource>(SERVICE_IDENTIFIER.DataSource);
  constructor(@unmanaged() target: EntityTarget<T>) {
    this.repository = new Repository(target, this.dataSource.createEntityManager());
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
