# Synthetic Retention Application — Developer Guide

This repository contains the legacy data retention service for user accounts.

## Authoritative Policy Workflow
1. Policy rules are authored exclusively in `policy/retention.idl.json`.
2. After updating policy rules, execute `npm run generate` to regenerate `generated/retention-policy.json`.
3. The runtime resolver (`src/policy-resolver.ts`) reads the generated artifact, applying first-matching rules followed by `defaultDays`.
4. The cleanup service (`src/cleanup.ts`) enforces strict elapsed-day cutoffs (`createdAt < asOf - days * 86400s`).
5. User-facing text in `src/display-policy.ts` is purely decorative and does NOT affect data retention or cleanup eligibility.
6. Preserving unrelated account behavior and testing boundary conditions is mandatory for all changes.
