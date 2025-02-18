import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SuggestionContext, SuggestCallbackRoute, SuggestCallbackStates } from './SuggestCallbackRoute';
import { useParams } from 'react-router';


const { mockUseParams } = vi.hoisted(() => {
    return {
        /**
         * Returns a mock react router producer factory. The value parameter is optional and will be merged with the default values.
         * If the value parameter is null, the context parameter will be unset.
         */
        mockUseParams: (values: Partial<SuggestionContext> | null = {}) => {
            const defaultValues: SuggestionContext = {
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
                // ISO 8601 timestamp
                timestamp: "2022-01-01T00:00:00.000Z"
            }

            if (values === null) {
                // Set default values for the suggestion context
                values = {}
            } else {
                values = {
                    ...defaultValues,
                    ...values
                };
            }

            const producer = () => {
                return {
                    useParams: () => {
                        return {
                            context: JSON.stringify(values)
                        }
                    }
                }
            }

            return producer;
        }
    }
})

describe('SuggestCallbackRoute', () => {
    // When the context parameter is success, it should redirect to the chat page and start a chat with the suggestions.
    it('should redirect to the chat page and start a chat with the suggestions when the context parameter is success', async () => {
        // vi.mock("react-router", mockUseParams())
        vi.mock("react-router", () => {
            return {
                useParams: () => {
                    return {
                        suggestionContext: JSON.stringify({
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
                        })
                    }
                }
            }
        })
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.true');
    });

    // When the context parameter is failure, it should redirect to the chat page and show an error message.

    it('should redirect to the chat page and show an error message when the context parameter is failure', async () => {
        vi.mock("react-router", mockUseParams({
            success: false,
        }))
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.false');
        expect(screen.getByTestId('val.errorReason')).toHaveTextContent('redirect_because_server_returned_success_false');
    })

    // When the context parameter does not exist, it should redirect to the chat page and show an error message.
    it('should redirect to the chat page and show an error message when the context parameter does not exist', async () => {
        vi.mock("react-router", mockUseParams(null))
        render(<SuggestCallbackRoute />);
        await screen.findByTestId('val.success.false');
    });

    // When context parameter is badly formatted, it should redirect to the chat page and show an error message.
    it('should redirect to the chat page and show an error message when the context parameter is badly formatted', async () => {
        throw new Error('Not implemented');
    });
});