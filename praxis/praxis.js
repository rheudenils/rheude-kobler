/* Rheude & Kobler – Praxis-Seite
   Offene Anfragen bestätigen/absagen, Termine je Tag, Praxistage pflegen. */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var logoutBtn = document.querySelector('[data-a=abmelden]');
  var S = { view: 'offen', data: null, cancelId: null, showOff: false, showPast: false, formOpen: false, editTag: null, dirty: false, busy: false };

  /* ---------- Hilfen ---------- */
  var M = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hm = function (m) { return m == null ? '' : pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dateOf = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var longDate = function (iso) { var d = dateOf(iso); return WD[d.getDay()] + ', ' + d.getDate() + '. ' + M[d.getMonth()] + ' ' + d.getFullYear(); };
  var shortDate = function (iso) { var d = dateOf(iso); return WD[d.getDay()].slice(0, 2) + ', ' + d.getDate() + '. ' + M[d.getMonth()]; };
  function ago(isoTs) {
    var min = Math.round((Date.now() - new Date(isoTs).getTime()) / 60000);
    if (min < 2) return 'gerade eben';
    if (min < 60) return 'vor ' + min + ' Min.';
    var h = Math.round(min / 60);
    if (h < 24) return 'vor ' + h + ' Std.';
    var d = Math.round(h / 24);
    return 'vor ' + d + (d === 1 ? ' Tag' : ' Tagen');
  }
  var euro = function (n) { return n == null ? '' : n.toLocaleString('de-DE') + ' €'; };
  var STATUS = { angefragt: 'Offen', bestaetigt: 'Bestätigt', abgesagt: 'Abgesagt' };

  function api(path, method, body) {
    var opt = { method: method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (method && method !== 'GET') { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body || {}); }
    return fetch('/api/admin/' + path, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, fehler: 'Der Server antwortet nicht richtig (' + r.status + ').' }; })
        .then(function (d) { d._status = r.status; return d; });
    }, function () { return { ok: false, fehler: 'Keine Verbindung. Bitte Internet prüfen.' }; });
  }

  var toastTimer;
  function toast(msg) {
    var el = document.querySelector('.px-toast');
    if (!el) { el = document.createElement('div'); el.className = 'px-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 5000);
  }

  /* ---------- Daten ---------- */
  var D = function () { return S.data; };
  var offene = function () { return D().termine.filter(function (t) { return t.status === 'angefragt' && t.datum >= D().heute; }); };
  var tagBy = function (iso) { return D().tage.filter(function (t) { return t.datum === iso; })[0]; };
  function setTitle() {
    var n = S.data ? offene().length : 0;
    document.title = (n ? '(' + n + ') ' : '') + 'Praxis · Rheude & Kobler';
  }

  function load(rerender) {
    return api('daten').then(function (d) {
      if (d.anmelden) { S.data = null; renderLogin(d.eingerichtet); return; }
      if (!d.ok) { if (!S.data) app.innerHTML = '<div class="px-error">' + esc(d.fehler) + '</div>'; return; }
      S.data = d;
      setTitle();
      if (rerender !== false) render();
    });
  }

  /* ---------- Anmeldung ---------- */
  function renderLogin(eingerichtet, fehler) {
    logoutBtn.hidden = true;
    document.title = 'Praxis · Rheude & Kobler';
    app.innerHTML = '<form class="px-login" data-form="login">' +
      '<h1>Praxis-Zugang</h1><p>Terminanfragen bestätigen und Praxistage pflegen.</p>' +
      (eingerichtet === false ? '<div class="px-error">Das Praxis-Passwort ist auf dem Server noch nicht eingerichtet.</div>' : '') +
      '<label class="px-field">Passwort<input type="password" name="passwort" autocomplete="current-password" required autofocus></label>' +
      (fehler ? '<div class="px-error" role="alert">' + esc(fehler) + '</div>' : '') +
      '<p style="margin:18px 0 0"><button class="px-btn" style="width:100%">Anmelden</button></p>' +
      '</form>';
  }

  /* ---------- Ansichten ---------- */
  function render() {
    if (!S.data) return;
    logoutBtn.hidden = false;
    var n = offene().length;
    var html = '';
    if (!D().mail) html += '<div class="px-banner"><strong>E-Mail-Versand ist noch nicht eingerichtet.</strong> Anfragen werden gespeichert und hier angezeigt, aber weder ihr noch die Patienten bekommen E-Mails. Bitte selbst Bescheid geben.</div>';
    html += '<nav class="px-tabs" role="tablist">' +
      tab('offen', 'Offen' +(n ? '<span class="px-badge">' + n + '</span>' : '')) +
      tab('kalender', 'Termine') + tab('tage', 'Praxistage') + '</nav>';
    html += S.view === 'offen' ? viewOffen() : S.view === 'kalender' ? viewKalender() : viewTage();
    app.innerHTML = html;
    S.dirty = false;
  }
  var tab = function (id, label) { return '<button type="button" role="tab" class="px-tab' + (S.view === id ? ' is-on' : '') + '" aria-selected="' + (S.view === id) + '" data-view="' + id + '">' + label + '</button>'; };

  function cancelBox(t) {
    if (S.cancelId !== t.id) return '';
    var mailNote = t.email && D().mail ? 'Die Patientin bzw. der Patient bekommt eine Absage per E-Mail.' : 'Es wird keine E-Mail verschickt – bitte selbst Bescheid geben.';
    return '<div class="px-cancel" style="grid-column:1/-1">' +
      (t.email && D().mail ? '<label class="px-field">Nachricht in der Absage (optional)<textarea rows="3" data-cancel-msg placeholder="z. B. Vorschlag für einen anderen Termin"></textarea></label>' : '') +
      '<p class="px-muted" style="margin:0;font-size:13px">' + mailNote + '</p>' +
      '<div class="px-row"><button type="button" class="px-btn danger solid" data-a="absagen" data-id="' + t.id + '">Termin absagen</button>' +
      '<button type="button" class="px-btn line" data-a="abbrechen">Zurück</button></div></div>';
  }

  function viewOffen() {
    var list = offene();
    if (!list.length) return '<div class="px-empty"><strong>Alles erledigt</strong>Keine offenen Anfragen.</div>';
    return list.map(function (t) {
      var mailOk = t.email && D().mail;
      var hint = !t.email ? 'Keine E-Mail angegeben – bitte telefonisch bestätigen.'
        : !D().mail ? 'E-Mail-Versand noch nicht eingerichtet – bitte selbst Bescheid geben.' : '';
      return '<article class="px-card is-wait">' +
        '<div class="px-when">' + esc(longDate(t.datum)) + '<small>' + hm(t.start) + '–' + hm(t.ende) + ' Uhr · ' + esc(t.behandlung) + '</small></div>' +
        '<dl class="px-meta">' +
          '<dt>Name</dt><dd>' + esc(t.name) + '</dd>' +
          (t.telefon ? '<dt>Telefon</dt><dd><a href="tel:' + esc(t.telefon.replace(/[^\d+]/g, '')) + '">' + esc(t.telefon) + '</a></dd>' : '') +
          (t.email ? '<dt>E-Mail</dt><dd><a href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a></dd>' : '') +
          '<dt>Behandler</dt><dd>' + esc(t.behandler) + '</dd>' +
          (t.preis != null ? '<dt>Richtpreis</dt><dd>' + euro(t.preis) + '</dd>' : '') +
          '<dt>Eingang</dt><dd>' + esc(ago(t.erstellt)) + '</dd>' +
        '</dl>' +
        (hint ? '<p class="px-hint">' + hint + '</p>' : '') +
        (S.cancelId === t.id ? '' : '<div class="px-row">' +
          '<button type="button" class="px-btn ok" data-a="bestaetigen" data-id="' + t.id + '">' + (mailOk ? 'Bestätigen &amp; E-Mail senden' : 'Als bestätigt markieren') + '</button>' +
          '<button type="button" class="px-btn danger" data-a="absagen-start" data-id="' + t.id + '">Absagen</button></div>') +
        cancelBox(t) +
        '</article>';
    }).join('');
  }

  function viewKalender() {
    var d = D(), heute = d.heute;
    var dates = {};
    d.tage.forEach(function (t) { dates[t.datum] = 1; });
    d.termine.forEach(function (t) { dates[t.datum] = 1; });
    var list = Object.keys(dates).sort().filter(function (x) { return S.showPast ? true : x >= heute; });
    if (S.showPast) list = list.filter(function (x) { return x < heute; }).reverse().concat(list.filter(function (x) { return x >= heute; }));

    var html = '<div class="px-toolbar">' +
      '<button type="button" class="px-btn" data-a="form-auf">+ Termin eintragen</button>' +
      '<div class="px-row" style="gap:16px">' +
        '<label class="px-check"><input type="checkbox" data-toggle="showOff"' + (S.showOff ? ' checked' : '') + '> Abgesagte zeigen</label>' +
        '<label class="px-check"><input type="checkbox" data-toggle="showPast"' + (S.showPast ? ' checked' : '') + '> Vergangene zeigen</label>' +
      '</div></div>';
    if (S.formOpen) html += terminForm();
    if (!list.length) return html + '<div class="px-empty"><strong>Noch keine Termine</strong>Legen Sie unter „Praxistage“ die Tage an, an denen Patienten buchen können.</div>';

    list.forEach(function (iso) {
      var tag = tagBy(iso);
      var items = d.termine.filter(function (t) { return t.datum === iso && (S.showOff || t.status !== 'abgesagt'); });
      var aktiv = d.termine.filter(function (t) { return t.datum === iso && t.status !== 'abgesagt'; }).length;
      html += '<section class="px-day"><div class="px-dayhead"><h3>' + esc(longDate(iso)) + (iso === heute ? ' · heute' : '') + '</h3><span>' +
        (tag ? hm(tag.von) + '–' + hm(tag.bis) + ' Uhr' + (tag.pause_von != null ? ' · Pause ' + hm(tag.pause_von) + '–' + hm(tag.pause_bis) : '') : 'kein Praxistag') +
        ' · ' + aktiv + ' Termin' + (aktiv === 1 ? '' : 'e') + '</span></div>';
      if (!items.length) html += '<p class="px-muted" style="margin:6px 2px 0;font-size:14px">Noch keine Termine.</p>';
      items.forEach(function (t) {
        var actions = '';
        if (S.cancelId !== t.id) {
          if (t.status === 'angefragt') actions = '<button type="button" class="px-btn ok small" data-a="bestaetigen" data-id="' + t.id + '">Bestätigen</button><button type="button" class="px-btn danger small" data-a="absagen-start" data-id="' + t.id + '">Absagen</button>';
          else if (t.status === 'bestaetigt' && iso >= heute) actions = '<button type="button" class="px-btn danger small" data-a="absagen-start" data-id="' + t.id + '">Absagen</button>';
          else if (t.status === 'abgesagt' && iso >= heute) actions = '<button type="button" class="px-btn line small" data-a="reaktivieren" data-id="' + t.id + '">Reaktivieren</button>';
        }
        html += '<div class="px-item' + (t.status === 'abgesagt' ? ' is-off' : '') + '">' +
          '<div class="px-time">' + hm(t.start) + '<small>bis ' + hm(t.ende) + '</small></div>' +
          '<div class="px-who"><b>' + esc(t.name) + '</b><br><span>' + esc(t.behandlung) + (t.preis != null ? ' · ' + euro(t.preis) : '') + (t.behandler && t.behandler !== 'Beliebig' ? ' · ' + esc(t.behandler) : '') + '</span>' +
            (t.telefon ? '<br><a href="tel:' + esc(t.telefon.replace(/[^\d+]/g, '')) + '">' + esc(t.telefon) + '</a>' : '') +
            (t.email ? '<br><a href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a>' : '') +
            (t.notiz ? '<br><span>Notiz: ' + esc(t.notiz) + '</span>' : '') +
            (t.quelle === 'praxis' ? '<br><span>von der Praxis eingetragen</span>' : '') + '</div>' +
          '<div class="px-side"><span class="px-pill ' + t.status + '">' + STATUS[t.status] + '</span><div class="px-row" style="justify-content:flex-end">' + actions + '</div></div>' +
          cancelBox(t) +
          '</div>';
      });
      html += '</section>';
    });
    return html;
  }

  function terminForm() {
    var d = D(), e = d.einstellungen;
    var next = d.tage.filter(function (t) { return t.datum >= d.heute; })[0];
    var first = e.behandlungen[0] || { name: 'Termin', dauer: 30 };
    return '<form class="px-form" data-form="termin"><h3>Termin eintragen</h3>' +
      '<p class="px-muted" style="margin:-6px 0 14px;font-size:14px">Zum Beispiel telefonische Buchungen. Der Termin ist sofort bestätigt und auf der Website gesperrt. Mehrere Zonen: Behandlung „Sonstiges“ wählen und in der Notiz festhalten.</p>' +
      '<div class="px-grid">' +
        '<label class="px-field">Datum<input type="date" name="datum" required value="' + (next ? next.datum : d.heute) + '"></label>' +
        '<label class="px-field">Uhrzeit<input type="time" name="zeit" required step="300"></label>' +
        '<label class="px-field">Behandlung<select name="behandlung">' + e.behandlungen.map(function (b) { return '<option data-dauer="' + b.dauer + '" data-preis="' + (b.preis == null ? '' : b.preis) + '">' + esc(b.name) + '</option>'; }).join('') + '<option data-dauer="30" data-preis="">Sonstiges</option></select></label>' +
        '<label class="px-field">Dauer (Min.)<input type="number" name="dauer" min="5" max="480" step="5" value="' + first.dauer + '"></label>' +
        '<label class="px-field">Preis (€)<input type="number" name="preis" min="0" step="1" value="' + (first.preis == null ? '' : first.preis) + '"></label>' +
        '<label class="px-field">Behandler<select name="behandler"><option>Beliebig</option>' + e.behandler.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></label>' +
        '<label class="px-field">Name<input name="name" required autocomplete="off"></label>' +
        '<label class="px-field">Telefon<input name="telefon" type="tel" autocomplete="off"></label>' +
        '<label class="px-field">E-Mail<input name="email" type="email" autocomplete="off"></label>' +
        '<label class="px-field wide">Notiz (nur intern)<input name="notiz" autocomplete="off"></label>' +
        (d.mail ? '<label class="px-check wide"><input type="checkbox" name="mail" checked> Bestätigung per E-Mail an den Patienten senden (falls E-Mail angegeben)</label>' : '') +
      '</div>' +
      '<div class="px-row" style="margin-top:16px"><button class="px-btn">Eintragen</button><button type="button" class="px-btn line" data-a="form-zu">Abbrechen</button></div>' +
      '</form>';
  }

  function viewTage() {
    var d = D(), t = S.editTag ? tagBy(S.editTag) : null;
    var kommende = d.tage.filter(function (x) { return x.datum >= d.heute; });
    var html = '<form class="px-form" data-form="tag"><h3>' + (t ? 'Praxistag bearbeiten' : 'Praxistag anlegen') + '</h3>' +
      '<p class="px-muted" style="margin:-6px 0 14px;font-size:14px">An diesen Tagen können Patienten auf der Website Termine anfragen. Termine liegen im ' + d.einstellungen.raster + '-Minuten-Takt.</p>' +
      '<div class="px-grid">' +
        '<label class="px-field">Datum<input type="date" name="datum" required min="' + d.heute + '" value="' + (t ? t.datum : '') + '"' + (t ? ' readonly' : '') + '></label>' +
        '<label class="px-field">Von<input type="time" name="von" required step="300" value="' + (t ? hm(t.von) : '09:00') + '"></label>' +
        '<label class="px-field">Bis<input type="time" name="bis" required step="300" value="' + (t ? hm(t.bis) : '18:00') + '"></label>' +
        '<label class="px-field">Pause von<input type="time" name="pause_von" step="300" value="' + (t ? hm(t.pause_von) : '12:30') + '"></label>' +
        '<label class="px-field">Pause bis<input type="time" name="pause_bis" step="300" value="' + (t ? hm(t.pause_bis) : '14:00') + '"></label>' +
      '</div>' +
      '<div class="px-row" style="margin-top:16px"><button class="px-btn">' + (t ? 'Änderungen speichern' : 'Praxistag anlegen') + '</button>' +
      (t ? '<button type="button" class="px-btn line" data-a="tag-neu">Abbrechen</button>' : '') + '</div></form>';

    if (!kommende.length) return html + '<div class="px-empty"><strong>Keine Praxistage</strong>Auf der Website steht derzeit „Neue Termine folgen“.</div>';
    html += kommende.map(function (x) {
      var ts = d.termine.filter(function (t) { return t.datum === x.datum && t.status !== 'abgesagt'; });
      var off = ts.filter(function (t) { return t.status === 'angefragt'; }).length;
      return '<div class="px-dayrow"><div><b>' + esc(longDate(x.datum)) + '</b><span>' + hm(x.von) + '–' + hm(x.bis) + ' Uhr' +
        (x.pause_von != null ? ' · Pause ' + hm(x.pause_von) + '–' + hm(x.pause_bis) : '') + ' · ' + ts.length + ' Termin' + (ts.length === 1 ? '' : 'e') +
        (off ? ', davon ' + off + ' offen' : '') + '</span></div>' +
        '<div class="px-row"><button type="button" class="px-btn line small" data-a="tag-bearbeiten" data-datum="' + x.datum + '">Bearbeiten</button>' +
        '<button type="button" class="px-btn danger small" data-a="tag-loeschen" data-datum="' + x.datum + '">Löschen</button></div></div>';
    }).join('');
    return html;
  }

  /* ---------- Aktionen ---------- */
  var termin = function (id) { return D().termine.filter(function (t) { return t.id === +id; })[0]; };

  function setStatus(id, status, extra) {
    if (S.busy) return;
    S.busy = true;
    var t = termin(id);
    api('termine/' + id, 'POST', Object.assign({ status: status }, extra || {})).then(function (d) {
      S.busy = false;
      if (!d.ok) { toast(d.fehler || 'Das hat nicht geklappt.'); if (d._status === 401) load(); return; }
      S.cancelId = null;
      var who = t ? t.name : 'Termin';
      if (status === 'bestaetigt') toast(d.mailGesendet ? who + ': bestätigt, E-Mail ist raus.' : who + ': bestätigt. Keine E-Mail verschickt – bitte selbst Bescheid geben.');
      else if (status === 'abgesagt') toast(d.mailGesendet ? who + ': abgesagt, E-Mail ist raus. Die Zeit ist wieder frei.' : who + ': abgesagt. Die Zeit ist wieder frei – bitte selbst Bescheid geben.');
      load();
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.view) { S.view = b.dataset.view; S.cancelId = null; S.formOpen = false; S.editTag = null; render(); return; }
    var a = b.dataset.a, id = b.dataset.id;
    if (a === 'abmelden') { api('abmelden', 'POST').then(function () { S.data = null; renderLogin(); }); }
    else if (a === 'bestaetigen') setStatus(id, 'bestaetigt');
    else if (a === 'absagen-start') { S.cancelId = +id; render(); var ta = app.querySelector('[data-cancel-msg]'); if (ta) ta.focus(); }
    else if (a === 'abbrechen') { S.cancelId = null; render(); }
    else if (a === 'absagen') { var msg = app.querySelector('[data-cancel-msg]'); setStatus(id, 'abgesagt', { nachricht: msg ? msg.value : '' }); }
    else if (a === 'reaktivieren') { if (confirm('Termin wieder als bestätigt eintragen? Es wird keine E-Mail verschickt.')) setStatus(id, 'bestaetigt', { mail: false }); }
    else if (a === 'form-auf') { S.formOpen = true; render(); var f = app.querySelector('[data-form=termin] [name=zeit]'); if (f) f.focus(); }
    else if (a === 'form-zu') { S.formOpen = false; render(); }
    else if (a === 'tag-bearbeiten') { S.editTag = b.dataset.datum; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (a === 'tag-neu') { S.editTag = null; render(); }
    else if (a === 'tag-loeschen') {
      if (!confirm(longDate(b.dataset.datum) + ' als Praxistag löschen?')) return;
      api('tage/' + b.dataset.datum, 'DELETE').then(function (d) { toast(d.ok ? 'Praxistag gelöscht.' : d.fehler); if (d.ok) load(); });
    }
  });

  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.toggle) { S[el.dataset.toggle] = el.checked; render(); return; }
    if (el.name === 'behandlung') {
      var opt = el.options[el.selectedIndex], dauer = el.form.querySelector('[name=dauer]');
      if (opt && dauer) dauer.value = opt.dataset.dauer;
      var preis = el.form.querySelector('[name=preis]');
      if (opt && preis) preis.value = opt.dataset.preis;
    }
  });
  app.addEventListener('input', function () { S.dirty = true; });

  app.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, v = function (n) { var el = f.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
    var btn = f.querySelector('button:not([type=button])');
    if (f.dataset.form === 'login') {
      btn.disabled = true;
      api('anmelden', 'POST', { passwort: v('passwort') }).then(function (d) {
        if (d.ok) load(); else renderLogin(undefined, d.fehler);
      });
    } else if (f.dataset.form === 'tag') {
      btn.disabled = true;
      api('tage', 'POST', { datum: v('datum'), von: v('von'), bis: v('bis'), pause_von: v('pause_von'), pause_bis: v('pause_bis') }).then(function (d) {
        btn.disabled = false;
        if (!d.ok) { toast(d.fehler); return; }
        toast((S.editTag ? 'Gespeichert: ' : 'Angelegt: ') + longDate(v('datum')) + '. Patienten sehen den Tag sofort.');
        S.editTag = null; load();
      });
    } else if (f.dataset.form === 'termin') {
      var body = { datum: v('datum'), zeit: v('zeit'), dauer: v('dauer'), preis: v('preis'), behandlung: v('behandlung'), behandler: v('behandler'), name: v('name'), telefon: v('telefon'), email: v('email'), notiz: v('notiz'), mail: v('mail') };
      var send = function () {
        btn.disabled = true;
        api('termine', 'POST', body).then(function (d) {
          btn.disabled = false;
          if (d.konflikt && confirm(d.fehler + '\n\nTrotzdem eintragen?')) { body.trotzdem = true; send(); return; }
          if (!d.ok) { if (!d.konflikt) toast(d.fehler); return; }
          S.formOpen = false;
          toast('Eingetragen: ' + shortDate(body.datum) + ', ' + body.zeit + ' Uhr' + (d.mailGesendet ? ' – Bestätigung per E-Mail ist raus.' : '.'));
          load();
        });
      };
      send();
    }
  });

  // Regelmäßig aktualisieren – aber nie, während jemand etwas eintippt
  function refresh() {
    if (!S.data || document.hidden) return;
    var editing = S.dirty || S.formOpen || S.cancelId || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    load(!editing);
  }
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', refresh);

  load();
})();
