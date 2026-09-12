-- Accord initial schema. PostgreSQL is the durable authority; ClickHouse is never authoritative.
-- Every JSONB payload is schema-validated in the application before it reaches this file.
-- No credentials, no unredacted message text and no complete model traces are stored here.

CREATE TABLE threads (
  id                  uuid PRIMARY KEY,
  team_id             text NOT NULL,
  channel_id          text NOT NULL,
  root_ts             text NOT NULL,
  enrolled            boolean NOT NULL DEFAULT false,
  context_revision    integer NOT NULL DEFAULT 0 CHECK (context_revision >= 0),
  active_decision_id  uuid,
  active_version      integer CHECK (active_version >= 1),
  finding_message_ts  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT threads_identity_unique UNIQUE (team_id, channel_id, root_ts)
);

CREATE TABLE inbound_events (
  event_key        text PRIMARY KEY,
  thread_id        uuid NOT NULL REFERENCES threads (id),
  payload          jsonb NOT NULL,
  context_revision integer NOT NULL CHECK (context_revision >= 0),
  status           text NOT NULL CHECK (status IN ('accepted', 'processed', 'ignored')),
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz
);

CREATE INDEX inbound_events_thread_idx ON inbound_events (thread_id, context_revision DESC);

CREATE TABLE decision_versions (
  decision_id        uuid NOT NULL,
  version            integer NOT NULL CHECK (version >= 1),
  thread_id          uuid NOT NULL REFERENCES threads (id),
  context_revision   integer NOT NULL CHECK (context_revision >= 0),
  status             text NOT NULL CHECK (status IN ('candidate', 'tentative', 'confirmed', 'withdrawn')),
  intent             jsonb,
  intent_hash        text,
  owner_id           text NOT NULL,
  confirmed_by       text,
  confirmed_at       timestamptz,
  source_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, version)
);

CREATE INDEX decision_versions_thread_idx ON decision_versions (thread_id, decision_id, version DESC);

ALTER TABLE threads
  ADD CONSTRAINT threads_active_decision_fk
  FOREIGN KEY (active_decision_id, active_version)
  REFERENCES decision_versions (decision_id, version)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE investigations (
  id               uuid PRIMARY KEY,
  thread_id        uuid NOT NULL REFERENCES threads (id),
  decision_id      uuid NOT NULL,
  decision_version integer NOT NULL CHECK (decision_version >= 1),
  context_revision integer NOT NULL CHECK (context_revision >= 0),
  mode             text NOT NULL CHECK (mode IN ('baseline', 'verify_pr')),
  target           jsonb,
  base_target      jsonb,
  dataset_version  text NOT NULL,
  as_of            text NOT NULL,
  status           text NOT NULL CHECK (status IN (
                     'queued', 'interpreting', 'waiting_for_clarification', 'investigating',
                     'analyzing_impact', 'verifying', 'completed', 'superseded', 'failed', 'cancelled')),
  attempt          integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  trigger_run_id   text,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- One logical run per decision version, context revision and mode. A retry reuses this row.
  CONSTRAINT investigations_run_key_unique UNIQUE (decision_id, decision_version, context_revision, mode)
);

CREATE INDEX investigations_active_idx ON investigations (thread_id, status)
  WHERE status NOT IN ('completed', 'superseded', 'failed', 'cancelled');

CREATE TABLE investigation_steps (
  investigation_id uuid NOT NULL REFERENCES investigations (id),
  step_key         text NOT NULL,
  input_hash       text NOT NULL,
  result           jsonb,
  status           text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  completed_at     timestamptz,
  PRIMARY KEY (investigation_id, step_key)
);

-- Evidence reuse is only permitted when every relevant hash matches.
CREATE INDEX investigation_steps_reuse_idx ON investigation_steps (step_key, input_hash)
  WHERE status = 'completed';

-- The baseline RepositoryReport for a decision version is frozen here and is never overwritten
-- by a candidate report. Its context revision may legitimately be older than the verification run.
CREATE TABLE baseline_reports (
  decision_id      uuid NOT NULL,
  decision_version integer NOT NULL CHECK (decision_version >= 1),
  report           jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, decision_version)
);

CREATE TABLE findings (
  id               uuid PRIMARY KEY,
  thread_id        uuid NOT NULL REFERENCES threads (id),
  decision_id      uuid NOT NULL,
  decision_version integer NOT NULL CHECK (decision_version >= 1),
  context_revision integer NOT NULL CHECK (context_revision >= 0),
  payload          jsonb NOT NULL,
  revision         integer NOT NULL CHECK (revision >= 1),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX findings_current_idx ON findings (thread_id, decision_version DESC, context_revision DESC);

CREATE TABLE outbox (
  id                      uuid PRIMARY KEY,
  thread_id               uuid NOT NULL REFERENCES threads (id),
  finding_id              uuid NOT NULL REFERENCES findings (id),
  payload                 jsonb NOT NULL,
  publication_revision    integer NOT NULL CHECK (publication_revision >= 1),
  expected_version        integer NOT NULL CHECK (expected_version >= 1),
  expected_context        integer NOT NULL CHECK (expected_context >= 0),
  status                  text NOT NULL CHECK (status IN (
                            'pending', 'sending', 'delivered', 'uncertain', 'retryable',
                            'permanent_failure', 'superseded')),
  attempts                integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at         timestamptz NOT NULL DEFAULT now(),
  lease_owner             text,
  lease_until             timestamptz,
  delivered_ts            text,
  error                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_publication_unique UNIQUE (finding_id, publication_revision)
);

-- Due rows for the publication worker: claimed by lease, never by holding a transaction open.
CREATE INDEX outbox_due_idx ON outbox (next_attempt_at)
  WHERE status IN ('pending', 'retryable', 'uncertain');

CREATE TABLE owner_actions (
  action_id                uuid PRIMARY KEY,
  thread_id                uuid NOT NULL REFERENCES threads (id),
  actor                    text NOT NULL,
  decision_id              uuid NOT NULL,
  expected_version         integer NOT NULL CHECK (expected_version >= 1),
  expected_context_revision integer NOT NULL CHECK (expected_context_revision >= 0),
  kind                     text NOT NULL CHECK (kind IN ('confirm', 'tentative', 'withdraw')),
  outcome                  text NOT NULL,
  occurred_at              timestamptz NOT NULL DEFAULT now()
);

-- Written only by the transport-facing recordPublicationReceipt, after the bridge has
-- authenticated the event as this app's own bot in the allowed channel.
CREATE TABLE publication_receipts (
  publication_id       uuid NOT NULL REFERENCES outbox (id),
  provider_ts          text NOT NULL,
  finding_id           uuid NOT NULL,
  publication_revision integer NOT NULL CHECK (publication_revision >= 1),
  thread_id            uuid NOT NULL REFERENCES threads (id),
  bot_user_id          text NOT NULL,
  observed_at          timestamptz NOT NULL DEFAULT now(),
  receipt              jsonb NOT NULL,
  PRIMARY KEY (publication_id, provider_ts)
);

CREATE INDEX publication_receipts_lookup_idx ON publication_receipts (publication_id, publication_revision);

CREATE TABLE job_intents (
  id              uuid PRIMARY KEY,
  logical_key     text NOT NULL UNIQUE,
  task_type       text NOT NULL CHECK (task_type IN (
                    'accord-process-context', 'accord-investigate', 'accord-publish', 'accord-reconcile')),
  payload         jsonb NOT NULL,
  status          text NOT NULL CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
  trigger_run_id  text,
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Reconciliation sweeps this: an intent committed but never dispatched must still reach Trigger.dev.
CREATE INDEX job_intents_pending_idx ON job_intents (next_attempt_at)
  WHERE status = 'pending';
