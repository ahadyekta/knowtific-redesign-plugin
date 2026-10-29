#!/usr/bin/env node
// Screenshot a variation file (or any URL) at several widths so you can check the design.
// Usage: node shoot.mjs redesign/06-variations/home/a.html --out redesign/06-variations/home/_shots
//        [--widths 390,834,1440] [--brand b] [--fold] [--full]
// Default: full-page shots at 390 and 1440. --fold adds viewport-only shots.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs, ensureDir, launchChromium, SCRIPTS_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['fold', 'full']);
const target = args._[0];
if (!target) { console.error('Usage: node shoot.mjs <file.html|url> --out <dir> [--widths 390,1440] [--brand id] [--fold]'); process.exit(1); }
const widths = String(args.widths || '390,1440').split(',').map((n) => parseInt(n, 10)).filter(Boolean);
const OUT = ensureDir(path.resolve(args.out || 'shots'));

let url;
if (/^https?:/.test(target)) url = new URL(target);
else {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) { console.error('Not found: ' + abs); process.exit(1); }
  // variation files need ../../_rd (brand runtime); build it if missing
  const m = abs.match(/^(.*)[\\/]06-variations[\\/][^\\/]+[\\/][^\\/]+\.html$/);
  if (m && !fs.existsSync(path.join(m[1], '_rd', 'brand-runtime.js'))) {
    console.log('Brand runtime missing - running build-preview.mjs first...');
    execFileSync(process.execPath, [path.join(SCRIPTS_DIR, 'build-preview.mjs'), m[1]], { stdio: 'inherit' });
  }
  url = pathToFileURL(abs);
}
if (args.brand) url.searchParams.set('brand', args.brand);

const browser = await launchChromium();
const base = path.basename(target).replace(/\.html?$/, '') + (args.brand ? `--${args.brand}` : '');
const issues = [];
for (const w of widths) {
  const mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : w < 1000 ? 1112 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errs.push(`failed to load ${r.url().slice(0, 120)}`); });
  try { await page.goto(url.toString(), { waitUntil: 'load', timeout: 30000 }); } catch (e) { errs.push('load: ' + e.message.split('\n')[0]); }
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight, h1: document.querySelectorAll('h1').length,
    ctaInFold: [...document.querySelectorAll('a,button')].some((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.top >= 0 && r.bottom < innerHeight && r.width > 60 && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden'; }),
    brand: document.documentElement.getAttribute('data-brand'),
  })).catch(() => ({}));
  const file = path.join(OUT, `${base}--${w}.png`);
  await page.screenshot({ path: file, fullPage: args.fold ? false : true, timeout: 60000 }).catch(async () => page.screenshot({ path: file }));
  if (args.fold) await page.screenshot({ path: path.join(OUT, `${base}--${w}-fold.png`) });
  console.log(`  ${w}px -> ${path.relative(process.cwd(), file)}  (height ${info.height}px, brand ${info.brand || '-'})`);
  if (info.overflow) issues.push(`${w}px: horizontal overflow (page is ${info.scrollWidth}px wide)`);
  if (mobile && !info.ctaInFold) issues.push(`${w}px: no filled CTA button visible in the first screen`);
  if (info.h1 !== 1) issues.push(`${w}px: ${info.h1} h1 elements`);
  errs.slice(0, 5).forEach((e) => issues.push(`${w}px: console error: ${e.slice(0, 160)}`));
  await ctx.close();
}
await browser.close();
if (issues.length) { console.log('\nCheck:'); [...new Set(issues)].forEach((i) => console.log('  ! ' + i)); }
else console.log('\nNo layout issues detected (still look at the screenshots).');
