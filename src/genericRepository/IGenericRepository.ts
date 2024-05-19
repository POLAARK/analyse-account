// interfaces/IGenericRepository.ts
export interface IGenericRepository<T> {
  findOneBy(whereOptions: any): Promise<T | undefined>;
  findAll(): Promise<T[]>;
  find(whereOptions: any): Promise<T[] | undefined>;
  save(entity: T): Promise<T>;
  delete(id: number): Promise<void>;
}
