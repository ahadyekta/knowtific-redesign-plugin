#!/usr/bin/env node
// Publish a prospect's report: build <prospect>/redesign/deploy/ as a self-contained static
// folder (report as index.html with every image copied into img/, report.pdf, concept/),
// copy it to <root>/_site/<slug>-<8 random chars>/ and deploy the WHOLE _site folder to
// Cloudflare Pages (deploying one folder would delete every other prospect's report).
//
// Usage: node publish-prospect.mjs prospects/<slug> [--root prospects] [--no-deploy] [--project name]
//   Deploys only when CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set and a project is
//   configured (config.json "cloudflareProject"); otherwise builds everything and skips the deploy.
//
// Report links filled at publish time (the local report keeps its placeholder text):
//   <a data-fill="report-url">  <a data-fill="concept-url">  <a data-fill="pdf-url">
//   any element with data-needs-url is removed when there is no public URL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { parseArgs, readJson, writeJson, ensureDir, copyDir, SCRIPTS_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['no-deploy']);
const PDIR = path.resolve(args._[0] || '.');
const ROOT = path.resolve(args.root || path.dirname(PDIR));
const RD = path.join(PDIR, 'redesign');
const REPORTS = path.join(RD, '03-reports');
const SRC = path.join(REPORTS, 'prospect-report.html');
const DEPLOY = path.join(RD, 'deploy');
const log = (...a) => console.log(...a);

if (!fs.existsSync(SRC)) { console.error('Not found: ' + path.relative(process.cwd(), SRC)); process.exit(1); }
const state = readJson(path.join(RD, 'state.json'), {});
const config = readJson(path.join(ROOT, 'config.json'), {});
const slug = path.basename(PDIR);
const project = args.project || config.cloudflareProject || null;
const env = process.env;
const missing = [!env.CLOUDFLARE_API_TOKEN && 'CLOUDFLARE_API_TOKEN', !env.CLOUDFLARE_ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID', !project && 'config.cloudflareProject'].filter(Boolean);
const canDeploy = !args['no-deploy'] && !missing.length;
const skipReason = args['no-deploy'] ? '--no-deploy' : missing.length ? 'missing ' + missing.join(', ') : null;

// stable folder per prospect: reuse the one from a previous publish
const dirName = state.report?.dir || `${slug}-${crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().padEnd(8, '0').slice(0, 8)}`;
const base = (config.publicBaseUrl || (project ? `https://${project}.pages.dev` : '')).replace(/\/+$/, '');
const url = canDeploy && base ? `${base}/${dirName}/` : null;

// ---------- 1. deploy/index.html with local assets copied into img/ ----------
fs.rmSync(DEPLOY, { recursive: true, force: true });
ensureDir(path.join(DEPLOY, 'img'));
// template guidance and repeat markers stay in the working copy, not in the published page
let html = fs.readFileSync(SRC, 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '');
const copied = new Map(); const broken = []; const used = new Set();
const isExternal = (u) => /^(https?:|data:|mailto:|tel:|#|javascript:|\/\/)/i.test(u) || u === '';
function localAsset(ref) {
  const clean = ref.split(/[?#]/)[0];
  let abs;
  try { abs = path.resolve(REPORTS, decodeURIComponent(clean)); } catch { abs = path.resolve(REPORTS, clean); }
  if (copied.has(abs)) return copied.get(abs);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { broken.push(ref); return null; }
  // readable, unique name: <parent>-<file>, e.g. shots-home--mobile-fold.png
  let name = (path.basename(path.dirname(abs)) + '-' + path.basename(abs)).replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
  while (used.has(name)) name = name.replace(/(\.[a-z0-9]+)$/, '-2$1');
  used.add(name);
  fs.copyFileSync(abs, path.join(DEPLOY, 'img', name));
  copied.set(abs, 'img/' + name);
  return 'img/' + name;
}
// fill publish-time links first so their placeholder hrefs are not treated as assets
const links = url ? { 'report-url': url, 'concept-url': url + 'concept/', 'pdf-url': url + 'report.pdf' } : {};
html = html.replace(/<a\b([^>]*?)\sdata-fill=["']([a-z-]+)["']([^>]*)>([\s\S]*?)<\/a>/gi, (all, pre, key, post, inner) => {
  const target = links[key];
  const attrs = (pre + post).replace(/\shref=["'][^"']*["']/i, '');
  if (!target) return `<span${attrs.replace(/\s(target|rel)=["'][^"']*["']/gi, '')}>${inner}</span>`;
  const text = /\{\{|link added|when published/i.test(inner) ? target.replace(/^https?:\/\//, '') : inner;
  return `<a${attrs} href="${target}">${text}</a>`;
});
if (!url) html = html.replace(/<(\w+)\b[^>]*\sdata-needs-url\b[^>]*>[\s\S]*?<\/\1>/gi, '');
else html = html.replace(/\sdata-needs-url\b(=["'][^"']*["'])?/gi, '');
html = html.replace(/(\s(?:src|href|poster)=)(["'])([^"']+)\2/gi, (all, attr, q, ref) => {
  if (isExternal(ref) || /^(concept\/|report\.pdf)/.test(ref)) return all;
  const local = localAsset(ref);
  return local ? `${attr}${q}${local}${q}` : all;
});
html = html.replace(/url\((["']?)([^"')]+)\1\)/gi, (all, q, ref) => {
  if (isExternal(ref)) return all;
  const local = localAsset(ref);
  return local ? `url(${q}${local}${q})` : all;
});
if (!/name=["']robots["']/i.test(html)) html = html.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex, nofollow">');
fs.writeFileSync(path.join(DEPLOY, 'index.html'), html);

// ---------- 2. concept ----------
const preview = path.join(RD, 'preview');
let concept = null;
if (state.depth !== 'audit' && fs.existsSync(path.join(preview, 'index.html'))) {
  copyDir(preview, path.join(DEPLOY, 'concept'));
  concept = 'concept/';
}
if (!concept && /href=["']concept\//i.test(html)) broken.push('concept/ (no redesign/preview built)');

// ---------- 3. PDF rendered from the deploy copy, so its links are the public ones ----------
let pdfOk = false;
try {
  execFileSync(process.execPath, [path.join(SCRIPTS_DIR, 'to-pdf.mjs'), path.join(DEPLOY, 'index.html'), '--out', path.join(DEPLOY, 'report.pdf')], { stdio: 'inherit' });
  fs.copyFileSync(path.join(DEPLOY, 'report.pdf'), path.join(REPORTS, 'prospect-report.pdf'));
  pdfOk = true;
} catch (e) {
  if (fs.existsSync(path.join(REPORTS, 'prospect-report.pdf'))) { fs.copyFileSync(path.join(REPORTS, 'prospect-report.pdf'), path.join(DEPLOY, 'report.pdf')); pdfOk = true; }
  log('! PDF render failed, using the existing 03-reports/prospect-report.pdf: ' + e.message.split('\n')[0]);
}

// ---------- 4. verify: nothing may point outside deploy/ ----------
const problems = [];
for (const [, , ref] of html.matchAll(/\s(?:src|href|poster)=(["'])([^"']+)\1/gi)) {
  if (isExternal(ref)) continue;
  if (ref.startsWith('..') || path.isAbsolute(ref)) problems.push(`path leaks outside deploy/: ${ref}`);
  else if (!fs.existsSync(path.join(DEPLOY, ref.split(/[?#]/)[0]))) problems.push(`missing file: ${ref}`);
}
broken.forEach((b) => problems.push(`missing source asset: ${b}`));
if (!pdfOk) problems.push('no report.pdf');

// ---------- 5. copy into the shared _site and deploy it whole ----------
const SITE = ensureDir(path.join(ROOT, '_site'));
const guards = {
  '_headers': '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n',
  'robots.txt': 'User-agent: *\nDisallow: /\n',
  'index.html': '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Knowtific</title></head><body></body></html>\n',
};
for (const [n, body] of Object.entries(guards)) if (!fs.existsSync(path.join(SITE, n))) fs.writeFileSync(path.join(SITE, n), body);
// a broken report never enters _site/, where the next prospect's deploy would publish it
const siteDir = path.join(SITE, dirName);
if (!problems.length) {
  fs.rmSync(siteDir, { recursive: true, force: true });
  copyDir(DEPLOY, siteDir);
}

let deployed = false, deployError = null;
if (canDeploy && problems.length) deployError = 'not deployed: deploy folder has problems (see above)';
else if (canDeploy) {
  const cmd = ['--yes', 'wrangler', 'pages', 'deploy', SITE, '--project-name', project, '--branch', config.cloudflareBranch || 'main', '--commit-dirty=true'];
  for (let attempt = 1; attempt <= 2 && !deployed; attempt++) {
    log(`Deploying ${path.relative(process.cwd(), SITE)} to Cloudflare Pages project "${project}" (attempt ${attempt})...`);
    const r = spawnSync('npx', cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000, env: { ...env, NO_COLOR: '1', FORCE_COLOR: '0' } });
    process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
    if (r.status === 0) deployed = true;
    else {
      // keep wrangler's "[ERROR] ..." line and the detail line after it
      const lines = `${r.stderr || ''}\n${r.stdout || ''}`.replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !/^[─-]+$/.test(l));
      const i = lines.findIndex((l) => /\[ERROR\]|✘/.test(l));
      deployError = (i >= 0 ? lines.slice(i, i + 2).join(' ') : r.error?.message || lines.slice(-1)[0] || 'wrangler failed').slice(0, 400);
    }
  }
}

state.report = {
  ...(state.report || {}), dir: dirName, url: deployed ? url : null, pdf: '03-reports/prospect-report.pdf',
  deploy: 'redesign/deploy/', site: path.relative(PDIR, siteDir).replace(/\\/g, '/'),
  deployedAt: deployed ? new Date().toISOString() : state.report?.deployedAt || null,
  deploySkipped: canDeploy ? null : skipReason, deployError: deployed ? null : deployError,
};
writeJson(path.join(RD, 'state.json'), state);

const summary = { dir: dirName, url: state.report.url, deployed, deploySkipped: state.report.deploySkipped, deployError: state.report.deployError, images: copied.size, concept, pdf: pdfOk, problems };
log('\n' + JSON.stringify(summary, null, 2));
if (problems.length) { log('\nFix the problems above and publish again.'); process.exit(2); }
