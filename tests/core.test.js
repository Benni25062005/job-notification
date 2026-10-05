import test from 'node:test';
import assert from 'node:assert/strict';
import { localClock } from '../src/time.js';
import { rankJob, rankJobs } from '../src/rank.js';
import { fromAdzuna, deduplicate, identityKeys } from '../src/jobs.js';
import { buildEmail, sendEmail } from '../src/email.js';
import { searchJobs } from '../src/adzuna.js';
import { searchProfile, readConfig } from '../src/config.js';
import { runDaily } from '../src/run.js';
import handler, { authorized } from '../api/cron/search.js';
import { RedisStore, scripts } from '../src/store.js';

const base = { id: 'adzuna:at:1', source: 'Adzuna', country: 'at', title: 'Junior Softwareentwickler',
  company: 'Test GmbH', location: 'Dornbirn', description: 'React und PHP',
  url: 'https://example.com/job/1', publishedAt: '2026-10-01T12:00:00Z' };
const atMidnight = () => new Date('2026-10-04T22:30:00Z');
const config = { from: 'Jobs <jobs@example.com>', to: 'recipient@example.com' };

class MemoryStore {
  lock = null; record = null; sent = new Set(); days = new Set(); failCommits = 0;
  async acquire(token) { if (this.lock) return false; this.lock = token; return true; }
  async release(token) { if (this.lock === token) this.lock = null; }
  async completed(date) { return this.days.has(date); }
  async pending() { return structuredClone(this.record); }
  async seen(keys) { return new Set(keys.filter(key => this.sent.has(key))); }
  async save(pending, token) { assert.equal(token, this.lock); this.record = structuredClone(pending); }
  async commit(pending, token) {
    assert.equal(token, this.lock);
    if (this.failCommits-- > 0) throw new Error('Storage unavailable');
    pending.keys.forEach(key => this.sent.add(key));
    this.days.add(pending.date); this.record = null;
  }
}

test('UTC schedules hit local midnight exactly once, including DST transition dates', () => {
  for (const midnight of ['2026-01-06T00:00:00+01:00', '2026-07-06T00:00:00+02:00',
    '2026-03-29T00:00:00+01:00', '2026-03-30T00:00:00+02:00',
    '2026-10-25T00:00:00+02:00', '2026-10-26T00:00:00+01:00']) {
    const target = new Date(midnight), date = localClock(target).date;
    const utcDate = target.toISOString().slice(0, 10);
    for (const minute of ['00', '30', '59']) {
      const clocks = [22, 23].map(hour => localClock(new Date(`${utcDate}T${hour}:${minute}:00Z`)));
      assert.equal(clocks.filter(clock => clock.hour === 0 && clock.date === date).length, 1);
    }
  }
});

test('senior, experience and distant locations are down-ranked, never discarded', () => {
  assert.equal(rankJob(base).category, 'Sehr passend');
  assert.equal(rankJob({ ...base, title: 'Senior Software Engineer' }).category, 'Weniger passend');
  assert.equal(rankJob({ ...base, title: 'Lead Developer', description: 'Software React' }).category, 'Weniger passend');
  assert.equal(rankJob({ ...base, description: '2–3 Jahre Erfahrung mit React' }).category, 'Potenziell passend');
  assert.equal(rankJob({ ...base, description: 'Mindestens 5 Jahre Berufserfahrung mit PHP' }).category, 'Weniger passend');
  assert.equal(rankJob({ ...base, location: 'Bludenz' }).category, 'Weniger passend');
  assert.equal(rankJob({ ...base, location: 'Feldkirch' }).category, 'Sehr passend');
  assert.equal(rankJob({ ...base, location: 'Bergisch Gladbach' }).category, 'Weniger passend');
  assert.ok(rankJob({ ...base, title: 'Java Entwickler', description: '' }));
  assert.equal(rankJob({ ...base, title: 'Softwareentwickler Praktikum' }).category, 'Weniger passend');
  assert.equal(rankJob({ ...base, title: 'Verkäufer', description: 'Unsere Software ist modern' }), null);
});

test('ranking is deterministic and transparent', () => {
  const jobs = rankJobs([{ ...base, id: '2', title: 'Senior Software Engineer' }, base]);
  assert.equal(jobs[0].id, base.id);
  assert.ok(jobs[0].reasons.some(reason => reason.includes('React')));
});

test('normalization preserves source IDs, merges repeat ads and rejects unsafe links', () => {
  const raw = { id: 123, title: '<b>Developer</b>', redirect_url: 'https://example.com/123?utm_source=adzuna', location: { display_name: 'Dornbirn' }, company: { display_name: 'Firma' }, created: 'invalid' };
  assert.equal(fromAdzuna(raw, 'at').title, 'Developer');
  assert.equal(fromAdzuna(raw, 'at').publishedAt, null);
  assert.equal(fromAdzuna({ ...raw, redirect_url: 'javascript:alert(1)' }, 'at'), null);
  assert.equal(deduplicate([base, { ...base, id: 'other' }]).length, 1);
  assert.equal(deduplicate([base, { ...base, id: 'other', location: 'Feldkirch' }]).length, 2);
  assert.equal(identityKeys({ ...base, company: 'Unternehmen nicht angegeben' }).length, 1);
});

test('email escapes untrusted job content and contains every relevance category', () => {
  const jobs = rankJobs([base, { ...base, id: '2', title: 'Softwareentwickler', location: 'Feldkirch' },
    { ...base, id: '3', title: 'Senior <script>alert(1)</script> Software Engineer', company: 'A & B', url: 'javascript:alert(1)' }]);
  const mail = buildEmail({ date: '2026-10-05', jobs, ...config });
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(!mail.html.includes('href="javascript:'));
  assert.ok(mail.html.includes('A &amp; B'));
  for (const label of ['Sehr passend', 'Potenziell passend', 'Weniger passend']) assert.ok(mail.text.includes(label));
  assert.ok(mail.text.includes('The Adzuna API'));
});

test('Adzuna searches AT and DE without excluding senior roles, paginates and warns on truncation', async () => {
  const calls = [];
  const profile = { ...searchProfile, pageSize: 1, maxPagesPerArea: 2 };
  const result = await searchJobs({ adzunaId: 'id', adzunaKey: 'secret' }, { profile, fetchImpl: async url => {
    calls.push(new URL(url));
    return Response.json({ count: 3, results: [{ id: new URL(url).pathname, title: 'Senior Softwareentwickler', redirect_url: 'https://example.com/job', company: { display_name: 'Company' }, location: { display_name: 'Dornbirn' } }] });
  } });
  assert.equal(calls.length, 4);
  assert.equal(result.warnings.length, 2);
  assert.ok(calls.every(url => !url.searchParams.has('what_exclude')));
  assert.ok(calls.every(url => url.searchParams.get('sort_by') === 'date'));
  assert.equal(result.jobs.length, 2);
});

test('source failures are visible; total failure is never reported as no new jobs', async () => {
  const options = { fetchImpl: async url => new URL(url).pathname.includes('/at/') ? Response.json({}, { status: 503 }) : Response.json({ results: [] }) };
  const result = await searchJobs({}, options);
  assert.equal(result.warnings.length, 1);
  await assert.rejects(searchJobs({}, { fetchImpl: async () => Response.json({}, { status: 503 }) }), /Alle Stellenquellen/);
});

test('daily run sends once, persists IDs and skips already sent ads on the next day', async () => {
  const store = new MemoryStore(), mails = [];
  const options = { config, store, now: atMidnight, search: async () => ({ jobs: [base], warnings: [] }), send: async (payload, key) => { mails.push({ payload, key }); return 'email-id'; } };
  assert.equal((await runDaily(options)).count, 1);
  assert.equal((await runDaily(options)).status, 'already-completed');
  assert.equal(mails.length, 1);
  assert.equal((await runDaily({ ...options, now: () => new Date('2026-10-05T22:30:00Z') })).count, 0);
  assert.equal(mails.length, 2); // Daily zero-results digest, not duplicate jobs.
});

test('simultaneous calls do not send twice', async () => {
  const store = new MemoryStore(); let sends = 0;
  const options = { config, store, now: atMidnight, search: async () => ({ jobs: [base], warnings: [] }), send: async () => { sends++; return 'id'; } };
  const results = await Promise.all([runDaily(options), runDaily(options)]);
  assert.equal(sends, 1);
  assert.ok(results.some(result => result.status === 'already-running'));
});

test('failed email keeps immutable payload for retry and does not mark jobs sent', async () => {
  const store = new MemoryStore(); let searches = 0;
  const options = { config, store, now: atMidnight, search: async () => { searches++; return { jobs: [base], warnings: [] }; }, send: async () => { throw new Error('timeout'); } };
  await assert.rejects(runDaily(options), /timeout/);
  const original = structuredClone(store.record);
  assert.equal(store.sent.size, 0);
  await runDaily({ ...options, send: async (payload, id) => { assert.deepEqual(payload, original.payload); assert.equal(id, original.id); return 'id'; } });
  assert.equal(searches, 1);
  assert.ok(store.sent.has(base.id));
});

test('storage failure after accepted email resumes without sending again', async () => {
  const store = new MemoryStore(); store.failCommits = 1; let sends = 0;
  const options = { config, store, now: atMidnight, search: async () => ({ jobs: [base], warnings: [] }), send: async () => { sends++; return 'provider-id'; } };
  await assert.rejects(runDaily(options), /Storage/);
  await runDaily(options);
  assert.equal(sends, 1);
  assert.equal(store.record, null);
});

test('expired provider idempotency window stops uncertain resend', async () => {
  const store = new MemoryStore();
  store.record = { id: 'pending', date: '2026-10-04', attemptedAt: '2026-10-03T22:30:00Z' };
  await assert.rejects(runDaily({ config, store, now: atMidnight, send: async () => assert.fail('must not send') }), /23 Stunden/);
  assert.equal(store.lock, null);
});

test('email limit leaves unsent jobs eligible for the next day', async () => {
  const store = new MemoryStore(), second = { ...base, id: '2', title: 'Senior Softwareentwickler' };
  await runDaily({ config, store, now: atMidnight, profile: { ...searchProfile, maxJobsPerEmail: 1 },
    search: async () => ({ jobs: [base, second], warnings: [] }), send: async () => 'id' });
  assert.ok(store.sent.has(base.id));
  assert.ok(!store.sent.has(second.id));
});

test('out-of-window call does not touch storage', async () => {
  assert.equal((await runDaily({ now: () => new Date('2026-10-04T23:30:00Z') })).status, 'outside-window');
});

test('endpoint rejects unauthenticated calls even with no configured secret', async () => {
  assert.equal(authorized('Bearer undefined', undefined), false);
  assert.equal(authorized(`Bearer ${'x'.repeat(32)}`, 'x'.repeat(32)), true);
  const res = { code: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { return body; } };
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 401);
  await handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.throws(() => readConfig({}), /Konfiguration fehlt/);
});

test('Resend request supplies fixed payload and idempotency key without leaking errors', async () => {
  let request;
  assert.equal(await sendEmail({ ...config, subject: 'Test' }, 'jobs/key', 'secret', async (url, options) => { request = { url, options }; return Response.json({ id: 'id' }); }), 'id');
  assert.equal(request.options.headers['Idempotency-Key'], 'jobs/key');
  await assert.rejects(sendEmail({}, 'key', 'secret', async () => { throw new Error('URL_WITH_SECRET'); }), error => !error.message.includes('SECRET'));
});

test('Redis REST commands use atomic locking, persistent deduplication and fenced finalization', async () => {
  const calls = [];
  const redis = new RedisStore({ redisUrl: 'https://redis.example.com', redisToken: 'secret', prefix: 'test' }, async (_, options) => {
    const command = JSON.parse(options.body); calls.push(command);
    const result = command[0] === 'SET' ? 'OK' : command[0] === 'SMISMEMBER' ? [1, 0] : 1;
    return Response.json({ result });
  });
  assert.ok(await redis.acquire('token'));
  assert.deepEqual(calls[0], ['SET', 'test:lock', 'token', 'NX', 'EX', 600]);
  assert.deepEqual(await redis.seen(['a', 'b']), new Set(['a']));
  await redis.commit({ id: 'digest', date: '2026-10-05', keys: ['a'], count: 1, providerId: 'email' }, 'token');
  const commit = calls.at(-1);
  assert.equal(commit[0], 'EVAL'); assert.equal(commit[1], scripts.commit);
  assert.deepEqual(commit.slice(2, 9), [4, 'test:lock', 'test:pending', 'test:sent', 'test:done:2026-10-05', 'token', 'digest']);
  await redis.release('token');
  assert.equal(calls.at(-1)[1], scripts.release);
});
