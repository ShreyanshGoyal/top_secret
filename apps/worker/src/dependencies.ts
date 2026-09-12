/** Explicit provider composition for the Trigger.dev worker.
 * Nothing here runs at import time: tasks call these builders inside their run function, so a
 * missing credential surfaces as a clear task failure rather than a crashed deploy.
 */
import { AccordError, publicError } from '@accord/contracts';
import {
  createOpenAIModel, createTriggerScheduler, datasetAsOf, loadAccordConfig, systemClock,
  botUserIdFromEnvironment,
} from '@accord/core';
import type { AccordConfig, IngressDependencies, InvestigationDependencies, PublishDependencies } from '@accord/core';
import { createImpactPort } from '@accord/data-impact';
import { createPrivacyPort, createSafeLogger } from '@accord/privacy';
import { createRepositoryPort } from '@accord/repo-investigator';
import { createPublisherPort, renderFinding } from '@accord/slack-delivery';
import { DEFAULT_STORE_CONFIG, createStore } from '@accord/store';
import type { StorePort } from '@accord/store';

const TRUSTED_PROFILE_VERSION = process.env['ACCORD_TRUSTED_PROFILE_VERSION'] ?? '1.0';

function privacyFor(config: AccordConfig) {
  return createPrivacyPort({
    teamId: config.slack.teamId,
    channelId: config.slack.channelId,
    repository: { owner: config.github.owner, name: config.github.name },
    datasetVersion: config.dataset.version,
    // In-memory only. These values are never logged or serialized.
    knownSecretValues: [
      config.slack.botToken, config.slack.appToken, config.model.apiKey,
      config.github.token, config.clickhouse.password, config.trigger.secretKey,
    ],
  });
}

function base(component: string): { config: AccordConfig; store: StorePort } & Omit<IngressDependencies, 'scheduler'> {
  const config = loadAccordConfig();
  const clock = systemClock();
  const store = createStore({ databaseUrl: config.postgres.databaseUrl, ...DEFAULT_STORE_CONFIG });
  return {
    config,
    store,
    privacy: privacyFor(config),
    clock,
    logger: createSafeLogger({ component }),
    ownerId: config.slack.ownerUserId,
    botUserId: botUserIdFromEnvironment(),
    repositoryTarget: {
      owner: config.github.owner,
      name: config.github.name,
      ref: config.github.ref,
      pathPrefix: config.github.pathPrefix,
    },
    dataset: { version: config.dataset.version, asOf: datasetAsOf(config, clock) },
  };
}

export function ingressDependencies(component = 'worker'): IngressDependencies & { store: StorePort } {
  const { config: _config, ...rest } = base(component);
  return { ...rest, scheduler: createTriggerScheduler() };
}

export function investigationDependencies(): InvestigationDependencies & { store: StorePort } {
  const { config, ...rest } = base('investigator');
  const providerDeps = { privacy: rest.privacy, clock: rest.clock, logger: rest.logger };
  return {
    ...rest,
    scheduler: createTriggerScheduler(),
    model: createOpenAIModel(config.model, providerDeps),
    repository: createRepositoryPort({
      repository: { owner: config.github.owner, name: config.github.name },
      pathPrefix: config.github.pathPrefix,
      githubToken: config.github.token,
      openAIKey: config.model.apiKey,
      model: config.model.model,
      trustedProfileVersion: TRUSTED_PROFILE_VERSION,
    }, providerDeps),
    impact: createImpactPort({
      url: config.clickhouse.url,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      allowedDatasetVersion: config.dataset.version,
    }, providerDeps),
  };
}

export function publishDependencies(leaseOwner: string): PublishDependencies & { store: StorePort } {
  const { config, ...rest } = base('publisher');
  const botUserId = rest.botUserId;
  if (!botUserId) {
    // The bot identity is resolved through authenticated setup, never guessed and never from a model.
    throw new AccordError(publicError('INVALID_INPUT', 'ACCORD_BOT_USER_ID is required to publish findings'));
  }
  return {
    ...rest,
    leaseOwner,
    render: renderFinding,
    publisher: createPublisherPort({
      botToken: config.slack.botToken,
      teamId: config.slack.teamId,
      channelId: config.slack.channelId,
      botUserId,
    }, {
      privacy: rest.privacy,
      clock: rest.clock,
      logger: rest.logger,
      receipts: rest.store.receiptReader(),
    }),
  };
}
