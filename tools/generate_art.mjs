#!/usr/bin/env node
/**
 * Generate storybook art with Google's Gemini image model (developer-time only —
 * the app itself never calls any API).
 *
 *   export GEMINI_API_KEY=...            # your own key, set in your own shell
 *   npm run art:generate                 # all assets in tools/art-brief.json
 *   npm run art:generate -- --only bird_owl,bee_think
 *   npm run art:generate -- --dry-run    # print requests, call nothing
 *   npm run art:generate -- --force      # regenerate files that already exist
 *   npm run art:generate -- --model gemini-3.1-flash-lite-image
 *
 * Raw images go to art-generated/raw/<id>.<ext>. Then run `npm run art:process`
 * to key out backgrounds, resize to WebP and update src/assets/generated.json.
 *
 * API used (Gemini "Interactions" endpoint, checked against ai.google.dev docs 2026-09-27):
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   header x-goog-api-key; body { model, input: [...parts], response_format: { type: 'image', ... } }
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'art-generated', 'raw');
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dryRun = flag('dry-run');
const force = flag('force');
const model = value('model', 'gemini-3.1-flash-image');
const only = value('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const size = value('size', '1K');

const brief = JSON.parse(readFileSync(join(ROOT, 'tools', 'art-brief.json'), 'utf8'));
const assets = brief.assets.filter((a) => !only.length || only.includes(a.id));
if (!assets.length) {
  console.error('No matching assets in tools/art-brief.json');
  process.exit(1);
}

const key = process.env.GEMINI_API_KEY;
if (!dryRun && !key) {
  console.error('Set GEMINI_API_KEY in your shell first (it is read from the environment, never stored).');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function buildBody(a) {
  const rule = a.kind === 'sprite' ? brief.spriteRule : brief.backgroundRule;
  const input = [{ type: 'text', text: `${brief.style}\n\n${a.prompt}\n\n${rule}` }];
  if (a.reference) {
    const p = join(ROOT, a.reference);
    input.push({ type: 'image', mime_type: MIME[extname(p).toLowerCase()] ?? 'image/png', data: readFileSync(p).toString('base64') });
  }
  return {
    model,
    input,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: a.aspect, image_size: size },
  };
}

/** Find the first base64 image anywhere in the response (tolerant of response-shape changes). */
function findImage(node) {
  if (!node || typeof node !== 'object') return null;
  const mime = node.mime_type ?? node.mimeType;
  if (typeof node.data === 'string' && node.data.length > 1000 && (!mime || String(mime).startsWith('image/'))) {
    return { data: node.data, mime: mime ?? 'image/png' };
  }
  for (const v of Object.values(node)) {
    const hit = findImage(v);
    if (hit) return hit;
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(a) {
  const body = buildBody(a);
  if (dryRun) {
    const shown = { ...body, input: body.input.map((p) => (p.type === 'image' ? { ...p, data: `<${p.data.length} base64 chars>` } : p)) };
    console.log(`\n# ${a.id}\n${JSON.stringify(shown, null, 1)}`);
    return 'dry';
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const errText = await res.text();
      // "limit: 0" means this key's tier has no allowance for the model — retrying cannot help
      if (/limit: 0\b/.test(errText)) {
        console.error(`\nThis API key has no quota for ${model} (Google free tier allows 0 image requests).\nEnable billing for the key's project at https://ai.dev/rate-limit, then re-run.\n`);
        process.exit(2);
      }
      const wait = 2000 * 2 ** attempt;
      console.warn(`  ${a.id}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    const img = findImage(JSON.parse(text));
    if (!img) throw new Error(`no image in response: ${text.slice(0, 400)}`);
    const file = join(OUT, `${a.id}.${EXT[img.mime] ?? 'png'}`);
    writeFileSync(file, Buffer.from(img.data, 'base64'));
    writeFileSync(join(OUT, `${a.id}.json`), JSON.stringify({ id: a.id, model, prompt: body.input[0].text, reference: a.reference ?? null, generatedAt: new Date().toISOString() }, null, 1));
    return file;
  }
  throw new Error('gave up after retries');
}

let ok = 0;
let failed = 0;
for (const a of assets) {
  const existing = ['png', 'jpg', 'webp'].map((e) => join(OUT, `${a.id}.${e}`)).find(existsSync);
  if (existing && !force && !dryRun) {
    console.log(`skip ${a.id} (exists; use --force to regenerate)`);
    continue;
  }
  try {
    const out = await generate(a);
    if (out !== 'dry') console.log(`ok   ${a.id} → ${out.replace(ROOT + '/', '')}`);
    ok++;
  } catch (e) {
    failed++;
    console.error(`FAIL ${a.id}: ${e.message}`);
  }
}
console.log(`\n${dryRun ? 'dry run' : 'done'}: ${ok} ok, ${failed} failed. Next: npm run art:process`);
process.exit(failed ? 1 : 0);
