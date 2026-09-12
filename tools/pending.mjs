/** Root scripts for work that is not implemented yet must fail clearly, never pretend to pass.
 * Usage: node tools/pending.mjs <script name> <owner> <expected implementation path>
 * The owning agent replaces the root script line as part of its merge; Agent 1 applies it.
 */
const [name, owner, path] = process.argv.slice(2);
process.stderr.write(
  `\n[accord] "${name ?? 'unknown script'}" is not implemented at this commit.\n` +
  `  Owner: ${owner ?? 'unassigned'}\n` +
  `  Expected implementation: ${path ?? 'see docs/build-spec/06-ACCEPTANCE-AND-REVIEW.md'}\n` +
  `  This command exits nonzero on purpose so nothing reports a pass it has not earned.\n\n`,
);
process.exit(1);
