import { useDevice } from '@deriv-com/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CommissionTooltip from '../commission-tooltip';

type TProps = Partial<React.ComponentProps<typeof CommissionTooltip>>;

jest.mock('@deriv-com/ui', () => ({
    ...jest.requireActual('@deriv-com/ui'),
    useDevice: jest.fn(() => ({ isDesktop: false })),
}));

const renderTooltip = (props: TProps = {}) =>
    render(
        <div>
            <button data-testid='outside'>outside</button>
            <CommissionTooltip commission={0.5} multiplier={100} amount={10} currency='USD' {...props}>
                Commission
            </CommissionTooltip>
        </div>
    );

describe('CommissionTooltip', () => {
    afterEach(() => jest.clearAllMocks());

    // --- mobile: tap to reveal ---
    it('reveals the formula on tap (mobile)', async () => {
        renderTooltip();

        expect(screen.queryByTestId('dt_commission_formula')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Commission'));

        expect(screen.getByTestId('dt_commission_formula')).toBeInTheDocument();
    });

    it('hides the formula when tapping outside (mobile)', async () => {
        renderTooltip();

        await userEvent.click(screen.getByText('Commission'));
        expect(screen.getByTestId('dt_commission_formula')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('outside'));

        expect(screen.queryByTestId('dt_commission_formula')).not.toBeInTheDocument();
    });

    it('keeps the formula open when tapping inside the bubble (mobile)', async () => {
        renderTooltip();

        await userEvent.click(screen.getByText('Commission'));
        await userEvent.click(screen.getByTestId('dt_commission_formula'));

        expect(screen.getByTestId('dt_commission_formula')).toBeInTheDocument();
    });

    it('renders children plainly (tapping reveals nothing) when the percentage cannot be derived', async () => {
        renderTooltip({ commission: null });

        expect(screen.getByText('Commission')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Commission'));

        expect(screen.queryByTestId('dt_commission_formula')).not.toBeInTheDocument();
    });

    // --- desktop: hover to reveal (no tap bubble) ---
    it('reveals the formula on hover on desktop', async () => {
        (useDevice as jest.Mock).mockReturnValue({ isDesktop: true });
        renderTooltip();

        expect(screen.queryByText('0.0500%')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByText('Commission'));

        // commission_percentage = (0.5 * 100) / (100 * 10) = 0.0500
        expect(screen.getByText('0.0500%')).toBeInTheDocument();
        // desktop uses the hover portal, not the mobile tap bubble
        expect(screen.queryByTestId('dt_commission_formula')).not.toBeInTheDocument();
    });
});
