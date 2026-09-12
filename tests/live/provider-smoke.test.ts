import { test } from 'node:test';

const required = ['CLICKHOUSE_URL', 'CLICKHOUSE_DATABASE', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'GITHUB_TOKEN', 'OPENAI_API_KEY', 'TRIGGER_SECRET_KEY', 'SLACK_BOT_TOKEN'];
const missing = required.filter((name) => !process.env[name]);
test('live provider smoke prerequisites are explicit', { skip: missing.length ? `Pending live smoke: missing ${missing.join(', ')}.` : false }, () => {
  // This intentionally does not claim a pass for credentials alone. The final live flow belongs to
  // the merged coordinator/channel test and must record actual Slack, GitHub, model, Trigger and
  // ClickHouse evidence tied to that commit.
});
