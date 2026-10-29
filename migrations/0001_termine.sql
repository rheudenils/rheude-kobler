-- Praxistage: an diesen Tagen sind Termine buchbar
CREATE TABLE IF NOT EXISTS tage (
  datum      TEXT PRIMARY KEY,          -- JJJJ-MM-TT
  von        INTEGER NOT NULL,          -- Minuten ab Mitternacht
  bis        INTEGER NOT NULL,
  pause_von  INTEGER,
  pause_bis  INTEGER
);

-- Termine: Anfragen von der Website und Einträge der Praxis
CREATE TABLE IF NOT EXISTS termine (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  datum       TEXT NOT NULL,
  start       INTEGER NOT NULL,         -- Minuten ab Mitternacht
  ende        INTEGER NOT NULL,
  behandlung  TEXT NOT NULL,
  behandler   TEXT NOT NULL DEFAULT 'Beliebig',
  name        TEXT NOT NULL,
  telefon     TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  notiz       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'angefragt',  -- angefragt | bestaetigt | abgesagt
  quelle      TEXT NOT NULL DEFAULT 'website',    -- website | praxis
  erstellt    TEXT NOT NULL,
  geaendert   TEXT,
  erinnert    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS termine_datum ON termine (datum, status);
CREATE INDEX IF NOT EXISTS termine_status ON termine (status);

-- Fehlgeschlagene Anmeldungen (Schutz vor Passwort-Raten)
CREATE TABLE IF NOT EXISTS anmeldeversuche (
  ip    TEXT NOT NULL,
  zeit  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS anmeldeversuche_ip ON anmeldeversuche (ip, zeit);
