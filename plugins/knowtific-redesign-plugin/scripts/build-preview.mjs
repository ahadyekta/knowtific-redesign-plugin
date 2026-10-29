#!/usr/bin/env node
// Build the live comparison preview: brand runtime + brands + variations + current-site
// screenshots + viewer, into <redesign>/preview (a static site you can serve or deploy).
// Also syncs <redesign>/_rd so variation files work when opened from 06-variations directly.
// Validates brand contrast and variation hygiene and prints warnings.
//
// Usage: node build-preview.mjs redesign [--out redesign/preview] [--strict]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, writeJson, ensureDir, copyDir, TEMPLATES_DIR, SCRIPTS_DIR, checkBrandContrast, contrast, CONTRAST_PAIRS } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['strict']);
const RD = path.resolve(args._[0] || 'redesign');
const OUT = path.resolve(args.out || path.join(RD, 'preview'));
if (!fs.existsSync(RD)) { console.error(`Not found: ${RD}`); process.exit(1); }

const warnings = []; const errors = []; const infos = [];
const warn = (scope, msg) => warnings.push({ scope, msg });
const fail = (scope, msg) => errors.push({ scope, msg });

const state = readJson(path.join(RD, 'state.json'), {});
const brandsFile = readJson(path.join(RD, '05-brand', 'brands.json'), null);
const brandCurrent = readJson(path.join(RD, '02-audit', 'crawl', 'brand-current.json'), null);
const crawlPages = readJson(path.join(RD, '02-audit', 'crawl', 'pages.json'), []);
const findings = readJson(path.join(RD, '02-audit', 'findings.json'), []);
const findingById = Object.fromEntries((Array.isArray(findings) ? findings : []).map((f) => [f.id, f]));

// ---------- brands ----------
const SYSTEM_FONTS = /^(arial|helvetica|helvetica neue|georgia|times|times new roman|verdana|tahoma|trebuchet ms|segoe ui|system-ui|-apple-system|sans-serif|serif|courier new|calibri|garamond)$/i;
const brands = [];
if (brandsFile?.brands?.length) brands.push(...brandsFile.brands);
else warn('brands', 'No 05-brand/brands.json yet - preview will only show the current brand.');

let currentLogo = null;
const crawlDir = path.join(RD, '02-audit', 'crawl');
if (brandCurrent?.logo?.saved && fs.existsSync(path.join(crawlDir, brandCurrent.logo.saved))) currentLogo = brandCurrent.logo.saved;
if (brandCurrent && brandsFile?.includeCurrent !== false) {
  const f = brandCurrent.fonts || {};
  const logoPath = currentLogo ? 'logos/current-' + currentLogo : null;
  brands.unshift({
    id: 'current', name: 'Current', concept: 'The site\'s existing colours, fonts and logo (auto-extracted) - useful to show a new layout without a rebrand.',
    tagline: brandsFile?.currentTagline || '', colors: brandCurrent.suggestedTokens,
    fonts: { heading: f.heading, body: f.body, headingWeight: +f.headingWeight || 700, headingIsSystem: SYSTEM_FONTS.test(f.heading || ''), bodyIsSystem: SYSTEM_FONTS.test(f.body || ''),
      headingFallback: /georgia|times|garamond|serif$/i.test(f.heading || '') ? 'Georgia, serif' : 'Arial, sans-serif', bodyFallback: 'Arial, sans-serif' },
    radius: brandCurrent.buttonRadius && brandCurrent.buttonRadius !== '0px' ? brandCurrent.buttonRadius : '4px',
    logo: logoPath ? { primary: logoPath, mark: logoPath, onDark: logoPath } : {}, auto: true,
  });
}
const brandReport = brands.map((b) => {
  const issues = checkBrandContrast(b);
  // the existing brand's contrast problems are audit findings, not build problems
  if (b.id === 'current') issues.forEach((i) => infos.push(`current brand: ${i.msg}`));
  else for (const i of issues) (i.level === 'error' ? fail : warn)(`brand ${b.id}`, i.msg);
  const pairs = CONTRAST_PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(b.colors?.[fg], b.colors?.[bg]) }));
  if (b.id !== 'current') {
    for (const k of ['primary', 'mark', 'onDark']) {
      const p = b.logo?.[k];
      if (!p) warn(`brand ${b.id}`, `logo.${k} not set`);
      else if (!fs.existsSync(path.join(RD, '05-brand', p))) fail(`brand ${b.id}`, `logo file missing: 05-brand/${p}`);
    }
    if (!b.fonts?.heading || !b.fonts?.body) warn(`brand ${b.id}`, 'fonts.heading / fonts.body missing');
  }
  return { ...b, contrast: pairs };
});

// ---------- runtime sync ----------
function tailwindSource() {
  const local = path.join(SCRIPTS_DIR, 'node_modules', '@tailwindcss', 'browser', 'dist', 'index.global.js');
  if (fs.existsSync(local)) return fs.readFileSync(local);
  warn('runtime', 'Tailwind browser build not installed locally (run npm install in the plugin scripts folder) - falling back to CDN.');
  return Buffer.from("document.write('<script src=\"https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4\"><\\/script>');\n");
}
function syncRuntime(dir) {
  ensureDir(dir);
  fs.copyFileSync(path.join(TEMPLATES_DIR, 'runtime', 'brand-runtime.js'), path.join(dir, 'brand-runtime.js'));
  fs.writeFileSync(path.join(dir, 'tailwind.js'), tailwindSource());
  const slim = brands.map(({ id, name, tagline, displayName, colors, fonts, radius, logo }) => ({ id, name, tagline, displayName, colors, fonts, radius, logo }));
  fs.writeFileSync(path.join(dir, 'brands.js'), '/* generated by build-preview.mjs - edit 05-brand/brands.json instead */\nwindow.RD_BRANDS = ' + JSON.stringify(slim, null, 1) + ';\n');
  copyDir(path.join(RD, '05-brand', 'logos'), path.join(dir, 'logos'));
  if (currentLogo) { ensureDir(path.join(dir, 'logos')); fs.copyFileSync(path.join(crawlDir, currentLogo), path.join(dir, 'logos', 'current-' + currentLogo)); }
  copyDir(path.join(crawlDir, 'images'), path.join(dir, 'img'), (p) => !p.endsWith('.json'));
}
syncRuntime(path.join(RD, '_rd'));
fs.rmSync(OUT, { recursive: true, force: true });
syncRuntime(path.join(OUT, '_rd'));

// ---------- pages + variations ----------
const varRoot = path.join(RD, '06-variations');
let keyPages = Array.isArray(state.keyPages) ? state.keyPages : [];
if (!keyPages.length && fs.existsSync(varRoot)) keyPages = fs.readdirSync(varRoot, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => ({ slug: d.name, label: d.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));
if (!keyPages.length) warn('pages', 'No key pages in state.json and no 06-variations folders yet.');

const meta = (html, name) => (html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'i')) || [])[1] || '';
function lintVariation(scope, html) {
  if (!/_rd\/brands\.js/.test(html) || !/_rd\/brand-runtime\.js/.test(html)) fail(scope, 'missing ../../_rd/brands.js or brand-runtime.js script - brand switching will not work');
  if (!/data-brand-logo/.test(html)) warn(scope, 'no data-brand-logo element - logo will not change with the brand');
  const h1 = (html.match(/<h1[\s>]/gi) || []).length; if (h1 !== 1) warn(scope, `${h1} <h1> elements (should be 1)`);
  if (!/<html[^>]*\blang=/i.test(html)) warn(scope, 'missing lang attribute on <html>');
  if (!/name=["']viewport["']/i.test(html)) fail(scope, 'missing viewport meta');
  const noAlt = (html.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || []).length; if (noAlt) warn(scope, `${noAlt} <img> without alt`);
  if (/lorem ipsum/i.test(html)) fail(scope, 'contains lorem ipsum');
  if (/\{\{[^}]+\}\}/.test(html)) fail(scope, 'unfilled {{placeholders}} from the starter');
  const noSvg = html.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const hex = (noSvg.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g) || []).filter((h) => !/^#(fff|ffffff|000|000000)$/i.test(h));
  if (hex.length > 3) warn(scope, `${hex.length} hard-coded hex colours (${[...new Set(hex)].slice(0, 5).join(', ')}) - use brand tokens so brand switching works`);
  if (/<img[^>]+src=["']https?:\/\//i.test(html)) warn(scope, 'hotlinked external image(s) - use _rd/img or placeholders');
  if (!meta(html, 'rd:label')) warn(scope, 'missing <meta name="rd:label">');
  return { tbc: (html.match(/class=["'][^"']*\btbc\b/g) || []).length };
}

const manifestPages = [];
for (const kp of keyPages) {
  const dir = path.join(varRoot, kp.slug);
  const pageOut = { slug: kp.slug, label: kp.label || kp.slug, variants: [], current: null };
  if (!fs.existsSync(dir)) { warn(`page ${kp.slug}`, `no folder 06-variations/${kp.slug}`); manifestPages.push(pageOut); continue; }
  copyDir(dir, path.join(OUT, 'pages', kp.slug), (p, ent) => !ent.name.startsWith('_'));
  const files = fs.readdirSync(dir).filter((f) => /^[a-z]\.html$/.test(f)).sort();
  if (files.length < 3) warn(`page ${kp.slug}`, `${files.length} variation(s) found (expected a, b, c)`);
  for (const f of files) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const id = f[0];
    const scope = `${kp.slug}/${f}`;
    const before = warnings.length + errors.length;
    const lint = lintVariation(scope, html);
    const fixes = meta(html, 'rd:fixes').split(/[,\s]+/).filter(Boolean).map((fid) => ({ id: fid, title: findingById[fid]?.title || null, priority: findingById[fid]?.priority || null, dimension: findingById[fid]?.dimension || null }));
    pageOut.variants.push({
      id, file: `pages/${kp.slug}/${f}`, label: meta(html, 'rd:label') || `Variation ${id.toUpperCase()}`, strategy: meta(html, 'rd:strategy'),
      fixes, tbc: lint.tbc, title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '',
      issues: [...warnings, ...errors].slice(before).map((w) => w.msg),
    });
  }
  // current-site screenshots for comparison
  const cp = crawlPages.find((p) => (kp.currentPath && new URL(p.url).pathname.replace(/\/$/, '') === kp.currentPath.replace(/\/$/, '')) || (kp.currentUrl && p.url === kp.currentUrl) || p.slug === (kp.currentSlug || kp.slug));
  if (cp?.shots) {
    const cur = { url: cp.url, title: cp.title };
    for (const k of ['desktop', 'mobile']) {
      const src = path.join(crawlDir, cp.shots[k] || '');
      if (cp.shots[k] && fs.existsSync(src)) { ensureDir(path.join(OUT, '_rd', 'current')); const dest = `_rd/current/${kp.slug}--${k}.png`; fs.copyFileSync(src, path.join(OUT, dest)); cur[k] = dest; }
    }
    pageOut.current = cur;
  } else if (crawlPages.length) warn(`page ${kp.slug}`, 'no matching crawled page for the "current site" view (set keyPages[].currentPath in state.json)');
  manifestPages.push(pageOut);
}

// ---------- manifest + viewer ----------
const scorecard = readJson(path.join(RD, '02-audit', 'scorecard.json'), null);
const manifest = {
  client: state.client || brandsFile?.client || path.basename(path.dirname(RD)), site: state.site || null, builtAt: new Date().toISOString(),
  pages: manifestPages, brands: brandReport, scorecard,
  warnings: warnings.map((w) => `${w.scope}: ${w.msg}`), errors: errors.map((w) => `${w.scope}: ${w.msg}`), info: infos,
};
fs.writeFileSync(path.join(OUT, '_rd', 'manifest.js'), 'window.RD_MANIFEST = ' + JSON.stringify(manifest, null, 1) + ';\n');
fs.copyFileSync(path.join(TEMPLATES_DIR, 'viewer.html'), path.join(OUT, 'index.html'));
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n'); // keep client previews out of search
writeJson(path.join(RD, 'preview-report.json'), { builtAt: manifest.builtAt, warnings: manifest.warnings, errors: manifest.errors });

// ---------- console report ----------
const nVar = manifestPages.reduce((s, p) => s + p.variants.length, 0);
console.log(`Preview built -> ${path.relative(process.cwd(), OUT)}/index.html`);
console.log(`  ${manifestPages.length} page(s), ${nVar} variation(s), ${brands.length} brand option(s)${brands[0]?.id === 'current' ? ' (incl. Current)' : ''}`);
for (const b of brandReport) {
  const bad = b.contrast.filter((c) => c.ratio !== null && c.ratio < c.min);
  console.log(`  brand ${b.id.padEnd(8)} ${String(b.name || '').padEnd(14)} contrast: ${bad.length ? bad.map((c) => `${c.fg}/${c.bg} ${c.ratio}`).join(', ') : 'all pairs pass'}`);
}
if (errors.length) { console.log(`\nErrors (${errors.length}):`); errors.forEach((e) => console.log(`  x ${e.scope}: ${e.msg}`)); }
if (warnings.length) { console.log(`\nWarnings (${warnings.length}):`); warnings.forEach((w) => console.log(`  ! ${w.scope}: ${w.msg}`)); }
if (infos.length) { console.log(`\nInfo - existing brand (use as audit evidence, not build errors):`); infos.forEach((i) => console.log('  - ' + i)); }
if (!errors.length && !warnings.length) console.log('\nNo build issues found.');
console.log(`\nServe: node "${path.join(SCRIPTS_DIR, 'serve.mjs')}" "${path.relative(process.cwd(), OUT)}" --port 4321`);
if (args.strict && errors.length) process.exit(1);
