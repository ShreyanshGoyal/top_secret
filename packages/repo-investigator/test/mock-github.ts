import type { RepositoryId, Sha } from '@accord/contracts';
import type { GitHubClientPort } from '../src/github.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LocalScenarioGitHubClient implements GitHubClientPort {
  private readonly fileOverrides = new Map<string, string>();

  constructor(
    public readonly headSha: Sha = '1111111111111111111111111111111111111111',
    public readonly baseSha: Sha = '0000000000000000000000000000000000000000'
  ) {}

  setFileOverride(path: string, content: string): void {
    this.fileOverrides.set(path, content);
  }

  loadScenario(scenarioName: string): void {
    const scenarioDir = resolve(__dirname, '../../../fixtures/retention-app/scenarios', scenarioName);
    const filesToTry = [
      'policy/retention.idl.json',
      'generated/retention-policy.json',
      'src/policy-resolver.ts',
      'src/cleanup.ts',
      'src/display-policy.ts'
    ];

    for (const rel of filesToTry) {
      const fullPath = resolve(scenarioDir, rel);
      if (existsSync(fullPath)) {
        this.fileOverrides.set(`fixtures/retention-app/${rel}`, readFileSync(fullPath, 'utf8'));
      }
    }
  }

  async resolveRefToSha(_repo: RepositoryId, ref: string): Promise<Sha> {
    if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
    return this.headSha;
  }

  async getPullRequest(_repo: RepositoryId, _prNumber: number): Promise<{ headSha: Sha; baseSha: Sha }> {
    return { headSha: this.headSha, baseSha: this.baseSha };
  }

  async listTree(_repo: RepositoryId, _sha: Sha, _pathPrefix: string): Promise<string[]> {
    return [
      'fixtures/retention-app/policy/retention.idl.json',
      'fixtures/retention-app/generated/retention-policy.json',
      'fixtures/retention-app/scripts/generate.ts',
      'fixtures/retention-app/src/policy-resolver.ts',
      'fixtures/retention-app/src/cleanup.ts',
      'fixtures/retention-app/src/display-policy.ts',
      'fixtures/retention-app/src/index.ts',
      'fixtures/retention-app/AGENTS.md'
    ];
  }

  async readFileAtSha(_repo: RepositoryId, _sha: Sha, path: string): Promise<string> {
    const override = this.fileOverrides.get(path);
    if (override !== undefined) return override;

    const diskPath = resolve(__dirname, '../../../', path);
    if (existsSync(diskPath)) {
      return readFileSync(diskPath, 'utf8');
    }
    throw new Error(`MockGitHub: File not found: ${path}`);
  }
}
