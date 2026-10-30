#!/usr/bin/env node
// Book-keeping for unattended prospect runs: workspace files, queue, targets, suppression,
// duplicate checks, slugs, contact extraction and the index.csv row. Deterministic so the
// model never hand-edits CSV or checklists.
//
// Usage (paths relative to the current folder; --root defaults to ./prospects):
//   node prospect.mjs init                         create missing workspace files from the starter
//   node prospect.mjs next                         first usable queue item as JSON (ticks duplicates/suppressed)
//   node prospect.mjs check <url> ["Business"]     {ok, reason} - already indexed / suppressed?
//   node prospect.mjs slug "Business" ["Suburb"]   free folder slug, e.g. smith-plumbing-lilydale
//   node prospect.mjs queue-add <url> "Business" "trade" "suburb"
//   node prospect.mjs tick <url> [--note "done (slug)"]
//   node prospect.mjs tick-target "trade | suburb" [--note "..."]
//   node prospect.mjs crawl-check <prospect-dir>   is the crawl usable? (site down / blocked)
//   node prospect.mjs contact <prospect-dir>       emails + phones published on the site, best guess
//   node prospect.mjs index <prospect-dir>         upsert the prospect's row in index.csv
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, ensureDir, TEMPLATES_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [cmd, ...pos] = args._;
const ROOT = path.resolve(args.root || 'prospects');
const STARTER = path.join(TEMPLATES_DIR, 'prospects-workspace', 'prospects');
const F = (name) => path.join(ROOT, name);
const today = () => new Date().toISOString().slice(0, 10);
const out = (o) => console.log(JSON.stringify(o, null, 2));

const INDEX_HEADER = ['slug', 'business', 'url', 'suburb', 'trade', 'overall', 'topIssue', 'email', 'reportUrl', 'depth', 'status', 'date'];

// ---------- helpers ----------
function domainOf(u) {
  try { return new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
const read = (p, fb = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return fb; } };

// CSV with RFC 4180 quoting
function csvParse(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function readIndex() {
  const rows = csvParse(read(F('index.csv')));
  const header = rows[0] && rows[0][0] === 'slug' ? rows.shift() : INDEX_HEADER;
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
function writeIndex(records) {
  const lines = [INDEX_HEADER.join(',')].concat(records.map((r) => INDEX_HEADER.map((h) => csvCell(r[h])).join(',')));
  fs.writeFileSync(F('index.csv'), lines.join('\n') + '\n');
}

// checklist lines: "- [ ] a | b | c" ; notes are appended after " — "
const CHECK = /^(\s*[-*]\s+\[)( |x|X)(\]\s+)(.*)$/;
function parseChecklist(file) {
  return read(file).split(/\r?\n/).map((line, i) => {
    const m = line.match(CHECK);
    if (!m) return { i, line, item: false };
    const body = m[4].split(' — ')[0];
    return { i, line, item: true, done: m[2] !== ' ', fields: body.split('|').map((s) => s.trim()) };
  });
}
function tickLine(file, idx, note) {
  const lines = read(file).split(/\r?\n/);
  lines[idx] = lines[idx].replace(CHECK, (all, a, _x, b, rest) => `${a}x${b}${rest}${note ? ' — ' + note : ''}`);
  fs.writeFileSync(file, lines.join('\n'));
}

function suppression() {
  const domains = new Set(), emails = new Set(), names = [];
  for (const raw of read(F('suppression.md')).split(/\r?\n/)) {
    if (!/^\s*[-*]\s+/.test(raw)) continue; // only list items; prose and headings are ignored
    const line = raw.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, '').replace(/\s+#.*$/, '').replace(/`/g, '').trim();
    if (!line) continue;
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(line)) emails.add(line.toLowerCase());
    else if (/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(line)) domains.add(domainOf(line));
    else names.push(line.toLowerCase());
  }
  return { domains, emails, names };
}

function check(url, business) {
  const d = domainOf(url);
  if (!d) return { ok: false, reason: `invalid URL: ${url}` };
  const sup = suppression();
  if (sup.domains.has(d)) return { ok: false, reason: `suppressed domain ${d}` };
  if ([...sup.emails].some((e) => e.endsWith('@' + d))) return { ok: false, reason: `suppressed email at ${d}` };
  if (business && sup.names.some((n) => n === business.toLowerCase())) return { ok: false, reason: `suppressed business "${business}"` };
  const hit = readIndex().find((r) => domainOf(r.url) === d);
  if (hit) return { ok: false, reason: `already in index.csv as ${hit.slug} (${hit.status || 'no status'})`, slug: hit.slug };
  return { ok: true, domain: d };
}

function freeSlug(business, suburb, url) {
  let base = slugify(business);
  const sub = slugify(suburb);
  if (sub && !base.endsWith(sub)) base = base ? `${base}-${sub}` : sub;
  if (!base) base = slugify(domainOf(url) || 'prospect');
  const d = url ? domainOf(url) : null;
  let s = base, n = 2;
  for (;;) {
    const st = readJson(path.join(ROOT, s, 'redesign', 'state.json'), null);
    if (!fs.existsSync(path.join(ROOT, s)) || (d && st && domainOf(st.site || '') === d)) return s;
    s = `${base}-${n++}`;
  }
}

// ---------- commands ----------
function init() {
  ensureDir(ROOT);
  const created = [];
  for (const name of fs.readdirSync(STARTER)) {
    if (!fs.existsSync(F(name))) { fs.copyFileSync(path.join(STARTER, name), F(name)); created.push(name); }
  }
  // the deploy root always carries its no-index guards
  const site = ensureDir(F('_site'));
  const guards = {
    '_headers': '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n',
    'robots.txt': 'User-agent: *\nDisallow: /\n',
    'index.html': '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Knowtific</title></head><body></body></html>\n',
  };
  for (const [n, body] of Object.entries(guards)) {
    if (!fs.existsSync(path.join(site, n))) { fs.writeFileSync(path.join(site, n), body); created.push('_site/' + n); }
  }
  return { root: path.relative(process.cwd(), ROOT) || '.', created };
}

function next() {
  init();
  const file = F('queue.md');
  const skipped = [];
  for (const l of parseChecklist(file)) {
    if (!l.item || l.done) continue;
    const [url, business = '', trade = '', suburb = ''] = l.fields;
    const c = check(url, business);
    if (!c.ok) { tickLine(file, l.i, `skipped ${today()}: ${c.reason}`); skipped.push({ url, reason: c.reason }); continue; }
    return { empty: false, url, business, trade, suburb, slug: freeSlug(business, suburb, url), skipped };
  }
  const target = parseChecklist(F('targets.md')).find((l) => l.item && !l.done);
  return { empty: true, skipped, target: target ? { line: target.fields.join(' | '), trade: target.fields[0] || '', suburb: target.fields[1] || '' } : null };
}

function queueAdd(url, business, trade, suburb) {
  init();
  const d = domainOf(url);
  if (!d) return { added: false, reason: 'invalid URL' };
  const inQueue = parseChecklist(F('queue.md')).some((l) => l.item && domainOf(l.fields[0]) === d);
  if (inQueue) return { added: false, reason: 'already in queue' };
  const c = check(url, business);
  if (!c.ok) return { added: false, reason: c.reason };
  const clean = (s) => String(s || '').replace(/[|\r\n]+/g, ' ').trim();
  const body = read(F('queue.md'));
  fs.writeFileSync(F('queue.md'), body.replace(/\s*$/, '\n') + `- [ ] ${clean(url)} | ${clean(business)} | ${clean(trade)} | ${clean(suburb)}\n`);
  return { added: true };
}

function tick(url, note) {
  const d = domainOf(url);
  const l = parseChecklist(F('queue.md')).find((x) => x.item && !x.done && domainOf(x.fields[0]) === d);
  if (!l) return { ticked: false, reason: 'no unchecked queue line for ' + d };
  tickLine(F('queue.md'), l.i, note || `done ${today()}`);
  return { ticked: true };
}
function tickTarget(text, note) {
  const want = text.split('|').map((s) => s.trim().toLowerCase()).join('|');
  const l = parseChecklist(F('targets.md')).find((x) => x.item && !x.done && x.fields.map((s) => s.toLowerCase()).join('|') === want);
  if (!l) return { ticked: false, reason: 'no unchecked target line "' + text + '"' };
  tickLine(F('targets.md'), l.i, note || `searched ${today()}`);
  return { ticked: true };
}

function crawlDir(dir) { return path.join(path.resolve(dir), 'redesign', '02-audit', 'crawl'); }

function crawlCheck(dir) {
  const pages = readJson(path.join(crawlDir(dir), 'pages.json'), null);
  if (!pages) return { ok: false, reason: 'no pages.json - crawl did not run or crashed' };
  const ok = pages.filter((p) => p.status && p.status < 400 && !p.error);
  const home = pages.find((p) => p.depth === 0) || pages[0];
  const blocked = /just a moment|attention required|access denied|forbidden|captcha|are you a robot|site not found|domain (is )?for sale|account suspended|coming soon|under construction/i;
  const r = { pages: pages.length, okPages: ok.length, homeStatus: home?.status ?? null, homeTitle: home?.title || null, homeWords: home?.wordCount ?? 0, homeError: home?.error || null };
  if (!home || home.error || !home.status) return { ok: false, reason: `site down or unreachable (${home?.error || 'no response'})`, ...r };
  if (home.status >= 400) return { ok: false, reason: `home page returns HTTP ${home.status} (down or blocking the crawl)`, ...r };
  if (blocked.test(home.title || '') || (home.wordCount || 0) < 40) return { ok: false, reason: `home page looks blocked, parked or empty ("${home.title || ''}", ${home.wordCount || 0} words)`, ...r };
  return { ok: true, ...r };
}

function contact(dir) {
  const pages = readJson(path.join(crawlDir(dir), 'pages.json'), []);
  const site = readJson(path.join(crawlDir(dir), 'site.json'), {});
  const host = domainOf(site.start || pages[0]?.url || '') || '';
  const JUNK = /\.(png|jpe?g|gif|webp|svg|avif)$|@(\d+x|2x|3x)\b|sentry|wixpress|example\.|domain\.com|yourdomain|yoursite|email\.com$|test\.com$|\bname@|\buser@|godaddy|squarespace|wordpress\.(com|org)$|noreply|no-reply/i;
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const found = new Map();
  const add = (raw, url, via) => {
    const email = raw.trim().replace(/[.,;:)]+$/, '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) || JUNK.test(email)) return;
    const sameDomain = host && (email.endsWith('@' + host) || email.split('@')[1].endsWith('.' + host));
    const contactPage = /contact|quote|enquir|book|about/i.test(new URL(url).pathname);
    const score = (sameDomain ? 4 : 0) + (via === 'mailto' ? 2 : 0) + (contactPage ? 1 : 0);
    const prev = found.get(email);
    if (!prev || prev.score < score) found.set(email, { email, foundOn: url, via, sameDomain: !!sameDomain, score });
  };
  for (const p of pages) {
    for (const m of p.mailtoLinks || []) { try { add(decodeURIComponent(m.replace(/^mailto:/i, '').split('?')[0]), p.url, 'mailto'); } catch {} }
    const text = read(path.join(crawlDir(dir), p.textFile || `text/${p.slug}.md`));
    for (const m of text.matchAll(EMAIL)) add(m[0], p.url, 'text');
  }
  const phones = new Map();
  for (const p of pages) for (const t of p.telLinks || []) {
    const phone = decodeURIComponent(t.href.replace(/^tel:/i, '')).replace(/[^\d+]/g, '');
    if (phone.length >= 8 && !phones.has(phone)) phones.set(phone, { phone, display: t.text || phone, foundOn: p.url });
  }
  const emails = [...found.values()].sort((a, b) => b.score - a.score);
  const best = emails[0] || null;
  return { site: host, emails, phones: [...phones.values()], best: best ? { email: best.email, foundOn: best.foundOn } : null };
}

function index(dir) {
  const abs = path.resolve(dir);
  const st = readJson(path.join(abs, 'redesign', 'state.json'), null);
  if (!st) return { ok: false, reason: 'no redesign/state.json in ' + dir };
  const sc = readJson(path.join(abs, 'redesign', '02-audit', 'scorecard.json'), null);
  const findings = readJson(path.join(abs, 'redesign', '02-audit', 'findings.json'), []);
  const rank = (f) => ({ P1: 0, P2: 1, P3: 2, P4: 3 }[f.priority] ?? 4) * 3 + ({ high: 0, medium: 1, low: 2 }[f.impact] ?? 3);
  const top = Array.isArray(findings) && findings.length ? [...findings].sort((a, b) => rank(a) - rank(b))[0] : null;
  const slug = path.basename(abs);
  const row = {
    slug, business: st.client || '', url: st.site || '', suburb: st.prospect?.suburb || '', trade: st.prospect?.trade || '',
    overall: sc?.overall ?? '', topIssue: top ? top.title : '', email: st.contact?.email || '', reportUrl: st.report?.url || '',
    depth: st.depth || '', status: st.status || '', date: today(),
  };
  const rows = readIndex();
  const d = domainOf(row.url);
  const i = rows.findIndex((r) => r.slug === slug || (d && domainOf(r.url) === d));
  if (i >= 0) rows[i] = row; else rows.push(row);
  writeIndex(rows);
  fs.writeFileSync(F('.last-run'), slug + '\n');
  return { ok: true, updated: i >= 0, row };
}

const need = (n, usage) => { if (pos.length < n) { console.error('Usage: node prospect.mjs ' + usage); process.exit(1); } };
switch (cmd) {
  case 'init': out(init()); break;
  case 'next': out(next()); break;
  case 'check': need(1, 'check <url> ["Business"]'); out(check(pos[0], pos[1])); break;
  case 'slug': need(1, 'slug "Business" ["Suburb"] [--url url]'); console.log(freeSlug(pos[0], pos[1], args.url)); break;
  case 'queue-add': need(1, 'queue-add <url> "Business" "trade" "suburb"'); out(queueAdd(...pos)); break;
  case 'tick': need(1, 'tick <url> [--note "..."]'); out(tick(pos[0], args.note)); break;
  case 'tick-target': need(1, 'tick-target "trade | suburb" [--note "..."]'); out(tickTarget(pos[0], args.note)); break;
  case 'crawl-check': need(1, 'crawl-check <prospect-dir>'); out(crawlCheck(pos[0])); break;
  case 'contact': need(1, 'contact <prospect-dir>'); out(contact(pos[0])); break;
  case 'index': need(1, 'index <prospect-dir>'); out(index(pos[0])); break;
  default:
    console.error('Commands: init | next | check | slug | queue-add | tick | tick-target | crawl-check | contact | index');
    process.exit(1);
}
