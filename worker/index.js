/* =============================================================
   Rheude & Kobler – Server (Cloudflare Worker)
   - liefert die Website aus (dist/client)
   - /api/verfuegbarkeit   freie Zeiten für den Kalender (ohne Namen)
   - /api/anfrage          Terminanfrage: Slot wird sofort reserviert
   - /api/admin/...        Praxis-Seite (mit Passwort)
   - täglich 7 Uhr:        Übersicht an die Praxis, Erinnerungen, Löschfristen
   ============================================================= */
import { RASTER, STD, MONATE_VORAUS, BEHANDLUNGEN, BEHANDLER, ANGEBOT } from './config.js';
import { toMin, toTime, isIsoDate, berlinJetzt, plusTage } from './zeit.js';
import * as mail from './mail.js';

const AKTIV = "status IN ('angefragt','bestaetigt')";
const MAX_OFFENE_PRO_KONTAKT = 3;
const MAX_ANFRAGEN_PRO_STUNDE = 40;

/* ---------- Hilfen ---------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fehler = (meldung, status = 400, extra = {}) => json({ ok: false, fehler: meldung, ...extra }, status);

const sauber = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const istEmail = (s) => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(s);
const istTelefon = (s) => /^[+\d(][\d\s/().\-]{5,24}$/.test(s);

async function body(request) {
  try { return await request.json(); } catch { return null; }
}

function tagAusDb(t) {
  return t && { datum: t.datum, von: t.von, bis: t.bis, pause_von: t.pause_von, pause_bis: t.pause_bis };
}

/* Prüft, ob eine Uhrzeit an diesem Praxistag überhaupt buchbar ist */
function slotFehler(tag, start, dauer, jetzt, { vergangenheitErlaubt = false } = {}) {
  if (!tag) return 'An diesem Tag ist keine Sprechstunde.';
  if (!Number.isFinite(start) || start < tag.von || start + dauer > tag.bis) return 'Diese Uhrzeit liegt außerhalb der Sprechstunde.';
  if (!vergangenheitErlaubt) {
    if ((start - tag.von) % RASTER !== 0) return 'Diese Uhrzeit ist nicht buchbar.';
    if (tag.pause_von != null && start < tag.pause_bis && start + dauer > tag.pause_von) return 'Diese Uhrzeit fällt in die Pause.';
    if (tag.datum < jetzt.datum || (tag.datum === jetzt.datum && start <= jetzt.min + 60)) return 'Diese Uhrzeit ist leider zu kurzfristig.';
  }
  return null;
}

const ueberschneidung = (env, datum, start, ende, ohneId = 0) =>
  env.DB.prepare(`SELECT id, name, start, ende FROM termine WHERE datum = ? AND ${AKTIV} AND start < ? AND ende > ? AND id <> ? LIMIT 1`)
    .bind(datum, ende, start, ohneId).first();

/* ---------- öffentlich ---------- */
async function verfuegbarkeit(env) {
  const jetzt = berlinJetzt();
  const bis = plusTage(jetzt.datum, Math.ceil((MONATE_VORAUS + 1) * 31));
  const [tage, belegt] = await Promise.all([
    env.DB.prepare('SELECT * FROM tage WHERE datum >= ? AND datum <= ? ORDER BY datum').bind(jetzt.datum, bis).all(),
    env.DB.prepare(`SELECT datum, start, ende FROM termine WHERE datum >= ? AND datum <= ? AND ${AKTIV}`).bind(jetzt.datum, bis).all()
  ]);
  return json({
    ok: true,
    tage: tage.results.map((t) => ({
      datum: t.datum, von: toTime(t.von), bis: toTime(t.bis),
      pause: t.pause_von != null ? [toTime(t.pause_von), toTime(t.pause_bis)] : null,
      vergeben: belegt.results.filter((b) => b.datum === t.datum).map((b) => toTime(b.start) + '-' + toTime(b.ende))
    }))
  });
}

async function anfrage(request, env, ctx) {
  const d = await body(request);
  if (!d) return fehler('Ungültige Anfrage.');
  if (d.website) return json({ ok: true }); // Spam-Falle: unsichtbares Feld wurde ausgefüllt

  const datum = sauber(d.datum, 10), start = toMin(d.zeit);
  const zonen = Array.isArray(d.zonen) ? d.zonen.slice(0, 12).map((z) => String(z)) : [];
  const behandlung = ANGEBOT.berechne(zonen); // Preis und Dauer immer vom Server berechnet
  const behandler = d.behandler === 'Beliebig' || BEHANDLER.includes(d.behandler) ? d.behandler : null;
  const name = sauber(d.name, 100), telefon = sauber(d.telefon, 30), email = sauber(d.email, 120).toLowerCase();

  if (!isIsoDate(datum) || !behandlung || !behandler) return fehler('Bitte wählen Sie Tag, Uhrzeit und Behandlung erneut.');
  if (name.length < 2) return fehler('Bitte geben Sie Ihren Namen an.');
  if (email && !istEmail(email)) return fehler('Bitte prüfen Sie Ihre E-Mail-Adresse.');
  if (telefon && !istTelefon(telefon)) return fehler('Bitte prüfen Sie Ihre Telefonnummer.');
  if (!email && !telefon) return fehler('Bitte geben Sie Telefon oder E-Mail an, damit wir Ihren Termin bestätigen können.');

  const jetzt = berlinJetzt();
  const tag = tagAusDb(await env.DB.prepare('SELECT * FROM tage WHERE datum = ?').bind(datum).first());
  const ende = start + behandlung.dauer;
  const preis = behandlung.preis;
  const f = slotFehler(tag, start, behandlung.dauer, jetzt);
  if (f) return fehler(f, 409, { vergeben: true });

  // Missbrauch begrenzen
  const offene = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM termine WHERE status = 'angefragt' AND datum >= ?1 AND ((?2 <> '' AND email = ?2) OR (?3 <> '' AND telefon = ?3))`
  ).bind(jetzt.datum, email, telefon).first();
  if (offene.n >= MAX_OFFENE_PRO_KONTAKT) return fehler('Sie haben bereits mehrere offene Anfragen. Wir melden uns in Kürze bei Ihnen.', 429);
  const proStunde = await env.DB.prepare('SELECT COUNT(*) AS n FROM termine WHERE erstellt > ?').bind(new Date(Date.now() - 3600e3).toISOString()).first();
  if (proStunde.n >= MAX_ANFRAGEN_PRO_STUNDE) return fehler('Gerade sind sehr viele Anfragen eingegangen. Bitte versuchen Sie es später erneut oder schreiben Sie uns eine E-Mail.', 429);

  // Reservieren – nur wenn der Zeitraum noch frei ist (in einem Schritt, damit niemand doppelt bucht)
  const erstellt = new Date().toISOString();
  const r = await env.DB.prepare(
    `INSERT INTO termine (datum, start, ende, behandlung, behandler, name, telefon, email, preis, status, quelle, erstellt)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?10, 'angefragt', 'website', ?9
     WHERE NOT EXISTS (SELECT 1 FROM termine WHERE datum = ?1 AND ${AKTIV} AND start < ?3 AND ende > ?2)`
  ).bind(datum, start, ende, behandlung.text, behandler, name, telefon, email, erstellt, preis).run();
  if (!r.meta.changes) return fehler('Diese Uhrzeit wurde gerade vergeben. Bitte wählen Sie eine andere.', 409, { vergeben: true });

  const t = { id: r.meta.last_row_id, datum, start, ende, behandlung: behandlung.text, behandler, name, telefon, email, preis, status: 'angefragt' };
  ctx.waitUntil(Promise.all([mail.praxisNeueAnfrage(env, t), mail.patientEingang(env, t)]));
  return json({ ok: true, bestaetigungsmail: !!email && mail.mailAktiv(env) });
}

/* ---------- Anmeldung Praxis ---------- */
const COOKIE = 'kr_praxis';
const SITZUNG_TAGE = 30;
const enc = (s) => new TextEncoder().encode(s);

async function hmac(schluessel, text) {
  const key = await crypto.subtle.importKey('raw', enc(schluessel), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(text)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Ändert sich das Passwort, werden alle bestehenden Anmeldungen ungültig.
const sitzungsSchluessel = (env) => 'kr-sitzung|' + env.PRAXIS_PASSWORT;

async function angemeldet(request, env) {
  if (!env.PRAXIS_PASSWORT) return false;
  const c = (request.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith(COOKIE + '='));
  if (!c) return false;
  const [ablauf, sig] = c.slice(COOKIE.length + 1).split('.');
  if (!ablauf || !sig || +ablauf < Date.now()) return false;
  return (await hmac(sitzungsSchluessel(env), ablauf)) === sig;
}

async function anmelden(request, env) {
  if (!env.PRAXIS_PASSWORT) return fehler('Das Praxis-Passwort ist noch nicht eingerichtet (PRAXIS_PASSWORT).', 503);
  const ip = request.headers.get('cf-connecting-ip') || 'lokal';
  const seit = Date.now() - 15 * 60e3;
  const versuche = await env.DB.prepare('SELECT COUNT(*) AS n FROM anmeldeversuche WHERE ip = ? AND zeit > ?').bind(ip, seit).first();
  if (versuche.n >= 8) return fehler('Zu viele Versuche. Bitte warten Sie 15 Minuten.', 429);

  const d = await body(request);
  const eingabe = String(d?.passwort ?? '');
  // Vergleich über HMAC, damit die Laufzeit nichts über das Passwort verrät
  const ok = (await hmac('vergleich', eingabe)) === (await hmac('vergleich', env.PRAXIS_PASSWORT));
  if (!ok) {
    await env.DB.prepare('INSERT INTO anmeldeversuche (ip, zeit) VALUES (?, ?)').bind(ip, Date.now()).run();
    return fehler('Das Passwort stimmt nicht.', 401);
  }
  await env.DB.prepare('DELETE FROM anmeldeversuche WHERE ip = ?').bind(ip).run();
  const ablauf = String(Date.now() + SITZUNG_TAGE * 86400e3);
  const token = ablauf + '.' + (await hmac(sitzungsSchluessel(env), ablauf));
  return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/; Max-Age=${SITZUNG_TAGE * 86400}` });
}

/* ---------- Praxis-Seite ---------- */
async function praxisDaten(env) {
  const jetzt = berlinJetzt();
  const ab = plusTage(jetzt.datum, -30);
  const [termine, tage] = await Promise.all([
    env.DB.prepare('SELECT * FROM termine WHERE datum >= ? ORDER BY datum, start').bind(ab).all(),
    env.DB.prepare('SELECT * FROM tage WHERE datum >= ? ORDER BY datum').bind(ab).all()
  ]);
  return json({
    ok: true, heute: jetzt.datum, jetzt: jetzt.min,
    mail: mail.mailAktiv(env),
    einstellungen: { raster: RASTER, behandlungen: BEHANDLUNGEN, behandler: BEHANDLER },
    termine: termine.results, tage: tage.results
  });
}

async function statusAendern(env, ctx, id, d) {
  const neu = d?.status;
  if (!['angefragt', 'bestaetigt', 'abgesagt'].includes(neu)) return fehler('Unbekannter Status.');
  const t = await env.DB.prepare('SELECT * FROM termine WHERE id = ?').bind(id).first();
  if (!t) return fehler('Termin nicht gefunden.', 404);
  if (t.status === neu) return json({ ok: true, mailGesendet: false });
  if (t.status === 'abgesagt') {
    const k = await ueberschneidung(env, t.datum, t.start, t.ende, t.id);
    if (k) return fehler(`Die Zeit ist inzwischen belegt (${k.name}, ${toTime(k.start)} Uhr).`, 409);
  }
  await env.DB.prepare('UPDATE termine SET status = ?, geaendert = ? WHERE id = ?').bind(neu, new Date().toISOString(), id).run();

  let mailGesendet = false;
  if (d.mail !== false && t.email) {
    if (neu === 'bestaetigt') mailGesendet = await mail.patientBestaetigt(env, t);
    if (neu === 'abgesagt') mailGesendet = await mail.patientAbgesagt(env, t, sauber(d.nachricht, 1000));
  }
  return json({ ok: true, mailGesendet });
}

async function terminEintragen(env, d) {
  const datum = sauber(d?.datum, 10), start = toMin(d?.zeit);
  const dauer = Math.max(5, Math.min(480, parseInt(d?.dauer, 10) || STD));
  const name = sauber(d?.name, 100);
  const preis = d?.preis === '' || d?.preis == null ? null : Math.max(0, Math.min(10000, parseInt(d.preis, 10) || 0));
  if (!isIsoDate(datum) || !Number.isFinite(start)) return fehler('Bitte Datum und Uhrzeit angeben.');
  if (name.length < 2) return fehler('Bitte einen Namen angeben.');
  const email = sauber(d?.email, 120).toLowerCase();
  if (email && !istEmail(email)) return fehler('Die E-Mail-Adresse sieht nicht richtig aus.');
  if (start + dauer > 24 * 60) return fehler('Der Termin geht über Mitternacht hinaus.');

  if (!d.trotzdem) {
    const k = await ueberschneidung(env, datum, start, start + dauer);
    if (k) return fehler(`Überschneidet sich mit ${k.name} (${toTime(k.start)}–${toTime(k.ende)} Uhr).`, 409, { konflikt: true });
  }
  const r = await env.DB.prepare(
    `INSERT INTO termine (datum, start, ende, behandlung, behandler, name, telefon, email, notiz, preis, status, quelle, erstellt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bestaetigt', 'praxis', ?)`
  ).bind(datum, start, start + dauer, sauber(d.behandlung, 80) || 'Termin', sauber(d.behandler, 80) || 'Beliebig', name,
    sauber(d.telefon, 30), email, sauber(d.notiz, 500), preis, new Date().toISOString()).run();
  let mailGesendet = false;
  if (d.mail && email) mailGesendet = await mail.patientBestaetigt(env, { datum, start, name, email, preis });
  return json({ ok: true, id: r.meta.last_row_id, mailGesendet });
}

async function tagSpeichern(env, d) {
  const datum = sauber(d?.datum, 10);
  const von = toMin(d?.von), bis = toMin(d?.bis);
  const pv = d?.pause_von ? toMin(d.pause_von) : null, pb = d?.pause_bis ? toMin(d.pause_bis) : null;
  if (!isIsoDate(datum)) return fehler('Bitte ein Datum wählen.');
  if (!(von < bis)) return fehler('Die Endzeit muss nach der Anfangszeit liegen.');
  if ((pv == null) !== (pb == null) || (pv != null && !(von <= pv && pv < pb && pb <= bis))) return fehler('Die Pause muss innerhalb der Sprechstunde liegen (Beginn und Ende angeben).');
  await env.DB.prepare(
    `INSERT INTO tage (datum, von, bis, pause_von, pause_bis) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(datum) DO UPDATE SET von = excluded.von, bis = excluded.bis, pause_von = excluded.pause_von, pause_bis = excluded.pause_bis`
  ).bind(datum, von, bis, pv, pb).run();
  return json({ ok: true });
}

async function tagLoeschen(env, datum) {
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM termine WHERE datum = ? AND ${AKTIV}`).bind(datum).first();
  if (n.n) return fehler(`An diesem Tag gibt es noch ${n.n} aktive Termin${n.n === 1 ? '' : 'e'}. Bitte zuerst absagen.`, 409);
  await env.DB.prepare('DELETE FROM tage WHERE datum = ?').bind(datum).run();
  return json({ ok: true });
}

async function admin(request, env, ctx, pfad) {
  const methode = request.method;
  if (methode !== 'GET') {
    // Nur Anfragen von der eigenen Seite (Schutz gegen fremde Formulare)
    const herkunft = request.headers.get('origin');
    if (herkunft && herkunft !== new URL(request.url).origin) return fehler('Nicht erlaubt.', 403);
    if (!(request.headers.get('content-type') || '').includes('application/json')) return fehler('Nicht erlaubt.', 415);
  }
  if (pfad === 'anmelden' && methode === 'POST') return anmelden(request, env);
  if (pfad === 'abmelden' && methode === 'POST') return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/; Max-Age=0` });
  if (!(await angemeldet(request, env))) return fehler('Bitte melden Sie sich an.', 401, { anmelden: true, eingerichtet: !!env.PRAXIS_PASSWORT });

  let m;
  if (pfad === 'daten' && methode === 'GET') return praxisDaten(env);
  if ((m = /^termine\/(\d+)$/.exec(pfad)) && methode === 'POST') return statusAendern(env, ctx, +m[1], await body(request));
  if (pfad === 'termine' && methode === 'POST') return terminEintragen(env, await body(request));
  if (pfad === 'tage' && methode === 'POST') return tagSpeichern(env, await body(request));
  if ((m = /^tage\/(\d{4}-\d{2}-\d{2})$/.exec(pfad)) && methode === 'DELETE') return tagLoeschen(env, m[1]);
  return fehler('Nicht gefunden.', 404);
}

/* ---------- täglich ---------- */
export async function taeglich(env) {
  const jetzt = berlinJetzt();
  const morgen = plusTage(jetzt.datum, 1);
  const [offen, morgenListe] = await Promise.all([
    env.DB.prepare("SELECT * FROM termine WHERE status = 'angefragt' AND datum >= ? ORDER BY datum, start").bind(jetzt.datum).all(),
    env.DB.prepare(`SELECT * FROM termine WHERE datum = ? AND ${AKTIV} ORDER BY start`).bind(morgen).all()
  ]);
  if (offen.results.length || morgenListe.results.length) await mail.praxisTagesuebersicht(env, offen.results, morgenListe.results, morgen);

  for (const t of morgenListe.results) {
    if (t.status !== 'bestaetigt' || !t.email || t.erinnert) continue;
    if (await mail.patientErinnerung(env, t)) await env.DB.prepare('UPDATE termine SET erinnert = 1 WHERE id = ?').bind(t.id).run();
  }

  // Löschfristen: personenbezogene Daten nicht länger als nötig aufbewahren
  const frist = plusTage(jetzt.datum, -(parseInt(env.LOESCHEN_NACH_TAGEN, 10) || 180));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM termine WHERE datum < ?').bind(frist),
    env.DB.prepare('DELETE FROM tage WHERE datum < ?').bind(frist),
    env.DB.prepare('DELETE FROM anmeldeversuche WHERE zeit < ?').bind(Date.now() - 86400e3)
  ]);
}

/* ---------- Einstieg ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/api/verfuegbarkeit' && request.method === 'GET') return await verfuegbarkeit(env);
      if (url.pathname === '/api/anfrage' && request.method === 'POST') return await anfrage(request, env, ctx);
      if (url.pathname.startsWith('/api/admin/')) return await admin(request, env, ctx, url.pathname.slice('/api/admin/'.length));
      return fehler('Nicht gefunden.', 404);
    } catch (e) {
      console.error(e);
      return fehler('Interner Fehler. Bitte versuchen Sie es erneut.', 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(taeglich(env));
  }
};
