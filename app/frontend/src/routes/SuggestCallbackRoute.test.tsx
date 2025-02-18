import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuggestCallbackRoute } from './SuggestCallbackRoute';
import { SuggestionContext } from './SuggestCallbackRoute';


const { mockReactRouterProducerFactory } = vi.hoisted(() => {
    return {
        /**
         * Returns a mock react router producer factory. The value parameter is optional and will be merged with the default values.
         */
        mockReactRouterProducerFactory: (values: Partial<SuggestionContext> = {}) => {
            // Set default values for the suggestion context
            values = {
                has_suggestions: true,
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
                timestamp: 'timestamp',
                ...values
            };

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
    it('should render the Suggest Callback route', async () => {
        render(<SuggestCallbackRoute />);

        const item = await screen.findByText('Suggest Callback');
        expect(item).not.toBeNull();
    });

    // When the context parameter is success, it should redirect to the chat page and start a chat with the suggestions.
    it('should redirect to the chat page and start a chat with the suggestions when the context parameter is success', async () => {
        vi.mock("react-router", mockReactRouterProducerFactory())
        render(<SuggestCallbackRoute />);
    });

    // When the context parameter is failure, it should redirect to the chat page and show an error message.

    it('should redirect to the chat page and show an error message when the context parameter is failure', async () => {
        throw new Error('Not implemented');
    })

    // When the context parameter does not exist, it should redirect to the chat page and show an error message.
    it('should redirect to the chat page and show an error message when the context parameter does not exist', async () => {
        throw new Error('Not implemented');
    });

    // When context parameter is badly formatted, it should redirect to the chat page and show an error message.
    it('should redirect to the chat page and show an error message when the context parameter is badly formatted', async () => {
        throw new Error('Not implemented');
    });
});