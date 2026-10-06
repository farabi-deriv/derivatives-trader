import { renderToStaticMarkup } from 'react-dom/server';

import { mockStore } from '@deriv/stores';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import TakeProfitStopLossDesktop from '../take-profit-stop-loss-desktop';

jest.mock('AppV2/Hooks/useIsVirtualKeyboardOpen', () => ({
    __esModule: true,
    default: jest.fn(() => ({ is_key_board_visible: false })),
}));
jest.mock('AppV2/Hooks/useProposal', () => ({
    useProposal: jest.fn(() => ({ data: undefined, error: undefined, isFetching: false })),
}));

const buildStore = ({ has_take_profit = false, has_stop_loss = false } = {}) =>
    mockStore({
        modules: {
            trade: {
                ...mockStore({}).modules.trade,
                currency: 'USD',
                has_take_profit,
                take_profit: has_take_profit ? '10' : '',
                has_stop_loss,
                stop_loss: has_stop_loss ? '5' : '',
                trade_types: { MULTUP: 'Multiply Up' },
                validation_params: {
                    MULTUP: { take_profit: { min: '0.1', max: '100' }, stop_loss: { min: '0.1', max: '100' } },
                },
            },
        },
    });

// Static markup runs no effects, so it is the first paint — where a slide-in from off shows.
const firstPaint = (store: ReturnType<typeof mockStore>) =>
    renderToStaticMarkup(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <TakeProfitStopLossDesktop onClose={jest.fn()} is_open />
            </ModulesProvider>
        </TraderProviders>
    );

const pressedStates = (markup: string) => [...markup.matchAll(/aria-pressed="(true|false)"/g)].map(match => match[1]);

describe('TakeProfitStopLossDesktop', () => {
    it('paints both switches in their real state when it opens, rather than sliding there', () => {
        // Take profit first in the DOM, then stop loss.
        expect(pressedStates(firstPaint(buildStore({ has_take_profit: true })))).toEqual(['true', 'false']);
        expect(pressedStates(firstPaint(buildStore({ has_stop_loss: true })))).toEqual(['false', 'true']);
    });
});
