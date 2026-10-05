import { categories } from './rank.js';
import { safeUrl } from './jobs.js';
import { requestJson } from './http.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function buildEmail({ date, jobs, warnings = [], remaining = 0, from, to }) {
  const subject = `${jobs.length} neue Entwicklerstellen · ${date}${warnings.length ? ' · Suche unvollständig' : ''}`;
  const intro = jobs.length ? 'Neu für dich gefunden, nach Passung sortiert.' : 'Heute wurden keine neuen Entwicklerstellen in den abgefragten Quellen gefunden.';
  const notes = [
    'Region: Vorarlberger Unterland/Rheintal bis Feldkirch und Bodensee bis Ravensburg/Weingarten.',
    'Bewertung anhand von Titel, Standort und Beschreibungsausschnitt. Anforderungen und Verfügbarkeit in der Originalanzeige prüfen.',
    '„Neu“ bedeutet erstmals in deinem Bericht; das Veröffentlichungsdatum laut Quelle steht beim Treffer. Suche umfasst die letzten 30 Tage.',
    ...(remaining ? [`Weitere ${remaining} unversendete Treffer bleiben für den nächsten Bericht vorgemerkt, solange sie im Suchzeitraum liegen.`] : []),
    ...warnings.map(warning => `Hinweis: ${warning}`),
  ];
  let html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f8;color:#172033;font-family:Arial,sans-serif"><main style="max-width:680px;margin:auto;padding:28px 20px"><p style="color:#58657a;font-size:12px">JOB-BENACHRICHTIGUNG · ${escapeHtml(date)}</p><h1 style="font-size:26px">${jobs.length} neue Entwicklerstellen</h1><p>${escapeHtml(intro)}</p>`;
  const lines = [subject, '', intro, ...notes, ''];
  for (const category of categories) {
    const group = jobs.filter(job => job.category === category);
    if (!group.length) continue;
    html += `<h2 style="font-size:19px;margin-top:30px">${escapeHtml(category)} (${group.length})</h2>`;
    lines.push(category, '');
    for (const job of group) {
      const url = safeUrl(job.url);
      const published = job.publishedAt ? new Date(job.publishedAt).toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna' }) : 'unbekannt';
      const sourceUrl = job.country === 'at' ? 'https://www.adzuna.at/' : 'https://www.adzuna.de/';
      html += `<article style="background:#fff;border:1px solid #dce2eb;border-radius:10px;padding:18px;margin:14px 0"><h3 style="margin:0 0 8px;font-size:17px">${escapeHtml(job.title)}</h3><p>${escapeHtml(job.company)} · ${escapeHtml(job.location)}</p><p style="font-size:12px;color:#58657a">Passung: ${job.score}/100 · Veröffentlicht laut Quelle: ${escapeHtml(published)}</p><ul>${job.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><p style="line-height:1.5">${escapeHtml(job.description.slice(0, 400))}${job.description.length > 400 ? '…' : ''}</p>${url ? `<p><a href="${escapeHtml(url)}" style="color:#1455b8">Stellenanzeige öffnen →</a></p>` : ''}<p style="font-size:12px;color:#58657a">Quelle: <a href="${sourceUrl}">The Adzuna API</a></p></article>`;
      lines.push(job.title, `${job.company} | ${job.location} | ${job.score}/100`, `Veröffentlicht laut Quelle: ${published}`, ...job.reasons.map(reason => `- ${reason}`), job.description.slice(0, 400), url || '', `Quelle: The Adzuna API – ${sourceUrl}`, '');
    }
  }
  html += `<div style="font-size:12px;line-height:1.6;color:#58657a">${notes.map(note => `<p>${escapeHtml(note)}</p>`).join('')}<p>Persönliche Stellensuche · Quelle: <a href="https://www.adzuna.at/">The Adzuna API</a></p></div></main></body></html>`;
  return { from, to: [to], subject, html, text: lines.join('\n') };
}

export async function sendEmail(payload, key, apiKey, fetchImpl = fetch) {
  const result = await requestJson('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  }, 'Resend', fetchImpl);
  if (typeof result.id !== 'string' || !result.id) throw new Error('Resend: Versandbestätigung fehlt.');
  return result.id;
}
