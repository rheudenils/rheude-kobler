/* =============================================================
   Rheude & Kobler – Preis und Dauer einer Auswahl berechnen.
   Gilt gleichermaßen für Website, Server und Praxis-Seite.
   Die Zahlen selbst stehen in behandlungstage.js.
   ============================================================= */
(function (g) {
  'use strict';
  var cfg = g.BEHANDLUNGSTAGE || {};
  var zonen = cfg.zonen || [];
  var pakete = cfg.pakete || {};
  var beratung = cfg.beratung || { name: 'Erstberatung', preis: 0, dauer: cfg.standardDauer || 30 };
  var ZUSATZ_AB = cfg.zusatzzeitAbZonen || 4;

  // auswahl: Liste von Zonen-Namen. Leer = nur Beratung. Unbekannte Namen → null.
  function berechne(auswahl) {
    auswahl = auswahl || [];
    var gewaehlt = [];
    for (var i = 0; i < auswahl.length; i++) {
      var z = zonen.filter(function (x) { return x.name === auswahl[i]; })[0];
      if (!z) return null;
      if (gewaehlt.indexOf(z) < 0) gewaehlt.push(z);
    }
    if (!gewaehlt.length) {
      return { beratung: true, zonen: [], text: beratung.name, preis: beratung.preis, dauer: beratung.dauer, pakete: [], medizinisch: false };
    }
    var preis = 0, paketInfo = [], gruppen = {};
    gewaehlt.forEach(function (z) {
      if (z.paket && pakete[z.paket]) (gruppen[z.paket] = gruppen[z.paket] || []).push(z);
      else preis += z.preis;
    });
    Object.keys(gruppen).forEach(function (k) {
      var list = gruppen[k], p = pakete[k].preise && pakete[k].preise[list.length];
      if (p) { preis += p; paketInfo.push(pakete[k].name + ' · ' + list.length + ' Zonen'); }
      else list.forEach(function (z) { preis += z.preis; });
    });
    var dauer = Math.max.apply(null, gewaehlt.map(function (z) { return z.dauer || beratung.dauer; })) + (gewaehlt.length >= ZUSATZ_AB ? 15 : 0);
    return {
      beratung: false,
      zonen: gewaehlt.map(function (z) { return z.name; }),
      text: gewaehlt.map(function (z) { return z.name; }).join(', '),
      preis: preis, dauer: dauer, pakete: paketInfo,
      medizinisch: gewaehlt.some(function (z) { return z.medizinisch; })
    };
  }

  // Zonen nach Bereich gruppiert (Reihenfolge wie in behandlungstage.js)
  function bereiche() {
    var out = [];
    zonen.forEach(function (z) {
      var b = out.filter(function (x) { return x.name === z.bereich; })[0];
      if (!b) out.push(b = { name: z.bereich || 'Behandlung', zonen: [] });
      b.zonen.push(z);
    });
    return out;
  }

  g.KR_ANGEBOT = { berechne: berechne, bereiche: bereiche, zonen: zonen, pakete: pakete, beratung: beratung };
})(typeof window !== 'undefined' ? window : globalThis);
