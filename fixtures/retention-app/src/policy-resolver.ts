/**
 * Fixture Policy Resolver
 * Reads the generated policy envelope and resolves retention days for an account.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRetentionPolicy,
  resolveRetentionDays as resolveFromProjection
} from '@accord/retention-fixture';
import type { AccountRecord, GeneratorEnvelope } from '@accord/retention-fixture';
import type { RetentionProjection } from '@accord/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedEnvelope: GeneratorEnvelope | null = null;

export function loadGeneratedPolicyEnvelope(): GeneratorEnvelope {
  if (cachedEnvelope) return cachedEnvelope;
  const policyPath = resolve(__dirname, '../generated/retention-policy.json');
  const raw = readFileSync(policyPath, 'utf8');
  const parsed = JSON.parse(raw);
  cachedEnvelope = {
    generatorVersion: parsed.generatorVersion,
    sourceSha256: parsed.sourceSha256,
    policy: parseRetentionPolicy(parsed.policy)
  };
  return cachedEnvelope;
}

export function getOperativeProjection(): RetentionProjection {
  return loadGeneratedPolicyEnvelope().policy;
}

export function resolveRetentionDays(account: AccountRecord): number {
  const projection = getOperativeProjection();
  return resolveFromProjection(account, projection);
}
