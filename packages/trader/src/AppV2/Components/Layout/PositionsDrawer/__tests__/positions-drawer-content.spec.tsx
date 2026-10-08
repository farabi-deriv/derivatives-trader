import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';

import { PositionsDrawerFooter } from '../positions-drawer-content';

jest.mock('@deriv/components', () => ({
    ...jest.requireActual('@deriv/components'),
    Money: ({ amount }: { amount: number }) => <span data-testid='dt_money'>{amount}</span>,
}));

let mock_is_phone_landscape = false;
jest.mock('AppV2/Hooks/useIsPhoneLandscape', () => () => mock_is_phone_landscape);

type TMockPosition = { profit_loss: number };

const renderFooter = (store: ReturnType<typeof mockStore>) =>
    render(
        <StoreProvider store={store}>
            <PositionsDrawerFooter />
        </StoreProvider>
    );

const buildStore = ({
    active_positions = [],
    all_positions = [],
    is_switching_account = false,
}: {
    active_positions?: TMockPosition[];
    all_positions?: TMockPosition[];
    is_switching_account?: boolean;
}) =>
    mockStore({
        client: { currency: 'USD' },
        portfolio: { active_positions, all_positions } as never,
        ui: { is_switching_account },
    });

describe('PositionsDrawerFooter', () => {
    it('renders nothing when there are no open positions even if closed contracts exist (issue #1057 Issue 1)', () => {
        const { container } = renderFooter(buildStore({ active_positions: [], all_positions: [{ profit_loss: 100 }] }));

        expect(container).toBeEmptyDOMElement();
    });

    it('sums Total P/L from open positions only and counts a single open position (issue #1057 Issue 2)', () => {
        renderFooter(
            buildStore({
                active_positions: [{ profit_loss: 10 }],
                all_positions: [{ profit_loss: 10 }, { profit_loss: 100 }],
            })
        );

        expect(screen.getByText('1 open position')).toBeInTheDocument();
        expect(screen.getByTestId('dt_money')).toHaveTextContent('10');
        expect(screen.getByTestId('dt_money')).not.toHaveTextContent('110');
    });

    it('renders nothing while switching account even when open positions exist', () => {
        const { container } = renderFooter(
            buildStore({ active_positions: [{ profit_loss: 10 }], is_switching_account: true })
        );

        expect(container).toBeEmptyDOMElement();
    });

    describe('[PDF-001] P/L label', () => {
        afterEach(() => {
            mock_is_phone_landscape = false;
        });

        it('reads "Current P/L" in the landscape summary, in regular weight', () => {
            mock_is_phone_landscape = true;
            renderFooter(buildStore({ active_positions: [{ profit_loss: 5 }] }));

            expect(screen.getByText('Current P/L')).toHaveStyle('--text-weight: var(--text-weight-normal)');
            expect(screen.queryByText('Total P/L:')).not.toBeInTheDocument();
        });

        it('keeps "Total P/L:" in the desktop footer', () => {
            renderFooter(buildStore({ active_positions: [{ profit_loss: 5 }] }));

            expect(screen.getByText('Total P/L:')).toBeInTheDocument();
        });
    });
});
