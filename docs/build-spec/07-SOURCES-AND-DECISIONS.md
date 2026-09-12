# Implementation references and decisions

References checked during specification on12 September2026. These URLs help the implementers verify actual SDK behavior. Public docs can change; pin dependencies and inspect installed types. The target repository is assumed empty per user instruction and was not independently read. These specifications contain original design requirements, not claims that any implementation has already passed tests.

## Starter

[Starter repository](https://github.com/CopilotKit/agents-everywhere-starter-kit) supplies reusable infrastructure. Preserve its license and record the imported commit. [Channel package](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/channel/package.json) and [root package](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/package.json) establish the inspected dependency pins. [Agent guidance](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/AGENTS.md) and [Channels skill](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/.agents/skills/build-channels-agent/SKILL.md) are required implementation references. Do not copy older illustrative package versions over the chosen starter's actual lockfile.

## Slack architecture

[CopilotKit direct adapters](https://docs.copilotkit.ai/reference/channels/sdk/direct-adapters) documents the direct provider path. This spec deliberately chooses it so the app owns the same bot credentials used for durable background publication. [Slack postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/) provides threaded outbound posting; [Slack update](https://docs.slack.dev/reference/methods/chat.update/) supports updates to the bot's existing messages. The application must separately manage freshness, authorization and uncertain outcomes. The spec does not rely on an invented proactive Channels method.

## Reasoning

[OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) are the references for model/tool boundaries. Strict output shape does not establish authorization or evidential truth; application validation remains mandatory. Use a configured model available to the team's account and run a real smoke test rather than assume availability from an example.

## Durability and data

[Trigger retries](https://trigger.dev/docs/errors-retrying) and [idempotency](https://trigger.dev/docs/idempotency) support task execution. Application-level PostgreSQL constraints, version checks and outbox reconciliation supplement them. [ClickHouse query permissions](https://clickhouse.com/docs/concepts/features/configuration/settings/permissions-for-queries) informs the read-only role; the actual restricted view and query compiler are application requirements. [Cloud Run billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings) is relevant to background CPU; deployment must prove the persistent bridge stays operational. External durable stores are required.

## Deliberately excluded

Expert recommendation, Exa, Auth0, broad history profiling and automatic remediation are not v1 dependencies. Add them only as a separately reviewed scope change after required acceptance passes. [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) would be a suitable explicit ownership source for a later reviewer suggestion, but no expertise ranking is part of this build.
