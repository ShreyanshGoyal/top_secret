/**
 * Trusted Hash & Normalization Utilities
 * Performs byte-level SHA-256 digest computation before sanitization.
 */
import { createHash } from 'node:crypto';

export function normalizeNewlines(content: string): string {
  // Normalize Windows CRLF to standard LF without altering whitespace or tokens
  return content.replace(/\r\n/g, '\n');
}

export function computeByteSha256(content: string | Buffer): string {
  if (typeof content === 'string') {
    const normalized = normalizeNewlines(content);
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
  return createHash('sha256').update(content).digest('hex');
}
