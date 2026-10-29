# Website mit Terminverwaltung online stellen

Stand: 29.10.2026

## So funktioniert es im Alltag

1. Ein Patient wählt auf der Website Tag und Uhrzeit und schickt die Anfrage ab.
   Die Uhrzeit ist **sofort für alle anderen gesperrt**. Doppelbuchungen sind ausgeschlossen.
2. Der Patient sieht: „vorgemerkt – **verbindlich erst mit unserer Bestätigung**“.
   Hat er eine E-Mail angegeben, bekommt er das zusätzlich per E-Mail.
3. Ihr bekommt sofort eine E-Mail „Neue Terminanfrage“ mit allen Angaben.
4. Auf der **Praxis-Seite** (`https://rheude-kobler.de/praxis/`, mit Passwort) steht die Anfrage unter **Offen**:
   - **Bestätigen** → der Patient bekommt automatisch die verbindliche Terminbestätigung per E-Mail.
   - **Absagen** → der Patient bekommt eine Absage, auf Wunsch mit einer Nachricht (z. B. einem Alternativvorschlag). Die Zeit ist wieder frei.
   - Ohne E-Mail-Adresse steht dort „bitte telefonisch bestätigen“. Ihr ruft an und tippt danach auf „Als bestätigt markieren“.
5. **Jeden Morgen um 7 Uhr** (im Sommer 8 Uhr) kommt eine Übersicht per E-Mail mit allen noch offenen Anfragen und den Terminen von morgen. Eine vergessene Anfrage fällt so spätestens am nächsten Morgen auf.
6. Bestätigte Patienten bekommen am Vortag eine **Erinnerung** per E-Mail.
7. Telefonische Buchungen tragt ihr unter **Termine → + Termin eintragen** ein. Sie sind dann sofort auch auf der Website gesperrt.
8. **Praxistage** legt ihr auf der Praxis-Seite unter „Praxistage“ an: Datum, von, bis und Pause. Patienten sehen den Tag sofort.

Personenbezogene Daten werden 180 Tage nach dem Termin automatisch gelöscht.

**Tipp:** Öffnet die Praxis-Seite am Handy und legt sie mit „Zum Home-Bildschirm“ ab. Dann ist sie wie eine App mit einem Tipp erreichbar.

---

## Einmalig einrichten (ca. 1 Stunde)

Alle Befehle startet ihr im Terminal im Projektordner. Beim ersten Mal lädt der Rechner eine passende Node-Version herunter, das dauert kurz.

### 1. Cloudflare-Konto (kostenlos)
- Unter https://dash.cloudflare.com/sign-up ein Konto anlegen, am besten mit der Praxis-E-Mail.
- Danach im Terminal:
  ```bash
  npm run cloudflare-anmelden
  ```
  Es öffnet sich ein Browserfenster. Dort auf „Allow“ klicken.

### 2. Datenbank anlegen
```bash
npm run datenbank-anlegen
```
Die Ausgabe enthält eine Zeile `"database_id": "…"`. Diese ID in `wrangler.jsonc` anstelle von `00000000-0000-0000-0000-000000000000` eintragen. Ihr könnt mir die Ausgabe auch schicken, dann trage ich sie ein. Danach:
```bash
npm run datenbank-einrichten
```

### 3. Praxis-Passwort festlegen
```bash
npm run geheimnis -- PRAXIS_PASSWORT
```
Gebt ein langes Passwort ein, mindestens 12 Zeichen. Es ist nur bei Cloudflare gespeichert, nirgends im Code. Wer es ändert, meldet alle Geräte ab.

### 4. E-Mail-Versand über Brevo (kostenlos bis 300 E-Mails pro Tag)
Brevo ist ein EU-Anbieter (Frankreich) und bietet einen Vertrag zur Auftragsverarbeitung an.
1. Unter https://www.brevo.com ein Konto anlegen.
2. Unter **Senders, Domains & Dedicated IPs → Domains** die Domain `rheude-kobler.de` hinzufügen und die angezeigten DNS-Einträge (DKIM, DMARC) eintragen. Erst danach kommen die E-Mails zuverlässig an und landen nicht im Spam.
3. Unter **SMTP & API → API Keys** einen Schlüssel erstellen und hinterlegen:
   ```bash
   npm run geheimnis -- BREVO_API_KEY
   ```
4. In den Kontoeinstellungen den **Auftragsverarbeitungsvertrag (DPA)** akzeptieren.

Fehlt der Brevo-Schlüssel, läuft trotzdem alles, nur ohne E-Mails. Auf der Praxis-Seite erscheint dann ein gelber Hinweis.

### 5. Hochladen
```bash
npm run online
```
Danach ist die Seite unter einer Adresse wie `https://rheude-kobler.<konto>.workers.dev` erreichbar. Testet dort alles mit eurer eigenen E-Mail-Adresse: Praxistag anlegen, Termin anfragen, bestätigen, absagen.

### 6. Eigene Domain verbinden
Damit die Seite unter `rheude-kobler.de` läuft, muss die Domain bei Cloudflare verwaltet werden:
1. Im Cloudflare-Dashboard **Add a domain** → `rheude-kobler.de` → Free-Tarif.
2. **Wichtig:** Cloudflare übernimmt die bestehenden DNS-Einträge. Prüft vor dem nächsten Schritt, ob die **MX-Einträge** eures E-Mail-Postfachs dabei sind. Sonst kommen keine E-Mails mehr an `termin@rheude-kobler.de` an.
3. Beim bisherigen Domain-Anbieter die beiden Cloudflare-Nameserver eintragen. Das dauert einige Minuten bis zu 24 Stunden.
4. Unter **Workers & Pages → rheude-kobler → Settings → Domains & Routes → Add → Custom domain** sowohl `rheude-kobler.de` als auch `www.rheude-kobler.de` eintragen.

---

## Wenn sich etwas ändert

| Was | Wo |
|---|---|
| Praxistage, Termine, Bestätigen/Absagen | Praxis-Seite `/praxis/` |
| Zonen, Preise, Pakete, Behandler | `behandlungstage.js`, danach `npm run online` (Kalkulation: `PREISKALKULATION.md`) |
| Absender, Praxis-E-Mail (mehrere mit Komma), Adresse, Löschfrist | `wrangler.jsonc` unter `vars`, danach `npm run online` |
| Texte und Bilder der Website | `index.html`, `assets/`, danach `npm run online` |
| Fehler ansehen | `npm run protokoll` (zeigt Live-Meldungen des Servers) |

**Lokal ausprobieren:** `npm run lokal` startet alles auf http://localhost:8787 mit einer Test-Datenbank. Das Test-Passwort steht in der Datei `.dev.vars`.

---

## Vor dem Start rechtlich erledigen
- **Impressum und Datenschutzerklärung** vervollständigen und prüfen lassen. In der Datenschutzerklärung stehen bereits Platzhalter-Hinweise. Terminanfragen mit Behandlungswunsch gelten als Gesundheitsdaten (Art. 9 DSGVO).
- **Auftragsverarbeitung:** Cloudflare (der Vertrag ist automatisch Teil der Nutzungsbedingungen, im Dashboard unter „Compliance“ abrufbar) und Brevo (siehe Schritt 4).
- Die Texte zu Behandlungen auf das **Heilmittelwerbegesetz** prüfen.
