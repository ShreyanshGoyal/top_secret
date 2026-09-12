/**
 * Bounded Read-Only GitHub Adapter
 * Resolves refs and PRs to immutable 40-hex commit SHAs.
 * Fetches file trees and blobs strictly pinned to that SHA.
 */
import { isPathBlocked, REPOSITORY_LIMITS } from './config.js';
import type { CommitTarget, RepositoryConfig, RepositoryId, Sha } from '@accord/contracts';

export interface GitHubClientPort {
  resolveRefToSha(repo: RepositoryId, ref: string): Promise<Sha>;
  getPullRequest(repo: RepositoryId, prNumber: number): Promise<{ headSha: Sha; baseSha: Sha }>;
  listTree(repo: RepositoryId, sha: Sha, pathPrefix: string): Promise<string[]>;
  readFileAtSha(repo: RepositoryId, sha: Sha, path: string): Promise<string>;
}

export class LiveGitHubClient implements GitHubClientPort {
  constructor(private readonly token: string) {}

  private async fetchGitHub(url: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Accord-Repo-Investigator/1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`GitHub API error HTTP ${res.status}: ${errText}`);
    }
    return res.json();
  }

  async resolveRefToSha(repo: RepositoryId, ref: string): Promise<Sha> {
    if (/^[0-9a-f]{40}$/i.test(ref)) {
      return ref.toLowerCase();
    }
    const data = await this.fetchGitHub(`https://api.github.com/repos/${repo.owner}/${repo.name}/commits/${ref}`);
    if (!data.sha || !/^[0-9a-f]{40}$/i.test(data.sha)) {
      throw new Error(`GitHub: invalid SHA resolved for ref ${ref}`);
    }
    return data.sha.toLowerCase();
  }

  async getPullRequest(repo: RepositoryId, prNumber: number): Promise<{ headSha: Sha; baseSha: Sha }> {
    const data = await this.fetchGitHub(`https://api.github.com/repos/${repo.owner}/${repo.name}/pulls/${prNumber}`);
    const headSha = data.head?.sha?.toLowerCase();
    const baseSha = data.base?.sha?.toLowerCase();
    if (!headSha || !baseSha) {
      throw new Error(`GitHub: PR #${prNumber} does not return valid head/base SHAs`);
    }
    return { headSha, baseSha };
  }

  async listTree(repo: RepositoryId, sha: Sha, pathPrefix: string): Promise<string[]> {
    const data = await this.fetchGitHub(`https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${sha}?recursive=1`);
    const tree = data.tree || [];
    const normalizedPrefix = pathPrefix.replace(/^\/+|\/+$/g, '');
    const paths: string[] = [];

    for (const item of tree) {
      if (item.type !== 'blob') continue;
      const path = item.path as string;
      if (path.startsWith(normalizedPrefix) && !isPathBlocked(path)) {
        paths.push(path);
        if (paths.length >= REPOSITORY_LIMITS.MAX_ALLOWED_FILES) break;
      }
    }
    return paths;
  }

  async readFileAtSha(repo: RepositoryId, sha: Sha, path: string): Promise<string> {
    const data = await this.fetchGitHub(`https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${sha}`);
    if (!data.content) {
      throw new Error(`GitHub: missing content for ${path} at ${sha}`);
    }
    return Buffer.from(data.content, 'base64').toString('utf8');
  }
}

export class GitHubAdapter {
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly config: RepositoryConfig,
    private readonly client: GitHubClientPort = new LiveGitHubClient(config.githubToken)
  ) {}

  async resolveTarget(input: {
    repository: RepositoryId;
    ref: string;
    pullRequestUrl: string | null;
    pathPrefix: string;
  }): Promise<CommitTarget> {
    // 1. Validate repository allowlist
    if (
      input.repository.owner !== this.config.repository.owner ||
      input.repository.name !== this.config.repository.name
    ) {
      throw new Error(`Target repository ${input.repository.owner}/${input.repository.name} does not match allowed repository ${this.config.repository.owner}/${this.config.repository.name}`);
    }

    // 2. Handle PR target
    if (input.pullRequestUrl) {
      // Validate PR URL format strictly (reject credentials, query parameters, fragments, foreign hosts)
      const prMatch = /^https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)\/pull\/(\d+)\/?$/.exec(input.pullRequestUrl);
      if (!prMatch) {
        throw new Error(`Invalid GitHub pull request URL: ${input.pullRequestUrl}`);
      }

      const [, urlOwner, urlName, prNumStr] = prMatch;
      if (urlOwner !== this.config.repository.owner || urlName !== this.config.repository.name) {
        throw new Error(`Cross-repository PR rejected: URL repo ${urlOwner}/${urlName} does not match configured repo`);
      }

      const prNumber = parseInt(prNumStr!, 10);
      if (!Number.isInteger(prNumber) || prNumber <= 0) {
        throw new Error(`Invalid pull request number: ${prNumStr}`);
      }

      const { headSha, baseSha } = await this.client.getPullRequest(input.repository, prNumber);
      return {
        repository: input.repository,
        sha: headSha,
        baseSha,
        pullRequestNumber: prNumber,
        pullRequestUrl: input.pullRequestUrl,
        pathPrefix: input.pathPrefix,
      };
    }

    // 3. Handle baseline ref target
    const resolvedSha = await this.client.resolveRefToSha(input.repository, input.ref);
    return {
      repository: input.repository,
      sha: resolvedSha,
      baseSha: null,
      pullRequestNumber: null,
      pullRequestUrl: null,
      pathPrefix: input.pathPrefix,
    };
  }

  async listAllowedPaths(target: CommitTarget, suffixFilter?: string): Promise<string[]> {
    const rawPaths = await this.client.listTree(target.repository, target.sha, target.pathPrefix);
    if (!suffixFilter) return rawPaths;
    return rawPaths.filter((p) => p.endsWith(suffixFilter));
  }

  async readFile(target: CommitTarget, path: string): Promise<string> {
    if (isPathBlocked(path)) {
      throw new Error(`Access to blocked path rejected: ${path}`);
    }
    if (!path.startsWith(target.pathPrefix.replace(/^\/+/, ''))) {
      throw new Error(`Access outside target pathPrefix rejected: ${path}`);
    }

    const cacheKey = `${target.repository.owner}/${target.repository.name}@${target.sha}:${path}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const content = await this.client.readFileAtSha(target.repository, target.sha, path);
    this.cache.set(cacheKey, content);
    return content;
  }
}
