#!/usr/bin/env node
// Performance / SEO / best-practice lab data with Lighthouse (local Chrome), plus optional
// PageSpeed Insights field data (real Chrome users, CrUX) when online.
//
// Usage:
//   node tech-audit.mjs --pages redesign/02-audit/crawl/pages.json --out redesign/02-audit/tech [--top 8]
//   node tech-audit.mjs --urls https://a.com/,https://a.com/contact --out ... [--desktop] [--psi] [--psi-only]
//   PSI_API_KEY=... raises the PageSpeed Insights quota (optional).
import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, readJson, writeJson, ensureDir, slugFromUrl } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['psi', 'psi-only', 'desktop', 'html']);
const OUT = path.resolve(args.out || 'redesign/02-audit/tech');
const TOP = parseInt(args.top || '8', 10);
const formFactor = args.desktop ? 'desktop' : 'mobile';
ensureDir(path.join(OUT, 'lighthouse'));

let targets = [];
if (args.urls) targets = String(args.urls).split(',').map((u) => ({ url: u.trim(), slug: slugFromUrl(u.trim()) }));
else {
  const pages = readJson(path.resolve(args.pages || 'redesign/02-audit/crawl/pages.json'));
  // home first, then shallow 200-status pages; skip error pages
  targets = pages.filter((p) => p.status && p.status < 400)
    .sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : a.depth - b.depth))
    .slice(0, TOP).map((p) => ({ url: p.finalUrl || p.url, slug: p.slug }));
}
if (!targets.length) { console.error('No URLs to test.'); process.exit(1); }

const ms = (v) => (v == null ? null : Math.round(v));
function summarise(lhr) {
  const a = lhr.audits;
  const cat = (k) => (lhr.categories[k] ? Math.round(lhr.categories[k].score * 100) : null);
  const opportunities = Object.values(a)
    .filter((x) => x.details?.type === 'opportunity' && (x.details.overallSavingsMs > 50 || x.details.overallSavingsBytes > 20000) && x.score !== null && x.score < 0.9)
    .sort((x, y) => (y.details.overallSavingsMs || 0) - (x.details.overallSavingsMs || 0))
    .slice(0, 8)
    .map((x) => ({ id: x.id, title: x.title, savingsMs: ms(x.details.overallSavingsMs), savingsKB: x.details.overallSavingsBytes ? Math.round(x.details.overallSavingsBytes / 1024) : null }));
  const failedSeo = (lhr.categories.seo?.auditRefs || []).map((r) => a[r.id]).filter((x) => x && x.score === 0).map((x) => ({ id: x.id, title: x.title }));
  const failedBp = (lhr.categories['best-practices']?.auditRefs || []).map((r) => a[r.id]).filter((x) => x && x.score === 0).map((x) => ({ id: x.id, title: x.title }));
  const thirdParty = (a['third-party-summary']?.details?.items || []).slice(0, 8).map((i) => ({ entity: i.entity?.text || i.entity, blockingMs: ms(i.blockingTime), kb: Math.round((i.transferSize || 0) / 1024) }));
  const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet || a['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet || null;
  return {
    scores: { performance: cat('performance'), accessibility: cat('accessibility'), bestPractices: cat('best-practices'), seo: cat('seo') },
    metrics: {
      fcpMs: ms(a['first-contentful-paint']?.numericValue), lcpMs: ms(a['largest-contentful-paint']?.numericValue),
      tbtMs: ms(a['total-blocking-time']?.numericValue), cls: a['cumulative-layout-shift']?.numericValue != null ? +a['cumulative-layout-shift'].numericValue.toFixed(3) : null,
      speedIndexMs: ms(a['speed-index']?.numericValue), totalKB: a['total-byte-weight'] ? Math.round(a['total-byte-weight'].numericValue / 1024) : null,
      requests: a['network-requests']?.details?.items?.length ?? null,
    },
    lcpElement: lcpEl, opportunities, thirdParty, failedSeo, failedBestPractices: failedBp,
    runWarnings: lhr.runWarnings || [],
  };
}

async function runLighthouse() {
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  let chromePath = process.env.CHROME_PATH;
  if (!chromePath) { try { const { chromium } = await import('playwright'); chromePath = chromium.executablePath(); } catch {} }
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
  const results = {};
  try {
    for (const t of targets) {
      process.stdout.write(`  Lighthouse (${formFactor}) ${t.url} ... `);
      try {
        const config = formFactor === 'desktop'
          ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } }
          : undefined;
        const r = await lighthouse(t.url, { port: chrome.port, output: args.html ? ['json', 'html'] : 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, config);
        const s = summarise(r.lhr);
        results[t.slug] = { url: t.url, ...s };
        writeJson(path.join(OUT, 'lighthouse', `${t.slug}.json`), results[t.slug]);
        if (args.html && Array.isArray(r.report)) fs.writeFileSync(path.join(OUT, 'lighthouse', `${t.slug}.html`), r.report[1]);
        console.log(`perf ${s.scores.performance} | a11y ${s.scores.accessibility} | seo ${s.scores.seo} | LCP ${(s.metrics.lcpMs / 1000).toFixed(1)}s`);
      } catch (e) { results[t.slug] = { url: t.url, error: e.message.slice(0, 300) }; console.log('failed: ' + e.message.slice(0, 120)); }
    }
  } finally { await chrome.kill(); }
  return results;
}

async function runPsi() {
  const results = {};
  for (const t of targets) {
    process.stdout.write(`  PageSpeed Insights ${t.url} ... `);
    const q = new URLSearchParams({ url: t.url, strategy: formFactor });
    ['performance', 'accessibility', 'best-practices', 'seo'].forEach((c) => q.append('category', c));
    if (process.env.PSI_API_KEY) q.set('key', process.env.PSI_API_KEY);
    try {
      const res = await fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + q, { signal: AbortSignal.timeout(120000) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message);
      const field = (le) => le?.metrics ? Object.fromEntries(Object.entries(le.metrics).map(([k, v]) => [k, { p75: v.percentile, category: v.category }])) : null;
      results[t.slug] = {
        url: t.url, fieldData: field(j.loadingExperience), fieldOverall: j.loadingExperience?.overall_category || null,
        originFieldData: field(j.originLoadingExperience), lab: j.lighthouseResult ? summarise(j.lighthouseResult) : null,
      };
      writeJson(path.join(OUT, 'lighthouse', `${t.slug}.psi.json`), results[t.slug]);
      console.log(results[t.slug].fieldOverall ? `field: ${results[t.slug].fieldOverall}` : 'no field data (low traffic) - lab only');
    } catch (e) { results[t.slug] = { url: t.url, error: e.message.slice(0, 300) }; console.log('failed: ' + e.message.slice(0, 120)); }
  }
  return results;
}

console.log(`Technical audit of ${targets.length} page(s), ${formFactor}`);
const summary = { formFactor, testedAt: new Date().toISOString(), lighthouse: null, psi: null };
if (!args['psi-only']) summary.lighthouse = await runLighthouse();
if (args.psi || args['psi-only']) summary.psi = await runPsi();

// site-level rollup
const lh = Object.values(summary.lighthouse || {}).filter((x) => x.scores);
if (lh.length) {
  const avg = (f) => Math.round(lh.reduce((s, x) => s + (f(x) || 0), 0) / lh.length);
  summary.rollup = {
    avgPerformance: avg((x) => x.scores.performance), avgAccessibility: avg((x) => x.scores.accessibility),
    avgSeo: avg((x) => x.scores.seo), avgBestPractices: avg((x) => x.scores.bestPractices),
    worstLcp: lh.map((x) => ({ url: x.url, lcpMs: x.metrics.lcpMs })).sort((a, b) => b.lcpMs - a.lcpMs).slice(0, 3),
    commonOpportunities: Object.entries(lh.flatMap((x) => x.opportunities.map((o) => o.title)).reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([title, pages]) => ({ title, pages })),
  };
}
writeJson(path.join(OUT, 'summary.json'), summary);
console.log(`\nWrote ${path.relative(process.cwd(), path.join(OUT, 'summary.json'))}` + (summary.rollup ? ` - avg performance ${summary.rollup.avgPerformance}, accessibility ${summary.rollup.avgAccessibility}, SEO ${summary.rollup.avgSeo}` : ''));
