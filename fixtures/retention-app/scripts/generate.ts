/**
 * Deterministic Retention Policy Generator
 * Generates generated/retention-policy.json from policy/retention.idl.json
 * Byte-identical on repeated runs. Trailing newline, no timestamps.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRetentionPolicy,
  computeSourcePolicyHash,
  GENERATOR_VERSION
} from '@accord/retention-fixture';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function generatePolicy(
  sourcePath = resolve(__dirname, '../policy/retention.idl.json'),
  outputPath = resolve(__dirname, '../generated/retention-policy.json')
): void {
  const sourceRaw = readFileSync(sourcePath, 'utf8');
  const sourceJson = JSON.parse(sourceRaw);
  const validatedPolicy = parseRetentionPolicy(sourceJson);
  const sourceSha = computeSourcePolicyHash(validatedPolicy);

  const envelope = {
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: sourceSha,
    policy: validatedPolicy
  };

  const outputContent = JSON.stringify(envelope, null, 2) + '\n';
  writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`Generated retention policy (${outputContent.length} bytes, SHA: ${sourceSha.slice(0, 10)}...)`);
}

// Auto-run if executed directly
if (process.argv[1] === __filename) {
  generatePolicy();
}
