import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // React Fast Refresh's injected module preamble can race Electron's initial
  // renderer module evaluation and leave a blank window. Forge restarts remain
  // available for deterministic development reloads.
  server: { hmr: false },
});
