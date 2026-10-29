# Rheude & Kobler · Ästhetische Medizin

Website der ärztlich geführten Praxis in Böhl-Iggelheim.

## Aktiver Website-Stand (29.10.2026 – Umsetzung des Claude-Design-Entwurfs)

- `index.html` – Startseite nach Entwurf: Hero, Behandlungen, Team, Ablauf, **Terminkalender**, Kontakt, Fußzeile mit Impressum/Datenschutz zum Aufklappen
- `behandlungstage.js` – Zonen mit Preis und Dauer, Paketpreise, Erstberatung, Behandler, Zeitraster (Praxistage und Termine pflegt ihr auf der Praxis-Seite `/praxis/`)
- `praxis/` – Praxis-Seite: Anfragen bestätigen/absagen, Termine eintragen, Praxistage pflegen
- `worker/`, `migrations/`, `wrangler.jsonc` – Server und Datenbank auf Cloudflare
- `angebot.js` – berechnet Preis und Dauer einer Zonen-Auswahl (Website, Server, Praxis-Seite)
- `PREISKALKULATION.md` – interne Preiskalkulation (wird nicht veröffentlicht)
- **`ONLINE-STELLEN.md` – Anleitung zum Online-Stellen und zum Alltag mit der Terminverwaltung**
- `buchung.js` – Terminkalender: Monatsansicht mit markierten Praxistagen → freie Uhrzeiten → Behandlung, Behandler, Name/Telefon/E-Mail → Anfrage. Freie Zeiten werden passend zur Behandlungsdauer berechnet
- `site.css` / `site.js` – Gestaltung (Marcellus, Cormorant Garamond, Jost – lokal in `assets/fonts/`), Menü, Foto-Platzhalter
- `termin-buchen/index.html` – eigene Seite nur mit dem Terminkalender
- `assets/praxis/` und `assets/team/` – Fotos mit den Namen aus `LIESMICH.txt` ablegen; fehlt ein Foto, erscheint ein Platzhalter
- `archiv/` – frühere Stände (`website-stand-2026-09`, `-10-23`, `-10-29` = Stand vor der Design-Umsetzung)

Bei Änderungen an CSS/JS die Versionsnummer `?v=11` in den HTML-Dateien (auch `praxis/index.html`) erhöhen, damit Besucher sofort die neue Fassung sehen.

Hinweis Wortwahl: Auf der Website heißt es bewusst „Behandlungstage“ statt „Botox-Tage“ (§10 HWG, siehe `copy/hwg-checkliste.md`).

## Weitere Projektunterlagen

- `copy/` – Textvarianten und HWG-Checkliste
- `flyer/` – frühere Flyer-Unterlagen
- zusätzliche Dateien in `termin-buchen/` – ältere Portal-Prototypen; nicht Bestandteil des aktiven Website-Builds

## Bearbeitung und Vorschau

Der gesamte bearbeitbare Stand liegt in diesem Ordner und kann von Codex, Claude oder einem anderen lokalen Editor direkt geöffnet werden. `npm run build` erneuert den fertigen Stand unter `dist/client/`; `npm run dev` zeigt ihn anschließend lokal unter `http://localhost:4173/` an.

Für eine Vorschau ohne Build: im Projektordner `python3 -m http.server 4180` starten und `http://localhost:4180/` öffnen.

## Veröffentlichung

Die Hosting-Zuordnung liegt in `.openai/hosting.json`. Der lokale Ordner bleibt dabei die vollständige und maßgebliche Quelle.
