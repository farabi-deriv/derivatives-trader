import React from 'react';

import { render, screen } from '@testing-library/react';

import { CONTRACT_LIST } from 'AppV2/Utils/trade-types-utils';

import EvenOddTradeDescription from '../even-odd-trade-description';

jest.mock('@deriv/stores', () => ({
    ...jest.requireActual('@deriv/stores'),
    useStore: () => ({ ui: { is_dark_mode_on: false } }),
}));

jest.mock('@lottiefiles/dotlottie-react', () => ({
    DotLottieReact: jest.fn(() => <div>DotLottieReact</div>),
}));

describe('EvenOddTradeDescription ', () => {
    it('should render a proper content', () => {
        const mockOnTermClick = jest.fn();
        render(<EvenOddTradeDescription contract_type={CONTRACT_LIST.EVEN_ODD} onTermClick={mockOnTermClick} />);

        const earnElements = screen.getAllByText(/earn a/i);
        expect(earnElements.length).toBeGreaterThan(0);
    });
});
