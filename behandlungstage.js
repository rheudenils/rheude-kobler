/* =============================================================
   BEHANDLUNGEN & EINSTELLUNGEN – hier pflegt ihr alles selbst
   -------------------------------------------------------------
   PRAXISTAGE und TERMINE pflegt ihr auf der Praxis-Seite:
   https://rheude-kobler.de/praxis/  (mit Passwort)

   In dieser Datei stehen:
   - zonen      was Patienten beim Buchen auswählen können:
                "name", "bereich" (Überschrift), "preis" in Euro,
                "dauer" in Minuten, optional "paket" (Paketpreis) und
                "medizinisch: true" (umsatzsteuerfrei, eigener Hinweis)
   - pakete     Paketpreise, z. B. 2 oder 3 Zonen im oberen Gesicht
   - beratung   Termin nur zur Beratung (wird bei Behandlung angerechnet)
   - behandler  erscheinen als Auswahl (zusätzlich zu „Beliebig“)
   - raster     Abstand der Uhrzeiten (30 = halbstündlich)
   Preise und Kalkulation: siehe PREISKALKULATION.md
   Nach einer Änderung hier: "npm run online" ausführen.

   "tage" unten sind nur Beispiele für die lokale Vorschau ohne
   Server – auf der echten Website zählen die Praxistage aus der
   Praxis-Seite.
   ============================================================= */

window.BEHANDLUNGSTAGE = {
  empfaenger: "termin@rheude-kobler.de",

  raster: 30,               // Uhrzeiten im 30-Minuten-Takt
  standardDauer: 30,        // Dauer, wenn bei einer Behandlung keine angegeben ist
  monateVoraus: 3,          // so viele Monate kann man im Kalender vorblättern

  // Ab so vielen gewählten Zonen wird der Termin 15 Minuten länger
  zusatzzeitAbZonen: 4,

  beratung: { name: "Erstberatung", preis: 50, dauer: 30 },

  zonen: [
    { name: "Zornesfalte",         bereich: "Oberes Gesicht", preis: 279, dauer: 30, paket: "oben" },
    { name: "Stirnfalten",         bereich: "Oberes Gesicht", preis: 249, dauer: 30, paket: "oben" },
    { name: "Krähenfüße",          bereich: "Oberes Gesicht", preis: 279, dauer: 30, paket: "oben" },
    { name: "Lip-Flip",            bereich: "Feine Akzente",  preis: 169, dauer: 30 },
    { name: "Nasenfältchen",       bereich: "Feine Akzente",  preis: 149, dauer: 30 },
    { name: "Mundwinkel",          bereich: "Feine Akzente",  preis: 189, dauer: 30 },
    { name: "Kinn (Erdbeerkinn)",  bereich: "Feine Akzente",  preis: 189, dauer: 30 },
    { name: "Zähneknirschen",      bereich: "Medizinisch",    preis: 449, dauer: 30, medizinisch: true },
    { name: "Starkes Schwitzen (Achseln)", bereich: "Medizinisch", preis: 649, dauer: 45, medizinisch: true }
  ],

  pakete: {
    oben: { name: "Oberes Gesicht", preise: { 2: 449, 3: 549 } }   // 2 Zonen / 3 Zonen
  },

  behandler: ["Dr. med. Nils Rheude", "Dr. med. Niklas Kobler"],

  // NUR FÜR DIE LOKALE VORSCHAU (python-Server) – online zählt die Praxis-Seite
  tage: [
    { datum: "2026-11-14", von: "09:00", bis: "18:00", pause: ["12:30", "14:00"], vergeben: ["09:00", "10:30", "11:00-11:45", "15:30"] },
    { datum: "2026-11-28", von: "09:00", bis: "18:00", pause: ["12:30", "14:00"], vergeben: ["09:30", "14:00"] },
    { datum: "2026-12-12", von: "10:00", bis: "17:00", pause: ["13:00", "14:00"], vergeben: [] }
  ]
};
