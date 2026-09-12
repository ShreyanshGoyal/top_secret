# Accord submission checklist

## Title and description

**What we built:** Accord turns a confirmed Slack retention decision into a current, evidence-backed finding: it checks the configured repository at a fixed commit, calculates the affected synthetic population through a restricted ClickHouse query, and updates the originating thread as context or a PR changes.

**Who it is for:** Product owners and engineers resolving policy-to-code drift in the Slack thread where the decision was made.

**Why Slack context matters:** The owner’s authenticated confirmation, follow-up clarification, and PR link are the source events that version and fence investigation results. A standalone chat loses that thread-level ownership and revision context.

**Sponsor technologies actually used:** CopilotKit Channels is the direct Slack interaction layer; OpenAI is the bounded interpretation/investigation provider when configured; Trigger.dev is the durable investigation runtime. Each must be demonstrated live before it is claimed in a submission.

## Provenance and eligibility

- [x] Inherited starter identified: CopilotKit `agents-everywhere-starter-kit` commit `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5`, including the retained MIT license and unused web/mobile examples.
- [x] New Accord work identified: Slack decision/version workflow, strict shared contracts, repository investigation fixture, ClickHouse impact analysis, privacy guards, demo infrastructure, and proof.
- [ ] Team has confirmed the project’s event eligibility with its own local organizer rules.
- [ ] Public repository, final commit, uncut demo video, and social post have been prepared by the team.

## Evidence to attach after real checks

- [ ] Final repository URL and full commit SHA.
- [ ] Sanitized `artifacts/review-manifest.json` from the final commit, with actual command exits and pending checks—not placeholders.
- [ ] A real Slack thread showing owner confirmation, background same-bot finding/update, clarification, UI-only negative control, and correct-PR verification.
- [ ] Real GitHub SHA/PR links and ClickHouse read-only role proof.
- [ ] Actual Trigger run IDs and a statement that verified-at-commit does not verify deployment.

Do not add organizer deadlines, scores, private URLs, credentials, or fabricated live evidence here. See [README.md](README.md) for setup and [`docs/build-spec/06-ACCEPTANCE-AND-REVIEW.md`](docs/build-spec/06-ACCEPTANCE-AND-REVIEW.md) for the full review rubric.
