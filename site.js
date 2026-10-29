/* Rheude & Kobler — Menü, Bild-Platzhalter, Impressum/Datenschutz */
(function () {
  'use strict';
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Mobiles Menü */
  var toggle = document.querySelector('.nav-toggle'), links = document.getElementById('nav-links');
  if (toggle && links) {
    var setOpen = function (open) { links.classList.toggle('open', open); toggle.setAttribute('aria-expanded', open); };
    toggle.addEventListener('click', function () { setOpen(!links.classList.contains('open')); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* Preisliste – Zahlen aus behandlungstage.js */
  var A = window.KR_ANGEBOT, preise = document.querySelector('[data-preise]');
  if (A && preise) {
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var euro = function (n) { return n.toLocaleString('de-DE') + ' €'; };
    var row = function (name, preis, cls, sub) { return '<div class="prow' + (cls ? ' ' + cls : '') + '"><span>' + esc(name) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><b>' + euro(preis) + '</b></div>'; };
    preise.innerHTML = A.bereiche().map(function (b) {
      var rows = b.zonen.map(function (z) { return row(z.name, z.preis); });
      var keys = [];
      b.zonen.forEach(function (z) { if (z.paket && A.pakete[z.paket] && keys.indexOf(z.paket) < 0) keys.push(z.paket); });
      keys.forEach(function (k) {
        var anzahl = b.zonen.filter(function (z) { return z.paket === k; }).length, p = A.pakete[k].preise || {};
        Object.keys(p).forEach(function (n) { rows.push(row(+n === anzahl ? 'Alle ' + n + ' Zonen' : n + ' Zonen nach Wahl', p[n], 'pkg', 'Paketpreis')); });
      });
      return '<div class="pgroup"><h4>' + esc(b.name) + '</h4>' + rows.join('') + '</div>';
    }).join('');
    var hb = document.querySelector('[data-beratung-hinweis]');
    if (hb && A.beratung && A.beratung.preis) hb.textContent = A.beratung.name + ' ohne Behandlung ' + euro(A.beratung.preis) + ', wird bei einer Behandlung angerechnet.';
  }

  /* Fehlt ein Foto, erscheint ein Platzhalter mit Dateiname */
  document.querySelectorAll('.media img').forEach(function (img) {
    var mark = function () { img.closest('.media').classList.add('is-empty'); };
    if (img.complete && img.naturalWidth === 0) mark();
    img.addEventListener('error', mark);
  });

  /* Impressum / Datenschutz aufklappen */
  function openLegal(hash, instant) {
    var d = hash && document.querySelector(hash);
    if (!d || d.tagName !== 'DETAILS') return;
    document.querySelectorAll('.legal details').forEach(function (x) { x.open = x === d; });
    requestAnimationFrame(function () { d.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' }); });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#impressum"], a[href="#datenschutz"]');
    if (!a) return;
    e.preventDefault();
    openLegal(a.getAttribute('href'));
  });
  if (/^#(impressum|datenschutz)$/.test(location.hash)) window.addEventListener('load', function () { openLegal(location.hash, true); });
})();
