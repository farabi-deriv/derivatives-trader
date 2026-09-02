import React from 'react';

import { getLocalizedBasis } from '@deriv/shared';
import { render, screen } from '@testing-library/react';

import PurchaseButtonContent from '../purchase-button-content';

type TInfo = React.ComponentProps<typeof PurchaseButtonContent>['info'];

const mock_props = {
    currency: 'USD',
    has_cancellation: false,
    has_open_accu_contract: false,
    info: {
        obj_contract_basis: {
            text: 'Payout',
            value: 19.23,
        },
    } as TInfo,
    is_accumulator: false,
    is_multiplier: false,
    is_turbos: false,
    is_vanilla: false,
};
const wrapper_data_test_id = 'dt_purchase_button_wrapper';
const localized_basis = getLocalizedBasis();

describe('PurchaseButtonContent', () => {
    it('should keep the basis label and show a pending placeholder while the proposal has no amount yet', () => {
        // The label is static, so a proposal still in flight must not blank the whole row — that left
        // the button reading just "Buy" over an empty row (#1142).
        render(<PurchaseButtonContent {...mock_props} info={{} as TInfo} />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.getByTestId('square-skeleton')).toBeInTheDocument();
        expect(screen.getByTestId(wrapper_data_test_id)).not.toHaveClass(
            'purchase-button__information__wrapper--disabled-placeholder'
        );
    });

    it('should show a dash instead of a placeholder once the proposal has errored', () => {
        // An errored proposal carries no amount and never will, so it must not shimmer forever.
        render(<PurchaseButtonContent {...mock_props} info={{ has_error: true } as TInfo} />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(screen.queryByTestId('square-skeleton')).not.toBeInTheDocument();
    });

    it('should show a pending placeholder for the multipliers total cost before it is priced', () => {
        render(<PurchaseButtonContent {...mock_props} is_multiplier has_cancellation info={{} as TInfo} />);

        expect(screen.getByText('Total cost')).toBeInTheDocument();
        expect(screen.getByTestId('square-skeleton')).toBeInTheDocument();
    });

    it('should render correct default text basis and amount if info was passed', () => {
        render(<PurchaseButtonContent {...mock_props} />);

        expect(screen.getByTestId(wrapper_data_test_id)).not.toHaveClass(
            'purchase-button__information__wrapper--disabled-placeholder'
        );
        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.getByText('$19.23')).toBeInTheDocument();
    });

    it('should render Total cost for Multipliers when Deal Cancellation is enabled', () => {
        const multipliers_info = {
            has_error: false,
            has_error_details: false,
            obj_contract_basis: {
                text: '',
                value: '',
            },
            stake: '10.00',
        };
        render(
            <PurchaseButtonContent {...mock_props} is_multiplier has_cancellation info={multipliers_info as TInfo} />
        );

        expect(screen.getByText('Total cost')).toBeInTheDocument();
        expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('should not render Total cost for Multipliers when Deal Cancellation is not set', () => {
        const multipliers_info = {
            has_error: false,
            has_error_details: false,
            obj_contract_basis: {
                text: '',
                value: '',
            },
            stake: '10.00',
        };
        const { container } = render(
            <PurchaseButtonContent {...mock_props} is_multiplier info={multipliers_info as TInfo} />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('should not render button content if has_no_button_content === true and there is no error', () => {
        const { container } = render(<PurchaseButtonContent {...mock_props} has_no_button_content />);

        expect(container).toBeEmptyDOMElement();
    });

    it('should render Max payout and its value for a fresh accumulator', () => {
        render(<PurchaseButtonContent {...mock_props} is_accumulator max_payout={6000} />);

        expect(screen.getByText(localized_basis.max_payout)).toBeInTheDocument();
        expect(screen.getByText('$6,000.00')).toBeInTheDocument();
    });

    it('should render the standard payout (not Max payout) for an accumulator with an open contract', () => {
        render(<PurchaseButtonContent {...mock_props} is_accumulator has_open_accu_contract max_payout={6000} />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.queryByText(localized_basis.max_payout)).not.toBeInTheDocument();
        expect(screen.getByText(/19.23/)).toBeInTheDocument();
    });

    it('should withhold a priced amount but keep the basis label while the stake is above the balance', () => {
        // A payout under a permanently disabled Buy is a promise the account cannot collect, so the
        // value slot takes the same dash an errored proposal gets.
        render(<PurchaseButtonContent {...mock_props} is_stake_above_balance />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.queryByText('$19.23')).not.toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(screen.queryByTestId('square-skeleton')).not.toBeInTheDocument();
    });

    it('should not shimmer when the stake is above the balance and the proposal is not priced yet', () => {
        // The gate is a terminal state, so the skeleton must be unreachable from it.
        render(<PurchaseButtonContent {...mock_props} info={{} as TInfo} is_stake_above_balance />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(screen.queryByTestId('square-skeleton')).not.toBeInTheDocument();
    });

    it('should withhold the multipliers total cost while the stake is above the balance', () => {
        render(
            <PurchaseButtonContent
                {...mock_props}
                is_multiplier
                has_cancellation
                info={{ stake: '10.00' } as TInfo}
                is_stake_above_balance
            />
        );

        expect(screen.getByText('Total cost')).toBeInTheDocument();
        expect(screen.queryByText('$10.00')).not.toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should quote the amount exactly as before when is_stake_above_balance is false', () => {
        render(<PurchaseButtonContent {...mock_props} is_stake_above_balance={false} />);

        expect(screen.getByText(localized_basis.payout)).toBeInTheDocument();
        expect(screen.getByText('$19.23')).toBeInTheDocument();
        expect(screen.queryByText('-')).not.toBeInTheDocument();
    });
});
