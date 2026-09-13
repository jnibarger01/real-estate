/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SessionInfo = {
  authenticated: boolean;
  authRequired: boolean;
  username?: string;
  expiresAt?: number;
  issuedAt?: number;
  ttlMs: number;
  idleWarningMs: number;
};
