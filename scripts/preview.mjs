import { mkdir, writeFile } from 'node:fs/promises';
import { searchJobs } from '../src/adzuna.js';
import { rankJobs } from '../src/rank.js';
import { buildEmail } from '../src/email.js';
import { localClock } from '../src/time.js';
import { searchProfile } from '../src/config.js';

const demo = process.argv.includes('--demo');
let result;
if (demo) {
  const base = { country: 'at', source: 'Adzuna', company: 'Beispielunternehmen (Demo)', publishedAt: '2026-10-05T08:00:00Z', url: 'https://example.com/demo', description: 'Beispielanzeige, keine echte Stelle. React, JavaScript und PHP.' };
  result = { jobs: [
    { ...base, id: 'demo:1', title: 'Junior Webentwickler (Demo)', location: 'Dornbirn' },
    { ...base, id: 'demo:2', title: 'Softwareentwickler (Demo)', location: 'Feldkirch', description: 'Beispielanzeige. 2–3 Jahre Erfahrung mit C# und .NET erwünscht.' },
    { ...base, id: 'demo:3', title: 'Senior Software Developer (Demo)', location: 'Ravensburg', country: 'de' },
  ], warnings: ['DEMO: Alle gezeigten Stellen sind erfundene Testdaten.'] };
} else {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) throw new Error('ADZUNA_APP_ID und ADZUNA_APP_KEY in .env.local setzen oder --demo verwenden.');
  result = await searchJobs({ adzunaId: process.env.ADZUNA_APP_ID, adzunaKey: process.env.ADZUNA_APP_KEY });
}
const ranked = rankJobs(result.jobs);
const email = buildEmail({ date: localClock().date, jobs: ranked.slice(0, searchProfile.maxJobsPerEmail),
  remaining: Math.max(0, ranked.length - searchProfile.maxJobsPerEmail), warnings: result.warnings,
  from: 'preview@example.com', to: 'preview@example.com' });
await mkdir('preview', { recursive: true });
await writeFile('preview/digest.html', email.html);
await writeFile('preview/digest.txt', email.text);
console.log(`${demo ? 'Demo' : 'Live-Suche'}: ${ranked.length} Treffer. Vorschau: preview/digest.html. Keine E-Mail gesendet, keine Datenbank verändert.`);
