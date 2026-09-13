import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    globals: true,
    setupFiles: ['./tests/helpers/test-setup.js'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    reporters: ['verbose'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  }
});
