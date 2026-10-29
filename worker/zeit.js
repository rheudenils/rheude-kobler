/* Datum und Uhrzeit – immer deutsche Ortszeit (Europe/Berlin) */
export const pad = (n) => String(n).padStart(2, '0');

export function toMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return NaN;
  return +m[1] * 60 + +m[2];
}
export const toTime = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

export const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00Z'));

export function berlinJetzt() {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date());
  const [datum, zeit] = s.split(' ');
  return { datum, min: toMin(zeit) };
}

export function plusTage(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function langesDatum(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${TAGE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function kurzesDatum(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${TAGE[d.getUTCDay()].slice(0, 2)}, ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.`;
}
