import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        setupFiles: ['./vitest.setup.ts'],
        globals: true,
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    },
})

