import { RentCastProviderError } from './rentcast';

/** RESO/Bridge is intentionally inactive until a licensed MLS provider is configured. */
export function isResoConfigured(): boolean {
  return Boolean(process.env.RESO_BRIDGE_API_KEY?.trim() && process.env.RESO_BRIDGE_BASE_URL?.trim());
}

export function resoNotConfigured(): never {
  throw new RentCastProviderError('Pending-status MLS data is not configured. A licensed RESO/Bridge provider is required.', 503);
}
