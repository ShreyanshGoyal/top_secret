import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
function git(args: string[]): string { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
const commitSha = git(['rev-parse', 'HEAD']); const dirty = git(['status', '--porcelain']).length > 0;
const lockfileSha256 = createHash('sha256').update(await (await import('node:fs/promises')).readFile('package-lock.json')).digest('hex');
const manifest = { schemaVersion: 1, repository: process.env.ACCORD_GITHUB_OWNER && process.env.ACCORD_GITHUB_REPO ? `${process.env.ACCORD_GITHUB_OWNER}/${process.env.ACCORD_GITHUB_REPO}` : null, commitSha, dirty, starterSha: '6443333e4b81fd6e21a4f531bdeee3a71eccd7b5', lockfileSha256, generatedAt: new Date().toISOString(), datasetVersion: process.env.ACCORD_DATASET_VERSION ?? null, asOf: process.env.ACCORD_DEMO_AS_OF ?? '2026-09-12T00:00:00.000Z', commands: [], scenarios: [], providers: { slack: 'pending', openai: 'pending', github: 'pending', clickhouse: 'pending', trigger: 'pending' }, deployment: { revision: null, tested: false }, pending: ['No live provider result has been recorded by this command.'], limitations: ['This manifest records current repository metadata only; it does not convert missing integration checks into passes.'] };
await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/review-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`Wrote sanitized review manifest for ${commitSha}. Live checks remain pending until recorded by their explicit tests.`);
