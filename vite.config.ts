import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2020',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  test: {
    // Vitest's `exclude` replaces the defaults rather than extending them, so
    // spread configDefaults.exclude to keep node_modules/dist etc. excluded.
    // `.claude/**` keeps Vitest from walking into git worktrees checked out
    // under .claude/worktrees/ (e.g. an older copy of this repo), which have
    // their own copies of the test files.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
