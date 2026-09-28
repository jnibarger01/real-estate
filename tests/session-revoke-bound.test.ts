import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRevokedSessionsForTests,
  isSessionTokenRevoked,
  revokeSessionToken,
  revokedSessionCountForTests,
} from '../src/api/session.ts';

const ENV_KEY = 'SESSION_REVOKE_MAX_ENTRIES';
const original = process.env[ENV_KEY];

afterEach(() => {
  clearRevokedSessionsForTests();
  if (original == null) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe('revokedSessions bound', () => {
  it('never exceeds SESSION_REVOKE_MAX_ENTRIES after revoke', () => {
    process.env[ENV_KEY] = '5';
    const now = 1_000_000;
    for (let i = 0; i < 12; i++) {
      revokeSessionToken(`tok-${i}`, now + 60_000 + i, now);
    }
    expect(revokedSessionCountForTests()).toBeLessThanOrEqual(5);
    // Freshly revoked token within the cap still denies
    expect(isSessionTokenRevoked('tok-11', now)).toBe(true);
  });

  it('still prunes expired entries', () => {
    process.env[ENV_KEY] = '100';
    const now = 1_000_000;
    revokeSessionToken('expired', now - 1, now);
    expect(isSessionTokenRevoked('expired', now)).toBe(false);
    expect(revokedSessionCountForTests()).toBe(0);
    revokeSessionToken('live', now + 10_000, now);
    expect(isSessionTokenRevoked('live', now)).toBe(true);
    expect(isSessionTokenRevoked('live', now + 10_001)).toBe(false);
  });

  it('evicts soonest-expiring first when over cap', () => {
    process.env[ENV_KEY] = '2';
    const now = 1_000_000;
    revokeSessionToken('soon', now + 1_000, now);
    revokeSessionToken('later', now + 5_000, now);
    revokeSessionToken('newest', now + 9_000, now);
    expect(revokedSessionCountForTests()).toBe(2);
    expect(isSessionTokenRevoked('soon', now)).toBe(false);
    expect(isSessionTokenRevoked('later', now)).toBe(true);
    expect(isSessionTokenRevoked('newest', now)).toBe(true);
  });
});
