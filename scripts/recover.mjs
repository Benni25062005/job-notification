import { randomUUID } from 'node:crypto';
import { readConfig } from '../src/config.js';
import { RedisStore } from '../src/store.js';
import { requestJson } from '../src/http.js';

const config = readConfig(), store = new RedisStore(config), token = randomUUID();
if (!await store.acquire(token)) throw new Error('Ein anderer Lauf ist aktiv.');
try {
  const pending = await store.pending();
  if (!pending) { console.log('Kein offener Versand.'); process.exitCode = 0; }
  else {
    const suppliedId = process.argv.find(arg => arg.startsWith('--email-id='))?.slice(11);
    const emailId = pending.providerId || suppliedId;
    if (process.argv.includes('--discard-confirmed-unsent')) {
      if (pending.providerId) throw new Error('Ein bereits bestätigter Versand darf nicht verworfen werden.');
      await store.discardUnsent(pending, token);
      console.log('Als unversendet bestätigten Bericht verworfen. Stellen bleiben für den nächsten Lauf verfügbar.');
    } else if (!emailId) {
      console.log(JSON.stringify({ date: pending.date, idempotencyKey: pending.id, attemptedAt: pending.attemptedAt, count: pending.count }, null, 2));
      console.log('Resend-Dashboard prüfen. Falls angenommen: npm run recover -- --email-id=RESEND_ID. Es wird keine E-Mail gesendet.');
    } else {
      if (!/^[a-zA-Z0-9-]+$/.test(emailId)) throw new Error('Ungültige E-Mail-ID.');
      const email = await requestJson(`https://api.resend.com/emails/${emailId}`, { headers: { Authorization: `Bearer ${config.resendKey}` } }, 'Resend');
      if (email.subject !== pending.payload.subject || email.html !== pending.payload.html ||
          email.from !== pending.payload.from || JSON.stringify(email.to) !== JSON.stringify(pending.payload.to)) {
        throw new Error('E-Mail stimmt nicht mit dem offenen Bericht überein. Keine Änderung vorgenommen.');
      }
      pending.providerId = emailId;
      await store.save(pending, token);
      await store.commit(pending, token);
      console.log('Bereits von Resend angenommener Bericht als versendet verbucht. Keine neue E-Mail gesendet.');
    }
  }
} finally { await store.release(token); }
