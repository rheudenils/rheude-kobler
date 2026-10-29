/* E-Mails über Brevo (EU-Anbieter, AV-Vertrag verfügbar).
   Ohne BREVO_API_KEY wird nichts verschickt – die Praxis-Seite zeigt dann einen Hinweis. */
import { langesDatum, kurzesDatum, toTime } from './zeit.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const mailAktiv = (env) => !!(env.BREVO_API_KEY && env.MAIL_ABSENDER);
export const praxisAdressen = (env) => String(env.PRAXIS_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
const adresse = (env) => env.PRAXIS_ADRESSE || 'Am Bahnhofsplatz 5, 67459 Böhl-Iggelheim';
const seite = (env) => String(env.SITE_URL || '').replace(/\/$/, '');

async function senden(env, { an, betreff, absaetze, knopf, antwortAn }) {
  if (!mailAktiv(env) || !an.length) return false;
  const alsText = (a) => a.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const text = absaetze.map(alsText).join('\n\n') + (knopf ? `\n\n${knopf.text}: ${knopf.url}` : '');
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#2E3832">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EF;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E6E2D8">
<tr><td style="background:#2E3832;padding:22px 28px;color:#F6F4EF;font-family:Georgia,serif;font-size:18px;letter-spacing:3px">RHEUDE <span style="color:#C6A86F">&amp;</span> KOBLER<div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#B5B8A8;margin-top:4px">ÄSTHETISCHE MEDIZIN</div></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
${absaetze.map((a) => `<p style="margin:0 0 16px">${a}</p>`).join('')}
${knopf ? `<p style="margin:24px 0 8px"><a href="${esc(knopf.url)}" style="display:inline-block;background:#9C7F47;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:2px;text-transform:uppercase">${esc(knopf.text)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E6E2D8;font-size:12px;color:#6E7468">Rheude &amp; Kobler · Ästhetische Medizin · ${esc(adresse(env))}</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: env.MAIL_NAME || 'Rheude & Kobler', email: env.MAIL_ABSENDER },
        to: an.map((email) => ({ email })),
        replyTo: antwortAn ? { email: antwortAn } : undefined,
        subject: betreff,
        htmlContent: html,
        textContent: text
      })
    });
    if (!res.ok) { console.error('Mailversand fehlgeschlagen', res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error('Mailversand fehlgeschlagen', e);
    return false;
  }
}

const wann = (t) => `${langesDatum(t.datum)}, ${toTime(t.start)} Uhr`;
const zeile = (label, wert) => `<strong>${label}:</strong> ${esc(wert)}`;

/* ---------- an die Praxis ---------- */
export function praxisNeueAnfrage(env, t) {
  return senden(env, {
    an: praxisAdressen(env),
    antwortAn: t.email || undefined,
    betreff: `Neue Terminanfrage: ${kurzesDatum(t.datum)} ${toTime(t.start)} Uhr – ${t.name}`,
    absaetze: [
      'Über die Website ist eine neue Terminanfrage eingegangen. Der Termin ist <strong>vorgemerkt</strong> und für andere gesperrt, aber <strong>noch nicht bestätigt</strong>.',
      [zeile('Termin', `${wann(t)} bis ${toTime(t.ende)} Uhr`), zeile('Behandlung', t.behandlung), zeile('Richtpreis', t.preis != null ? t.preis + ' €' : '—'), zeile('Behandler', t.behandler),
        zeile('Name', t.name), zeile('Telefon', t.telefon || '—'), zeile('E-Mail', t.email || '— (bitte telefonisch bestätigen)')].join('<br>'),
      'Bitte auf der Praxis-Seite bestätigen oder absagen – die Patientin bzw. der Patient bekommt dann automatisch Bescheid.'
    ],
    knopf: { text: 'Zur Praxis-Seite', url: `${seite(env)}/praxis/` }
  });
}

export function praxisTagesuebersicht(env, offen, morgen, morgenDatum) {
  const liste = (arr) => arr.map((t) => `${kurzesDatum(t.datum)} ${toTime(t.start)} Uhr · ${esc(t.name)} · ${esc(t.behandlung)}${t.status === 'angefragt' ? ' · <strong style="color:#9C7F47">noch offen</strong>' : ''}`).join('<br>');
  const absaetze = [];
  if (offen.length) absaetze.push(`<strong>${offen.length} ${offen.length === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf Ihre Bestätigung:</strong>`, liste(offen));
  if (morgen.length) absaetze.push(`<strong>Morgen, ${esc(langesDatum(morgenDatum))}:</strong>`, liste(morgen));
  return senden(env, {
    an: praxisAdressen(env),
    betreff: offen.length ? `${offen.length} offene Terminanfrage${offen.length === 1 ? '' : 'n'} · Tagesübersicht` : `Termine morgen (${morgen.length}) · Tagesübersicht`,
    absaetze,
    knopf: { text: 'Zur Praxis-Seite', url: `${seite(env)}/praxis/` }
  });
}

/* ---------- an Patientinnen und Patienten ---------- */
const richtpreis = (t) => (t.preis ? `<br>Richtpreis: ${esc(t.preis)} € (inkl. Nachkontrolle)` : '');
const anrede = (t) => `Guten Tag ${esc(t.name)},`;
const antwort = (env) => praxisAdressen(env)[0];

export function patientEingang(env, t) {
  if (!t.email) return Promise.resolve(false);
  return senden(env, {
    an: [t.email], antwortAn: antwort(env),
    betreff: 'Ihre Terminanfrage ist eingegangen – Rheude & Kobler',
    absaetze: [
      anrede(t),
      `vielen Dank für Ihre Anfrage. Wir haben folgenden Termin für Sie vorgemerkt:<br><strong>${esc(wann(t))}</strong>${richtpreis(t)}`,
      '<strong>Bitte beachten Sie: Der Termin ist erst verbindlich, wenn wir ihn bestätigen.</strong> Sie erhalten in Kürze eine Bestätigung per E-Mail oder einen Anruf von uns.',
      'Mit freundlichen Grüßen<br>Ihr Praxisteam Rheude &amp; Kobler'
    ]
  });
}

export function patientBestaetigt(env, t) {
  if (!t.email) return Promise.resolve(false);
  return senden(env, {
    an: [t.email], antwortAn: antwort(env),
    betreff: `Terminbestätigung: ${kurzesDatum(t.datum)} um ${toTime(t.start)} Uhr – Rheude & Kobler`,
    absaetze: [
      anrede(t),
      `hiermit bestätigen wir Ihren Termin verbindlich:<br><strong>${esc(wann(t))}</strong><br>${esc(adresse(env))}${richtpreis(t)}`,
      'Sollten Sie den Termin nicht wahrnehmen können, antworten Sie bitte einfach auf diese E-Mail – möglichst mindestens 24 Stunden vorher.',
      'Wir freuen uns auf Sie.<br>Ihr Praxisteam Rheude &amp; Kobler'
    ]
  });
}

export function patientAbgesagt(env, t, nachricht) {
  if (!t.email) return Promise.resolve(false);
  const absaetze = [anrede(t)];
  absaetze.push(t.status === 'bestaetigt'
    ? `leider müssen wir Ihren Termin am <strong>${esc(wann(t))}</strong> absagen.`
    : `leider können wir Ihnen den angefragten Termin am <strong>${esc(wann(t))}</strong> nicht anbieten.`);
  if (nachricht) absaetze.push(esc(nachricht).replace(/\n/g, '<br>'));
  absaetze.push('Gern können Sie online einen anderen Termin wählen. Bei Fragen antworten Sie einfach auf diese E-Mail.', 'Mit freundlichen Grüßen<br>Ihr Praxisteam Rheude &amp; Kobler');
  return senden(env, {
    an: [t.email], antwortAn: antwort(env),
    betreff: 'Ihr Termin bei Rheude & Kobler',
    absaetze,
    knopf: { text: 'Neuen Termin wählen', url: `${seite(env)}/#termin` }
  });
}

export function patientErinnerung(env, t) {
  if (!t.email) return Promise.resolve(false);
  return senden(env, {
    an: [t.email], antwortAn: antwort(env),
    betreff: `Erinnerung: Ihr Termin morgen um ${toTime(t.start)} Uhr – Rheude & Kobler`,
    absaetze: [
      anrede(t),
      `wir möchten Sie an Ihren Termin erinnern:<br><strong>${esc(wann(t))}</strong><br>${esc(adresse(env))}`,
      'Falls Sie verhindert sind, geben Sie uns bitte kurz Bescheid, indem Sie auf diese E-Mail antworten.',
      'Bis morgen!<br>Ihr Praxisteam Rheude &amp; Kobler'
    ]
  });
}
