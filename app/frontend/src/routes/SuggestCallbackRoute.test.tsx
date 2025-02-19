import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SuggestCallbackRoute } from './SuggestCallbackRoute';

const mocks = vi.hoisted(() => {
    return {
        useSearchParams_get: vi.fn(),
    }
})

vi.mock("react-router", () => {
    return {
        useSearchParams: () => {
            return [
                {
                    get: mocks.useSearchParams_get
                }
            ]
        }
    }
});


describe('SuggestCallbackRoute', () => {
    // When the context parameter is success, it should redirect to the chat page and start a chat with the suggestions.
    it('should redirect to the chat page and start a chat with the suggestions when the context parameter is success', async () => {
        // vi.mock("react-router", mockUseParams())
        mocks.useSearchParams_get.mockReturnValue(btoa(JSON.stringify({
            success: true,
            content: 'content',
            citations: [
                {
                    title: 'title',
                    url: 'url',
                    content: 'content'
                }
            ],
            language: 'en',
            original_query: 'original_query',
            requester: 'requester',
            timestamp: "2022-01-01T00:00:00.000Z"
        })));
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.true');
    });

    // When the context parameter is failure, it should redirect to the chat page and show an error message.

    it('should redirect to the chat page and show an error message when success is false', async () => {
        mocks.useSearchParams_get.mockReturnValue(btoa(JSON.stringify({
            success: false,
            reason: "redirect_because_context_validation_failed" // can be one of several values
        })));
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.false');
        expect(screen.getByTestId('val.errorReason')).toHaveTextContent('redirect_because_server_returned_success_false');
    })

    // When the context parameter does not exist, it should redirect to the chat page and show an error message.
    it('should redirect to the chat page and show an error message when the context parameter does not exist', async () => {
        mocks.useSearchParams_get.mockReturnValue(null);
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.false');
    });

    // When context parameter is badly formatted, it should redirect to the chat page and show an error message.
    // it('should redirect to the chat page and show an error message when the context parameter is badly formatted', async () => {
    //     throw new Error('Not implemented');
    // });
});