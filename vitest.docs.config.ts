import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tools/gen-coverage.test.ts'], environment: 'node' } });
