#!/usr/bin/env node
/**
 * Writes art-generated/CHATGPT_PROMPTS.md: one copy-paste prompt per asset in
 * tools/art-brief.json, for generating the art by hand in ChatGPT (or any image tool).
 * Save the results into art-generated/inbox/ with any file names.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const brief = JSON.parse(readFileSync(join(ROOT, 'tools', 'art-brief.json'), 'utf8'));
mkdirSync(join(ROOT, 'art-generated', 'inbox'), { recursive: true });

const SIZE = { '1:1': 'square (1024×1024)', '16:9': 'wide landscape (1536×1024)', '9:16': 'tall portrait (1024×1536)', '21:9': 'very wide banner (1536×1024, keep the important parts in a thin horizontal band across the middle)' };
const spriteRule = 'Transparent background (PNG with alpha). If transparency is not possible, use a completely flat solid pure magenta (#FF00FF) background with no shadow. Draw exactly one subject, whole and centred, filling about 80% of the canvas. No magenta or purple on the subject.';

const L = [
  '# ChatGPT image prompts for MathBee Coach',
  '',
  'Paste one prompt per ChatGPT message. Download each image and save it into `art-generated/inbox/` (any file name is fine).',
  'Bee poses: attach `public/assets/sprites/bee.webp` to the message so ChatGPT keeps the same bee.',
  'When done, tell Claude "the images are in the inbox" — it will match, clean, and add them.',
  '',
];
for (const a of brief.assets) {
  const rule = a.kind === 'sprite' ? spriteRule : brief.backgroundRule;
  L.push(`## ${a.id}${a.reference ? '  (attach the bee image)' : ''}`, '', '```', `${brief.style}`, '', `${a.prompt}`, '', `${rule} Format: ${SIZE[a.aspect] ?? a.aspect}.`, '```', '');
}
writeFileSync(join(ROOT, 'art-generated', 'CHATGPT_PROMPTS.md'), L.join('\n'));
console.log(`wrote art-generated/CHATGPT_PROMPTS.md (${brief.assets.length} prompts); save images into art-generated/inbox/`);
