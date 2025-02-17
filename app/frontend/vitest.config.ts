import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        setupFiles: ['vitest-cleanup-after-each.ts'],
        environment: 'jsdom',
    },
})

