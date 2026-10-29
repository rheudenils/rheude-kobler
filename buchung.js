/* =============================================================
   Rheude & Kobler — Terminkalender
   Kalender links, freie Uhrzeiten + Anfrage rechts.
   Praxistage und belegte Zeiten kommen live vom Server, Behandlungen
   und Behandler aus behandlungstage.js. Rendert in [data-termin].
   ============================================================= */
(function () {
  'use strict';

  var cfg = window.BEHANDLUNGSTAGE || {};
  var RASTER = cfg.raster || 30;
  var STD = cfg.standardDauer || 30;
  var AHEAD = cfg.monateVoraus == null ? 3 : cfg.monateVoraus;

  var M = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var toMin = function (t) { var p = String(t).trim().split(':'); return +p[0] * 60 + +(p[1] || 0); };
  var toTime = function (m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var now = new Date();
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var todayIso = iso(now);
  var asDate = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var longDate = function (s) { var d = asDate(s); return WDL[d.getDay()] + ', ' + d.getDate() + '. ' + M[d.getMonth()] + ' ' + d.getFullYear(); };
  var shortDate = function (s) { var d = asDate(s); return WD[d.getDay()] + ', ' + d.getDate() + '. ' + M[d.getMonth()]; };

  // Zonen, Preise und Dauer kommen aus angebot.js (Zahlen in behandlungstage.js)
  var A = window.KR_ANGEBOT || { berechne: function () { return { beratung: true, zonen: [], text: 'Beratung', preis: 0, dauer: STD, pakete: [] }; }, bereiche: function () { return []; }, beratung: { name: 'Beratung', preis: 0 } };
  var euro = function (n) { return n.toLocaleString('de-DE') + ' €'; };
  var doctors = ['Beliebig'].concat(cfg.behandler || []);

  /* Praxistage kommen live vom Server (/api/verfuegbarkeit).
     Lokale Vorschau ohne Server: Beispieltage aus behandlungstage.js. */
  var mode = 'laden'; // laden | api | vorschau | fehler
  var lokal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var days = [], dayByIso = {}, MAXMO = 0;
  function setDays(list) {
    days = (list || [])
      .filter(function (d) { return d && d.datum >= todayIso; })
      .sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
    dayByIso = {};
    days.forEach(function (d) { dayByIso[d.datum] = d; });
    // Monatsbereich: aktueller Monat bis letzter Praxistag (höchstens AHEAD Monate)
    var lastMo = days.length ? (function () { var d = asDate(days[days.length - 1].datum); return (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth(); })() : 0;
    MAXMO = Math.max(0, Math.min(AHEAD, lastMo));
  }
  function load() {
    return fetch('/api/verfuegbarkeit', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (d) { if (!d.ok) throw new Error('fehler'); mode = 'api'; setDays(d.tage); });
  }

  function blocks(day) {
    return (day.vergeben || []).map(function (s) {
      var p = String(s).split(/\s*[-–]\s*/), a = toMin(p[0]);
      return [a, p[1] ? toMin(p[1]) : a + STD];
    });
  }
  // Alle Uhrzeiten eines Tages: { time, taken }
  function slotsFor(day, dauer) {
    var dur = dauer || STD, start = toMin(day.von), end = toMin(day.bis);
    var pause = day.pause && day.pause.length === 2 ? [toMin(day.pause[0]), toMin(day.pause[1])] : null;
    var earliest = day.datum === todayIso ? now.getHours() * 60 + now.getMinutes() + 60 : -1;
    var bl = blocks(day), out = [];
    for (var m = start; m + dur <= end; m += RASTER) {
      if (m <= earliest) continue;
      if (pause && m < pause[1] && m + dur > pause[0]) continue;
      out.push({ time: toTime(m), taken: bl.some(function (b) { return m < b[1] && m + dur > b[0]; }) });
    }
    return out;
  }
  var freeCount = function (day, dauer) { return slotsFor(day, dauer).filter(function (s) { return !s.taken; }).length; };
  function nextFreeDay(dauer) {
    for (var i = 0; i < days.length; i++) if (freeCount(days[i], dauer)) return days[i];
    return null;
  }

  var oval = function (w, h, stroke, sw) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 112 156" aria-hidden="true"><ellipse cx="56" cy="78" rx="54" ry="76" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/></svg>';
  };

  function Termin(root) {
    var state = { mo: 0, day: null, slot: null, zonen: [], doc: 'Beliebig', name: '', phone: '', email: '', hp: '', done: false, viaMail: false, mailConfirm: false, sending: false, error: '' };
    var treatObj = function () { return A.berechne(state.zonen) || A.berechne([]); };

    root.classList.add('tm');
    root.innerHTML =
      '<div class="tm-cal">' +
        '<div class="tm-head"><div class="tm-month"><span data-r="month"></span><em data-r="year"></em></div>' +
          '<div class="tm-arrows"><button type="button" class="tm-arrow" data-a="prev" aria-label="Vorheriger Monat">‹</button>' +
          '<button type="button" class="tm-arrow" data-a="next" aria-label="Nächster Monat">›</button></div></div>' +
        '<div class="tm-grid" data-r="grid" role="grid"></div>' +
        '<div class="tm-legend"><span><i class="tm-dot"></i>Praxistag mit freien Zeitfenstern</span>' +
          '<button type="button" class="tm-nextfree" data-a="nextfree" data-r="nextfree"></button></div>' +
      '</div>' +
      '<div class="tm-side" data-r="side" aria-live="polite"></div>';

    var r = {};
    root.querySelectorAll('[data-r]').forEach(function (el) { r[el.dataset.r] = el; });

    function renderCal() {
      var base = new Date(now.getFullYear(), now.getMonth() + state.mo, 1);
      r.month.textContent = M[base.getMonth()];
      r.year.textContent = base.getFullYear();
      root.querySelector('[data-a=prev]').disabled = state.mo <= 0;
      root.querySelector('[data-a=next]').disabled = state.mo >= MAXMO;
      var html = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(function (w) { return '<div class="tm-wd" aria-hidden="true">' + w + '</div>'; }).join('');
      for (var i = 0; i < (base.getDay() + 6) % 7; i++) html += '<div class="tm-cell"></div>';
      var dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      var dur = treatObj().dauer;
      for (var n = 1; n <= dim; n++) {
        var key = iso(new Date(base.getFullYear(), base.getMonth(), n));
        var d = dayByIso[key];
        var open = d && freeCount(d, dur) > 0;
        if (!open) { html += '<div class="tm-cell"><span class="tm-closed">' + n + '</span></div>'; continue; }
        var sel = state.day === key;
        html += '<div class="tm-cell"><button type="button" class="tm-day' + (sel ? ' is-sel' : '') + '" data-day="' + key + '" aria-pressed="' + sel + '" aria-label="' + esc(longDate(key)) + ', freie Termine">' + n + '<i class="tm-dot"></i></button></div>';
      }
      r.grid.innerHTML = html;
      var nf = nextFreeDay(dur);
      r.nextfree.hidden = !nf;
      if (nf) { r.nextfree.textContent = 'Nächster freier Tag: ' + shortDate(nf.datum) + ' →'; r.nextfree.dataset.day = nf.datum; }
    }

    function chips(list, key) {
      return list.map(function (label) {
        var sel = state[key] === label;
        return '<button type="button" class="tm-chip' + (sel ? ' is-sel' : '') + '" data-chip="' + key + '" data-val="' + esc(label) + '" aria-pressed="' + sel + '">' + esc(label) + '</button>';
      }).join('');
    }
    // Mehrfachauswahl der Zonen mit Preisen, darunter der Richtpreis der Auswahl
    function zonenAuswahl() {
      var t = treatObj();
      var chip = function (val, label, preis, sel) {
        return '<button type="button" class="tm-chip tm-zchip' + (sel ? ' is-sel' : '') + '" data-zone="' + esc(val) + '" aria-pressed="' + sel + '">' + esc(label) + ' <i>' + euro(preis) + '</i></button>';
      };
      return '<div class="tm-group"><div class="tm-label">Was möchten Sie behandeln lassen?</div>' +
        A.bereiche().map(function (b) {
          return '<div class="tm-zgroup"><div class="tm-zlabel">' + esc(b.name) + '</div><div class="tm-chips">' +
            b.zonen.map(function (z) { return chip(z.name, z.name, z.preis, state.zonen.indexOf(z.name) >= 0); }).join('') + '</div></div>';
        }).join('') +
        '<div class="tm-zgroup"><div class="tm-zlabel">Unsicher?</div><div class="tm-chips">' + chip('', 'Nur Beratung', A.beratung.preis, t.beratung) + '</div></div>' +
        '<div class="tm-price"><span>Richtpreis</span><b>' + euro(t.preis) + '</b><small>' +
          esc(t.beratung ? 'wird bei einer Behandlung angerechnet' : (t.pakete.length ? 'Paketpreis ' + t.pakete.join(', ') + ' · ' : '') + 'ca. ' + t.dauer + ' Min. · inkl. Nachkontrolle') +
        '</small></div></div>';
    }
    var canSubmit = function () { return !!(state.slot && state.name.trim() && (state.phone.trim() || /\S+@\S+\.\S+/.test(state.email))); };

    function renderSide() {
      var s = state, html;
      if (s.done) {
        html = '<div class="tm-center">' +
          '<span class="tm-oval">' + oval(64, 90, '#C6A86F', 2) + '<svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 10 L10 18 L24 2" fill="none" stroke="#C6A86F" stroke-width="1.6"/></svg></span>' +
          '<h3 class="tm-title-lg" tabindex="-1">Vielen Dank, ' + esc(s.name.trim().split(' ')[0]) + '</h3>' +
          '<div class="tm-sum"><span>' + esc(longDate(s.day)) + '</span><em>' + esc(s.slot) + ' Uhr · ' + esc(treatObj().text) + '</em><small>Richtpreis ' + euro(treatObj().preis) + ' · Behandler: ' + esc(s.doc) + '</small></div>' +
          '<p class="tm-muted">' + (s.demo ? '<strong>Vorschau:</strong> Auf der fertigen Website wäre der Termin jetzt vorgemerkt und die Praxis benachrichtigt. Hier wurde nichts gesendet.' : s.viaMail
            ? 'Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage. Bitte senden Sie die E-Mail ab — danach bestätigen wir Ihren Termin persönlich. <a href="' + mailto() + '">E-Mail erneut öffnen</a>'
            : 'Ihr Wunschtermin ist für Sie vorgemerkt. <strong>Verbindlich wird er, sobald wir ihn bestätigen</strong> — ' +
              (s.mailConfirm ? 'eine Eingangsbestätigung ist bereits per E-Mail unterwegs.' : 'wir melden uns in Kürze bei Ihnen.')) + '</p>' +
          '<button type="button" class="tm-ghost" data-a="reset">Weiteren Termin wählen</button>' +
          '</div>';
      } else if (mode === 'laden') {
        html = '<div class="tm-center"><span class="tm-oval">' + oval(64, 90, '#C6A86F', 2) + '<em>&amp;</em></span>' +
          '<h3 class="tm-title">Freie Termine werden geladen …</h3></div>';
      } else if (!s.day) {
        var mailLink = '<a href="mailto:' + esc(cfg.empfaenger) + '">' + esc(cfg.empfaenger) + '</a>';
        html = '<div class="tm-center">' +
          '<span class="tm-oval">' + oval(64, 90, '#C6A86F', 2) + '<em>&amp;</em></span>' +
          '<h3 class="tm-title">' + (mode === 'fehler' ? 'Terminwahl gerade nicht erreichbar' : days.length ? 'Bitte wählen Sie einen Tag' : 'Neue Termine folgen') + '</h3>' +
          '<p class="tm-muted">' + (mode === 'fehler' ? 'Bitte versuchen Sie es in wenigen Minuten erneut oder schreiben Sie uns an ' + mailLink + '.'
            : days.length ? 'Anschließend sehen Sie alle freien Uhrzeiten dieses Praxistages.'
            : 'Aktuell sind keine Praxistage veröffentlicht. Schreiben Sie uns gern an ' + mailLink + '.') + '</p>' +
          '</div>';
      } else {
        var day = dayByIso[s.day], dur = treatObj().dauer, list = slotsFor(day, dur);
        var free = list.filter(function (x) { return !x.taken; }).length;
        html = '<div class="tm-dayhead"><div class="tm-label-gold">' + free + ' Zeitfenster frei</div><div class="tm-daylabel">' + esc(longDate(s.day)) + '</div></div>' +
          (s.error && !s.slot ? '<p class="tm-error" role="alert">' + s.error + '</p>' : '') +
          '<div class="tm-slots">' + list.map(function (x) {
            if (x.taken) return '<span class="tm-slot is-taken" aria-label="' + x.time + ' Uhr, vergeben">' + x.time + '</span>';
            var sel = s.slot === x.time;
            return '<button type="button" class="tm-slot' + (sel ? ' is-sel' : '') + '" data-slot="' + x.time + '" aria-pressed="' + sel + '">' + x.time + '</button>';
          }).join('') + '</div>';
        if (s.slot) {
          var ok = canSubmit();
          html += '<div class="tm-form">' +
            zonenAuswahl() +
            '<div class="tm-group"><div class="tm-label">Behandler</div><div class="tm-chips">' + chips(doctors, 'doc') + '</div></div>' +
            '<div class="tm-fields">' +
              '<label class="tm-field">Name<input data-f="name" autocomplete="name" placeholder="Vor- und Nachname" value="' + esc(s.name) + '"></label>' +
              '<label class="tm-field">Telefon<input data-f="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="Für Rückfragen" value="' + esc(s.phone) + '"></label>' +
              '<label class="tm-field">E-Mail<input data-f="email" type="email" autocomplete="email" inputmode="email" placeholder="Für die Bestätigung" value="' + esc(s.email) + '"></label>' +
              '<input class="tm-hp" data-f="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" value="' + esc(s.hp) + '">' +
            '</div>' +
            '<div class="tm-submitrow"><div class="tm-choice">' + esc(s.slot) + ' Uhr · ' + euro(treatObj().preis) + '</div>' +
              '<button type="button" class="tm-submit" data-a="submit"' + (ok && !s.sending ? '' : ' disabled') + '>' + (s.sending ? 'Wird gesendet …' : 'Termin anfragen') + '</button></div>' +
            (s.error ? '<p class="tm-error" role="alert">' + s.error + '</p>' : '') +
            '<p class="tm-note">Ihre Angaben verwenden wir ausschließlich zur Terminabstimmung (<a href="' + (cfg._datenschutzLink || '#datenschutz') + '">Datenschutz</a>). Verbindlich wird der Termin mit unserer Bestätigung. Falls Sie verhindert sind, sagen Sie bitte bis 24 Stunden vorher ab.</p>' +
            '</div>';
        }
      }
      r.side.innerHTML = html;
    }

    function updateSubmit() {
      var b = root.querySelector('[data-a=submit]');
      if (b) b.disabled = !canSubmit() || state.sending;
    }

    /* Versand */
    function payload() {
      return {
        Behandlung: treatObj().text + ' (Richtpreis ' + euro(treatObj().preis) + ', ca. ' + treatObj().dauer + ' Min.)',
        Termin: longDate(state.day) + ' · ' + state.slot + ' Uhr',
        Behandler: state.doc,
        Name: state.name.trim(), Telefon: state.phone.trim() || '—', 'E-Mail': state.email.trim() || '—'
      };
    }
    function mailto() {
      var p = payload();
      var body = 'Guten Tag,\n\nich möchte folgenden Termin anfragen:\n\n' +
        Object.keys(p).map(function (k) { return k + ': ' + p[k]; }).join('\n') + '\n\nMit freundlichen Grüßen\n' + p.Name;
      return 'mailto:' + (cfg.empfaenger || '') + '?subject=' + encodeURIComponent('Terminanfrage: ' + p.Termin) + '&body=' + encodeURIComponent(body);
    }
    function finish(viaMail) {
      state.done = true; state.viaMail = viaMail; state.sending = false;
      renderSide();
      var h = root.querySelector('.tm-title-lg'); if (h) h.focus({ preventScroll: true });
    }
    function submit() {
      if (!canSubmit() || state.sending) return;
      state.error = '';
      if (window.KR_VORSCHAU) { state.demo = true; finish(false); return; }
      // Lokale Vorschau ohne Server: Anfrage per E-Mail-Programm
      if (mode !== 'api') { window.location.href = mailto(); finish(true); return; }
      state.sending = true; renderSide();
      fetch('/api/anfrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          datum: state.day, zeit: state.slot, zonen: state.zonen, behandler: state.doc,
          name: state.name.trim(), telefon: state.phone.trim(), email: state.email.trim(), website: state.hp
        })
      }).then(function (res) { return res.json(); }).then(function (d) {
        if (d.ok) {
          state.mailConfirm = !!d.bestaetigungsmail;
          finish(false);
          reloadAll();
          return;
        }
        state.sending = false;
        state.error = esc(d.fehler || 'Das hat leider nicht geklappt.');
        if (d.vergeben) { state.slot = null; reloadAll(); }
        renderSide();
      }).catch(function () {
        state.sending = false;
        state.error = 'Senden hat nicht geklappt. Bitte versuchen Sie es erneut oder <a href="' + mailto() + '">senden Sie die Anfrage per E-Mail</a>.';
        renderSide();
      });
    }

    function pickDay(key) {
      var d = asDate(key);
      state.mo = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
      if (state.day !== key) state.slot = null;
      state.day = key; state.done = false;
      renderCal(); renderSide();
    }

    // Handy: Uhrzeiten liegen unter dem Kalender – dorthin scrollen
    function revealSide() {
      var top = r.side.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.75) window.scrollTo({ top: top + window.scrollY - 90, behavior: 'smooth' });
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var a = b.dataset.a;
      if (a === 'prev') { state.mo = Math.max(0, state.mo - 1); renderCal(); }
      else if (a === 'next') { state.mo = Math.min(MAXMO, state.mo + 1); renderCal(); }
      else if (a === 'nextfree') { pickDay(b.dataset.day); revealSide(); }
      else if (a === 'submit') submit();
      else if (a === 'reset') { state.day = null; state.slot = null; state.done = false; state.name = state.phone = state.email = state.hp = ''; state.zonen = []; state.error = ''; renderCal(); renderSide(); }
      else if (b.dataset.day) { state.error = ''; pickDay(b.dataset.day); revealSide(); }
      else if (b.dataset.slot) { state.error = ''; state.slot = b.dataset.slot; renderSide(); }
      else if (b.dataset.zone != null) {
        var z = b.dataset.zone, i = state.zonen.indexOf(z);
        if (!z) state.zonen = [];
        else if (i >= 0) state.zonen.splice(i, 1);
        else state.zonen.push(z);
        // Längere Behandlung: passt die gewählte Uhrzeit noch?
        var dauer = treatObj().dauer;
        var still = slotsFor(dayByIso[state.day], dauer).some(function (x) { return x.time === state.slot && !x.taken; });
        if (!still) {
          state.error = 'Für Ihre Auswahl (ca. ' + dauer + ' Min.) reicht die Zeit ab ' + esc(state.slot) + ' Uhr leider nicht. Bitte wählen Sie eine andere Uhrzeit.';
          state.slot = null;
        }
        renderCal(); renderSide();
      }
      else if (b.dataset.chip) { state[b.dataset.chip] = b.dataset.val; renderSide(); }
    });
    root.addEventListener('input', function (e) {
      var f = e.target.dataset.f;
      if (f) { state[f] = e.target.value; updateSubmit(); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.dataset.f) { e.preventDefault(); submit(); }
    });

    this.pick = function (key) { if (dayByIso[key]) pickDay(key); };
    // Neue Daten vom Server: Auswahl behalten, wenn sie noch frei ist
    this.refresh = function () {
      state.mo = Math.min(state.mo, MAXMO);
      if (state.done) { renderCal(); return; } // Danke-Ansicht nicht verändern
      if (state.day && !dayByIso[state.day]) { state.day = null; state.slot = null; }
      if (state.day && state.slot && !slotsFor(dayByIso[state.day], treatObj().dauer).some(function (x) { return x.time === state.slot && !x.taken; })) state.slot = null;
      if (!state.day) {
        // Kalender startet im Monat des nächsten freien Praxistags
        var first = nextFreeDay(treatObj().dauer);
        state.mo = 0;
        if (first) { var fd = asDate(first.datum); state.mo = Math.min(MAXMO, Math.max(0, (fd.getFullYear() - now.getFullYear()) * 12 + fd.getMonth() - now.getMonth())); }
      }
      state.mo = Math.min(state.mo, MAXMO);
      renderCal(); renderSide();
    };
    renderCal(); renderSide();
  }

  var instances = [];
  document.querySelectorAll('[data-termin]').forEach(function (el) { instances.push(new Termin(el)); });
  function refreshAll() { instances.forEach(function (i) { i.refresh(); }); }
  function reloadAll() { load().then(refreshAll, function () {}); }

  // GitHub-Vorschau: Beispieltage, nichts wird gesendet
  (window.KR_VORSCHAU ? Promise.reject() : load()).catch(function () {
    if (lokal || window.KR_VORSCHAU) { mode = 'vorschau'; setDays(cfg.tage); } else { mode = 'fehler'; setDays([]); }
  }).then(refreshAll);

  // Wer die Seite länger offen hat, sieht beim Zurückkehren den aktuellen Stand
  document.addEventListener('visibilitychange', function () { if (!document.hidden && mode === 'api') reloadAll(); });

  window.KRTermin = { days: function () { return days; }, nextFreeDay: nextFreeDay, shortDate: shortDate, pick: function (k) { if (instances[0]) instances[0].pick(k); } };
})();
