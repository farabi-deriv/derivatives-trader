import { routes, TRADE_TYPES } from '@deriv/shared';

import {
    checkIsServiceModalError,
    getChartHeight,
    getErrorSnackbarBottomOffset,
    HEIGHT,
    isTradeParamVisible,
} from '../layout-utils';

describe('isTradeParamVisible', () => {
    it('should return correct value for expiration component key', () => {
        const common_args = {
            component_key: 'expiration',
            contract_type: TRADE_TYPES.MULTIPLIER,
            has_cancellation: false,
            symbol: 'cryBTCUSD',
        };
        expect(
            isTradeParamVisible({
                ...common_args,
            })
        ).toEqual(true);
        expect(
            isTradeParamVisible({
                ...common_args,
                symbol: '1HZ100V',
            })
        ).toEqual(false);
        expect(
            isTradeParamVisible({
                ...common_args,
                contract_type: TRADE_TYPES.ACCUMULATOR,
            })
        ).toEqual(false);
    });

    it('should return correct value for mult_info_display component key', () => {
        const common_args = {
            component_key: 'mult_info_display',
            contract_type: TRADE_TYPES.MULTIPLIER,
            has_cancellation: true,
            symbol: '1HZ100V',
        };
        expect(
            isTradeParamVisible({
                ...common_args,
            })
        ).toEqual(true);
        expect(
            isTradeParamVisible({
                ...common_args,
                has_cancellation: false,
            })
        ).toEqual(false);
    });
    it('should return false if there is no such contract type or component_key', () => {
        const common_args = {
            component_key: 'barrier',
            contract_type: TRADE_TYPES.HIGH_LOW,
            has_cancellation: false,
            symbol: '1HZ150V',
        };
        expect(
            isTradeParamVisible({
                ...common_args,
                component_key: 'mock_component_key',
            })
        ).toEqual(false);
        expect(
            isTradeParamVisible({
                ...common_args,
                contract_type: 'mock_contract_type',
            })
        ).toEqual(false);
    });
});

describe('getChartHeight', () => {
    const original_height = window.innerHeight;

    beforeAll(() => (window.innerHeight = 740));
    afterAll(() => (window.innerHeight = original_height));

    it('should return correct chart height', () => {
        const common_args = {
            contract_type: TRADE_TYPES.MATCH_DIFF,
            has_cancellation: false,
            is_accumulator: false,
            symbol: '1HZ100V',
        };
        // window.innerHeight (740) - HEADER (56) - MARKET_SELECTOR (72) - TRADE_PARAM_SHEET (158) - BOTTOM_NAV (56) = 398
        // MATCH_DIFF is a digit type, so subtract DIGIT_INFO (46): 398 - 46 = 352
        // MATCH_DIFF has trade_type_tabs, so subtract TRADE_TYPE_TAB (48): 352 - 48 = 304
        const default_chart_height = 304;
        // base (398) - CHART_STATS (44) = 354 (ACCUMULATOR has no trade_type_tabs)
        const accumulators_chart_height = 354;
        // base (398) - TRADE_TYPE_TAB (48) = 350. The below-params info rows are dropped on
        // responsive, so they no longer reduce the chart height.
        const chart_height_with_trade_type_tabs = 350;

        expect(
            getChartHeight({
                ...common_args,
            })
        ).toEqual(default_chart_height);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.ACCUMULATOR,
                is_accumulator: true,
            })
        ).toEqual(accumulators_chart_height);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.MULTIPLIER,
                has_cancellation: true,
            })
        ).toEqual(chart_height_with_trade_type_tabs);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.MULTIPLIER,
                symbol: 'cryBTCUSD',
            })
        ).toEqual(chart_height_with_trade_type_tabs);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.VANILLA.CALL,
            })
        ).toEqual(chart_height_with_trade_type_tabs);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.RISE_FALL,
            })
        ).toEqual(chart_height_with_trade_type_tabs);
        expect(
            getChartHeight({
                ...common_args,
                contract_type: TRADE_TYPES.HIGH_LOW,
            })
        ).toEqual(chart_height_with_trade_type_tabs);
    });

    it('reclaims the market-selector and bottom-nav space when maximized', () => {
        const common_args = {
            contract_type: TRADE_TYPES.RISE_FALL,
            has_cancellation: false,
            is_accumulator: false,
            symbol: '1HZ100V',
        };
        // Non-maximized RISE_FALL: base (386) - TRADE_TYPE_TAB (48) = 338
        const default_height = getChartHeight(common_args);
        // Maximized reclaims MARKET_SELECTOR (72) + BOTTOM_NAV (56) = +128
        expect(getChartHeight({ ...common_args, is_maximized: true })).toEqual(default_height + 72 + 56);
    });
});

describe('getErrorSnackbarBottomOffset', () => {
    it('clears the bottom nav and the Buy button on the trade page', () => {
        const offset = getErrorSnackbarBottomOffset({ pathname: routes.index, is_logged_in: true });

        expect(offset).toBe('112px');
        expect(parseInt(offset)).toBeGreaterThanOrEqual(HEIGHT.BOTTOM_NAV + HEIGHT.PURCHASE_BUTTON);
    });

    it('drops the bottom-nav allowance when the chart is maximized (the sheet sits at the screen edge)', () => {
        const offset = getErrorSnackbarBottomOffset({
            pathname: routes.index,
            is_logged_in: true,
            is_chart_maximized: true,
        });

        expect(offset).toBe('56px');
        expect(parseInt(offset)).toBeGreaterThanOrEqual(HEIGHT.PURCHASE_BUTTON);
        expect(parseInt(offset)).toBeLessThan(HEIGHT.BOTTOM_NAV + HEIGHT.PURCHASE_BUTTON);
    });

    it('clears the bottom nav and the Buy button on the logged-out trade page too', () => {
        // The bottom nav renders for every mobile visitor (AppContent) and the params sheet keeps
        // its `bottom: HEIGHT.BOTTOM_NAV` logged out, so the clearance is identical to logged in.
        const offset = getErrorSnackbarBottomOffset({ pathname: routes.index, is_logged_in: false });

        expect(offset).toBe('112px');
        expect(parseInt(offset)).toBeGreaterThanOrEqual(HEIGHT.BOTTOM_NAV + HEIGHT.PURCHASE_BUTTON);
    });

    it('drops only the bottom-nav allowance when logged out and the chart is maximized', () => {
        expect(
            getErrorSnackbarBottomOffset({
                pathname: routes.index,
                is_logged_in: false,
                is_chart_maximized: true,
            })
        ).toBe('56px');
    });

    it('applies the same offset on the automate page', () => {
        expect(getErrorSnackbarBottomOffset({ pathname: routes.trader_automate, is_logged_in: true })).toEqual(
            getErrorSnackbarBottomOffset({ pathname: routes.index, is_logged_in: true })
        );
    });

    it('keeps the contract-details offset above a cancellable multiplier’s action', () => {
        expect(
            getErrorSnackbarBottomOffset({
                pathname: '/contract/12345',
                is_logged_in: true,
                is_cancellable_multiplier: true,
            })
        ).toBe('104px');
    });

    it('falls back to the default offsets everywhere else', () => {
        expect(getErrorSnackbarBottomOffset({ pathname: routes.trader_positions, is_logged_in: true })).toBe('48px');
        expect(getErrorSnackbarBottomOffset({ pathname: routes.trader_positions, is_logged_in: false })).toBe('-8px');
    });
});

describe('checkIsServiceModalError', () => {
    it('returns false if services_error is empty object', () => {
        expect(checkIsServiceModalError({ services_error: {} })).toBe(false);
    });
    it('returns true if services_error has appropriate code', () => {
        expect(checkIsServiceModalError({ services_error: { code: 'InsufficientBalance' } })).toBe(true);
    });
    it('returns true if services_error code is AuthorizationRequired and type is buy', () => {
        expect(checkIsServiceModalError({ services_error: { code: 'AuthorizationRequired', type: 'buy' } })).toBe(true);
    });
});
