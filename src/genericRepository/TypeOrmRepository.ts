import { injectable, unmanaged } from "inversify";
import { container } from "../ioc_container/container";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import {
  DataSource,
  type EntityTarget,
  type FindManyOptions,
  type FindOptionsWhere,
  type ObjectLiteral,
  Repository,
} from "typeorm";
import { type IGenericRepository } from "./IGenericRepository";
import { CustomError } from "~/error/customError";

@injectable()
export class TypeOrmRepository<T extends ObjectLiteral> implements IGenericRepository<T> {
  repository: Repository<T>;
  dataSource = container.get<DataSource>(SERVICE_IDENTIFIER.DataSource);
  constructor(@unmanaged() target: EntityTarget<T>) {
    this.repository = new Repository(target, this.dataSource.createEntityManager());
  }

  async save(entity: T): Promise<T> {
    return await this.repository.save<T>(entity);
  }

  async findOneBy(whereOptions: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
    const res = await this.repository.findOneBy(whereOptions);
    // const entityClass = (this.repository.target as any).entityName;
    // if (!res) {
    //   throw new CustomError(`Can't find requested entity ${entityClass}`);
    // }
    return res;
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
