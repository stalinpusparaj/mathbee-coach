import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Emits /sw.js after bundling with a precache list of every emitted file plus the
 * public folder, and a build id derived from their contents. A changed build id makes
 * the browser install a new worker, which waits until the app asks it to take over.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'mathbee-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = new Set<string>(['/', '/index.html']);
      for (const name of Object.keys(bundle)) files.add('/' + name);
      const publicDir = join(process.cwd(), 'public');
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (!entry.startsWith('.')) files.add('/' + relative(publicDir, full).split('\\').join('/'));
        }
      };
      walk(publicDir);
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : String(chunk.source).length.toString());
      }
      const buildId = hash.digest('hex').slice(0, 12);
      const template = readFileSync(join(process.cwd(), 'src', 'sw', 'sw-template.js'), 'utf8');
      const code = template
        .replace('__BUILD_ID__', buildId)
        .replace('__PRECACHE__', JSON.stringify([...files].sort()));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

/**
 * `vite build --mode artifact` builds the claude.ai Artifact version: relative paths,
 * no service worker (the Artifact viewer does not support them), output in dist-artifact/.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  plugins: mode === 'artifact' ? [react()] : [react(), serviceWorkerPlugin()],
  build: { target: 'es2020', sourcemap: false, outDir: mode === 'artifact' ? 'dist-artifact' : 'dist' },
}));
