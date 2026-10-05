import { authorized } from '../../src/auth.js';
import { readConfig } from '../../src/config.js';
import { searchJobs } from '../../src/adzuna.js';
import { sendEmail } from '../../src/email.js';
import { RedisStore } from '../../src/store.js';
import { runDaily } from '../../src/run.js';

export { authorized };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!authorized(req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return res.status(200).json({ status: 'not-production' });
  if (process.env.NOTIFICATIONS_ENABLED !== 'true') return res.status(200).json({ status: 'disabled' });
  try {
    const config = readConfig();
    const result = await runDaily({
      config, store: new RedisStore(config),
      search: () => searchJobs(config, { signal: AbortSignal.timeout(180000) }),
      send: (payload, key) => sendEmail(payload, key, config.resendKey),
    });
    console.info(JSON.stringify(result));
    return res.status(200).json(result);
  } catch (error) {
    // Eigene Fehler enthalten keine Secrets, Rohantworten oder E-Mail-Inhalte.
    console.error(error.message);
    return res.status(500).json({ error: 'Lauf fehlgeschlagen. Server-Logs prüfen.' });
  }
}
