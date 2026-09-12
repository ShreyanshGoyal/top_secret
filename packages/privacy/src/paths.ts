import { AccordError, publicError } from '@accord/contracts';

const BLOCKED_SEGMENTS = new Set(['.aws', '.config', '.git', '.ssh', 'credentials']);
const BLOCKED_BASENAMES = new Set(['.env', 'id_rsa', 'id_dsa', 'known_hosts']);
const PRIVATE_KEY_SUFFIXES = ['.pem', '.p12', '.pfx', '.key'];
const GENERATED_POLICY = 'fixtures/retention-app/generated/retention-policy.json';

function normalized(path: string): string { return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/'); }

/** Reject secret-bearing or escaping repository paths before any fetch/model use. */
export function assertAllowedPath(path: string): void {
  const value = normalized(path);
  const parts = value.split('/');
  const basename = parts.at(-1) ?? '';
  const blocked = value.length === 0 || parts.some((part) => part === '..' || BLOCKED_SEGMENTS.has(part))
    || BLOCKED_BASENAMES.has(basename) || basename.startsWith('.env.')
    || PRIVATE_KEY_SUFFIXES.some((suffix) => basename.toLowerCase().endsWith(suffix));
  if (blocked && value !== GENERATED_POLICY) throw new AccordError(publicError('FORBIDDEN', 'Repository path is not permitted for Accord evidence.'));
}
