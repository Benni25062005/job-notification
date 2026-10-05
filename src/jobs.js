import { createHash } from 'node:crypto';

export function plainText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,
    entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity])
    .replace(/\s+/g, ' ').trim();
}

export function normalize(value) {
  return plainText(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function fromAdzuna(raw, country) {
  const url = safeUrl(raw.redirect_url);
  const title = plainText(raw.title);
  if (!raw.id || !url || !title) return null;
  return {
    id: `adzuna:${country}:${raw.id}`, source: 'Adzuna', country, title,
    company: plainText(raw.company?.display_name) || 'Unternehmen nicht angegeben',
    location: plainText(raw.location?.display_name) || 'Standort unklar',
    description: plainText(raw.description).slice(0, 3000), url,
    publishedAt: Number.isFinite(Date.parse(raw.created)) ? new Date(raw.created).toISOString() : null,
  };
}

export function identityKeys(job) {
  const keys = [job.id];
  if (job.company !== 'Unternehmen nicht angegeben' && job.location !== 'Standort unklar') {
    const fingerprint = [job.country, job.company, job.title, job.location].map(normalize).join('|');
    keys.push(`fingerprint:${createHash('sha256').update(fingerprint).digest('hex')}`);
  }
  return keys;
}

export function deduplicate(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const keys = identityKeys(job);
    if (keys.some(key => seen.has(key))) return false;
    keys.forEach(key => seen.add(key));
    return true;
  });
}
