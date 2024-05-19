import { inject, injectable } from "inversify";
import { DataSource } from "typeorm";
import { TypeOrmRepository } from "../genericRepository/TypeOrmRepository";
import SERVICE_IDENTIFIER from "../ioc_container/identifiers";
import { ITokenRepository } from "./ITokenRepository";
import { Token } from "./Token";

@injectable()
export class TokenRepository extends TypeOrmRepository<Token> implements ITokenRepository {
  constructor(@inject(SERVICE_IDENTIFIER.DataSource) dataSource: DataSource) {
    super(Token, dataSource);
  }
  async findOneByAddress(address: string): Promise<Token> {
    return await this.findOneBy({ address: address });
  }
}
