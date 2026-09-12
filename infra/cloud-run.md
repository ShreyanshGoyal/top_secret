# Cloud Run bridge deployment

Deploy only on an explicit operator request. The Channels bridge is a persistent Socket Mode
process; Cloud Run must use one minimum instance, instance-based CPU/background CPU, and a maximum
of one instance for the demo. This reduces overlap but does not replace the durable lease/dedupe
logic in the application.

Build the `infra/Dockerfile.channel` image from a clean committed checkout. Configure `PORT`, the
Slack/Intelligence settings, PostgreSQL/Trigger ingress settings required by the bridge, and no seed
administrator credentials. The worker receives its separate OpenAI, GitHub, read-only ClickHouse,
PostgreSQL, and Slack-outbound credentials through Trigger.dev. Use externally reachable durable
PostgreSQL and ClickHouse; do not rely on the container filesystem.

Before routing traffic, record the deployed image digest and commit, prove a safe readiness check,
then send a real Slack mention and a delayed same-bot update. Roll back by selecting the last
recorded working revision; do not claim success merely because the image built.
