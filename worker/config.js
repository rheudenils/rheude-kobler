/* Liest Zonen, Preise, Behandler und Raster aus behandlungstage.js –
   dieselbe Datei, die auch die Website nutzt (eine Quelle für beides). */
import './fenster.js';
import '../behandlungstage.js';
import '../angebot.js';

const cfg = globalThis.BEHANDLUNGSTAGE || {};

export const RASTER = cfg.raster || 30;
export const STD = cfg.standardDauer || 30;
export const MONATE_VORAUS = cfg.monateVoraus == null ? 3 : cfg.monateVoraus;
export const BEHANDLER = cfg.behandler || [];
export const ANGEBOT = globalThis.KR_ANGEBOT;
// Auswahl für Termine, die die Praxis selbst einträgt
export const BEHANDLUNGEN = [ANGEBOT.beratung, ...ANGEBOT.zonen].map((z) => ({ name: z.name, dauer: z.dauer || STD, preis: z.preis }));
