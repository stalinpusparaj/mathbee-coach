#!/usr/bin/env node
/**
 * After `vite build --mode artifact`: write dist-artifact/mathbee.html, the page fragment the
 * claude.ai Artifact host wraps in its own <html>/<head>/<body>, and list the supporting files.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIR = join(process.cwd(), 'dist-artifact');
const html = readFileSync(join(DIR, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+)"/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="\.?\/?([^"]+)"/g)].map((m) => m[1]);
if (!js.length) throw new Error('no entry script found in index.html');

const page = [
  '<title>MathBee Coach</title>',
  '<meta name="description" content="A storybook maths garden for Grade 1: counting, adding, clocks, calendars and more.">',
  ...css.map((h) => `<link rel="stylesheet" href="${h}">`),
  '<div id="root"></div>',
  '<noscript>MathBee Coach needs JavaScript to run.</noscript>',
  ...js.map((s) => `<script type="module" src="${s}"></script>`),
  '',
].join('\n');
writeFileSync(join(DIR, 'mathbee.html'), page);

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) walk(p);
  else files.push(relative(DIR, p).split('\\').join('/'));
});
walk(DIR);
const supporting = files.filter((f) => !['index.html', 'mathbee.html', 'manifest.webmanifest'].includes(f) && !f.startsWith('.'));
writeFileSync(join(DIR, 'files.json'), JSON.stringify(supporting, null, 1));
console.log(`wrote dist-artifact/mathbee.html; ${supporting.length} supporting files`);
