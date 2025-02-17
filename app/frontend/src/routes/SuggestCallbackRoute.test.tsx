import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuggestCallbackRoute } from './SuggestCallbackRoute';

describe('SuggestCallbackRoute', () => {
    it('should render the Suggest Callback route', async () => {
        render(<SuggestCallbackRoute />);

        const item = await screen.findByText('Suggest Callback');
        expect(item).not.toBeNull();
    });
});