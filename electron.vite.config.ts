import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  // index = the app UI's bridge, page = runs inside every web page (saved passwords, see main/passwords.ts)
  preload: { build: { rolldownOptions: { input: { index: 'src/preload/index.ts', page: 'src/preload/page.ts' } } } },
  renderer: { plugins: [react()] },
});
