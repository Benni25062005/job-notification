export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export const normalize = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
export function filterJobs(jobs, { query = '', region = 'all', category = 'all', onlyNew = false, savedOnly = false, saved = new Set(), sort = 'score' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return jobs.filter(job => (region === 'all' || job.country === region)
    && (category === 'all' || job.category === category)
    && (!onlyNew || job.isNew)
    && (!savedOnly || saved.has(job.id))
    && words.every(word => normalize([job.title, job.company, job.location, job.description, ...(job.reasons || [])].join(' ')).includes(word)))
    .sort((a, b) => (sort === 'company' ? a.company.localeCompare(b.company, 'de') : sort === 'date' ? (b.publishedAt || '').localeCompare(a.publishedAt || '') : b.score - a.score) || b.score - a.score || a.id.localeCompare(b.id));
}
