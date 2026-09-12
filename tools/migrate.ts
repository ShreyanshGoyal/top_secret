/** `npm run db:migrate` — applies ordered SQL migrations to the configured PostgreSQL database.
 * Requires DATABASE_URL. It fails clearly rather than pretending a schema exists.
 */
import { runMigrations, storeConfigFromEnvironment } from '@accord/store';

const config = storeConfigFromEnvironment();
const { appliedVersion } = await runMigrations(config);
process.stdout.write(`[accord] migrations applied; schema version ${appliedVersion}\n`);
