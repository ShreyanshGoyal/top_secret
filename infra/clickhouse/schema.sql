-- Accord's isolated synthetic demo dataset. Run only with the seed/admin identity.
CREATE DATABASE IF NOT EXISTS accord_demo;

CREATE TABLE IF NOT EXISTS accord_demo.accounts (
  dataset_version String,
  account_id String,
  plan Enum8('free' = 1, 'paid' = 2),
  organization_type Enum8('university' = 1, 'company' = 2, 'personal' = 3),
  university_verified Bool
) ENGINE = MergeTree
ORDER BY (dataset_version, account_id);

CREATE TABLE IF NOT EXISTS accord_demo.records (
  dataset_version String,
  record_id String,
  account_id String,
  created_at DateTime64(3, 'UTC')
) ENGINE = MergeTree
ORDER BY (dataset_version, account_id, record_id);

-- This is the only relation granted to the worker runtime role.
-- The application account can query this view but cannot read the underlying
-- source tables.  The definer has no host access and only the two source-table
-- SELECT grants below, keeping the view's authority deliberately narrow.
CREATE USER IF NOT EXISTS accord_view_owner IDENTIFIED WITH no_password HOST NONE;
GRANT SELECT ON accord_demo.accounts TO accord_view_owner;
GRANT SELECT ON accord_demo.records TO accord_view_owner;

CREATE OR REPLACE VIEW accord_demo.accord_retention_view
DEFINER = accord_view_owner
SQL SECURITY DEFINER AS
SELECT
  accounts.dataset_version,
  accounts.account_id,
  accounts.plan,
  accounts.organization_type,
  accounts.university_verified,
  records.record_id,
  records.created_at
FROM accord_demo.accounts AS accounts
INNER JOIN accord_demo.records AS records
  ON accounts.dataset_version = records.dataset_version
 AND accounts.account_id = records.account_id;

-- A deliberate non-product table used by the operator's privilege probe. It must never be
-- visible to the restricted runtime identity.
CREATE TABLE IF NOT EXISTS accord_demo.accord_private_operator_notes (
  note String
) ENGINE = MergeTree ORDER BY tuple();
