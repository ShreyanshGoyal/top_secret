import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRetentionPolicy,
  computeSourcePolicyHash,
  verifyGeneratorConsistency,
  GENERATOR_VERSION
} from '@accord/retention-fixture';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('R14: repeated generation is byte-identical', () => {
  const genScriptPath = resolve(__dirname, '../../../fixtures/retention-app/scripts/generate.ts');
  const idlPath = resolve(__dirname, '../../../fixtures/retention-app/policy/retention.idl.json');
  const artifactPath = resolve(__dirname, '../../../fixtures/retention-app/generated/retention-policy.json');

  const rawBefore = readFileSync(artifactPath, 'utf8').replace(/\r\n/g, '\n');

  // Parse and re-run canonical serialization
  const idlRaw = readFileSync(idlPath, 'utf8');
  const idl = parseRetentionPolicy(JSON.parse(idlRaw));
  const sourceHash = computeSourcePolicyHash(idl);

  const reEnvelope = {
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: sourceHash,
    policy: idl
  };
  const rawAfter = (JSON.stringify(reEnvelope, null, 2) + '\n').replace(/\r\n/g, '\n');

  assert.equal(rawAfter, rawBefore, 'Regeneration must produce byte-identical JSON');
});

test('R02: existing override avoids false conflict despite default30', () => {
  const overrideIdlPath = resolve(__dirname, '../../../fixtures/retention-app/scenarios/override/policy/retention.idl.json');
  const overrideArtifactPath = resolve(__dirname, '../../../fixtures/retention-app/scenarios/override/generated/retention-policy.json');

  const idl = parseRetentionPolicy(JSON.parse(readFileSync(overrideIdlPath, 'utf8')));
  const envelope = JSON.parse(readFileSync(overrideArtifactPath, 'utf8'));

  assert.equal(idl.defaultDays, 30, 'Default stays 30 days');
  assert.equal(idl.rules.length, 1, 'Contains target override rule');
  assert.equal(idl.rules[0]!.days, 90, 'Override sets 90 days');

  const consistency = verifyGeneratorConsistency(idl, envelope);
  assert.equal(consistency.consistent, true, 'Override scenario is generator consistent');
});
