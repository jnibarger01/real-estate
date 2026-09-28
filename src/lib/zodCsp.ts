/**
 * Must be imported before any zod schema module in the browser entry.
 * Zod v4 probes `new Function("")` to enable its JIT fast path; under the
 * production CSP (script-src 'self', no 'unsafe-eval') that probe raises a
 * securitypolicyviolation. jitless skips the probe and uses the normal
 * (non-eval) parser, which is fine for our small payloads.
 */
import { z } from 'zod';

z.config({ jitless: true });
