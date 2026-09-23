import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RiskManagementPicker from '../risk-management-picker';

jest.mock('../deal-cancellation', () => jest.fn(() => <div>Page content 2</div>));
jest.mock('../take-profit-and-stop-loss-container', () => jest.fn(() => <div>Page content 1</div>));
jest.mock('../risk-management-info', () => jest.fn(() => null));

const mock_props = {
    closeActionSheet: jest.fn(),
    should_show_deal_cancellation: true,
};
describe('RiskManagementPicker', () => {
    it('should render Page content 1 component on first page', () => {
        render(<RiskManagementPicker {...mock_props} />);

        expect(screen.getByText('Page content 1')).toBeInTheDocument();
    });

    it('should render Page content 2 component on first page', async () => {
        render(<RiskManagementPicker {...mock_props} />);

        await userEvent.click(screen.getByText('Deal cancellation'));

        expect(screen.getByText('Page content 2')).toBeInTheDocument();
    });

    it('should open initial tab corresponding to passed initial_tab_index prop', () => {
        render(<RiskManagementPicker {...mock_props} initial_tab_index={1} />);

        // The header now owns leading Close / trailing Save action buttons, so target the
        // segmented-control tabs (class `item`) rather than the first two buttons in the DOM.
        const [first_tab, second_tab] = screen
            .getAllByRole('button')
            .filter(button => button.classList.contains('item'));

        expect(first_tab).not.toHaveClass('item selected');
        expect(second_tab).toHaveClass('item selected');
    });
});
