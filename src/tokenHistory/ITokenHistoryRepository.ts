import { IGenericRepository } from "../genericRepository/IGenericRepository";
import { TokenHistory } from "./TokenHistory";
export interface ITokenHistoryRepository extends IGenericRepository<TokenHistory> {
  saveOrUpdateTokenHistory(entity: TokenHistory, maxRetries: number): Promise<TokenHistory>;
}
