import { requestJson } from './http.js';
import { fromAdzuna, deduplicate } from './jobs.js';
import { searchProfile } from './config.js';

export async function searchJobs(config, { profile = searchProfile, fetchImpl = fetch, signal } = {}) {
  // Zwei parallele Regionen, Seiten je Region sequenziell; standardmäßig höchstens 6 API-Aufrufe.
  const outcomes = await Promise.allSettled(profile.areas.map(async area => {
    const jobs = [];
    const warnings = [];
    for (let page = 1; page <= profile.maxPagesPerArea; page++) {
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${area.country}/search/${page}`);
      url.search = new URLSearchParams({
        app_id: config.adzunaId, app_key: config.adzunaKey,
        what_or: profile.keywords, where: area.where, distance: String(area.distance),
        results_per_page: String(profile.pageSize), max_days_old: String(profile.maxDaysOld),
        sort_by: 'date', sort_dir: 'down', 'content-type': 'application/json',
      }).toString();
      let data;
      try {
        data = await requestJson(url, { headers: { Accept: 'application/json' }, signal }, `Adzuna ${area.country}`, fetchImpl);
        if (!Array.isArray(data.results)) throw new Error(`Adzuna ${area.country}: Ergebnisse fehlen.`);
      } catch (error) {
        if (page === 1) throw error;
        warnings.push(`${area.where}: Suche ab Seite ${page} unvollständig. ${error.message}`);
        break;
      }
      let invalid = 0;
      for (const raw of data.results) {
        const job = raw && typeof raw === 'object' ? fromAdzuna(raw, area.country) : null;
        if (job) jobs.push(job); else invalid++;
      }
      if (invalid) warnings.push(`${area.where}: ${invalid} ungültige Einträge auf Seite ${page} übersprungen.`);
      if (data.results.length < profile.pageSize || (Number.isFinite(data.count) && page * profile.pageSize >= data.count)) break;
      if (page === profile.maxPagesPerArea) warnings.push(`${area.where}: Seitenlimit erreicht; nicht alle Treffer abgerufen.`);
    }
    return { jobs, warnings };
  }));
  if (outcomes.every(result => result.status === 'rejected')) throw new Error('Alle Stellenquellen fehlgeschlagen. Zugangsdaten und Vercel-Logs prüfen.');
  const jobs = [], warnings = [];
  outcomes.forEach((result, index) => {
    if (result.status === 'fulfilled') { jobs.push(...result.value.jobs); warnings.push(...result.value.warnings); }
    else warnings.push(`${profile.areas[index].where}: Quelle nicht verfügbar. ${result.reason.message}`);
  });
  return { jobs: deduplicate(jobs), warnings };
}
