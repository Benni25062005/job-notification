import { escapeHtml as h, safeUrl, filterJobs } from './view.js';

const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const defaultSkills = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'PHP', 'C#', '.NET', 'MySQL', 'SQL', 'HTML', 'CSS', 'Tailwind', 'WordPress'];
let data = null, demo = false, view = 'all', category = 'all', loading = false, requestVersion = 0;
let token = storageRead('sessionStorage', 'jobradar:token', '');
let saved = readSaved();
let toastTimer;

function storageRead(storage, key, fallback) { try { return window[storage].getItem(key) || fallback; } catch { return fallback; } }
function readSaved() {
  try {
    const value = JSON.parse(storageRead('localStorage', demo ? 'jobradar:demo-saved' : 'jobradar:saved', '[]'));
    return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(0, 1000) : []);
  } catch { return new Set(); }
}
function setToken(value) { token = value; try { if (value) sessionStorage.setItem('jobradar:token', value); else sessionStorage.removeItem('jobradar:token'); } catch { /* In-memory access remains available. */ } }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800); }
function showNotice(message, error = false) { $('status-notice').textContent = message; $('status-notice').hidden = !message; $('status-notice').classList.toggle('error', error); }
function dateLabel(value, options = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Datum unbekannt';
  return new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', ...options }).format(new Date(value));
}
function jobSkills(job) { return (job.reasons || []).find(reason => reason.startsWith('Passende Technologien:'))?.replace('Passende Technologien:', '').replace(/\.$/, '').split(',').map(skill => skill.trim()).filter(Boolean) || []; }
function initials(company) { return company.replace(/\(Demo\)/g, '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }
function matchClass(job) { return job.category === 'Sehr passend' ? 'best' : job.category === 'Potenziell passend' ? 'potential' : 'less'; }
function options() { return { query: $('query').value, region: $('region').value, sort: $('sort').value, category, onlyNew: $('only-new').checked, savedOnly: view === 'saved', saved }; }
function clearFilters() { category = 'all'; $('query').value = ''; $('region').value = 'all'; $('sort').value = 'score'; $('only-new').checked = false; }

function render() {
  const jobs = data?.jobs || [], filtered = filterJobs(jobs, options());
  const hasSnapshot = Boolean(data?.searchedAt);
  $('demo-banner').hidden = !demo;
  $('stat-total').textContent = hasSnapshot ? jobs.length : '—';
  $('stat-best').textContent = hasSnapshot ? jobs.filter(job => job.category === 'Sehr passend').length : '—';
  $('stat-new').textContent = hasSnapshot ? jobs.filter(job => job.isNew).length : '—';
  $('stat-date').textContent = hasSnapshot ? dateLabel(data.searchedAt) : 'Noch offen';
  $('stat-time').textContent = hasSnapshot ? `${dateLabel(data.searchedAt, { hour: '2-digit', minute: '2-digit' }).split(', ').at(-1)} Uhr${demo ? ' · Beispieldaten' : ' · Ortszeit'}` : 'Wartet auf den ersten Suchlauf';
  $('saved-count').textContent = jobs.filter(job => saved.has(job.id)).length;
  $('result-count').textContent = filtered.length;
  $('jobs-heading').firstChild.textContent = view === 'saved' ? 'Deine Merkliste ' : 'Stellen entdecken ';
  $('breadcrumb-title').textContent = view === 'saved' ? 'Merkliste' : 'Übersicht';
  $('list-caption').textContent = view === 'saved' ? 'Deine gemerkten Stellen aus dem aktuellen Suchlauf. Auf diesem Gerät gespeichert.' : 'Ein Überblick. Alle Möglichkeiten.';
  $('automation-state').textContent = demo ? 'Demo · kein Versand' : data ? (data.notificationsEnabled ? 'Automatische Suche aktiviert' : 'Automatische Suche deaktiviert') : 'Einrichtung ausstehend';
  $('access-button').querySelector('span').textContent = token && !demo ? 'Verbunden' : 'Zugang';
  $('profile-skills').innerHTML = (data?.profile?.skills || defaultSkills).map(skill => `<span class="tag">${h(skill)}</span>`).join('');
  $('footer-status').textContent = demo ? 'Demoansicht · keine echten Stellen oder E-Mails' : data?.email?.status === 'accepted' ? `Letzter Bericht: ${data.email.count} Stellen · Versand angenommen` : 'Persönliche Stellensuche · keine öffentlichen Profildaten';
  document.querySelectorAll('[data-view]').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = button.dataset.category === category;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    button.querySelector('span').textContent = filterJobs(jobs, { ...options(), category: button.dataset.category }).length;
  });
  $('jobs-list').innerHTML = filtered.map((job, index) => `<article class="job-card ${matchClass(job)}"><div class="job-top"><div class="company-logo tone-${index % 4}" aria-hidden="true">${h(initials(job.company))}</div><div class="job-heading"><div class="job-eyebrow"><span>${h(job.company)}</span>${job.isNew ? '<span class="new-badge">NEU</span>' : ''}</div><h3 class="job-title"><button data-detail="${h(job.id)}">${h(job.title)}</button></h3><div class="job-meta"><span>${icon('pin')}${h(job.location)}</span><span>${icon('clock')}Anzeige vom ${h(dateLabel(job.publishedAt))}</span></div></div><div class="job-score"><span class="score-number">${h(job.score)}<small>/100</small></span><span class="score-label">${h(job.category)}</span></div><button class="icon-button save-button ${saved.has(job.id) ? 'saved' : ''}" data-save="${h(job.id)}" aria-pressed="${saved.has(job.id)}" aria-label="${h(job.title)} ${saved.has(job.id) ? 'aus Merkliste entfernen' : 'merken'}" title="${saved.has(job.id) ? 'Aus Merkliste entfernen' : 'Stelle merken'}">${icon('bookmark')}</button></div><p class="job-summary">${h(job.description || 'Keine Beschreibung in der Quelle vorhanden.')}</p><div class="job-bottom"><div class="tags">${jobSkills(job).slice(0, 5).map(skill => `<span class="tag">${h(skill)}</span>`).join('')}${demo ? '<span class="tag">Erfundenes Beispiel</span>' : ''}</div><button class="text-button" data-detail="${h(job.id)}">Details ansehen ${icon('arrow')}</button></div></article>`).join('');
  $('empty-state').hidden = filtered.length > 0;
  let emptyMode;
  if (!data) emptyMode = 'connect';
  else if (!hasSnapshot) emptyMode = 'waiting';
  else if (!jobs.length) emptyMode = 'no-jobs';
  else if (view === 'saved' && !jobs.some(job => saved.has(job.id))) emptyMode = 'saved';
  else emptyMode = 'filtered';
  const empty = {
    connect: ['Dein Jobradar steht bereit.', 'Verbinde deinen Zugang, um deine persönlichen Suchergebnisse zu sehen. Oder entdecke die Oberfläche mit Beispieldaten.', 'Zugang öffnen'],
    waiting: ['Noch keine Suche gespeichert.', 'Sobald die Quellen eingerichtet sind und der erste Suchlauf abgeschlossen ist, erscheinen deine Stellen hier.', 'Gespeicherten Stand laden'],
    'no-jobs': ['Noch keine Entwicklerstellen gefunden.', 'Im letzten Suchlauf wurden keine passenden Entwickleranzeigen gefunden. Prüfe auch die Hinweise zur Datenquelle.', 'Gespeicherten Stand laden'],
    saved: ['Platz für deine Favoriten.', 'Tippe bei einer Stelle auf das Lesezeichen. So findest du interessante Möglichkeiten hier wieder.', 'Stellen entdecken'],
    filtered: ['Keine Treffer für diese Auswahl.', 'Versuche einen anderen Suchbegriff oder erweitere deine Filter.', 'Filter zurücksetzen'],
  }[emptyMode];
  $('empty-title').textContent = empty[0]; $('empty-copy').textContent = empty[1]; $('empty-primary').textContent = empty[2]; $('empty-primary').dataset.action = emptyMode;
  $('demo-button').hidden = demo || (hasSnapshot && jobs.length > 0);
}

function openAccess() { $('access-error').textContent = ''; $('access-token').value = ''; $('logout-button').hidden = !token; $('access-dialog').showModal(); }
async function loadResults(candidate = token) {
  if (!candidate) { openAccess(); return false; }
  if (loading) return false;
  loading = true;
  const version = ++requestVersion;
  $('refresh-button').disabled = true; $('access-form').querySelector('button[type=submit]').disabled = true;
  $('jobs-list').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${candidate}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401 && candidate === token) { setToken(''); data = null; render(); }
      throw new Error(body.error || 'Die Ergebnisse konnten nicht geladen werden.');
    }
    if (!Array.isArray(body.jobs)) throw new Error('Die Antwort enthält keine gültige Stellenliste.');
    if (version !== requestVersion) return false;
    setToken(candidate); demo = false; data = body; saved = readSaved();
    $('access-dialog').close();
    const notices = [...(body.warnings || [])];
    if (!body.notificationsEnabled) notices.push('Der automatische Suchlauf ist noch deaktiviert.');
    if (body.searchedAt && Date.now() - Date.parse(body.searchedAt) > 36 * 3600000) notices.push('Der letzte Suchlauf ist älter als 36 Stunden. Diese Ergebnisse sind möglicherweise nicht mehr aktuell.');
    showNotice(notices.join(' ')); render(); return true;
  } catch (error) {
    if (version !== requestVersion) return false;
    const message = error.name === 'TimeoutError' ? 'Die Verbindung dauert zu lange. Bitte versuche es erneut.' : error.message;
    $('access-error').textContent = message; showNotice(message, true); return false;
  } finally {
    loading = false; $('refresh-button').disabled = false; $('access-form').querySelector('button[type=submit]').disabled = false; $('jobs-list').setAttribute('aria-busy', 'false');
  }
}

function toggleSaved(id) {
  if (saved.has(id)) saved.delete(id); else saved.add(id);
  try { localStorage.setItem(demo ? 'jobradar:demo-saved' : 'jobradar:saved', JSON.stringify([...saved])); }
  catch { toast('Merkliste nur für diese Sitzung verfügbar.'); }
  render();
  if ($('job-dialog').open) renderDetail(id);
}
function renderDetail(id) {
  const job = data?.jobs.find(job => job.id === id);
  if (!job) return;
  const url = safeUrl(job.url);
  $('job-detail').innerHTML = `<p class="eyebrow">${demo ? 'ERFUNDENES BEISPIEL' : 'DEINE CHANCE IM DETAIL'}</p><p class="detail-company">${h(job.company)}</p><h2>${h(job.title)}</h2><div class="job-meta"><span>${icon('pin')}${h(job.location)}</span><span>Veröffentlicht: ${h(dateLabel(job.publishedAt, { year: 'numeric' }))}</span></div><span class="detail-score">${h(job.category)} · ${h(job.score)}/100</span><h3>Warum diese Einstufung?</h3><ul class="detail-reasons">${job.reasons.map(reason => `<li>${h(reason)}</li>`).join('')}</ul><h3>Einblick in die Stelle</h3><p class="detail-description">${h(job.description || 'Kein Beschreibungsausschnitt verfügbar.')}</p><p class="detail-note">${demo ? 'Diese Stelle und das Unternehmen sind erfundene Beispiele. Es gibt keine echte Stellenanzeige dazu.' : 'Die Bewertung basiert auf dem Beschreibungsausschnitt. Anforderungen, Arbeitsmodell und Verfügbarkeit bitte in der Originalanzeige prüfen. Quelle: The Adzuna API.'}</p><div class="detail-actions">${url && !demo ? `<a class="button primary" href="${h(url)}" target="_blank" rel="noopener noreferrer">Originalanzeige öffnen ${icon('external')}</a>` : ''}<button class="button" data-save="${h(id)}">${icon('bookmark')}${saved.has(id) ? 'Aus Merkliste entfernen' : 'Stelle merken'}</button></div>${!demo ? `<p class="detail-note">Quelle: <a href="https://www.adzuna.${job.country === 'at' ? 'at' : 'de'}/" target="_blank" rel="noopener noreferrer">The Adzuna API ↗</a></p>` : ''}`;
}

document.addEventListener('click', event => {
  const detail = event.target.closest('[data-detail]');
  if (detail) { renderDetail(detail.dataset.detail); $('job-dialog').showModal(); }
  const save = event.target.closest('[data-save]');
  if (save) toggleSaved(save.dataset.save);
  const close = event.target.closest('[data-close]');
  if (close) $(close.dataset.close).close();
  const nav = event.target.closest('[data-view]');
  if (nav) { view = nav.dataset.view; clearFilters(); render(); }
  const filter = event.target.closest('[data-category]');
  if (filter) { category = filter.dataset.category; render(); }
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target !== dialog) return; const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); });
$('access-button').addEventListener('click', openAccess);
$('profile-button').addEventListener('click', () => $('profile-dialog').showModal());
$('access-form').addEventListener('submit', event => { event.preventDefault(); loadResults($('access-token').value.trim()); });
$('refresh-button').addEventListener('click', async () => {
  if (demo) { toast('Demoansicht – keine Live-Suche.'); return; }
  if (await loadResults()) toast('Gespeicherte Ergebnisse aktualisiert.');
});
$('logout-button').addEventListener('click', () => { requestVersion++; setToken(''); data = null; demo = false; saved = readSaved(); clearFilters(); showNotice(''); render(); $('access-dialog').close(); });
$('demo-button').addEventListener('click', async () => { const { demoData } = await import('./demo.js'); requestVersion++; demo = true; data = demoData(); saved = readSaved(); clearFilters(); showNotice(''); render(); });
$('leave-demo').addEventListener('click', () => { demo = false; data = null; saved = readSaved(); clearFilters(); showNotice(''); render(); if (token) loadResults(); });
$('empty-primary').addEventListener('click', () => {
  const action = $('empty-primary').dataset.action;
  if (action === 'connect') openAccess();
  else if (action === 'waiting' || action === 'no-jobs') loadResults();
  else { if (action === 'saved') view = 'all'; clearFilters(); render(); }
});
['query', 'region', 'sort', 'only-new'].forEach(id => $(id).addEventListener(id === 'query' ? 'input' : 'change', render));
render();
if (token) loadResults();
