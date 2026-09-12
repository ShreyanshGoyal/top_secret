/**
 * Setup Scenario Patch Assets for Accord
 * Generates the 8 canonical scenario patch directories in fixtures/retention-app/scenarios/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRetentionPolicy,
  computeSourcePolicyHash,
  GENERATOR_VERSION
} from '@accord/retention-fixture';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseDir = resolve(__dirname, '../scenarios');

const baselinePolicy = {
  schemaVersion: 1,
  defaultDays: 30,
  rules: []
};

const targetOverridePolicy = {
  schemaVersion: 1,
  defaultDays: 30,
  rules: [
    {
      id: 'verified-university-free',
      scope: {
        plans: ['free'],
        organizationTypes: ['university'],
        universityVerified: [true]
      },
      days: 90
    }
  ]
};

const overbroadPolicy = {
  schemaVersion: 1,
  defaultDays: 90,
  rules: []
};

function writeEnvelope(policyObj: any, sourceForHash = policyObj) {
  const parsed = parseRetentionPolicy(policyObj);
  const sourceHash = computeSourcePolicyHash(parseRetentionPolicy(sourceForHash));
  return JSON.stringify({
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: sourceHash,
    policy: parsed
  }, null, 2) + '\n';
}

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

// 1. Baseline
ensureDir(resolve(baseDir, 'baseline/policy'));
ensureDir(resolve(baseDir, 'baseline/generated'));
writeFileSync(resolve(baseDir, 'baseline/policy/retention.idl.json'), JSON.stringify(baselinePolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'baseline/generated/retention-policy.json'), writeEnvelope(baselinePolicy), 'utf8');

// 2. Override
ensureDir(resolve(baseDir, 'override/policy'));
ensureDir(resolve(baseDir, 'override/generated'));
writeFileSync(resolve(baseDir, 'override/policy/retention.idl.json'), JSON.stringify(targetOverridePolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'override/generated/retention-policy.json'), writeEnvelope(targetOverridePolicy), 'utf8');

// 3. UI-only
ensureDir(resolve(baseDir, 'ui-only/src'));
const uiDisplay = `import type { AccountRecord } from '@accord/retention-fixture';

export function getRetentionPolicyDisplay(account: AccountRecord): string {
  if (account.plan === 'free' && account.organizationType === 'university' && account.universityVerified) {
    return '90-day retention policy for verified university free accounts';
  }
  return 'Standard 30-day retention policy';
}
`;
writeFileSync(resolve(baseDir, 'ui-only/src/display-policy.ts'), uiDisplay, 'utf8');

// 4. Generated-only
ensureDir(resolve(baseDir, 'generated-only/policy'));
ensureDir(resolve(baseDir, 'generated-only/generated'));
writeFileSync(resolve(baseDir, 'generated-only/policy/retention.idl.json'), JSON.stringify(baselinePolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'generated-only/generated/retention-policy.json'), writeEnvelope(targetOverridePolicy, baselinePolicy), 'utf8');

// 5. Source-only
ensureDir(resolve(baseDir, 'source-only/policy'));
ensureDir(resolve(baseDir, 'source-only/generated'));
writeFileSync(resolve(baseDir, 'source-only/policy/retention.idl.json'), JSON.stringify(targetOverridePolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'source-only/generated/retention-policy.json'), writeEnvelope(baselinePolicy, baselinePolicy), 'utf8');

// 6. Correct
ensureDir(resolve(baseDir, 'correct/policy'));
ensureDir(resolve(baseDir, 'correct/generated'));
writeFileSync(resolve(baseDir, 'correct/policy/retention.idl.json'), JSON.stringify(targetOverridePolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'correct/generated/retention-policy.json'), writeEnvelope(targetOverridePolicy), 'utf8');

// 7. Overbroad
ensureDir(resolve(baseDir, 'overbroad/policy'));
ensureDir(resolve(baseDir, 'overbroad/generated'));
writeFileSync(resolve(baseDir, 'overbroad/policy/retention.idl.json'), JSON.stringify(overbroadPolicy, null, 2) + '\n', 'utf8');
writeFileSync(resolve(baseDir, 'overbroad/generated/retention-policy.json'), writeEnvelope(overbroadPolicy), 'utf8');

// 8. Unknown Runtime
ensureDir(resolve(baseDir, 'unknown-runtime/src'));
const unknownResolver = `import type { AccountRecord } from '@accord/retention-fixture';

export function resolveRetentionDays(account: AccountRecord): number {
  // Modified custom runtime logic that breaks trusted checksums
  if (account.plan === 'free') return 90;
  return 30;
}
`;
writeFileSync(resolve(baseDir, 'unknown-runtime/src/policy-resolver.ts'), unknownResolver, 'utf8');

console.log('Successfully generated all 8 scenario assets in fixtures/retention-app/scenarios/');
