# analyse-account

Legacy TypeScript service for reconstructing EVM wallet transaction and token-trading history. It
can run as a CLI or Discord bot and stores results in MySQL through TypeORM.

> **Status:** experimental. Results can be incomplete: the analyser primarily interprets ERC-20
> `Transfer` events and relies on third-party RPC and market-data APIs. Do not use its output as
> financial advice.

## Setup

Requirements: Node.js 22.13 or newer (within Node 22), npm 10, and an existing MySQL schema.

```sh
nvm use
npm ci
cp .env.example .env
cp src/config/configFile.example.json src/config/configFile.json
npm run check
```

Fill in the ignored local configuration files. Never put credentials in tracked examples. The
database schema is **not** synchronized automatically; use reviewed migrations for schema changes.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run with source watching |
| `npm start -- <wallet> [unix-seconds]` | Run the CLI; omit arguments for Discord mode |
| `npm run deploy` | Deploy Discord commands |
| `npm run check` | Format check, lint, type-check, and hermetic tests |
| `npm run format` | Apply Biome formatting |
| `npm run test:integration` | Opt-in live MySQL/RPC diagnostic; requires local credentials/data |
| `npm run generate:index` | Regenerate barrel exports |

## Architecture

- `src/app.ts`: CLI/Discord bootstrap and data-source initialization.
- `src/*Service.ts`: application and external-provider behavior.
- `src/*Repository.ts` and entities: TypeORM persistence.
- `src/ioc_container`: Inversify dependency bindings.
- `downloadEthPrice`: standalone legacy Python data utilities.

Read [AGENTS.md](AGENTS.md) before changing code and [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Known debt

The code still has limited automated coverage, no checked-in TypeORM migrations, and legacy
floating-point monetary calculations. Keep live-network work out of the default test suite and
treat dependency upgrades as focused, reviewed changes.
