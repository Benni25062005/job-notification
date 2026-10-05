import { requestJson } from './http.js';

export const scripts = {
  release: `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
  save: `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2]) return 1`,
  discard: `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end local raw = redis.call('GET', KEYS[2]) if not raw or cjson.decode(raw).id ~= ARGV[2] then return 0 end redis.call('DEL', KEYS[2]) return 1`,
  commit: `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    local raw = redis.call('GET', KEYS[2])
    if not raw or cjson.decode(raw).id ~= ARGV[2] then return 0 end
    for i = 4, #ARGV do redis.call('SADD', KEYS[3], ARGV[i]) end
    redis.call('SET', KEYS[4], ARGV[3], 'EX', 7776000)
    redis.call('DEL', KEYS[2])
    return 1`,
};

export class RedisStore {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }
  key(suffix) { return `${this.config.prefix}:${suffix}`; }
  async command(...command) {
    const data = await requestJson(this.config.redisUrl, {
      method: 'POST', headers: { Authorization: `Bearer ${this.config.redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    }, 'Redis', this.fetchImpl);
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('Redis: Befehl fehlgeschlagen.');
    return data.result;
  }
  async acquire(token) { return await this.command('SET', this.key('lock'), token, 'NX', 'EX', 600) === 'OK'; }
  async release(token) { await this.command('EVAL', scripts.release, 1, this.key('lock'), token); }
  async completed(date) { return Boolean(await this.command('GET', this.key(`done:${date}`))); }
  async delivery(date) {
    const raw = await this.command('GET', this.key(`done:${date}`));
    return raw ? JSON.parse(raw) : null;
  }
  async snapshot() {
    const raw = await this.command('GET', this.key('dashboard'));
    return raw ? JSON.parse(raw) : null;
  }
  async saveSnapshot(snapshot, token) {
    const script = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2], 'EX', 604800) return 1`;
    const result = await this.command('EVAL', script, 2, this.key('lock'), this.key('dashboard'), token, JSON.stringify(snapshot));
    if (result !== 1) throw new Error('Suchergebnisse konnten nicht gespeichert werden.');
  }
  async pending() {
    const raw = await this.command('GET', this.key('pending'));
    return raw ? JSON.parse(raw) : null;
  }
  async seen(keys) {
    if (!keys.length) return new Set();
    const flags = await this.command('SMISMEMBER', this.key('sent'), ...keys);
    if (!Array.isArray(flags) || flags.length !== keys.length) throw new Error('Redis: Duplikatprüfung fehlgeschlagen.');
    return new Set(keys.filter((_, index) => flags[index] === 1));
  }
  async save(pending, token) {
    const result = await this.command('EVAL', scripts.save, 2, this.key('lock'), this.key('pending'), token, JSON.stringify(pending));
    if (result !== 1) throw new Error('Sperre verloren; Verarbeitung gestoppt.');
  }
  async commit(pending, token) {
    const summary = { providerId: pending.providerId, count: pending.count, completedAt: new Date().toISOString() };
    const result = await this.command('EVAL', scripts.commit, 4, this.key('lock'), this.key('pending'), this.key('sent'), this.key(`done:${pending.date}`),
      token, pending.id, JSON.stringify(summary), ...pending.keys);
    if (result !== 1) throw new Error('Versandstatus konnte nicht abgeschlossen werden.');
  }
  async discardUnsent(pending, token) {
    const result = await this.command('EVAL', scripts.discard, 2, this.key('lock'), this.key('pending'), token, pending.id);
    if (result !== 1) throw new Error('Offener Versand konnte nicht verworfen werden.');
  }
}
