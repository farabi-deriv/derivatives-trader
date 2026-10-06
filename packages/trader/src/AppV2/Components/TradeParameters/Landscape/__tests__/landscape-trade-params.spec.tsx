import { mockStore } from '@deriv/stores';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import ModulesProvider from 'Stores/Providers/modules-providers';

import TraderProviders from '../../../../../trader-providers';
import LandscapeTradeParams from '../landscape-trade-params';

jest.mock('AppV2/Components/PurchaseButton', () => {
    const MockPurchaseButton = () => <button data-testid='purchase-button'>Buy</button>;
    return { __esModule: true, default: () => <MockPurchaseButton /> };
});

const buildStore = ({
    is_landscape_chrome_hidden = false,
    has_take_profit = false,
    take_profit = 0,
    has_open_accu_contract = false,
} = {}) =>
    mockStore({
        client: { balance: '1000', currency: 'USD' },
        ui: { is_landscape_chrome_hidden },
        modules: {
            trade: {
                ...mockStore({}).modules.trade,
                is_accumulator: true,
                currency: 'USD',
                basis: 'stake',
                amount: 5,
                has_take_profit,
                take_profit,
                is_market_closed: false,
                has_open_accu_contract,
                validation_params: {
                    ACCU: { stake: { min: '1', max: '100' }, take_profit: { min: '1', max: '50' } },
                },
                onChange: jest.fn(),
                onChangeMultiple: jest.fn(),
            },
        },
    });

// jsdom has no PointerEvent, so fireEvent's pointer helpers silently drop the coordinates and every
// delta comes out NaN — which passes a `!== 0` check and makes a drag test look green without ever
// simulating travel. A MouseEvent carries clientX/clientY natively, and React reads them straight off
// the native event.
const pointer = (el: Element, type: string, coords: { clientX?: number; clientY?: number }) =>
    fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, ...coords }));

// `observer` wraps the pill in React.memo and the mock store is not observable, so a rerender only
// reaches it when a prop identity changes — a fresh callback each time does that.
const rerenderWith = (rerender: (ui: React.ReactElement) => void, store: ReturnType<typeof mockStore>) =>
    rerender(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <LandscapeTradeParams onOverlayOpenChange={() => undefined} />
            </ModulesProvider>
        </TraderProviders>
    );

const renderPill = (store: ReturnType<typeof mockStore>) =>
    render(
        <TraderProviders store={store}>
            <ModulesProvider store={store}>
                <LandscapeTradeParams />
            </ModulesProvider>
        </TraderProviders>
    );

describe('LandscapeTradeParams', () => {
    it('[LTP-001] renders the take-profit chip, the stake chip and Buy when chrome is visible', () => {
        renderPill(buildStore());

        expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
        expect(screen.getByTestId('purchase-button')).toBeInTheDocument();
    });

    it('[LTP-019] locks every param once an accumulator contract is open, as portrait and desktop do', () => {
        renderPill(buildStore({ has_open_accu_contract: true, has_take_profit: true, take_profit: 10 }));
        const chips = screen.getAllByRole('spinbutton');

        expect(chips).toHaveLength(2);
        chips.forEach(chip => {
            expect(chip).toHaveAttribute('aria-disabled', 'true');
            expect(chip).toHaveClass('landscape-params__chip--disabled');
        });
        // Buy is untouched: it becomes the Close button for the open contract.
        expect(screen.getByTestId('purchase-button')).toBeInTheDocument();
    });

    it('[LTP-001] collapses to one chip (stake) + Buy when chrome is hidden and take profit is off', () => {
        renderPill(buildStore({ is_landscape_chrome_hidden: true }));

        // Collapsed in place rather than unmounted, so it animates out.
        expect(screen.getByTestId('dt_landscape_chip_take_profit')).toHaveClass('landscape-params__chip--collapsed');
        expect(screen.getByTestId('dt_landscape_chip_stake')).not.toHaveClass('landscape-params__chip--collapsed');
        expect(screen.getByTestId('purchase-button')).toBeInTheDocument();
    });

    it('[LTP-001] shows take profit on the full pill', () => {
        renderPill(buildStore());

        expect(screen.getByTestId('dt_landscape_chip_take_profit')).not.toHaveClass(
            'landscape-params__chip--collapsed'
        );
    });

    it('[LTP-018] keeps an enabled take profit on the collapsed pill', () => {
        // A live contract term: collapsing must not drop the only readout of a value already set.
        renderPill(buildStore({ is_landscape_chrome_hidden: true, has_take_profit: true, take_profit: 10 }));

        expect(screen.getByTestId('dt_landscape_chip_take_profit')).not.toHaveClass(
            'landscape-params__chip--collapsed'
        );
    });

    it('[LTP-018] switching take profit off on the collapsed pill does not pull the chip out', () => {
        // Latched at collapse: the chip goes on the NEXT one, never under the finger.
        const store = buildStore({ is_landscape_chrome_hidden: true, has_take_profit: true, take_profit: 10 });
        const { rerender } = render(
            <TraderProviders store={store}>
                <ModulesProvider store={store}>
                    <LandscapeTradeParams onOverlayOpenChange={() => undefined} />
                </ModulesProvider>
            </TraderProviders>
        );

        store.modules.trade.has_take_profit = false;
        store.modules.trade.take_profit = 0;
        rerenderWith(rerender, store);

        expect(screen.getByTestId('dt_landscape_chip_take_profit')).not.toHaveClass(
            'landscape-params__chip--collapsed'
        );
    });

    it('[LTP-002] the glass panel is a sibling of the pill, not a descendant', () => {
        renderPill(buildStore());

        fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));

        const pill = screen.getByTestId('dt_landscape_params_pill');

        // The panel exists once open...
        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
        // ...but is NOT inside the pill (whose overflow: hidden would clip a nested panel).
        expect(within(pill).queryByTestId('dt_landscape_value_panel')).not.toBeInTheDocument();
    });

    it('[LTP-014] a tap on the param opens the panel', () => {
        renderPill(buildStore());

        expect(screen.queryByTestId('dt_landscape_value_panel')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));

        // The panel is the scrolling surface, so the tap has to put it on screen before there is
        // anything to scroll.
        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
    });

    it('[LTP-014] scrolling the panel steps the value', () => {
        renderPill(buildStore());

        const chip = screen.getByTestId('dt_landscape_chip_stake');
        fireEvent.click(chip);
        const before = chip.getAttribute('aria-valuenow');

        fireEvent.wheel(screen.getByTestId('dt_landscape_value_panel'), { deltaY: -300 });

        expect(chip.getAttribute('aria-valuenow')).not.toBe(before);
    });

    it('[LTP-012] the stake steps in quarters below $10, so the adapter must ask for the fine ladder', () => {
        renderPill(buildStore());

        const chip = screen.getByTestId('dt_landscape_chip_stake');
        fireEvent.keyDown(chip, { key: 'ArrowUp' });

        // $5.00 is the store's amount; one step up is a quarter, not a whole dollar.
        expect(chip).toHaveAttribute('aria-valuetext', '$5.25');
    });

    it('[LTP-014] dragging the panel steps the value', () => {
        renderPill(buildStore());

        const chip = screen.getByTestId('dt_landscape_chip_stake');
        fireEvent.click(chip);
        const before = chip.getAttribute('aria-valuenow');

        const panel = screen.getByTestId('dt_landscape_value_panel');
        pointer(panel, 'pointerdown', { clientY: 200 });
        pointer(panel, 'pointermove', { clientY: 128 });

        expect(chip.getAttribute('aria-valuenow')).not.toBe(before);
    });

    it('[LPD-007] dragging a chip slides the pill without touching the value', () => {
        renderPill(buildStore());

        const chip = screen.getByTestId('dt_landscape_chip_stake');
        const before = chip.getAttribute('aria-valuenow');

        // The chip is part of the drag surface: its events bubble to the pill, which handles the move.
        // The value belongs to the panel, so dragging here must leave it alone.
        pointer(chip, 'pointerdown', { clientX: 700, clientY: 300 });
        pointer(chip, 'pointermove', { clientX: 640, clientY: 228 });

        expect(chip).toHaveAttribute('aria-valuenow', before);
        expect(screen.getByTestId('dt_landscape_params')).toHaveStyle({ transform: 'translateX(-60px)' });
    });

    it('[LPD-008] the grip drags the pill, like the rest of it', () => {
        renderPill(buildStore());

        const grip = screen.getByTestId('dt_landscape_params_grip');
        const wrapper = screen.getByTestId('dt_landscape_params');

        pointer(grip, 'pointerdown', { clientX: 300, clientY: 300 });
        pointer(grip, 'pointermove', { clientX: 360, clientY: 300 });

        expect(wrapper).toHaveStyle({ transform: 'translateX(60px)' });
    });

    it('[LPD-007] dragging the pill chrome slides it without touching the value', () => {
        renderPill(buildStore());

        const pill = screen.getByTestId('dt_landscape_params_pill');
        const chip = screen.getByTestId('dt_landscape_chip_stake');
        const wrapper = screen.getByTestId('dt_landscape_params');
        const before = chip.getAttribute('aria-valuenow');

        pointer(pill, 'pointerdown', { clientX: 700, clientY: 300 });
        pointer(pill, 'pointermove', { clientX: 640, clientY: 300 });

        expect(wrapper).toHaveStyle({ transform: 'translateX(-60px)' });
        expect(chip).toHaveAttribute('aria-valuenow', before);
    });

    it('[LTP-013] tapping take profit opens its panel, even while off, without switching it on', () => {
        const store = buildStore();
        renderPill(store);

        fireEvent.click(screen.getByTestId('dt_landscape_chip_take_profit'));

        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
        expect(store.modules.trade.onChangeMultiple).not.toHaveBeenCalled();
    });

    it('[LTP-013] take profit switching on by itself does NOT open the panel', () => {
        const store = buildStore();
        const { rerender } = renderPill(store);

        // `has_take_profit` is a persisted tab trade param, so switching market tabs restores it. That
        // must not pop the panel open over the chart — only a tap may.
        store.modules.trade.has_take_profit = true;
        store.modules.trade.take_profit = 5;
        rerenderWith(rerender, store);

        expect(screen.queryByTestId('dt_landscape_value_panel')).not.toBeInTheDocument();
    });

    it('[LTP-013] switching take profit off keeps its panel open, since that is where the switch is', () => {
        const store = buildStore({ has_take_profit: true, take_profit: 5 });
        const { rerender } = renderPill(store);
        fireEvent.click(screen.getByTestId('dt_landscape_chip_take_profit'));

        store.modules.trade.has_take_profit = false;
        rerenderWith(rerender, store);

        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
    });

    it('[LTP-017] a press outside the pill closes the panel', () => {
        renderPill(buildStore());
        fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));
        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();

        pointer(document.body, 'pointerdown', { clientX: 20, clientY: 20 });

        expect(screen.queryByTestId('dt_landscape_value_panel')).not.toBeInTheDocument();
    });

    it('[LTP-017] a press on the panel itself leaves it open', () => {
        renderPill(buildStore());
        fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));

        // Starting a scroll must not dismiss what you are scrolling.
        pointer(screen.getByTestId('dt_landscape_value_panel'), 'pointerdown', { clientY: 200 });

        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
    });

    it('[LTP-017] a press on a chip leaves it open, so params can be switched', () => {
        renderPill(buildStore());
        fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));

        pointer(screen.getByTestId('dt_landscape_chip_take_profit'), 'pointerdown', { clientY: 200 });

        expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
    });

    it('[LTP-015] lifting and re-touching mid-edit keeps the panel open and the draft value', () => {
        renderPill(buildStore());

        const chip = screen.getByTestId('dt_landscape_chip_stake');
        fireEvent.click(chip);
        const panel = screen.getByTestId('dt_landscape_value_panel');

        // First drag on the panel: three steps up from the opening index.
        pointer(panel, 'pointerdown', { clientY: 200 });
        pointer(panel, 'pointermove', { clientY: 128 });
        pointer(panel, 'pointerup', { clientY: 128 });

        const value_after_first_drag = chip.getAttribute('aria-valuenow');

        // Re-press to continue the same edit. Re-running open() here blanked the panel and re-seeded the
        // draft from the store, which the settle's proposal has not written back yet.
        pointer(panel, 'pointerdown', { clientY: 128 });

        expect(screen.getByTestId('dt_landscape_value_panel')).toBe(panel);
        expect(chip).toHaveAttribute('aria-valuenow', value_after_first_drag);
    });

    it('[LTP-015] a slow drag that has not stepped for the idle window keeps the panel open', () => {
        jest.useFakeTimers();
        try {
            renderPill(buildStore());

            fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));
            const panel = screen.getByTestId('dt_landscape_value_panel');
            pointer(panel, 'pointerdown', { clientY: 200 });
            pointer(panel, 'pointermove', { clientY: 176 });

            // Finger still down, but travelling slower than one step per idle window. The countdown
            // measures the gap between gestures, so it must not run while this one is live.
            act(() => jest.advanceTimersByTime(5000));

            expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it('[LTP-015] the panel closes once the gesture ends and the idle window passes', () => {
        jest.useFakeTimers();
        try {
            renderPill(buildStore());

            fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));
            const panel = screen.getByTestId('dt_landscape_value_panel');
            pointer(panel, 'pointerdown', { clientY: 200 });
            pointer(panel, 'pointermove', { clientY: 176 });
            pointer(panel, 'pointerup', { clientY: 176 });

            expect(screen.getByTestId('dt_landscape_value_panel')).toBeInTheDocument();
            // Long enough for the flick's coast to run down and the idle window to pass after it —
            // synthetic events land in the same tick, so every drag here releases at full speed.
            act(() => jest.advanceTimersByTime(6000));

            expect(screen.queryByTestId('dt_landscape_value_panel')).not.toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it('[LTP-015] a tap ends the gesture, so the param does not stay active forever', () => {
        jest.useFakeTimers();
        const onOverlayOpenChange = jest.fn();
        try {
            const store = buildStore();
            render(
                <TraderProviders store={store}>
                    <ModulesProvider store={store}>
                        <LandscapeTradeParams onOverlayOpenChange={onOverlayOpenChange} />
                    </ModulesProvider>
                </TraderProviders>
            );

            fireEvent.click(screen.getByTestId('dt_landscape_chip_stake'));
            const panel = screen.getByTestId('dt_landscape_value_panel');
            pointer(panel, 'pointerdown', { clientY: 200 });
            pointer(panel, 'pointerup', { clientY: 200 });

            expect(onOverlayOpenChange).toHaveBeenLastCalledWith(true);
            // Without a tap on the panel arming the idle timer the param would stay active, pinning
            // the chrome auto-hide paused for good.
            act(() => jest.advanceTimersByTime(2000));

            expect(onOverlayOpenChange).toHaveBeenLastCalledWith(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
