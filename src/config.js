export const searchProfile = {
  timeZone: 'Europe/Vienna',
  // Breite Suche; Junior/Senior werden anschließend bewertet, nicht ausgeschlossen.
  keywords: 'Softwareentwickler Softwareentwicklung Webentwickler Webentwicklung Developer Programmierer Frontend Backend Fullstack',
  areas: [
    { country: 'at', where: 'Bregenz', distance: 50 },
    { country: 'de', where: 'Ravensburg', distance: 50 },
  ],
  maxDaysOld: 30,
  maxPagesPerArea: 3,
  pageSize: 50,
  // Nicht versendete Treffer werden NICHT als versendet markiert.
  maxJobsPerEmail: 50,
  preferredPlaces: ['Hohenems', 'Dornbirn', 'Bregenz', 'Wolfurt', 'Lauterach',
    'Hard', 'Lustenau', 'Höchst', 'Fußach', 'Gaißau', 'Schwarzach', 'Bildstein',
    'Kennelbach', 'Lochau', 'Hörbranz', 'Altach', 'Götzis', 'Koblach', 'Mäder'],
  acceptedPlaces: ['Feldkirch', 'Rankweil', 'Sulz', 'Röthis', 'Weiler', 'Fraxern',
    'Klaus', 'Zwischenwasser', 'Meiningen', 'Lindau', 'Weißensberg', 'Sigmarszell',
    'Hergensweiler', 'Wangen', 'Ravensburg', 'Weingarten', 'Friedrichshafen',
    'Tettnang', 'Meckenbeuren', 'Langenargen', 'Kressbronn', 'Bodolz',
    'Wasserburg', 'Baienfurt', 'Baindt', 'Berg'],
  skills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'PHP', 'C#', '.NET',
    'MySQL', 'SQL', 'HTML', 'CSS', 'Tailwind', 'WordPress'],
};

export function readConfig(env = process.env) {
  const required = ['CRON_SECRET', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RESEND_API_KEY',
    'EMAIL_FROM', 'EMAIL_TO'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Konfiguration fehlt: ${missing.join(', ')}`);
  if (env.CRON_SECRET.length < 32) throw new Error('CRON_SECRET muss mindestens 32 Zeichen haben.');
  if (!/^https:\/\/[^/]+\/?$/.test(env.UPSTASH_REDIS_REST_URL)) throw new Error('Ungültige Redis-HTTPS-URL.');
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(env.EMAIL_TO)) throw new Error('EMAIL_TO muss eine einzelne E-Mail-Adresse sein.');
  if (/[\r\n]/.test(env.EMAIL_FROM) || !env.EMAIL_FROM.includes('@')) throw new Error('Ungültige Absenderadresse.');
  return {
    adzunaId: env.ADZUNA_APP_ID, adzunaKey: env.ADZUNA_APP_KEY,
    redisUrl: env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''),
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
    prefix: env.REDIS_PREFIX || 'job-notification:production',
    resendKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, to: env.EMAIL_TO,
  };
}
