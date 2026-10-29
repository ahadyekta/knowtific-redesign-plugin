#!/usr/bin/env node
// Crawl a website: discover pages (sitemap + links), capture desktop/mobile screenshots,
// extract SEO/content/conversion data, run axe accessibility checks, extract the current
// brand (colours, fonts, logo), download the client's real photos and check internal links.
//
// Usage:
//   node crawl.mjs https://example.com.au --out redesign/02-audit/crawl [--max 40]
//        [--include "/services/*"] [--exclude "/blog/*"] [--urls urls.txt]
//        [--concurrency 3] [--no-shots] [--no-axe] [--no-images] [--max-images 60]
//        [--no-linkcheck] [--timeout 30000]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, asList, slugFromUrl, ensureDir, writeJson, launchChromium, parseCssColor, rgbToHex, contrast } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['no-shots', 'no-axe', 'no-images', 'no-linkcheck']);
const start = args._[0];
if (!start) {
  console.error('Usage: node crawl.mjs <url> --out <dir> [--max 40] [--include pattern] [--exclude pattern] [--urls file]');
  process.exit(1);
}
const OUT = path.resolve(args.out || 'redesign/02-audit/crawl');
const MAX = parseInt(args.max || '40', 10);
const CONC = parseInt(args.concurrency || '3', 10);
const TIMEOUT = parseInt(args.timeout || '30000', 10);
const MAX_IMAGES = parseInt(args['max-images'] || '60', 10);
const include = asList(args.include).map(globToRe);
const exclude = asList(args.exclude).map(globToRe);
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 SiteRedesignAudit/1.0';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 SiteRedesignAudit/1.0';

for (const d of ['shots', 'text', 'axe', 'images']) ensureDir(path.join(OUT, d));

function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|zip|rar|docx?|xlsx?|pptx?|mp4|mov|mp3|wav|css|js|json|xml|txt|woff2?|ttf|eot)$/i;
const SKIP_PATH = /(\/wp-admin|\/wp-login|\/wp-json|\/feed\/?$|\/cart|\/checkout|\/my-account|\/login|\/logout|\/cdn-cgi\/|\/xmlrpc)/i;

let origin, startUrl;
try { startUrl = new URL(start); origin = startUrl.origin; } catch { console.error('Invalid URL: ' + start); process.exit(1); }
const host = startUrl.hostname.replace(/^www\./, '');

function normalise(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.hostname.replace(/^www\./, '') !== host) return null;
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|replytocom|share|ref$)/i.test(p)) u.searchParams.delete(p);
    return u.toString();
  } catch { return null; }
}
function allowed(u) {
  const p = new URL(u).pathname;
  if (SKIP_EXT.test(p) || SKIP_PATH.test(p)) return false;
  if (include.length && p !== '/' && !include.some((r) => r.test(p))) return false;
  if (exclude.some((r) => r.test(p))) return false;
  return true;
}

async function fetchText(url, ms = 15000) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'user-agent': UA_DESKTOP } });
    return { ok: res.ok, status: res.status, url: res.url, text: res.ok ? await res.text() : '' };
  } catch (e) { return { ok: false, status: 0, error: e.message, text: '' }; }
}

async function readSitemaps(robotsTxt) {
  const fromRobots = [...robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  const candidates = [...new Set([...fromRobots, origin + '/sitemap.xml', origin + '/sitemap_index.xml', origin + '/wp-sitemap.xml'])];
  const found = new Set(), seen = new Set(), sitemapFiles = [];
  const queue = [...candidates];
  while (queue.length && seen.size < 30) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await fetchText(sm);
    if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
    sitemapFiles.push(sm);
    const locs = [...r.text.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(r.text)) queue.push(...locs);
    else locs.forEach((l) => found.add(l));
  }
  return { sitemapFiles, urls: [...found] };
}

// ---------- in-page extraction (runs in the browser) ----------
function extractPage() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || document.querySelector(`meta[property="${n}"]`)?.content || null;
  const fold = window.innerHeight;
  const abs = (el) => el.getBoundingClientRect().top + window.scrollY;
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => ({ level: +h.tagName[1], text: txt(h).slice(0, 160) }));
  const ctaRe = /(call|phone|book|quote|enquir|inquir|contact|get started|get in touch|schedule|appointment|request|estimate|order|buy|shop|free|consult|sign up|subscribe|apply|download)/i;
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: txt(a).slice(0, 100) || a.getAttribute('aria-label') || a.querySelector('img')?.alt || '', visible: vis(a), y: Math.round(abs(a)) }));
  const ctas = [...document.querySelectorAll('a[href], button, input[type=submit]')].filter(vis).map((el) => {
    const t = (txt(el) || el.value || el.getAttribute('aria-label') || '').slice(0, 80);
    const cls = (el.className && el.className.baseVal === undefined ? el.className : '') + '';
    const s = getComputedStyle(el);
    const buttonish = el.tagName !== 'A' || /btn|button|cta/i.test(cls) || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' && parseFloat(s.paddingLeft) >= 8);
    const href = el.getAttribute?.('href') || '';
    return { text: t, tag: el.tagName.toLowerCase(), href, buttonish, y: Math.round(abs(el)), inFold: abs(el) < fold, bg: s.backgroundColor, color: s.color };
  }).filter((c) => c.text && (ctaRe.test(c.text) || /^tel:|^mailto:/.test(c.href) || c.buttonish));
  const images = [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.getAttribute('alt'), hasAlt: i.hasAttribute('alt'), naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, renderedWidth: Math.round(i.getBoundingClientRect().width), loading: i.getAttribute('loading'), y: Math.round(abs(i)) }));
  const bgImages = [...document.querySelectorAll('section, div, header, figure')].slice(0, 400).map((el) => getComputedStyle(el).backgroundImage).filter((b) => b && b.startsWith('url(')).map((b) => b.slice(4, -1).replace(/["']/g, '')).slice(0, 20);
  const forms = [...document.querySelectorAll('form')].map((f) => {
    const fields = [...f.querySelectorAll('input, select, textarea')].filter((i) => !['hidden', 'submit', 'button'].includes(i.type));
    return {
      action: f.getAttribute('action'), method: (f.getAttribute('method') || 'get').toLowerCase(), y: Math.round(abs(f)),
      fields: fields.map((i) => {
        const id = i.id; const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || i.closest('label');
        return { type: i.type || i.tagName.toLowerCase(), name: i.name, required: i.required, label: lab ? txt(lab).slice(0, 60) : null, placeholder: i.placeholder || null, ariaLabel: i.getAttribute('aria-label') };
      }),
      submitText: txt(f.querySelector('button, input[type=submit]') || document.createElement('i')) || f.querySelector('input[type=submit]')?.value || null,
      hasCaptcha: !!f.querySelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="turnstile"], .h-captcha'),
    };
  });
  const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
    try { const j = JSON.parse(s.textContent); const arr = Array.isArray(j) ? j : j['@graph'] || [j]; return arr.map((x) => [].concat(x['@type'] || []).join(',')); } catch { return ['(invalid JSON-LD)']; }
  });
  const html = document.documentElement.outerHTML;
  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  const tagChecks = {
    ga4: /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/.test(html), gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(html),
    googleAds: /['"]AW-\d{6,}/.test(html), uaLegacy: /UA-\d{4,}-\d+/.test(html), metaPixel: /connect\.facebook\.net\/.+fbevents\.js|fbq\(/.test(html),
    tiktok: /analytics\.tiktok\.com/.test(html), linkedin: /snap\.licdn\.com/.test(html), hotjar: /static\.hotjar\.com/.test(html), clarity: /clarity\.ms/.test(html),
    callTracking: /callrail|calltrackingmetrics|delacon|avanser|callsource/i.test(html),
  };
  const platform = (() => {
    const gen = meta('generator') || '';
    if (/wordpress/i.test(gen) || /wp-content|wp-includes/.test(html)) return 'WordPress' + (/elementor/i.test(html) ? ' + Elementor' : /divi/i.test(html) ? ' + Divi' : /wpbakery|vc_row/i.test(html) ? ' + WPBakery' : '');
    if (/wix\.com|wixstatic/.test(html)) return 'Wix'; if (/squarespace/i.test(html)) return 'Squarespace'; if (/cdn\.shopify|Shopify\./.test(html)) return 'Shopify';
    if (/webflow/i.test(html)) return 'Webflow'; if (/__NEXT_DATA__|\/_next\//.test(html)) return 'Next.js'; if (/godaddy|img1\.wsimg/i.test(html)) return 'GoDaddy builder';
    return gen || 'Unknown';
  })();
  const main = document.querySelector('main') || document.body;
  const bodyText = txt(main);
  const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src).filter(Boolean).map((s) => (/maps\.google|google\.com\/maps/.test(s) ? 'google-maps' : /youtube|vimeo/.test(s) ? 'video' : /calendly|cliniko|nookal|halaxy|timely|fresha|setmore|acuity|servicem8|hubspot/i.test(s) ? 'booking:' + new URL(s).hostname : new URL(s, location.href).hostname));
  return {
    title: document.title, metaDescription: meta('description'), canonical: document.querySelector('link[rel=canonical]')?.href || null,
    robots: meta('robots'), lang: document.documentElement.lang || null, viewport: meta('viewport'),
    og: { title: meta('og:title'), description: meta('og:description'), image: meta('og:image') },
    favicon: document.querySelector('link[rel~="icon"]')?.href || null, generator: meta('generator'), platform,
    headings, h1Count: headings.filter((h) => h.level === 1).length, wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    ctas: ctas.slice(0, 60), telLinks: links.filter((l) => l.href.startsWith('tel:')).map((l) => ({ href: l.href, text: l.text, visible: l.visible, y: l.y })),
    mailtoLinks: links.filter((l) => l.href.startsWith('mailto:')).map((l) => l.href), links: links.filter((l) => /^https?:/.test(l.href)).map(({ href, text }) => ({ href, text })),
    images, bgImages, imagesMissingAlt: images.filter((i) => !i.hasAlt).length, forms, jsonld, iframes, scripts: scripts.slice(0, 80), tags: tagChecks,
    hasNav: !!document.querySelector('nav, [role=navigation]'), hasMain: !!document.querySelector('main, [role=main]'), hasFooter: !!document.querySelector('footer'),
    copyrightYear: (bodyText.match(/©\s*(\d{4})|copyright\s*(\d{4})/i) || []).slice(1).find(Boolean) || ((document.querySelector('footer')?.innerText || '').match(/(?:©|copyright)\D{0,10}(\d{4})/i) || [])[1] || null,
    docHeight: document.documentElement.scrollHeight,
  };
}

// text dump with heading markers, for reading the page as a human would
function extractText() {
  const out = [];
  const walk = (el) => {
    for (const n of el.children) {
      const tag = n.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE'].includes(tag)) continue;
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (/^H[1-6]$/.test(tag)) { out.push('\n' + '#'.repeat(+tag[1]) + ' ' + n.innerText.replace(/\s+/g, ' ').trim()); continue; }
      if (['P', 'LI', 'BUTTON', 'A', 'LABEL', 'BLOCKQUOTE', 'FIGCAPTION', 'TD', 'TH', 'DT', 'DD'].includes(tag) && !n.querySelector('p,li,h1,h2,h3,h4,div')) {
        const t = n.innerText.replace(/\s+/g, ' ').trim();
        if (t) out.push((tag === 'LI' ? '- ' : tag === 'A' || tag === 'BUTTON' ? '[' : '') + t + (tag === 'A' || tag === 'BUTTON' ? ']' : ''));
        continue;
      }
      if (n.children.length) walk(n);
      else { const t = (n.innerText || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
    }
  };
  walk(document.body);
  return out.filter((l, i, a) => l !== a[i - 1]).join('\n');
}

function extractBrand() {
  const counts = { text: {}, bg: {}, button: {}, border: {} };
  const fonts = {};
  const add = (bucket, c, w = 1) => { if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) counts[bucket][c] = (counts[bucket][c] || 0) + w; };
  const els = [...document.querySelectorAll('body *')].slice(0, 3000);
  for (const el of els) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    const area = Math.min(r.width * r.height, 400000) / 10000;
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      add('text', s.color, 1);
      const f = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      fonts[f] = (fonts[f] || 0) + 1;
    }
    add('bg', s.backgroundColor, area);
    if (el.matches('a.btn, .btn, button, .button, [class*="btn"], [class*="button"], input[type=submit], .wp-block-button__link, .elementor-button')) add('button', s.backgroundColor, 5);
  }
  const ff = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : null; };
  const hw = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontWeight : null; };
  const logoCand = [...document.querySelectorAll('header img, [class*="logo"] img, img[class*="logo"], img[alt*="logo" i], img[src*="logo" i], a[href="/"] img, header svg, [class*="logo"] svg')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.top < 300; })
    .map((el) => ({ tag: el.tagName.toLowerCase(), src: el.currentSrc || el.src || null, alt: el.getAttribute?.('alt'), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), svg: el.tagName.toLowerCase() === 'svg' ? el.outerHTML.slice(0, 20000) : null }));
  const radius = (() => { const b = document.querySelector('.btn, button, .button, [class*="btn"], .wp-block-button__link, .elementor-button'); return b ? getComputedStyle(b).borderRadius : null; })();
  return { counts, fonts, headingFont: ff('h1') || ff('h2'), bodyFont: ff('p') || ff('body'), headingWeight: hw('h1') || hw('h2'), bodyBg: getComputedStyle(document.body).backgroundColor, logo: logoCand.slice(0, 5), buttonRadius: radius };
}

// ---------- main ----------
const t0 = Date.now();
console.log(`Crawling ${origin} (max ${MAX} pages) -> ${OUT}`);
const robots = await fetchText(origin + '/robots.txt');
const sm = await readSitemaps(robots.ok ? robots.text : '');
const httpCheck = await fetchText(start.replace(/^https:/, 'http:'), 10000);
const site = {
  start, origin, crawledAt: new Date().toISOString(),
  robotsTxt: { exists: robots.ok, content: robots.text.slice(0, 3000) },
  sitemap: { files: sm.sitemapFiles, urlCount: sm.urls.length },
  httpRedirectsToHttps: httpCheck.url ? httpCheck.url.startsWith('https:') : null,
  pages: [], brokenLinks: [], duplicates: {}, notCrawled: [],
};

// dedupe key ignores trailing slash and www so /about and /about/ are one page
const key = (u) => { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search; };
const queue = []; const queued = new Set();
const enqueue = (u, depth, source) => {
  const n = normalise(u, origin); if (!n || queued.has(key(n)) || !allowed(n)) return;
  queued.add(key(n)); queue.push({ url: n, depth, source });
};
enqueue(start, 0, 'start');
if (args.urls) fs.readFileSync(args.urls, 'utf8').split(/\s+/).filter(Boolean).forEach((u) => enqueue(u, 1, 'list'));
sm.urls.sort((a, b) => new URL(a).pathname.split('/').length - new URL(b).pathname.split('/').length).forEach((u) => enqueue(u, 1, 'sitemap'));

const browser = await launchChromium();
const dctx = await browser.newContext({ viewport: DESKTOP, userAgent: UA_DESKTOP, locale: 'en-AU', timezoneId: 'Australia/Melbourne' });
const mctx = await browser.newContext({ viewport: MOBILE, userAgent: UA_MOBILE, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'en-AU', timezoneId: 'Australia/Melbourne' });
let AxeBuilder = null;
if (!args['no-axe']) { try { AxeBuilder = (await import('@axe-core/playwright')).default; } catch { console.warn('axe not available - skipping accessibility scan'); } }

const pages = [];
const allInternalLinks = new Map(); // url -> Set(foundOn)
const imageCandidates = new Map();
let brand = null;
const slugs = new Set();

async function settle(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  // dismiss common cookie banners so screenshots show the real page
  for (const sel of ['#onetrust-accept-btn-handler', 'button:has-text("Accept all")', 'button:has-text("Accept")', 'button:has-text("I agree")', '.cky-btn-accept', '#cn-accept-cookie', '.cmplz-accept']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 300 })) { await b.click({ timeout: 1000 }); break; } } catch {}
  }
  // trigger lazy loading
  await page.evaluate(async () => {
    const h = Math.min(document.documentElement.scrollHeight, 30000);
    for (let y = 0; y < h; y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForTimeout(500);
}

async function shoot(page, file, full) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
  const vp = page.viewportSize();
  if (full && h > 16000) await page.screenshot({ path: file, clip: { x: 0, y: 0, width: vp.width, height: 16000 }, fullPage: true, timeout: 60000 });
  else await page.screenshot({ path: file, fullPage: !!full, timeout: 60000 });
}

async function crawlOne(item) {
  const { url } = item;
  let slug = slugFromUrl(url); while (slugs.has(slug)) slug += '-2'; slugs.add(slug);
  const rec = { url, slug, depth: item.depth, source: item.source };
  const page = await dctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(('pageerror: ' + e.message).slice(0, 200)));
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    rec.status = resp ? resp.status() : null;
    rec.finalUrl = page.url();
    rec.redirected = rec.finalUrl !== url;
    const chain = []; let r = resp?.request(); while (r && r.redirectedFrom()) { r = r.redirectedFrom(); chain.push(r.url()); }
    rec.redirectChain = chain.reverse();
    rec.headers = resp ? Object.fromEntries(Object.entries(resp.headers()).filter(([k]) => /^(server|x-powered-by|content-security-policy|strict-transport-security|x-frame-options|cache-control|content-encoding|x-generator)$/i.test(k))) : {};
    await settle(page);
    Object.assign(rec, await page.evaluate(extractPage));
    rec.timing = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      const lcp = performance.getEntriesByType('largest-contentful-paint');
      return n ? {
        ttfbMs: Math.round(n.responseStart), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd),
        requests: res.length + 1, transferKB: Math.round((res.reduce((s, x) => s + (x.transferSize || 0), 0) + (n.transferSize || 0)) / 1024),
        imageKB: Math.round(res.filter((x) => x.initiatorType === 'img' || /\.(jpe?g|png|webp|gif|avif)/i.test(x.name)).reduce((s, x) => s + (x.transferSize || 0), 0) / 1024),
        thirdPartyRequests: res.filter((x) => !x.name.startsWith(location.origin)).length,
      } : null;
    }).catch(() => null);
    rec.consoleErrors = consoleErrors.slice(0, 20);
    const text = await page.evaluate(extractText).catch(() => '');
    fs.writeFileSync(path.join(OUT, 'text', slug + '.md'), `# ${rec.title || slug}\nURL: ${url}\n\n${text}\n`);
    rec.textFile = `text/${slug}.md`;
    if (!brand && (item.depth === 0)) brand = await page.evaluate(extractBrand).catch(() => null);
    if (!args['no-shots']) {
      await shoot(page, path.join(OUT, 'shots', `${slug}--desktop.png`), true);
      await page.evaluate(() => scrollTo(0, 0));
      await shoot(page, path.join(OUT, 'shots', `${slug}--desktop-fold.png`), false);
      rec.shots = { desktop: `shots/${slug}--desktop.png`, desktopFold: `shots/${slug}--desktop-fold.png` };
    }
    if (AxeBuilder) {
      try {
        const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        const v = ax.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, helpUrl: x.helpUrl, wcag: x.tags.filter((t) => /^wcag\d/.test(t)), count: x.nodes.length, examples: x.nodes.slice(0, 3).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 200) })) }));
        writeJson(path.join(OUT, 'axe', slug + '.json'), v);
        rec.axe = { file: `axe/${slug}.json`, violations: v.length, critical: v.filter((x) => x.impact === 'critical').length, serious: v.filter((x) => x.impact === 'serious').length, byId: Object.fromEntries(v.map((x) => [x.id, x.count])) };
      } catch (e) { rec.axe = { error: e.message.slice(0, 200) }; }
    }
    // discover links + images
    for (const l of rec.links || []) {
      const n = normalise(l.href, url); if (!n) continue;
      const k = key(n);
      if (!allInternalLinks.has(k)) allInternalLinks.set(k, { url: n, foundOn: new Set() }); allInternalLinks.get(k).foundOn.add(url);
      if (queued.size < MAX * 4) enqueue(n, item.depth + 1, 'link');
    }
    rec.internalLinkCount = (rec.links || []).filter((l) => normalise(l.href, url)).length;
    rec.externalLinkCount = (rec.links || []).length - rec.internalLinkCount;
    delete rec.links;
    for (const im of [...(rec.images || []), ...(rec.bgImages || []).map((src) => ({ src, alt: null, naturalWidth: 0 }))]) {
      if (!im.src || im.src.startsWith('data:') || /\.svg(\?|$)/i.test(im.src) || /logo|icon|sprite|avatar|badge|flag|pixel|spinner|loader/i.test(im.src)) continue;
      if (im.naturalWidth && im.naturalWidth < 400) continue;
      if (!imageCandidates.has(im.src)) imageCandidates.set(im.src, { src: im.src, alt: im.alt, page: url, width: im.naturalWidth, height: im.naturalHeight });
    }
  } catch (e) {
    rec.error = e.message.split('\n')[0].slice(0, 300);
  } finally { await page.close().catch(() => {}); }

  // mobile pass
  if (!rec.error) {
    const mp = await mctx.newPage();
    try {
      await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await settle(mp);
      rec.mobile = await mp.evaluate(() => {
        const fold = innerHeight;
        const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const tapSmall = [...document.querySelectorAll('a[href], button')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 32 || r.width < 32; }).length;
        const tel = [...document.querySelectorAll('a[href^="tel:"]')].filter(vis);
        const fontPx = parseFloat(getComputedStyle(document.querySelector('p') || document.body).fontSize);
        const vpMeta = document.querySelector('meta[name="viewport"]')?.content || '';
        return {
          hasViewportMeta: /width=device-width/.test(vpMeta), layoutWidth: innerWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2, scrollWidth: document.documentElement.scrollWidth,
          telInFold: tel.some((el) => el.getBoundingClientRect().top < fold), telVisible: tel.length,
          ctaInFold: [...document.querySelectorAll('a[href], button')].filter(vis).some((el) => el.getBoundingClientRect().top < fold && /(call|book|quote|contact|enquir|get started|appointment)/i.test(el.innerText || '')),
          smallTapTargets: tapSmall, bodyFontPx: fontPx,
          stickyElements: [...document.querySelectorAll('body *')].slice(0, 2000).filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && vis(el)).map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), h: Math.round(el.getBoundingClientRect().height) })).slice(0, 6),
        };
      });
      if (!args['no-shots']) {
        await shoot(mp, path.join(OUT, 'shots', `${slug}--mobile.png`), true);
        await mp.evaluate(() => scrollTo(0, 0));
        await shoot(mp, path.join(OUT, 'shots', `${slug}--mobile-fold.png`), false);
        rec.shots = { ...(rec.shots || {}), mobile: `shots/${slug}--mobile.png`, mobileFold: `shots/${slug}--mobile-fold.png` };
      }
    } catch (e) { rec.mobileError = e.message.split('\n')[0].slice(0, 200); }
    finally { await mp.close().catch(() => {}); }
  }
  pages.push(rec);
  console.log(`  [${pages.length}/${MAX}] ${rec.status ?? 'ERR'} ${url}${rec.error ? '  ! ' + rec.error : ''}`);
}

// worker pool
const active = new Set();
while ((queue.length || active.size) && pages.length + active.size < MAX) {
  while (queue.length && active.size < CONC && pages.length + active.size < MAX) {
    const item = queue.shift();
    const p = crawlOne(item).finally(() => active.delete(p));
    active.add(p);
  }
  if (active.size) await Promise.race(active);
}
await Promise.all(active);
site.notCrawled = queue.map((q) => q.url).slice(0, 200);

// ---------- brand-current.json ----------
if (brand) {
  const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  const toHex = (c) => { const p = parseCssColor(c); return p && p.a > 0.5 ? rgbToHex(p.rgb) : null; };
  const hexCounts = (bucket) => { const m = {}; for (const [c, n] of Object.entries(brand.counts[bucket])) { const h = toHex(c); if (h) m[h] = (m[h] || 0) + n; } return top(m, 8).map(([hex, n]) => ({ hex, weight: Math.round(n) })); };
  const text = hexCounts('text'), bg = hexCounts('bg'), button = hexCounts('button');
  const isNeutral = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 20; };
  const avg = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
  const bodyBg = toHex(brand.bodyBg) || '#FFFFFF';
  const best = (on) => ((contrast('#FFFFFF', on) || 0) >= (contrast('#111111', on) || 0) ? '#FFFFFF' : '#111111');
  // primary = the strongest brand colour used on large areas (header/hero bands); accent = the button colour if different
  const colourful = (list) => list.map((c) => c.hex).filter((h) => !isNeutral(h));
  const primary = colourful(bg)[0] || colourful(button)[0] || colourful(text)[0] || '#1F4E79';
  const accent = [...colourful(button), ...colourful(bg), ...colourful(text)].find((h) => h !== primary) || primary;
  const textHex = text.find((c) => (contrast(c.hex, bodyBg) || 0) >= 3)?.hex || '#222222';
  const muted = text.map((c) => c.hex).find((h) => h !== textHex && isNeutral(h) && (contrast(h, bodyBg) || 0) >= 2.5) || '#666666';
  const surface = bg.map((c) => c.hex).find((h) => h !== bodyBg && isNeutral(h) && avg(h) > 200) || '#F5F5F5';
  const dark = bg.map((c) => c.hex).find((h) => avg(h) < 70) || '#111111';
  let logoSaved = null;
  const logo = brand.logo[0];
  if (logo?.svg) { fs.writeFileSync(path.join(OUT, 'logo.svg'), logo.svg.includes('xmlns') ? logo.svg : logo.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')); logoSaved = 'logo.svg'; }
  else if (logo?.src) {
    try {
      const res = await dctx.request.get(logo.src, { timeout: 15000 });
      if (res.ok()) {
        const ct = res.headers()['content-type'] || '';
        const ext = /svg/.test(ct) ? 'svg' : /png/.test(ct) ? 'png' : /webp/.test(ct) ? 'webp' : /jpe?g/.test(ct) ? 'jpg' : (logo.src.split('?')[0].split('.').pop() || 'png').slice(0, 4);
        fs.writeFileSync(path.join(OUT, 'logo.' + ext), await res.body()); logoSaved = 'logo.' + ext;
      }
    } catch {}
  }
  writeJson(path.join(OUT, 'brand-current.json'), {
    note: 'Extracted automatically from the home page. Verify before relying on it.',
    colors: { text, background: bg, buttons: button },
    fonts: { heading: brand.headingFont, body: brand.bodyFont, headingWeight: brand.headingWeight, all: top(brand.fonts, 8).map(([family, count]) => ({ family, count })) },
    buttonRadius: brand.buttonRadius,
    logo: { candidates: brand.logo.map(({ svg, ...rest }) => ({ ...rest, inlineSvg: !!svg })), saved: logoSaved },
    suggestedTokens: {
      primary, onPrimary: best(primary), accent, onAccent: best(accent), bg: bodyBg, surface,
      text: textHex, muted, border: '#E2E2E2', dark, onDark: best(dark),
    },
  });
}

// ---------- images ----------
const imagesOut = [];
if (!args['no-images']) {
  const list = [...imageCandidates.values()].slice(0, MAX_IMAGES * 2);
  let i = 0;
  for (const im of list) {
    if (imagesOut.length >= MAX_IMAGES) break;
    try {
      const res = await dctx.request.get(im.src, { timeout: 15000 });
      if (!res.ok()) continue;
      const ct = res.headers()['content-type'] || '';
      if (!/image\/(jpe?g|png|webp|avif)/.test(ct)) continue;
      const body = await res.body();
      if (body.length < 15000) continue;
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('avif') ? 'avif' : 'jpg';
      const base = (new URL(im.src).pathname.split('/').pop() || 'img').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 50);
      const file = `${String(++i).padStart(2, '0')}-${base}.${ext}`;
      fs.writeFileSync(path.join(OUT, 'images', file), body);
      imagesOut.push({ file, src: im.src, alt: im.alt, page: im.page, width: im.width || null, height: im.height || null, kb: Math.round(body.length / 1024) });
    } catch {}
  }
}
writeJson(path.join(OUT, 'images', 'images.json'), imagesOut);

// ---------- link check ----------
const crawledSet = new Map(pages.map((p) => [key(p.url), { url: p.url, status: p.status }]));
if (!args['no-linkcheck']) {
  const toCheck = [...allInternalLinks.entries()].filter(([k]) => !crawledSet.has(k)).map(([, v]) => v.url).slice(0, 200);
  const results = [];
  const worker = async () => {
    while (toCheck.length) {
      const u = toCheck.shift();
      let status = 0;
      try {
        let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': UA_DESKTOP } });
        if (r.status === 405 || r.status === 403) r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': UA_DESKTOP } });
        status = r.status;
      } catch { status = 0; }
      results.push([u, status]);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  for (const [u, s] of results) crawledSet.set(key(u), { url: u, status: s });
}
for (const [k, { url: u, status: s }] of crawledSet) if (s === 0 || s >= 400) site.brokenLinks.push({ url: u, status: s, foundOn: [...(allInternalLinks.get(k)?.foundOn || [])].slice(0, 10) });

// ---------- duplicates ----------
const dup = (key) => {
  const m = {}; for (const p of pages) { const v = (p[key] || '').trim(); if (v) (m[v] ||= []).push(p.url); }
  return Object.entries(m).filter(([, v]) => v.length > 1).map(([value, urls]) => ({ value, urls }));
};
site.duplicates = { titles: dup('title'), metaDescriptions: dup('metaDescription'), h1: (() => { const m = {}; for (const p of pages) { const h = p.headings?.find((x) => x.level === 1)?.text; if (h) (m[h] ||= []).push(p.url); } return Object.entries(m).filter(([, v]) => v.length > 1).map(([value, urls]) => ({ value, urls })); })() };
site.platform = pages.find((p) => p.platform)?.platform || null;
site.pages = pages.map((p) => ({ url: p.url, slug: p.slug, status: p.status, title: p.title }));
site.durationSec = Math.round((Date.now() - t0) / 1000);

pages.sort((a, b) => (a.depth - b.depth) || a.url.localeCompare(b.url));
writeJson(path.join(OUT, 'pages.json'), pages);
writeJson(path.join(OUT, 'site.json'), site);
await browser.close();

console.log(`\nDone in ${site.durationSec}s: ${pages.length} pages, ${imagesOut.length} images, ${site.brokenLinks.length} broken links, platform: ${site.platform}`);
console.log(`Sitemap: ${sm.sitemapFiles.length ? sm.urls.length + ' URLs' : 'not found'} | robots.txt: ${robots.ok ? 'yes' : 'no'} | ${queue.length} more URLs not crawled (raise --max)`);
console.log(`Outputs: ${path.relative(process.cwd(), OUT)}/{pages.json, site.json, brand-current.json, shots/, text/, axe/, images/}`);
