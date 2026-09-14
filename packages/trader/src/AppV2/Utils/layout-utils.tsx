import { routes } from '@deriv/shared';
import { TCommonStoreServicesError } from '@deriv/stores/types';

import { isDigitTradeType } from 'AppV2/Utils/digits';

import { getTradeParams } from './trade-params-utils';

export const HEIGHT = {
    HEADER: 56,
    TRADE_TYPE_TAB: 48,
    MARKET_SELECTOR: 72,
    CHART_STATS: 44,
    // 8px top padding + params row (72) + Buy button block (72), plus the sheet's border. The
    // sheet has no expand/collapse handle, so this is its only height.
    TRADE_PARAM_SHEET: 158,
    DIGIT_INFO: 46,
    BOTTOM_NAV: 56,
    // The Buy button itself, inset 12px inside the 72px Buy-button block already counted in
    // TRADE_PARAM_SHEET above. Error snackbars clear the *button* rather than the whole block:
    // clearing the block leaves the toast floating a row higher, which reads as detached from the
    // action it is about.
    PURCHASE_BUTTON: 48,
};

// Duration (ms) of the mobile chart maximize/minimize transition. The JS timer that disarms the
// chart-height transition (see trade-mobile.tsx) MUST match the `0.3s` CSS transitions on the
// collapsing chrome (trade.scss `.trade__chart--maximize-animating`, compact-header/header/bottom-nav);
// if they drift, the chart snaps mid-animation.
export const CHART_MAXIMIZE_ANIMATION_MS = 300;

export const isTradeParamVisible = ({
    component_key,
    contract_type,
    has_cancellation,
    symbol,
}: {
    component_key: string;
    contract_type: string;
    has_cancellation: boolean;
    symbol: string;
}) => {
    const params = getTradeParams(symbol, has_cancellation)?.[contract_type] ?? {};
    return component_key in params;
};

export const getChartHeight = ({
    contract_type,
    has_cancellation,
    is_accumulator,
    is_maximized = false,
    symbol,
}: {
    contract_type: string;
    has_cancellation: boolean;
    is_accumulator: boolean;
    /** Mobile chart-maximize mode: the market strip and bottom-nav collapse, so the chart
     * reclaims their height. The header stays (swapped for the equal-height compact header). */
    is_maximized?: boolean;
    symbol: string;
}) => {
    let height =
        window.innerHeight - HEIGHT.HEADER - HEIGHT.MARKET_SELECTOR - HEIGHT.TRADE_PARAM_SHEET - HEIGHT.BOTTOM_NAV;

    // Reclaim the collapsed market strip + bottom-nav space when maximized.
    if (is_maximized) {
        height += HEIGHT.MARKET_SELECTOR + HEIGHT.BOTTOM_NAV;
    }

    const isVisible = (component_key: string) =>
        isTradeParamVisible({ component_key, symbol, has_cancellation, contract_type });

    if (is_accumulator) {
        height -= HEIGHT.CHART_STATS;
    }

    if (isDigitTradeType(contract_type)) {
        height -= HEIGHT.DIGIT_INFO;
    }

    if (isVisible('trade_type_tabs')) {
        height -= HEIGHT.TRADE_TYPE_TAB;
    }

    return height;
};

// quill-ui's Snackbar arms its auto-dismiss timer only when status is 'neutral', there is no
// close button, or an explicit delay is passed. Error snackbars ('fail' + close button) must
// therefore always pass this delay, otherwise they persist until manually dismissed.
export const ERROR_SNACKBAR_DURATION = 4000;

// Breathing room between an error snackbar and the block it clears — the same 8px the trade-params
// sheet uses as its own top padding (`--core-spacing-400`, trade-parameters.scss).
const ERROR_SNACKBAR_GAP = 8;

/**
 * Bottom offset (a CSS length) for an error snackbar. The snackbars are portalled to
 * `document.body`, so each `addSnackbar` call positions itself via `style.marginBottom`.
 *
 * On the Trade and Automate pages the toast has to clear the purchase block as well as the bottom
 * nav, or it lands squarely on the Buy button — the page's primary action — and swallows taps. The
 * trade-params sheet is fixed at `bottom: HEIGHT.BOTTOM_NAV` and drops to the screen edge when the
 * chart is maximized (trade-parameters.scss), so the bottom-nav allowance follows that — and only
 * that. Auth state does not move either block: `AppContent` renders `BottomNav` for every mobile
 * visitor, and the sheet (with its Buy button) is rendered logged out too, so the logged-out trade
 * page needs exactly the same clearance. `is_logged_in` only picks the off-trade-page fallback.
 */
export const getErrorSnackbarBottomOffset = ({
    pathname,
    is_logged_in = true,
    is_chart_maximized = false,
    is_cancellable_multiplier = false,
}: {
    pathname: string;
    /** Only consulted off the trade/automate pages, so the trade-page callers omit it. */
    is_logged_in?: boolean;
    is_chart_maximized?: boolean;
    is_cancellable_multiplier?: boolean;
}) => {
    if (pathname === routes.index || pathname === routes.trader_automate) {
        const clears_bottom_nav = !is_chart_maximized;
        return `${HEIGHT.PURCHASE_BUTTON + ERROR_SNACKBAR_GAP + (clears_bottom_nav ? HEIGHT.BOTTOM_NAV : 0)}px`;
    }
    if (!is_logged_in) return '-8px';
    // Contract details for a cancellable multiplier: clear the Cancel action below the toast.
    if (is_cancellable_multiplier && pathname.startsWith(routes.contract.replace('/:contract_id', ''))) {
        return '104px';
    }
    return '48px';
};

export const SERVICE_ERROR = {
    INSUFFICIENT_BALANCE: 'InsufficientBalance',
    INVALID_CONTRACT_PROPOSAL: 'InvalidContractProposal',
    AUTHORIZATION_REQUIRED: 'AuthorizationRequired',
    COMPANY_WIDE_LIMIT_EXCEEDED: 'CompanyWideLimitExceeded',
};

export const checkIsServiceModalError = ({ services_error }: { services_error: TCommonStoreServicesError }) => {
    const { code, type } = services_error || {};
    // Error modal is shown only for next four types. For the rest - snackbar.
    const is_insufficient_balance = code === SERVICE_ERROR.INSUFFICIENT_BALANCE;
    const is_authorization_required = code === SERVICE_ERROR.AUTHORIZATION_REQUIRED && type === 'buy';
    return is_insufficient_balance || is_authorization_required;
};
