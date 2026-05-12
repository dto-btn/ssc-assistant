import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Vitest/jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

vi.mock('rehype-mermaid', () => ({
    default: () => undefined,
}))

afterEach(() => {
    cleanup()
})