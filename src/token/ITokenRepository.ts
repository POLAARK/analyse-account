import { type IGenericRepository } from "../genericRepository/IGenericRepository";
import { Token } from "./Token";

export interface ITokenRepository extends IGenericRepository<Token> {
  findOneByAddress(address: string): Promise<Token>;
}
