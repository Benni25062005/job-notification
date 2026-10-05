# Job-Benachrichtigung

Persönlicher täglicher E-Mail-Bericht für Entwicklerstellen im Vorarlberger Unterland/Rheintal bis Feldkirch sowie im deutschen Bodenseeraum bis Ravensburg/Weingarten. Kleine Node.js-Anwendung für Vercel, ohne Framework und ohne zusätzliche npm-Abhängigkeiten.

## Verhalten

- Sucht nach Softwareentwicklung, Webentwicklung, Frontend, Backend und Fullstack.
- **Sehr passend**, **Potenziell passend**, **Weniger passend** mit nachvollziehbaren Gründen und Bewertung von 0–100.
- Senior-/Lead-Stellen, mehrjährige Erfahrung und unpassende Standorte werden niedriger eingestuft, nicht allein deswegen ausgeschlossen. Fachfremde Suchtreffer werden verworfen.
- Bevorzugt Junior-/Berufseinsteigerstellen und bekannte Technologien. Bewertung ist eine regelbasierte Einschätzung anhand des verfügbaren Beschreibungsausschnitts, keine vollständige Analyse der Anzeige.
- Neue Treffer zuerst nach Passung, dann Veröffentlichungsdatum. Höchstens 50 pro E-Mail; nur tatsächlich verschickte Treffer gelten als versendet.
- Täglich ein Bericht, auch bei null neuen Treffern. Quellenausfälle werden als unvollständige Suche kenntlich gemacht. Fallen alle Quellen aus, endet der Lauf mit Fehler statt einer irreführenden leeren Erfolgsmeldung.
- Erste Suche berücksichtigt Anzeigen aus den letzten 30 Tagen. Danach bedeutet „neu“: bisher noch nicht verschickt. Identische Quell-IDs und identische Kombinationen aus Titel, Firma, Land und Standort werden erkannt. Leicht umgeschriebene Anzeigen können erneut erscheinen.
- Wiederholte oder parallele Aufrufe sind abgesichert. Ein abgeschlossener Tag wird nicht erneut verschickt.

## Stellenquelle und Grenzen

Version 1 verwendet die **offizielle Adzuna API** für Österreich und Deutschland, keine flächendeckende Suche über alle Jobportale. Suchkreise: Bregenz + 50 km (AT), Ravensburg + 50 km (DE). Das deckt die gewünschte Region breit ab, kann aber auch weitere Orte liefern. Diese werden niedriger bewertet.

Je Land höchstens drei Seiten mit je 50 Ergebnissen, nach Datum sortiert: maximal sechs Suchanfragen pro regulärem Lauf. Bei erreichtem Seitenlimit steht ein Hinweis im Bericht. Adzuna liefert nur einen Beschreibungsausschnitt; Originalanzeige über den unveränderten Adzuna-Link öffnen. Die konkrete Abdeckung der Region muss mit dem eigenen API-Zugang geprüft werden. Es sind keine Zugangsdaten und keine echten Stellen fest eingebaut.

Suchbegriffe, Orte, Technologien, Suchalter und Limits stehen in [`src/config.js`](src/config.js); Bewertungsregeln in [`src/rank.js`](src/rank.js). Ortszuordnung erfolgt anhand der Ortsnamen, nicht anhand einer tatsächlichen Fahrzeit. Nicht eindeutig zugeordnete Orte bleiben als „Weniger passend“ enthalten.

## Lokal prüfen

Node.js 24 verwenden. Es werden keine Pakete benötigt.

```bash
npm test
npm run check
npm run preview -- --demo
```

`preview/digest.html` und `preview/digest.txt` zeigen einen Bericht mit ausdrücklich erfundenen Teststellen. Die Vorschau sendet keine E-Mails und schreibt nicht in Redis.

Für eine Vorschau mit echten Anzeigen:

```bash
cp .env.example .env.local
# ADZUNA_APP_ID und ADZUNA_APP_KEY in .env.local eintragen
npm run preview
```

## Auf Vercel einrichten

1. Repository als Vercel-Projekt importieren. Framework: **Other**, Node.js: **24.x**, kein Build-Befehl. `vercel.json` setzt das statische Ausgabeverzeichnis auf `public`; der geschützte API-Endpunkt liegt unter `/api/cron/search`. Es gibt bewusst kein Dashboard.
2. Einen eigenen [Adzuna-API-Zugang](https://developer.adzuna.com/signup) registrieren. API-ID und API-Key hinterlegen. Zugriff und konkrete Abdeckung mit `npm run preview` prüfen.
3. Eine **Upstash Redis**-Datenbank über den Vercel Marketplace oder direkt bei Upstash verbinden. REST-URL und Schreib-Token eintragen. Bei anders benannten automatisch angelegten Variablen die Werte den Namen unten zuordnen. Eine dauerhafte Datenbank ohne Verdrängung der Versandhistorie verwenden.
4. **Resend** verbinden. Einen zulässigen Absender und die eigene Empfängeradresse eintragen. Für eine eigene Absenderdomain die Domain in Resend verifizieren. Der Testabsender `onboarding@resend.dev` darf nur an die zum Resend-Konto gehörende Adresse senden.
5. Alle unten aufgeführten Variablen im Vercel-Environment **Production** setzen. Secrets niemals in Git eintragen.
6. Zunächst `NOTIFICATIONS_ENABLED=false` lassen. Vorschau und Zugangsdaten prüfen, dann auf `true` setzen und erneut deployen. Cron Jobs laufen nur auf Production-Deployments.
7. Nach dem ersten Nachtlauf Vercel-Logs und den Versandstatus in Resend prüfen. Ein HTTP-200-Status von Resend bestätigt die Annahme, nicht die Zustellung im Postfach.

| Variable | Inhalt |
|---|---|
| `CRON_SECRET` | Zufälliges Secret mit mindestens 32 Zeichen; Vercel sendet es automatisch als Bearer-Token |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Eigener Adzuna-Zugang |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST-URL und Schreib-Token |
| `RESEND_API_KEY` | Resend-API-Key; für Wiederherstellung per API muss er auch E-Mails lesen dürfen |
| `EMAIL_FROM` | Zum Beispiel `Job-Suche <jobs@deine-domain.at>` |
| `EMAIL_TO` | Eine einzelne Empfängeradresse |
| `NOTIFICATIONS_ENABLED` | `true` aktiviert den Versand; sonst deaktiviert |
| `REDIS_PREFIX` | Standard `job-notification:production`; für Tests einen eigenen Wert setzen |

Ein Secret lässt sich lokal erzeugen:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Zeitplanung: 00:00–01:00 Uhr, inklusive Zeitumstellung

Vercel-Cron verwendet UTC. Daher gibt es zwei tägliche Aufrufe: **22:00 UTC** und **23:00 UTC**. Die Anwendung verarbeitet nur den Aufruf, der in `Europe/Vienna` in die Stunde **00** fällt. Im Sommer arbeitet der erste, im Winter der zweite; der jeweils andere beendet sich ohne Suche und ohne Versand. Beide Cron-Einträge laufen jeweils nur einmal täglich und passen damit zum Hobby-Tarif. Zusätzlich verhindert der gespeicherte lokale Kalendertag doppelte Berichte.

Die Hobby-Ausführung kann innerhalb der geplanten Stunde beginnen. Suche und Versand benötigen anschließend etwas Zeit; eine Zustellung vor exakt 01:00 kann bei einem sehr späten Start oder externen Störungen nicht garantiert werden. Automatische Sommer-/Winterzeit wird durch Tests abgedeckt.

## Fehler und Wiederherstellung

Der Versandablauf ist: globale Sperre → ggf. offenen Bericht abschließen → suchen → bereits versendete Stellen abgleichen → unveränderlichen Bericht speichern → Resend mit Idempotency-Key aufrufen → Versand-ID speichern → Stellen und Tag atomar als versendet verbuchen.

Redis speichert dauerhaft nur die Identitäten versendeter Stellen. Tagesbestätigungen bleiben 90 Tage erhalten; der offene Bericht einschließlich Empfänger und Mailinhalt bleibt bis zum Abschluss gespeichert. Die globale Sperre läuft nach zehn Minuten ab, länger als die maximale Vercel-Laufzeit von fünf Minuten. Redis muss privat bleiben.

Vercel wiederholt fehlgeschlagene Cron-Aufrufe nicht automatisch. Ein autorisierter erneuter GET-Aufruf im Mitternachtsfenster kann einen fehlgeschlagenen Lauf fortsetzen. Bereits von Resend bestätigte Berichte werden dabei nicht erneut gesendet.

Wenn Resend eine Nachricht angenommen hat, aber die Antwort oder Speicherung fehlschlägt, ist der Status möglicherweise unklar. Innerhalb von 23 Stunden kann dieselbe gespeicherte Nachricht mit demselben Schlüssel erneut versucht werden. Danach stoppt die Anwendung vorsichtshalber, da Resend Schlüssel nur 24 Stunden dedupliziert. Ein unklarer Versand blockiert weitere Berichte, bis er geklärt ist.

```bash
# Liest den offenen Status. Sendet keine Nachricht.
npm run recover

# Nach Abgleich mit dem Resend-Dashboard: bereits angenommene Mail verbuchen.
# Das Skript prüft Empfänger, Absender, Betreff und HTML-Inhalt per Resend API.
npm run recover -- --email-id=RESEND_EMAIL_ID

# NUR wenn im Resend-Dashboard sicher geprüft wurde, dass NICHT gesendet wurde:
# Offenen Bericht verwerfen, damit der nächste Lauf die Stellen erneut aufnehmen kann.
npm run recover -- --discard-confirmed-unsent
```

Kein blindes Löschen der Versandhistorie: Das würde bereits verschickte Stellen wieder als neu behandeln. Zugangsdaten und Empfängeränderungen vor Aktivierung prüfen. Ein offener Bericht behält absichtlich seinen ursprünglichen Empfänger und Inhalt; Änderungen der Umgebungsvariablen verändern ihn nicht rückwirkend.

## Validierung

`npm test` prüft Zeitumstellung, Standort-/Erfahrungsbewertung, Duplikate, Quellenfehler, HTML-Escaping, Zugriffsschutz, parallele Ausführung, Versandfehler und Wiederaufnahme nach Speicherfehlern. API-Tests verwenden simulierte HTTP-Antworten. Ein echter Ende-zu-Ende-Lauf mit Adzuna, Upstash und Resend sowie ein Vercel-Deployment benötigen eigene Zugangsdaten und sind damit nicht durch die lokalen Tests ersetzt.

## Dokumentation

- [Adzuna Suche](https://developer.adzuna.com/docs/search), [OpenAPI](https://developer.adzuna.com/swagger/spec/test2.json), [Nutzungsbedingungen](https://developer.adzuna.com/docs/terms_of_service)
- [Vercel Cron](https://vercel.com/docs/cron-jobs), [Tariflimits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Upstash REST](https://upstash.com/docs/redis/features/restapi)
- [Resend Versand](https://resend.com/docs/api-reference/emails/send-email), [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

Dieses Projekt dient der persönlichen Stellensuche. Quelle der Stellenangaben ist „The Adzuna API“. Bei einer späteren öffentlichen Veröffentlichung von Stellenanzeigen die zusätzlichen Adzuna-Vorgaben zur Darstellung und Kennzeichnung berücksichtigen.
