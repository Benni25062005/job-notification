import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardHandler } from '../api/dashboard.js';
import { filterJobs, safeUrl, escapeHtml } from '../public/view.js';
import { demoData } from '../public/demo.js';
import { RedisStore } from '../src/store.js';

const token = 'test-dashboard-token-0123456789abcdef';
const env = { DASHBOARD_TOKEN: token, CRON_SECRET: 'different-cron-secret-0123456789abcdef', UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'private-token', NOTIFICATIONS_ENABLED: 'true' };
function response() { return { code: null, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return body; } }; }

test('dashboard refuses missing/wrong tokens and the cron secret before reading Redis', async () => {
  const handler = createDashboardHandler({ env, makeStore: () => assert.fail('Must not access Redis') });
  for (const header of [undefined, 'Bearer wrong', `Bearer ${env.CRON_SECRET}`]) {
    const res = response(); await handler({ method: 'GET', headers: { authorization: header } }, res);
    assert.equal(res.code, 401); assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});

test('dashboard exposes saved results and public delivery summary, not recipient or provider ID', async () => {
  const demo = demoData();
  const handler = createDashboardHandler({ env, makeStore: () => ({
    snapshot: async () => ({ ...demo, date: '2026-10-05' }),
    delivery: async () => ({ count: 3, completedAt: '2026-10-04T22:30:00Z', providerId: 'private-provider-id', to: 'private@example.com' }),
  }) });
  const res = response(); await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.jobs.length, 6);
  assert.equal(res.body.email.status, 'accepted'); assert.equal(res.body.notificationsEnabled, true);
  assert.ok(!JSON.stringify(res.body).includes('private'));
});

test('dashboard distinguishes setup, no results yet, and storage failure', async () => {
  const req = { method: 'GET', headers: { authorization: `Bearer ${token}` } };
  let res = response(); await createDashboardHandler({ env: {} })(req, res);
  assert.equal(res.code, 503); assert.equal(res.body.code, 'SETUP_REQUIRED');
  res = response(); await createDashboardHandler({ env, makeStore: () => ({ snapshot: async () => null }) })(req, res);
  assert.equal(res.code, 200); assert.deepEqual(res.body.jobs, []); assert.equal(res.body.searchedAt, null);
  res = response(); await createDashboardHandler({ env, makeStore: () => ({ snapshot: async () => { throw new Error('private database error'); } }) })(req, res);
  assert.equal(res.code, 503); assert.ok(!JSON.stringify(res.body).includes('private database'));
  res = response(); await createDashboardHandler({ env })({ method: 'POST', headers: {} }, res);
  assert.equal(res.code, 405);
});

test('UI combines query, geography, relevance, new-only and bookmarks without changing source data', () => {
  const jobs = demoData().jobs, before = structuredClone(jobs);
  assert.equal(filterJobs(jobs, { category: 'Sehr passend' }).length, 2);
  assert.equal(filterJobs(jobs, { region: 'de' }).length, 2);
  assert.equal(filterJobs(jobs, { onlyNew: true }).length, 3);
  assert.equal(filterJobs(jobs, { region: 'at', query: 'react junior' }).length, 1);
  assert.equal(filterJobs(jobs, { query: 'not-a-company' }).length, 0);
  assert.equal(filterJobs(jobs, { savedOnly: true, saved: new Set(['demo-3']) })[0].id, 'demo-3');
  assert.equal(filterJobs(jobs, { sort: 'score' })[0].score, 95);
  assert.equal(filterJobs(jobs, { sort: 'date' })[0].id, 'demo-1');
  assert.deepEqual(jobs, before);
});

test('UI safely renders content and rejects executable or credential-bearing links', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://user:pass@example.com'), null);
  assert.equal(safeUrl('https://example.com/job'), 'https://example.com/job');
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

test('snapshot persistence is fenced by the search lock and expires after seven days', async () => {
  let command;
  const store = new RedisStore({ redisUrl: 'https://redis.example.com', redisToken: 'secret', prefix: 'test' }, async (_, options) => { command = JSON.parse(options.body); return Response.json({ result: 1 }); });
  await store.saveSnapshot({ jobs: [] }, 'lock-owner');
  assert.equal(command[0], 'EVAL'); assert.match(command[1], /604800/);
  assert.deepEqual(command.slice(2, 6), [2, 'test:lock', 'test:dashboard', 'lock-owner']);
});
