import { injectable } from "inversify";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import type { ITokenRepository } from "./ITokenRepository";
import { Token } from "./Token";

@injectable()
export class TokenRepository extends TypeOrmRepository<Token> implements ITokenRepository {
  constructor() {
    super(Token);
  }
  async findOneByAddress(address: string): Promise<Token | null> {
    return await this.findOneBy({ address: address });
  }
}
