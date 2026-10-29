// Shared helpers for the knowtific-redesign-plugin scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(SCRIPTS_DIR, '..');
export const TEMPLATES_DIR = path.join(PLUGIN_ROOT, 'templates');

/** Minimal argv parser: positionals + --flag value / --flag (boolean) / --flag=value. */
export function parseArgs(argv = process.argv.slice(2), booleans = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > -1) { push(out, a.slice(2, eq), a.slice(eq + 1)); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (booleans.includes(key) || next === undefined || next.startsWith('--')) { out[key] = true; continue; }
    push(out, key, next); i++;
  }
  return out;
}
function push(obj, k, v) {
  if (obj[k] === undefined) obj[k] = v;
  else obj[k] = [].concat(obj[k], v);
}
export const asList = (v) => (v === undefined || v === true ? [] : [].concat(v));

export function slugFromUrl(u) {
  const url = new URL(u);
  let p = decodeURIComponent(url.pathname).replace(/\/+$/, '');
  if (!p) return 'home';
  let s = p.replace(/^\//, '').replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-').replace(/\//g, '--').replace(/-{3,}/g, '--')
    .replace(/^-+|-+$/g, '').toLowerCase();
  if (url.search) s += '--q-' + url.search.slice(1).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 30);
  return s.slice(0, 90) || 'page';
}

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
export function readJson(p, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { if (fallback !== undefined) return fallback; throw new Error(`Cannot read JSON ${p}: ${e.message}`); }
}
export function writeJson(p, data) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(data, null, 2)); }

export function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let n = 0;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dest, ent.name);
    if (!filter(s, ent)) continue;
    if (ent.isDirectory()) n += copyDir(s, d, filter);
    else { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

/** Launch Chromium via Playwright; honours CHROME_PATH for a custom binary. */
export async function launchChromium(opts = {}) {
  const { chromium } = await import('playwright');
  const executablePath = process.env.CHROME_PATH || undefined;
  try {
    return await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'], ...opts });
  } catch (e) {
    if (/Executable doesn't exist|browserType.launch/i.test(e.message)) {
      console.error('\nChromium for Playwright is not installed. Run:\n  npx --prefix "' + SCRIPTS_DIR + '" playwright install chromium\n');
    }
    throw e;
  }
}

// ---------- colour + contrast ----------
export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function parseCssColor(str) {
  const m = String(str).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { rgb: [+m[1], +m[2], +m[3]], a };
}
function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const A = Array.isArray(a) ? a : hexToRgb(a), B = Array.isArray(b) ? b : hexToRgb(b);
  if (!A || !B) return null;
  const [l1, l2] = [lum(A), lum(B)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

/** Token pairs that must be readable, with the minimum ratio. */
export const CONTRAST_PAIRS = [
  ['text', 'bg', 4.5], ['text', 'surface', 4.5], ['muted', 'bg', 4.5], ['muted', 'surface', 4.5],
  ['onPrimary', 'primary', 4.5], ['onAccent', 'accent', 4.5], ['onDark', 'dark', 4.5],
  ['primary', 'bg', 3], ['accent', 'dark', 3],
];
export const COLOR_TOKENS = ['primary', 'onPrimary', 'accent', 'onAccent', 'bg', 'surface', 'text', 'muted', 'border', 'dark', 'onDark'];

export function checkBrandContrast(brand) {
  const issues = [];
  const c = brand.colors || {};
  for (const k of COLOR_TOKENS) if (!hexToRgb(c[k])) issues.push({ level: 'error', msg: `colour token "${k}" missing or not a 6-digit hex` });
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    const r = contrast(c[fg], c[bg]);
    if (r !== null && r < min) issues.push({ level: 'warn', msg: `${fg} on ${bg} = ${r}:1 (needs ${min}:1)`, pair: [fg, bg], ratio: r, min });
  }
  return issues;
}
