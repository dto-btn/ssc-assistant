import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SuggestCallbackRoute } from './SuggestCallbackRoute';

const mocks = vi.hoisted(() => {
    return {
        reactRouter_useSearchParams_get: vi.fn(),
        reactRouter_useNavigate_return: vi.fn()
    }
})

vi.mock("react-router", () => {
    return {
        useSearchParams: () => {
            return [
                {
                    get: mocks.reactRouter_useSearchParams_get
                }
            ]
        },
        useNavigate: () => mocks.reactRouter_useNavigate_return
    }
});


describe('SuggestCallbackRoute', () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('with success suggestionContext', () => {
        const successSuggestionContext = {
            success: true,
            content: 'content',
            citations: [
                {
                    title: 'title',
                    url: 'url'
                }
            ],
            language: 'en',
            original_query: 'original_query',
            requester: 'requester',
            timestamp: "2022-01-01T00:00:00.000Z"
        };
        beforeEach(() => {
            mocks.reactRouter_useSearchParams_get.mockReturnValue(btoa(JSON.stringify(successSuggestionContext)));
            render(<SuggestCallbackRoute />);
        });
        // When the context parameter is success, it should redirect to the chat page and start a chat with the suggestions.
        it('should redirect to the chat page and start a chat with the suggestions when the context parameter is success', async () => {
            // vi.mock("react-router", mockUseParams())
            await screen.findByTestId('val.success.true');
        });
        it('should redirect with the context when doNavigate is called.', async () => {
            const btn = await screen.findByTestId('processContextBtn');
            btn.click();
            expect(mocks.reactRouter_useNavigate_return).toHaveBeenCalledWith('/', { state: { success: true, context: successSuggestionContext } });
        });
    });

    // When the context parameter is failure, it should redirect to the chat page and show an error message.

    describe('with failure suggestionContext', () => {
        const failureSuggestionContext = {
            success: false,
            reason: "redirect_because_context_validation_failed"
        };
        beforeEach(() => {
            mocks.reactRouter_useSearchParams_get.mockReturnValue(btoa(JSON.stringify(failureSuggestionContext)));
            render(<SuggestCallbackRoute />);
        });
        it('should redirect to the chat page and show an error message when success is false', async () => {
            await screen.findByTestId('val.success.false');
            expect(screen.getByTestId('val.errorReason')).toHaveTextContent('redirect_because_server_returned_success_false');
        })
        it('should redirect with the context when doNavigate is called.', async () => {
            const btn = await screen.findByTestId('processContextBtn');
            btn.click();
            expect(mocks.reactRouter_useNavigate_return).toHaveBeenCalledWith('/', { state: { success: false, errorReason: "redirect_because_server_returned_success_false" } });
        });
    });

    describe('with null suggestionContext', () => {
        beforeEach(() => {
            mocks.reactRouter_useSearchParams_get.mockReturnValue(null);
            render(<SuggestCallbackRoute />);
        });

        it('should redirect to the chat page and show an error message when the context parameter does not exist', async () => {
            // When the context parameter does not exist, it should redirect to the chat page and show an error message.
            await screen.findByTestId('val.success.false');
        });
        it('should redirect with the context when doNavigate is called.', async () => {
            const btn = await screen.findByTestId('processContextBtn');
            btn.click();
            expect(mocks.reactRouter_useNavigate_return).toHaveBeenCalledWith('/', { state: { success: false, errorReason: "redirect_because_context_validation_failed" } });
        });
    });



    // When context parameter is badly formatted, it should redirect to the chat page and show an error message.
    // it('should redirect to the chat page and show an error message when the context parameter is badly formatted', async () => {
    //     throw new Error('Not implemented');
    // });
});