import { render, screen } from '@testing-library/react';

import CommissionDescription from '../commission-description';

describe('CommissionDescription', () => {
    const props = { commission: 0.5, multiplier: 100, amount: 10, currency: 'USD' };

    it('renders the description sentence and the formula pill with the derived percentage', () => {
        // commission_percentage = (0.5 * 100) / (100 * 10) = 0.0500
        render(<CommissionDescription {...props} />);

        expect(screen.getByText(/Commission is calculated as 0.0500% of your stake/)).toBeInTheDocument();
        expect(screen.getByText('0.0500%')).toBeInTheDocument();
    });

    it('renders nothing when the percentage cannot be derived', () => {
        const { container } = render(<CommissionDescription {...props} amount={0} />);

        expect(container).toBeEmptyDOMElement();
    });
});
