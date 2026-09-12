import { AccordError, publicError } from '@accord/contracts';
import type { ImpactConfig } from '@accord/contracts';

export interface ValidImpactConfig extends ImpactConfig { endpoint: URL }

/** Validate once at composition; passwords are intentionally never included in error messages. */
export function validateImpactConfig(config: ImpactConfig): ValidImpactConfig {
  let endpoint: URL;
  try { endpoint = new URL(config.url); } catch { throw new AccordError(publicError('INVALID_INPUT', 'ClickHouse URL is invalid.')); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password
    || !/^[A-Za-z0-9_]{1,128}$/.test(config.database) || !config.username || !config.password
    || !/^[A-Za-z0-9._:-]{1,120}$/.test(config.allowedDatasetVersion)) {
    throw new AccordError(publicError('INVALID_INPUT', 'ClickHouse configuration is incomplete or unsafe.'));
  }
  return { ...config, endpoint };
}
