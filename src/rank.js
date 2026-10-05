import { normalize } from './jobs.js';
import { searchProfile } from './config.js';

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsWord = (text, word) => new RegExp(`(^|[^a-z0-9])${escapeRegex(normalize(word))}(?=$|[^a-z0-9])`, 'i').test(text);
export const categories = ['Sehr passend', 'Potenziell passend', 'Weniger passend'];

export function rankJob(job, profile = searchProfile) {
  const title = normalize(job.title), description = normalize(job.description);
  const text = `${title} ${description}`, location = normalize(job.location);
  let score = 40, ceiling = 100;
  const reasons = [];
  // Nur fachfremde Treffer werden verworfen, niemals aufgrund Seniorität oder Ort.
  const relevant = /software|webentwick|web developer|frontend|front.end|backend|back.end|full.?stack|programmier|application developer|anwendungsentwick|\.net|c#|javascript|typescript/.test(title)
    || (/developer|entwickler/.test(title) && /\b(java|python|golang|rust|kotlin|swift|php)\b|c\+\+/.test(title))
    || (/developer|entwickler|engineer/.test(title) && /software|react|javascript|typescript|php|node\.?js|\.net|c#|programmier/.test(description));
  if (!relevant) return null;
  if (profile.preferredPlaces.some(place => containsWord(location, place))) {
    score += 30; reasons.push('Standort im bevorzugten Unterland/Rheintal.');
  } else if (profile.acceptedPlaces.some(place => containsWord(location, place))) {
    score += 20; reasons.push('Standort innerhalb der erweiterten Wunschregion.');
  } else {
    ceiling = 44; reasons.push('Standort außerhalb der erkannten Wunschorte oder zu ungenau; Anfahrt prüfen.');
  }
  const senior = /\b(senior|sr\.?|lead|principal|staff|head)\b|teamleit|abteilungsleit|architect|architekt/.test(title);
  const beginner = /\bjunior\b|berufseinsteig|berufsanfang|absolvent|graduate|entry.level|keine berufserfahrung/.test(text);
  if (senior) {
    score -= 30; ceiling = Math.min(ceiling, 44); reasons.push('Senior-/Führungsrolle: deutlich mehr Erfahrung erwartet.');
  } else if (beginner) {
    score += 25; reasons.push('Junior oder Berufseinstieg ausdrücklich erwähnt.');
  } else reasons.push('Berufseinstieg im verfügbaren Text nicht ausdrücklich bestätigt.');
  const years = [...text.matchAll(/(?:mindestens\s+|min\.?\s+|at least\s+)?(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*\+?\s*(?:jahre?n?|years?)(?:\s+of)?\s+(?:berufs)?(?:erfahrung|experience)/g)]
    .map(match => Number(match[1]));
  const requiredYears = Math.max(0, ...years);
  if (requiredYears >= 5) { ceiling = Math.min(ceiling, 44); reasons.push(`Text nennt mindestens ${requiredYears} Jahre Erfahrung; Anforderung prüfen.`); }
  else if (requiredYears >= 2 || /mehrjahrige\s+(?:berufs)?erfahrung|several years/.test(text)) {
    ceiling = Math.min(ceiling, 74); reasons.push('Mehrjährige Erfahrung erwähnt; Bewerbung kann trotzdem sinnvoll sein.');
  }
  if (/praktik|internship|werkstudent|ausbildung|lehrling|lehrstelle/.test(title)) {
    ceiling = Math.min(ceiling, 44); reasons.push('Praktikum, Studium oder Ausbildung statt regulärer Einstiegsstelle.');
  }
  const skills = profile.skills.filter(skill => containsWord(text, skill));
  if (skills.length) { score += Math.min(15, skills.length * 5); reasons.push(`Passende Technologien: ${skills.join(', ')}.`); }
  score = Math.max(0, Math.min(ceiling, score));
  return { ...job, score, category: score >= 80 ? categories[0] : score >= 45 ? categories[1] : categories[2], reasons };
}

export function rankJobs(jobs, profile = searchProfile) {
  return jobs.map(job => rankJob(job, profile)).filter(Boolean)
    .sort((a, b) => b.score - a.score || (b.publishedAt || '').localeCompare(a.publishedAt || '') || a.id.localeCompare(b.id));
}
