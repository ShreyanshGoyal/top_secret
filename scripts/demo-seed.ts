import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAdminClickHouse } from './lib/clickhouse-admin.js';
import { fixedDemoClock, required, requireDemoMode } from './lib/env.js';

type AccountSeed = { datasetVersion: string; accountId: string; plan: 'free' | 'paid'; organizationType: 'university' | 'company' | 'personal'; universityVerified: boolean };
type RecordSeed = { datasetVersion: string; recordId: string; accountId: string; createdAt: string };
const root = new URL('../', import.meta.url);
async function json<T>(relative: string): Promise<T> { return JSON.parse(await readFile(fileURLToPath(new URL(relative, root)), 'utf8')) as T; }
function count(row: Record<string, unknown> | undefined, name: string): number { const value = row?.[name]; const parsed = typeof value === 'number' ? value : Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`ClickHouse returned an invalid ${name} count.`); return parsed; }

requireDemoMode(); fixedDemoClock();
const datasetVersion = required('ACCORD_DATASET_VERSION');
const accounts = await json<AccountSeed[]>('infra/clickhouse/seed/accounts.json');
const records = await json<RecordSeed[]>('infra/clickhouse/seed/records.json');
if (!accounts.every((row) => row.datasetVersion === datasetVersion) || !records.every((row) => row.datasetVersion === datasetVersion)) throw new Error('Seed JSON does not match ACCORD_DATASET_VERSION. Seed a new immutable version instead of mutating this fixture.');
if (!/^[A-Za-z0-9._:-]{1,120}$/.test(datasetVersion)) throw new Error('ACCORD_DATASET_VERSION is invalid.');
const client = createAdminClickHouse();
const before = (await client.query(`SELECT (SELECT count() FROM accounts WHERE dataset_version = '${datasetVersion}') AS accounts, (SELECT count() FROM records WHERE dataset_version = '${datasetVersion}') AS records`))[0];
const accountCount = count(before, 'accounts'); const recordCount = count(before, 'records');
if (accountCount !== 0 || recordCount !== 0) {
  if (accountCount === accounts.length && recordCount === records.length) { console.log(`Dataset ${datasetVersion} already exists with the expected 6 accounts and 19 records; it was not modified.`); process.exit(0); }
  throw new Error(`Dataset ${datasetVersion} is partially populated (${accountCount} accounts, ${recordCount} records). Refusing to mutate an immutable dataset.`);
}
await client.insert('accounts', accounts.map((row) => ({ dataset_version: row.datasetVersion, account_id: row.accountId, plan: row.plan, organization_type: row.organizationType, university_verified: row.universityVerified })));
await client.insert('records', records.map((row) => ({ dataset_version: row.datasetVersion, record_id: row.recordId, account_id: row.accountId, created_at: row.createdAt })));
const after = (await client.query(`SELECT (SELECT count() FROM accounts WHERE dataset_version = '${datasetVersion}') AS accounts, (SELECT count() FROM records WHERE dataset_version = '${datasetVersion}') AS records`))[0];
if (count(after, 'accounts') !== 6 || count(after, 'records') !== 19) throw new Error('Seed verification failed; fixture counts are not 6 accounts and 19 records.');
console.log(`Seeded immutable dataset ${datasetVersion}: 6 accounts, 19 records. Configure/restart bridge and worker explicitly to activate this version.`);
