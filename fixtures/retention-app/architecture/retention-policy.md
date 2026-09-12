# Retention Policy Architecture & Enforcement

## Policy Structure
- **Source IDL**: `policy/retention.idl.json` defines canonical policy rules conforming to `schemaVersion: 1`.
- **Generated Envelope**: `generated/retention-policy.json` contains:
  - `generatorVersion`: "accord-retention-generator/1"
  - `sourceSha256`: SHA-256 of normalized source IDL.
  - `policy`: Canonical projection data.
- **Runtime Resolution**: `src/policy-resolver.ts` evaluates account attributes (`plan`, `organizationType`, `universityVerified`) against ordered rules.
- **Cleanup Engine**: `src/cleanup.ts` determines deletion eligibility using strict mathematical cutoffs:
  `createdAt < asOf - (retentionDays * 86400 * 1000)`
  Equality is strictly retained (a record exactly at the cutoff boundary is not deleted).
