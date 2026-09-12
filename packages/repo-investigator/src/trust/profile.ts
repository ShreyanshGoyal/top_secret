/**
 * Server-Side Trusted Profile
 * Validates candidate repository files against committed server-side checksums.
 * Never loads trusted profiles from inspected PRs or remote branches.
 */
import { computeByteSha256 } from './hashes.js';

export interface TrustedProfileData {
  schemaVersion: 1;
  trustedProfileVersion: string;
  generatorVersion: string;
  files: Record<string, string>;
  expectedDependencies: string[];
}

export const COMMITTED_TRUSTED_PROFILE: TrustedProfileData = {
  schemaVersion: 1,
  trustedProfileVersion: '1.0.0',
  generatorVersion: 'accord-retention-generator/1',
  files: {
    'scripts/generate.ts': '8b7635808668cd31d14d7058cb514658069d9440a4503e778d3fccb0616c43a8',
    'src/policy-resolver.ts': '9612339432aa14e41b40c4a19ca596d29cc8182535d97bc13baabec6754d30bb',
    'src/cleanup.ts': 'e9d78ecbe66be625cb95421d98ab5fb0e7ed42755b8f787168fc4d7531be012b',
    'src/index.ts': '390759ad90f353fd2d5b039412e93e6922a723751a8c096b6d6417a54a0949b9'
  },
  expectedDependencies: [
    '@accord/contracts',
    '@accord/retention-fixture'
  ]
};

export interface TrustCheckResult {
  matched: boolean;
  mismatches: string[];
  missingFiles: string[];
}

export function verifyAgainstTrustedProfile(
  fetchedFiles: Map<string, string>,
  profile: TrustedProfileData = COMMITTED_TRUSTED_PROFILE
): TrustCheckResult {
  const mismatches: string[] = [];
  const missingFiles: string[] = [];

  for (const [relativePath, expectedSha] of Object.entries(profile.files)) {
    // Check if path exists in candidate files (stripping leading prefix if needed)
    let content: string | undefined;
    for (const [path, fileContent] of fetchedFiles.entries()) {
      if (path.endsWith(relativePath)) {
        content = fileContent;
        break;
      }
    }

    if (content === undefined) {
      missingFiles.push(relativePath);
      continue;
    }

    const actualSha = computeByteSha256(content);
    if (actualSha !== expectedSha) {
      mismatches.push(`${relativePath} (expected ${expectedSha.slice(0, 10)}..., got ${actualSha.slice(0, 10)}...)`);
    }
  }

  const matched = mismatches.length === 0 && missingFiles.length === 0;
  return { matched, mismatches, missingFiles };
}
