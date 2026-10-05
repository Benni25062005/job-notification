import { authorized } from '../src/auth.js';
import { RedisStore } from '../src/store.js';
import { dashboardPayload } from '../src/dashboard.js';

// Reiner Lesezugriff. Der Dashboard-Schlüssel kann keine Suche oder E-Mail auslösen.
export function createDashboardHandler({ env = process.env, makeStore = config => new RedisStore(config) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!env.DASHBOARD_TOKEN || env.DASHBOARD_TOKEN.length < 32) return res.status(503).json({ code: 'SETUP_REQUIRED', error: 'Der Dashboard-Zugang ist noch nicht eingerichtet.' });
    if (!authorized(req.headers.authorization, env.DASHBOARD_TOKEN)) return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Zugangsschlüssel fehlt oder ist ungültig.' });
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return res.status(503).json({ code: 'SETUP_REQUIRED', error: 'Der Speicher für Suchergebnisse ist noch nicht verbunden.' });
    try {
      const store = makeStore({ redisUrl: env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), redisToken: env.UPSTASH_REDIS_REST_TOKEN, prefix: env.REDIS_PREFIX || 'job-notification:production' });
      const snapshot = await store.snapshot();
      const sent = snapshot?.date ? await store.delivery(snapshot.date) : null;
      return res.status(200).json(dashboardPayload(snapshot, sent, env.NOTIFICATIONS_ENABLED === 'true'));
    } catch {
      return res.status(503).json({ code: 'UNAVAILABLE', error: 'Die Suchergebnisse konnten nicht geladen werden. Bitte später erneut versuchen.' });
    }
  };
}

export default createDashboardHandler();
