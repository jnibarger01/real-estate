/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import {
  clearSessionCookie,
  createSessionToken,
  parseCookieHeader,
  readSessionFromRequest,
  revokeSessionToken,
  sessionPublicInfo,
  setSessionCookie,
  SESSION_COOKIE,
  decodeSessionToken,
} from '../session.js';
import { dashboardAuthConfigured, validateDashboardCredentials } from '../auth.js';

const router = Router();

router.get('/auth/session', (req, res) => {
  const authRequired = dashboardAuthConfigured();
  if (!authRequired) {
    return res.json({
      authenticated: true,
      authRequired: false,
      username: 'local',
      expiresAt: Date.now() + 24 * 60 * 60_000,
      ttlMs: 24 * 60 * 60_000,
      idleWarningMs: 60_000,
    });
  }

  const session = readSessionFromRequest(req);
  if (session) {
    return res.json(sessionPublicInfo(session, true));
  }

  // Allow HTTP Basic (e.g. Playwright) to establish a session for the SPA.
  const authorization = req.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator >= 0) {
      const username = decoded.slice(0, separator);
      const password = decoded.slice(separator + 1);
      if (validateDashboardCredentials(username, password)) {
        const { token, expiresAt, iat } = createSessionToken(username);
        setSessionCookie(res, token, expiresAt);
        return res.json(
          sessionPublicInfo({ u: username, exp: expiresAt, iat }, true),
        );
      }
    }
  }

  return res.json(sessionPublicInfo(null, true));
});

router.post('/auth/login', (req, res) => {
  if (!dashboardAuthConfigured()) {
    const { token, expiresAt, iat } = createSessionToken('local');
    setSessionCookie(res, token, expiresAt);
    return res.json(sessionPublicInfo({ u: 'local', exp: expiresAt, iat }, false));
  }

  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';

  let sessionUser: string | null = null;
  if (username && password && validateDashboardCredentials(username, password)) {
    sessionUser = username;
  } else if (apiKey && validateDashboardCredentials('', '', apiKey)) {
    sessionUser = 'api-key';
  }

  if (!sessionUser) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
  }

  const { token, expiresAt, iat } = createSessionToken(sessionUser);
  setSessionCookie(res, token, expiresAt);
  return res.json(sessionPublicInfo({ u: sessionUser, exp: expiresAt, iat }, true));
});

router.post('/auth/logout', (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (raw) {
    const payload = decodeSessionToken(raw);
    const exp = payload?.exp ?? Date.now() + 30 * 60_000;
    revokeSessionToken(raw, Math.max(exp, Date.now() + 1000));
  }
  clearSessionCookie(res);
  return res.json({ ok: true, authenticated: false });
});

router.post('/auth/touch', (req, res) => {
  const authRequired = dashboardAuthConfigured();
  if (!authRequired) {
    return res.json({
      authenticated: true,
      authRequired: false,
      username: 'local',
      expiresAt: Date.now() + 24 * 60 * 60_000,
      ttlMs: 24 * 60 * 60_000,
      idleWarningMs: 60_000,
    });
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'unauthorized', authenticated: false, authRequired: true });
  }

  const { token, expiresAt, iat } = createSessionToken(session.u);
  setSessionCookie(res, token, expiresAt);
  return res.json(sessionPublicInfo({ u: session.u, exp: expiresAt, iat }, true));
});

export default router;
