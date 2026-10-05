// Keine URLs oder Antworttexte in Fehlern: Adzuna enthält Schlüssel in der URL.
export async function requestJson(url, options = {}, label = 'Dienst', fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`${label}: Netzwerkfehler oder Zeitüberschreitung.`);
  }
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}.`);
  try { return await response.json(); }
  catch { throw new Error(`${label}: Ungültige JSON-Antwort.`); }
}
