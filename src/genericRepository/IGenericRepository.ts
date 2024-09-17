import type { FindManyOptions, FindOptionsWhere } from "typeorm";

// interfaces/IGenericRepository.ts
export interface IGenericRepository<T> {
  findOneBy(whereOptions: FindOptionsWhere<T>): Promise<T | null>;
  findAll(): Promise<T[]>;
  find(whereOptions: FindManyOptions<T>): Promise<T[] | undefined>;
  save(entity: T): Promise<T>;
  delete(id: number): Promise<void>;
}
