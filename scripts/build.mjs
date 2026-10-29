/* Baut die Website nach dist/client.
   VORSCHAU=1 baut die Vorschau für GitHub Pages: Terminbuchung als Demo mit
   Beispieltagen, ohne Praxis-Seite, für Suchmaschinen gesperrt. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const VORSCHAU = process.env.VORSCHAU === '1';
const from = (p) => new URL(`../${p}`, import.meta.url);
const to = (p) => new URL(`../dist/client/${p}`, import.meta.url);

await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(to(''), { recursive: true });

// Startseite
const dateien = ['index.html', 'site.css', 'site.js', 'buchung.js', 'behandlungstage.js', 'angebot.js'];
if (!VORSCHAU) dateien.push('404.html'); // nutzt Pfade ab Domain-Wurzel
for (const file of dateien) await cp(from(file), to(file));

// Bilder, Logo, Schriften (inkl. Praxis- und Teamfotos, sobald vorhanden)
await mkdir(to('assets/'), { recursive: true });
for (const file of ['kobler.jpg', 'rheude-neu.jpg', 'rheude-kobler-social.png', 'fonts.css']) {
  await cp(from(`assets/${file}`), to(`assets/${file}`));
}
for (const dir of ['fonts', 'logo', 'praxis', 'team']) {
  await cp(from(`assets/${dir}`), to(`assets/${dir}`), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });
}

// Terminanfrage
await mkdir(to('termin-buchen/'), { recursive: true });
await cp(from('termin-buchen/index.html'), to('termin-buchen/index.html'));

if (VORSCHAU) {
  // Vorschau-Kennzeichnung in beide Seiten einsetzen
  const kopf = '<meta name="robots" content="noindex, nofollow">\n<script>window.KR_VORSCHAU = true;</script>\n<style>body{padding-bottom:38px}</style>\n</head>';
  const band = '<body>\n<div style="position:fixed;left:0;right:0;bottom:0;z-index:100;background:#9C7F47;color:#fff;font:400 13px/1.4 Jost,system-ui,sans-serif;letter-spacing:.06em;text-align:center;padding:8px 16px">Vorschau · Die Terminbuchung ist hier nur eine Demo, es wird nichts gesendet.</div>';
  for (const seite of ['index.html', 'termin-buchen/index.html']) {
    const html = await readFile(to(seite), 'utf8');
    await writeFile(to(seite), html.replace('</head>', kopf).replace('<body>', band));
  }
  await writeFile(to('robots.txt'), 'User-agent: *\nDisallow: /\n');
  await writeFile(to('.nojekyll'), '');
  console.log('Rheude & Kobler: Vorschau gebaut.');
} else {
  // Praxis-Seite (Terminverwaltung, mit Passwort)
  await cp(from('praxis'), to('praxis'), { recursive: true });

  // Sicherheits-Header und Suchmaschinen
  await writeFile(to('_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: SAMEORIGIN
/praxis/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
`);
  await writeFile(to('robots.txt'), 'User-agent: *\nDisallow: /praxis/\nSitemap: https://rheude-kobler.de/sitemap.xml\n');
  await writeFile(to('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://rheude-kobler.de/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`);
  console.log('Rheude & Kobler: Website gebaut.');
}
