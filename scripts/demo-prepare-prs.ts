import { access, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const scenarios = ['baseline', 'override', 'ui-only', 'generated-only', 'source-only', 'correct', 'overbroad', 'unknown-runtime'];
const apply = process.argv.includes('--apply-local'); const push = process.argv.includes('--push');
if (!apply) { console.log(`Dry run only. Would prepare local fixture branches: ${scenarios.join(', ')}. Re-run with --apply-local; add --push only after explicit operator approval.`); process.exit(0); }
const baselineFlag = process.argv.indexOf('--baseline'); const baseline = baselineFlag >= 0 ? process.argv[baselineFlag + 1] : undefined;
if (!baseline) throw new Error('--baseline <immutable SHA/ref> is required when applying demo branches.');
for (const scenario of scenarios) {
  const patch = `fixtures/retention-app/scenarios/${scenario}/patch.diff`;
  await access(patch).catch(() => { throw new Error(`Missing Agent 3 scenario patch: ${patch}`); });
  const branch = `accord-demo/${scenario}`; const directory = `work/demo-branches/${scenario}`;
  await mkdir('work/demo-branches', { recursive: true });
  let result = spawnSync('git', ['worktree', 'add', '--force', '-B', branch, directory, baseline], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Could not create worktree for ${branch}.`);
  result = spawnSync('git', ['apply', '--check', patch], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`Patch check failed for ${scenario}.`);
  result = spawnSync('git', ['apply', patch], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`Patch apply failed for ${scenario}.`);
  const changed = spawnSync('git', ['diff', '--name-only', baseline], { cwd: directory, encoding: 'utf8' });
  if (changed.status !== 0 || changed.stdout.split('\n').filter(Boolean).some((path) => !path.startsWith('fixtures/retention-app/'))) throw new Error(`${scenario} changes outside the allowed fixture prefix.`);
  result = spawnSync('git', ['add', 'fixtures/retention-app'], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`Could not stage ${scenario}.`);
  result = spawnSync('git', ['commit', '-m', `demo(retention): ${scenario} scenario`], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`Could not commit ${scenario}.`);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }); if (head.status !== 0) throw new Error(`Could not resolve ${scenario} head SHA.`);
  console.log(`${scenario}: ${head.stdout.trim()}`);
  if (push) { result = spawnSync('git', ['push', '--set-upstream', 'origin', branch], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`Push failed for ${branch}.`); }
}
console.log('Local demo branches prepared. Create PRs explicitly and record their real URLs/head SHAs in demo-manifest.json; this script does not invent them.');
