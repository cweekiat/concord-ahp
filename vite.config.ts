import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/concord-ahp/',
  plugins: [react()],
  test: { environment: 'node' },
} as any);
