const required = [(process.env.ACCORD_MODEL_PROVIDER ?? 'google') === 'google' ? 'GOOGLE_API_KEY' : 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'TRIGGER_SECRET_KEY', 'SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'CLICKHOUSE_URL', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) throw new Error(`Live checks are pending; missing configuration: ${missing.join(', ')}.`);
throw new Error('Live checks are pending the merged Agent 1 coordinator and Agent 2 Slack bridge. Run the real merged flow and record evidence; this command will not manufacture a pass.');
