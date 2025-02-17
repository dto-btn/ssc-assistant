import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestCallbackRoute } from './SuggestCallbackRoute';
import 'jsdom';

describe('SuggestCallbackRoute', () => {
    it('should render the Suggest Callback route', async () => {
        render(<SuggestCallbackRoute />);

        const item = await screen.findByText('Suggest Callback');
        expect(item).not.toBeNull();
    });
});