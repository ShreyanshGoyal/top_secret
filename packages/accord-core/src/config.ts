/** Configuration shape and environment parsing contract. Owner: Agent 1.
 * Names match .env.example and 01-SHARED-CONTRACTS section 11. Each factory validates only what it needs.
 * There is no fallback from live providers to test doubles, and no production 'mock' mode.
 */
export type AccordMode = 'demo' | 'live';

export interface AccordConfig {
  mode: AccordMode;
  model: { apiKey: string; model: string };
  intelligence: { apiKey: string; channelCode: string };
  slack: { botToken: string; appToken: string; teamId: string; channelId: string; ownerUserId: string };
  github: { token: string; owner: string; name: string; ref: string; pathPrefix: string };
  postgres: { databaseUrl: string };
  clickhouse: { url: string; username: string; password: string; database: string };
  trigger: { secretKey: string; projectRef: string };
  dataset: { version: string; asOf: string | null };
  port: number;
}

export const REQUIRED_ENVIRONMENT_NAMES = [
  'OPENAI_API_KEY', 'ACCORD_MODEL', 'INTELLIGENCE_API_KEY', 'CHANNEL_CODE', 'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN', 'ACCORD_SLACK_TEAM_ID', 'ACCORD_SLACK_CHANNEL_ID', 'ACCORD_OWNER_SLACK_USER_ID',
  'GITHUB_TOKEN', 'ACCORD_GITHUB_OWNER', 'ACCORD_GITHUB_REPO', 'ACCORD_REPO_REF', 'ACCORD_REPO_PATH_PREFIX',
  'DATABASE_URL', 'CLICKHOUSE_URL', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'CLICKHOUSE_DATABASE',
  'TRIGGER_SECRET_KEY', 'TRIGGER_PROJECT_REF', 'ACCORD_MODE', 'ACCORD_DATASET_VERSION', 'PORT',
] as const;

export const DEMO_ONLY_ENVIRONMENT_NAMES = [
  'ACCORD_DEMO_AS_OF', 'ACCORD_TRUSTED_PROFILE_PATH', 'ACCORD_DEMO_RESET_ENABLED',
] as const;

export type RequiredEnvironmentName = (typeof REQUIRED_ENVIRONMENT_NAMES)[number];
