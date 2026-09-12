/** Runs a named script across every workspace that defines it, and fails when none does.
 * A suite that cannot run has proven nothing, so "no suites" is an error, never a pass.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

export function workspacesWith(script) {
  const root = JSON.parse(readFileSync('package.json', 'utf8'));
  const found = [];
  for (const pattern of root.workspaces ?? []) {
    for (const directory of globSync(pattern.endsWith('*') ? pattern : `${pattern}`)) {
      try {
        const manifest = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
        if (manifest.scripts?.[script]) found.push(manifest.name);
      } catch {
        // Not a workspace package; ignore.
      }
    }
  }
  return found;
}

export function requireEnvironment(names, label) {
  const missing = names.filter((name) => !process.env[name] || process.env[name].trim() === '');
  if (missing.length > 0) {
    process.stderr.write(
      `\n[accord] ${label} cannot run: missing ${missing.join(', ')}.\n`
      + '  These checks talk to real services on purpose. Configure them or report the check as pending.\n\n',
    );
    process.exit(1);
  }
}

export function runAcross(script, label) {
  const packages = workspacesWith(script);
  if (packages.length === 0) {
    process.stderr.write(`\n[accord] ${label}: no workspace defines "${script}" yet, so nothing was verified.\n\n`);
    process.exit(1);
  }
  let failed = 0;
  for (const name of packages) {
    process.stdout.write(`\n[accord] ${label} · ${name}\n`);
    const result = spawnSync('npm', ['run', script, '--workspace', name], { stdio: 'inherit' });
    if (result.status !== 0) failed += 1;
  }
  if (failed > 0) {
    process.stderr.write(`\n[accord] ${label}: ${failed} of ${packages.length} suites failed.\n\n`);
    process.exit(1);
  }
  process.stdout.write(`\n[accord] ${label}: ${packages.length} suite(s) passed.\n`);
}
