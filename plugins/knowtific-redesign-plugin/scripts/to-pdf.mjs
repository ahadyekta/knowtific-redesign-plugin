#!/usr/bin/env node
// Render an HTML report to an A4 PDF (print CSS respected, backgrounds on).
// Usage: node to-pdf.mjs redesign/03-reports/client-report.html [--out file.pdf] [--landscape]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, launchChromium } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['landscape']);
const src = args._[0];
if (!src || !fs.existsSync(src)) { console.error('Usage: node to-pdf.mjs <file.html> [--out file.pdf]'); process.exit(1); }
const out = path.resolve(args.out || src.replace(/\.html?$/i, '.pdf'));
const browser = await launchChromium();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.resolve(src)).toString(), { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(800); // web fonts
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'A4', landscape: !!args.landscape, printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
await browser.close();
console.log('PDF -> ' + path.relative(process.cwd(), out));
