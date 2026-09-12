const TEST_SECRET = /ACCORD_TEST_SECRET_DO_NOT_DISCLOSE_[A-Za-z0-9_-]+/g;
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /xox(?:[abprs]|o)-[A-Za-z0-9-]{10,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
];

function redacted(match: string, label: string): string {
  // Keep source line numbering stable for repository evidence, even for a multiline private key.
  return `${label}${'\n'.repeat((match.match(/\n/g) ?? []).length)}`;
}

/** Redacts recognizable credential forms without changing line breaks. */
export function sanitizeText(input: string, knownSecretValues: readonly string[]): string {
  let output = input;
  for (const secret of [...new Set(knownSecretValues)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).map((part, index, parts) => index === parts.length - 1 ? part : `${part}${redacted(secret, '[REDACTED_SECRET]')}`).join('');
  }
  for (const pattern of CREDENTIAL_PATTERNS) output = output.replace(pattern, (match) => redacted(match, '[REDACTED_SECRET]'));
  return output.replace(TEST_SECRET, (match) => redacted(match, '[REDACTED_TEST_SECRET]'));
}
