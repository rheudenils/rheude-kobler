# Rheude & Kobler · Ästhetische Medizin

Website der ärztlich geführten Praxis in Böhl-Iggelheim, mit Online-Terminbuchung und Terminverwaltung.

**Vorschau:** https://rheudenils.github.io/rheude-kobler/
Die Vorschau wird bei jedem Hochladen automatisch neu gebaut. Die Terminbuchung ist dort nur eine Demo mit Beispieltagen, es wird nichts gesendet.

## Aufbau

- `index.html` – Startseite: Hero, Behandlungen mit Preisliste, Team, Ablauf, **Terminkalender**, Kontakt, Fußzeile mit Impressum/Datenschutz zum Aufklappen
- `behandlungstage.js` – **hier pflegt ihr das Angebot**: Zonen mit Preis und Dauer, Paketpreise, Erstberatung, Behandler, Zeitraster
- `angebot.js` – berechnet Preis und Dauer einer Zonen-Auswahl (Website, Server, Praxis-Seite)
- `buchung.js` – Terminkalender: Praxistag → freie Uhrzeit → Zonen mit Richtpreis → Behandler → Kontakt → Anfrage
- `site.css` / `site.js` – Gestaltung (Marcellus, Cormorant Garamond, Jost – lokal in `assets/fonts/`), Menü, Preisliste, Foto-Platzhalter
- `termin-buchen/index.html` – eigene Seite nur mit dem Terminkalender
- `praxis/` – Praxis-Seite (mit Passwort): Anfragen bestätigen/absagen, Termine eintragen, Praxistage pflegen
- `worker/`, `migrations/`, `wrangler.jsonc` – Server und Datenbank auf Cloudflare
- `assets/praxis/` und `assets/team/` – Fotos mit den Namen aus `LIESMICH.txt` ablegen; fehlt ein Foto, erscheint ein Platzhalter
- `.github/workflows/vorschau.yml` – baut die Vorschau für GitHub Pages
- `intern/` – Preiskalkulation und HWG-Checkliste (nur lokal, wird nicht hochgeladen)
- **`ONLINE-STELLEN.md` – Anleitung zum Online-Stellen und zum Alltag mit der Terminverwaltung**

Bei Änderungen an CSS/JS die Versionsnummer `?v=11` in den HTML-Dateien (auch `praxis/index.html`) erhöhen, damit Besucher sofort die neue Fassung sehen.

Hinweis Wortwahl: Auf der Website steht bewusst nirgends „Botox“ (§ 10 HWG, siehe `intern/HWG-CHECKLISTE.md`).

## Lokal ansehen

- `npm run lokal` – komplette Website mit Terminverwaltung und Test-Datenbank unter http://localhost:8787
- `python3 -m http.server 4180` im Projektordner – nur die Gestaltung, Kalender mit Beispieltagen
- `VORSCHAU=1 npm run build` – baut die GitHub-Vorschau nach `dist/client/`
