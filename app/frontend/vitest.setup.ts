import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom';

vi.mock('rehype-mermaid', () => ({
    default: () => undefined,
}))

afterEach(() => {
    cleanup()
})