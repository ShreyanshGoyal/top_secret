/**
 * @accord/repo-investigator — bounded repository specialist over real GitHub evidence at a fixed SHA.
 * Owner: Agent 3, branch accord/repository. Never executes fetched code.
 * Factory signature frozen by 01-SHARED-CONTRACTS.
 */
import {
  CommitTargetSchema,
  RepositoryReportSchema,
  VerificationReportSchema,
} from '@accord/contracts';
import type {
  CommitTarget,
  Decision,
  ProviderDependencies,
  RepositoryConfig,
  RepositoryId,
  RepositoryPort,
  RepositoryReport,
  RunContext,
  VerificationReport,
} from '@accord/contracts';
import { RepositoryInvestigator } from './agent.js';
import { validateRepositoryConfig } from './config.js';
import { GitHubAdapter, type GitHubClientPort, LiveGitHubClient } from './github.js';
import { verifyCandidateFix } from './verify.js';

export * from './config.js';
export * from './evidence.js';
export * from './github.js';
export * from './tools.js';
export * from './trace.js';
export * from './verify.js';
export * from './trust/hashes.js';
export * from './trust/profile.js';
export * from './trust/projection.js';

export function createRepositoryPort(
  config: RepositoryConfig,
  deps: ProviderDependencies,
  customClient?: GitHubClientPort
): RepositoryPort {
  validateRepositoryConfig(config);

  const client = customClient || new LiveGitHubClient(config.githubToken);
  const github = new GitHubAdapter(config, client);

  return {
    async resolveTarget(input: {
      repository: RepositoryId;
      ref: string;
      pullRequestUrl: string | null;
      pathPrefix: string;
    }): Promise<CommitTarget> {
      deps.logger.info('repository_resolve_target', {
        owner: input.repository.owner,
        name: input.repository.name,
        ref: input.ref,
        hasPrUrl: input.pullRequestUrl !== null,
      });
      const resolved = await github.resolveTarget(input);
      return CommitTargetSchema.parse(resolved);
    },

    async inspect(input: {
      run: RunContext;
      decision: Decision;
      target: CommitTarget;
    }): Promise<RepositoryReport> {
      deps.logger.info('repository_inspect_start', {
        decisionId: input.decision.id,
        decisionVersion: input.decision.version,
        sha: input.target.sha,
      });

      const investigator = new RepositoryInvestigator({
        run: input.run,
        decision: input.decision,
        target: input.target,
        config,
        github,
      });

      const report = await investigator.runInvestigation();
      const validated = RepositoryReportSchema.parse(report);

      deps.logger.info('repository_inspect_complete', {
        conclusion: validated.conclusion,
        generatorConsistency: validated.generatorConsistency,
        trustedRuntime: validated.trustedRuntime,
        evidenceCount: validated.evidence.length,
      });

      return validated;
    },

    async verify(input: {
      run: RunContext;
      decision: Decision;
      baseline: RepositoryReport;
      candidate: RepositoryReport;
    }): Promise<VerificationReport> {
      deps.logger.info('repository_verify_start', {
        decisionId: input.decision.id,
        candidateSha: input.candidate.target.sha,
        baselineSha: input.baseline.target.sha,
      });

      const result = verifyCandidateFix(input);
      const validated = VerificationReportSchema.parse(result);

      deps.logger.info('repository_verify_complete', {
        verdict: validated.verdict,
        checksPassed: validated.checks.filter((c) => c.status === 'pass').length,
        checksTotal: validated.checks.length,
      });

      return validated;
    },
  };
}
