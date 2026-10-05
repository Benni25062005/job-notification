import { randomUUID } from 'node:crypto';
import { searchProfile } from './config.js';
import { identityKeys } from './jobs.js';
import { rankJobs } from './rank.js';
import { buildEmail } from './email.js';
import { localClock } from './time.js';

export async function deliverPending(pending, { store, send, token, now = () => new Date() }) {
  if (!pending.providerId) {
    // Resend merkt sich Schlüssel nur 24 h. Bei unklarem älterem Versand nicht blind erneut senden.
    if (pending.attemptedAt && now().getTime() - Date.parse(pending.attemptedAt) >= 23 * 3600_000) {
      throw new Error('Unklarer Versand älter als 23 Stunden. Mit npm run recover prüfen und abschließen.');
    }
    if (!pending.attemptedAt) pending.attemptedAt = now().toISOString();
    await store.save(pending, token);
    pending.providerId = await send(pending.payload, pending.id);
    await store.save(pending, token);
  }
  await store.commit(pending, token);
}

export async function runDaily({ config, store, search, send, now = () => new Date(), profile = searchProfile }) {
  const clock = localClock(now(), profile.timeZone);
  if (clock.hour !== 0) return { status: 'outside-window' };
  const token = randomUUID();
  if (!await store.acquire(token)) return { status: 'already-running' };
  try {
    let pending = await store.pending();
    if (pending) await deliverPending(pending, { store, send, token, now });
    if (await store.completed(clock.date)) return { status: 'already-completed' };
    const result = await search();
    const ranked = rankJobs(result.jobs, profile);
    const keys = [...new Set(ranked.flatMap(identityKeys))];
    const seen = await store.seen(keys);
    const unseen = ranked.filter(job => !identityKeys(job).some(key => seen.has(key)));
    const unseenIds = new Set(unseen.map(job => job.id));
    await store.saveSnapshot({
      date: clock.date, searchedAt: now().toISOString(), warnings: result.warnings,
      jobs: ranked.map(job => ({ ...job, isNew: unseenIds.has(job.id) })),
    }, token);
    const jobs = unseen.slice(0, profile.maxJobsPerEmail);
    pending = {
      id: `jobs/${randomUUID()}`, date: clock.date, createdAt: now().toISOString(),
      count: jobs.length, keys: [...new Set(jobs.flatMap(identityKeys))],
      payload: buildEmail({ date: clock.date, jobs, warnings: result.warnings,
        remaining: unseen.length - jobs.length, from: config.from, to: config.to }),
    };
    await store.save(pending, token);
    await deliverPending(pending, { store, send, token, now });
    return { status: 'sent', count: jobs.length, remaining: unseen.length - jobs.length, warnings: result.warnings.length };
  } finally {
    // Ein Release-Fehler darf den ursprünglichen Fehler nicht verdecken. Die Sperre läuft nach 10 min ab.
    await store.release(token).catch(() => console.error('Redis: Sperre konnte nicht freigegeben werden.'));
  }
}
