import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@premium-share/domain': path.resolve(__dirname, 'packages/domain/src'),
    },
  },
})
