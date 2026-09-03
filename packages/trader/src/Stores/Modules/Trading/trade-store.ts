import debounce from 'lodash.debounce';
import { action, computed, makeObservable, observable, override, reaction, runInAction, toJS, when } from 'mobx';

import {
    TActiveSymbolsRequest,
    TActiveSymbolsResponse,
    TBuyContractRequest,
    TBuyContractResponse,
    TPriceProposalRequest,
    TPriceProposalResponse,
    TServerTimeRequest,
    TTicksHistoryRequest,
    TTicksHistoryResponse,
    TTicksStreamResponse,
    TTradingTimesRequest,
} from '@deriv/api';
import {
    BARRIER_COLORS,
    ChartBarrierStore,
    cloneObject,
    CONTRACT_TYPES,
    convertDurationLimit,
    type Dayjs,
    extractInfoFromShortcode,
    findFirstOpenMarket,
    findSymbolForTradeType,
    formatMoney,
    getBarrierPipSize,
    getCardLabelsV2,
    getContractPath,
    getContractSubtype,
    getContractTypesConfig,
    getCurrencyDisplayCode,
    getExpiryType,
    getMarketName,
    getMinPayout,
    getPropertyValue,
    getTradeNotificationMessage,
    getTradeTypeName,
    getTradeURLParams,
    hasBarrier,
    hasIntradayDurationUnit,
    toMoment,
    isAccumulatorContract,
    isBarrierSupported,
    isCryptocurrency,
    isEmptyObject,
    isHighLow,
    isMarketClosed,
    isMultiplierContract,
    isTouchContract,
    isTurbosContract,
    isVanillaContract,
    isVanillaFxContract,
    mapErrorMessage,
    pickDefaultSymbol,
    resetEndTimeOnVolatilityIndices,
    routes,
    setLimitOrderBarriers,
    setTradeURLParams,
    trackAnalyticsEvent,
    TRADE_TYPES,
    WS,
} from '@deriv/shared';
import { safeParse } from '@deriv/utils';
import { localize } from '@deriv-com/translations';

import { TRADE_PANEL_TABS, type TTradePanelTab } from 'AppV2/Components/AutomationPanel/automation-config';
import { checkContractTypePrefix } from 'AppV2/Utils/contract-type';
import { isDigitContractType, isDigitTradeType } from 'AppV2/Utils/digits';
import {
    addToOpenMarkets,
    isSameMarket,
    isSameOpenMarketList,
    readOpenMarkets,
    removeFromOpenMarkets,
    replaceInOpenMarkets,
    type TOpenMarket,
    writeOpenMarkets,
} from 'AppV2/Utils/open-markets-utils';
import { isMultiplierOnlySymbol } from 'AppV2/Utils/symbol-categories-utils';
import { getDisplayedContractTypes } from 'AppV2/Utils/trade-types-utils';
import {
    mapContractTypeToDurationPresetKey,
    mapContractTypeToStakePresetKey,
} from 'AppV2/Utils/trade-params-preset-utils';
import {
    getDefaultDuration,
    getInitialTradeTypeTab,
    getDerivedDefaultStake,
    isValidPersistedDuration,
} from 'AppV2/Utils/trade-params-utils';
import { getMultiplierValidationRules, getValidationRules } from 'Stores/Modules/Trading/Constants/validation-rules';
import { ContractType } from 'Stores/Modules/Trading/Helpers/contract-type';
import { TContractTypesList, TRootStore, TTextValueNumber, TTextValueStrings } from 'Types';

import BaseStore from '../../base-store';

import { processPurchase } from './Actions/purchase';
import { getUpdatedTicksHistoryStats } from './Helpers/accumulator';
import { getChartAnalyticsData, STATE_TYPES, TPayload } from './Helpers/chart';
import { processTradeParams } from './Helpers/process';
import {
    createProposalRequests,
    getProposalErrorField,
    getProposalInfo,
    getStakeLimitsFromResponse,
    hasResolvableExpiry,
} from './Helpers/proposal';

import ServerTime from '_common/base/server_time';

type TBarriers = Array<
    ChartBarrierStore & {
        hideOffscreenBarrier?: boolean;
        isSingleBarrier?: boolean;
    }
>;

// Constants for barrier and duration defaults
const BARRIER_DEFAULTS = {
    /** Default offset added to current spot price for absolute barriers (e.g., forex) */
    ABSOLUTE_BARRIER_OFFSET: 0.0001,
    /** Default absolute barrier value when no spot price is available */
    FALLBACK_ABSOLUTE_BARRIER: '1.0000',
    /** Default relative barrier value for synthetic indices */
    DEFAULT_RELATIVE_BARRIER: '+0.1',
    /** Default decimal places for absolute barrier formatting */
    ABSOLUTE_BARRIER_DECIMAL_PLACES: 5,
} as const;

type BarrierSupportType = 'relative' | 'absolute';
type DurationSupportType = 'ticks' | 'endtime';

// Local type definitions for compatibility
type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;
type TickSpotData = NonNullable<TTicksStreamResponse['tick']>;
type History = NonNullable<TTicksHistoryResponse['history']>;

export type TProposalResponse = TPriceProposalResponse & {
    proposal: TPriceProposalResponse['proposal'];
    error?: TPriceProposalResponse['error'] & {
        code: string;
        message: string;
        details?: {
            payout_per_point_choices?: number[];
            barrier_choices?: string[];
            [k: string]: unknown;
        };
    };
};

export type TChartLayout = {
    adj: boolean;
    aggregationType: string;
    animation?: boolean;
    candleWidth: number;
    chartScale: string;
    chartType: string;
    crosshair: number;
    extended: boolean;
    flipped: boolean;
    interval: number;
    marketSessions: Partial<Record<string, boolean>>;
    outliers: boolean;
    panels: {
        chart: {
            chartName: string;
            display: string;
            index: number;
            percent: number;
            yAxis: {
                name: string;
                position: null;
            };
            yaxisLHS: string[];
            yaxisRHS: string[];
        };
    };
    periodicity: number;
    previousMaxTicks?: number;
    range: Partial<Record<string, unknown>>;
    setSpan: Partial<Record<string, unknown>>;
    studies?: Partial<Record<string, unknown>>;
    symbols: [
        {
            interval: number;
            periodicity: number;
            setSpan: Partial<Record<string, unknown>>;
            symbol: string;
            symbolObject: ActiveSymbols[number];
            timeUnit: string;
        },
    ];
    timeUnit: string;
    volumeUnderlay: boolean;
};
export type TChartStateChangeOption = {
    indicator_type_name?: string;
    indicators_category_name?: string;
    isClosed?: boolean;
    is_favorite?: boolean;
    is_info_open?: boolean;
    is_open?: boolean;
    chart_type_name?: string;
    granularity?: number;
    search_string?: string;
    symbol?: string;
    symbol_category?: string;
    time_interval_name?: string;
};
export type TV2ParamsInitialValues = {
    growth_rate?: number;
    strike?: string | number;
    multiplier?: number;
    barrier_1?: number;
    payout_per_point?: string;
};
type TContractDataForGTM = Omit<Partial<TPriceProposalRequest>, 'cancellation' | 'limit_order'> &
    ReturnType<typeof getProposalInfo> & {
        buy_price: number;
    };
type TPrevChartLayout =
    | (TChartLayout & {
          isDone?: VoidFunction;
          is_used?: boolean;
      })
    | null;

type TDurationMinMax = {
    [key: string]: { min: number; max: number };
};
type TResponse<Req, Res extends { [key: string]: unknown }, K extends string> = Res & {
    echo_req: Req;
    error?: {
        code: string;
        message: string;
        details?: Res[K] & { field: string; payout_per_point_choices?: number[] };
    };
};
type TProposalInfo = {
    [key: string]: ReturnType<typeof getProposalInfo>;
};
type TStakeBoundary = Record<
    string,
    {
        min_stake?: number;
        max_stake?: number;
    }
>;
type TTicksResponse = TTicksHistoryResponse | TTicksStreamResponse;
type TBarriersData = Record<string, never> | { barrier: string; barrier_choices?: string[] };
type TValidationParams = ReturnType<typeof getProposalInfo>['validation_params'];

const store_name = 'trade_store';
const g_subscribers_map: Partial<Record<string, ReturnType<typeof WS.subscribeTicksHistory>>> = {}; // blame amin.m

/**
 * How long a purchase attempt may wait for a usable proposal before giving up. Needed because the
 * wait's predicate requires proposal_info to be populated, and requestProposal has early returns
 * (market closed, awaiting contracts_for, validation errors) that leave it empty indefinitely —
 * without a bound the wait never settles and is_purchase_pending strands the Buy button spinning.
 */
const PROPOSAL_WAIT_TIMEOUT = 10000;
/** mobx rejects a timed-out `when` with this message. */
const WHEN_TIMEOUT = 'WHEN_TIMEOUT';

// Validates the persisted tab value — a plain `as` cast would let any
// stale/tampered localStorage value through and hide both the purchase
// button and the automation actions.
const getInitialTradePanelTab = (): TTradePanelTab => {
    const stored = localStorage.getItem('active_trade_panel_tab');
    const valid_values = Object.values(TRADE_PANEL_TABS) as readonly string[];
    return valid_values.includes(stored ?? '') ? (stored as TTradePanelTab) : TRADE_PANEL_TABS.TRADE;
};

export default class TradeStore extends BaseStore {
    // Control values
    is_trade_component_mounted = false;
    is_purchase_enabled = false;
    is_trade_enabled = false;
    is_trade_enabled_v2 = false;
    is_equal = 0;
    has_equals_only = false;

    // Underlying
    symbol = '';
    is_market_closed = false;
    active_symbols: ActiveSymbols = [];
    has_symbols_for_v2 = false;

    // Open market "tabs" for the AppV2 Trade strip, identified by the (symbol, contract_type) pair.
    // Recorded here (not derived from symbol/contract_type) so the strip reflects explicit user
    // commits, immune to the transient symbol-first/contract_type-swap churn during a selection.
    // Manual and automated trading keep INDEPENDENT collections (each capped separately) — switching
    // modes swaps which one the `open_markets` getter exposes without disturbing the other. Read the
    // active one via `open_markets`; mutate it via add/remove/replaceOpenMarket.
    open_markets_manual: TOpenMarket[] = readOpenMarkets('manual');
    open_markets_automation: TOpenMarket[] = readOpenMarkets('automation');
    // Trade types automation supports (resolved from server strategies, set by the automation tab
    // strip once loaded). While non-empty AND in automation mode, `setActiveOpenMarkets` filters the
    // automation collection to these — a true add-time guard so an unsupported pair can never enter
    // or persist in the strip.
    // Plain field (not observable): read at write time, no reactivity needed. Empty = not loaded yet
    // (filtering is off until then).
    automation_supported_trade_types: Set<string> = new Set();
    // Per-mode memory of the last active (symbol, contract_type). The store keeps a single active
    // symbol/contract_type. On switch we snapshot the mode we leave and
    // restore the mode we enter to its own market. Session-only (not persisted).
    active_market_manual: TOpenMarket | null = null;
    active_market_automation: TOpenMarket | null = null;
    // The tab a long-press is about to replace: while set, the next `selectMarketAndTradeType` swaps
    // this tab in place instead of appending a new one. Transient (not observable/persisted).
    replacing_market: TOpenMarket | null = null;
    // Count of in-flight market/trade-type commit cascades (see `is_selecting_market`). A counter,
    // not a boolean: commits can overlap (rapid tab clicks, un-awaited mode reconcile), and a boolean
    // would drop the guard when the FIRST cascade finished while a second was still mid-flight.
    selecting_market_depth = 0;
    // Monotonic id of the most recent market/trade-type selection intent (user click, URL reconcile,
    // mode reconcile). Async selection flows capture it at start and abort their remaining writes if
    // a newer intent has started — latest intent always wins, so two overlapping cascades can never
    // interleave into a hybrid {symbol from one, trade type from another} state. Deliberately NOT
    // observable: it's read imperatively inside the flows, never rendered.
    private selection_seq = 0;

    form_components: string[] = [];

    // Contract Type
    // Derived, never stored: which expiry bucket (tick/intraday/daily) the current selection falls
    // into, i.e. which `contracts_for` entry applies. It was an observable written by a reaction,
    // so it lagged whatever changed it last — reading a bucket the incoming trade type does not
    // offer is what sent a proposal with the digit default as its barrier.
    get contract_expiry_type() {
        if (!this.root_store?.common) return '';
        return getExpiryType(this) || '';
    }
    contract_type = '';
    prev_contract_type = '';
    contract_types_list: TContractTypesList = {};
    non_available_contract_types_list: TContractTypesList = {};
    trade_type_tab = '';
    trade_types: { [key: string]: string } = {};
    active_trade_panel_tab: TTradePanelTab = getInitialTradePanelTab();
    // Drives the MarketTabs market/trade-types selector open state. Lifted to the store so the
    // onboarding tour can open/close it programmatically for the "Trade types and markets" step.
    is_market_selector_open = false;
    // Mobile /automate route toggles this so shared trade params can tell they're
    // rendered in the automation view (desktop uses `is_automation_tab` instead).
    is_automation_page = false;
    contract_types_list_v2: TContractTypesList = {};

    // Amount
    amount = 2;
    basis = '';
    basis_list: Array<TTextValueStrings> = [];
    currency = '';
    default_stake: number | undefined;
    // Stake bands from pricing responses, keyed `${symbol}:${contract_type}` — per sub-type
    // (separate minimums) and per market (tabs must not overwrite each other). Never cleared;
    // provenance comes from probed_stake_keys.
    stake_boundary: Partial<TStakeBoundary> = {};
    // Keys whose own proposal reported a band. Doubles as the once-per-key probe fence: after it,
    // a stake set on that key is the user's. A set, so one tab cannot un-fence another.
    probed_stake_keys = new Set<string>();

    // Duration
    duration = 5;
    duration_min_max: TDurationMinMax = {};
    duration_unit = '';
    duration_units_list: Array<TTextValueStrings> = [];
    // Trade-type group key (mapContractTypeToDurationPresetKey) the default duration was last applied
    // for. Grouped so Up/Down sub-toggles (turboslong/turbosshort) don't reset it. Not observable/
    // persisted: resets to '' on load so the default re-applies on a fresh session.
    expiry_date: string | null = '';
    expiry_epoch: number | string = '';
    expiry_time: string | null = '';
    expiry_type: string | null = 'duration';
    saved_expiry_date_v2: string = '';
    unsaved_expiry_date_v2: string = '';

    // Barrier
    barrier = '';
    barrier_1 = '';
    barrier_2 = '';
    barrier_count = 0;
    main_barrier: ChartBarrierStore | null = null;
    barriers: TBarriers = [];
    barrier_choices: string[] = [];
    payout_choices: string[] = [];
    // Start Time
    start_date = 0; // 0 refers to 'now'
    start_dates_list: Array<{ text: string; value: number }> = [];
    start_time: string | null = null;
    sessions: Array<{ open: Dayjs; close: Dayjs }> = [];

    market_open_times: string[] = [];
    // End Date Time
    /**
     * An array that contains market closing time.
     *
     * e.g. ["04:00:00", "08:00:00"]
     *
     */
    market_close_times: string[] = [];
    validation_params: {
        [key: string]: TValidationParams | Record<string, never>;
    } = {};

    // Last Digit
    digit_stats: number[] = [];
    last_digit = 5;
    is_mobile_digit_view_selected = false;
    tick_data: TickSpotData | null = null;

    // Purchase
    proposal_info: TProposalInfo = {};
    purchase_info: Partial<TBuyContractResponse> = {};

    // Chart loader observables
    is_chart_loading?: boolean;
    should_show_active_symbols_loading = false;

    // Accumulator trade params
    accumulator_range_list: number[] = [];
    growth_rate = 0.03;
    maximum_payout = 0;
    maximum_ticks = 0;
    ticks_history_stats: {
        ticks_stayed_in?: number[];
        last_tick_epoch?: number;
    } = {};
    tick_size_barrier_percentage = '';

    // Multiplier trade params
    multiplier = 0;
    multiplier_range_list: TTextValueNumber[] = [];
    stop_loss?: string;
    take_profit?: string;
    has_stop_loss = false;
    has_take_profit = false;
    has_cancellation = false;
    open_payout_wheelpicker = false;
    cancellation_price?: number;
    stop_out?: number;
    stop_out_level?: string;
    expiration?: number;
    hovered_contract_type?: string | null;
    cancellation_duration = '60m';
    cancellation_range_list: Array<TTextValueStrings> = [];
    cached_multiplier_cancellation_list: Array<TTextValueStrings> = [];
    ref: React.RefObject<{
        hasPredictionIndicators(): void;
        triggerPopup(arg: () => void): void;
    }> | null = null;
    // Turbos trade params
    long_barriers: TBarriersData = {};
    short_barriers: TBarriersData = {};
    payout_per_point = '';

    // Vanilla trade params
    strike_price_choices: TBarriersData = {};

    // Mobile
    is_trade_params_expanded = true;
    v2_params_initial_values: TV2ParamsInitialValues = {};

    debouncedSetChartStatus = debounce((status: boolean) => {
        runInAction(() => {
            this.is_chart_loading = status;
            this.root_store.ui.setIsChartLoading(status);
        });
    }); // no time is needed here, the only goal is to put the call into macrotasks queue
    debouncedProposal = debounce(this.requestProposal, 500);
    proposal_requests: Record<string, Partial<TPriceProposalRequest>> = {};
    /** A buy request is in flight. Suppresses the proposal-driven re-enable of the Buy button. */
    is_purchasing_contract = false;
    /**
     * A purchase attempt is underway, from the click until it either reaches the server and
     * settles or is abandoned. Wider than `is_purchasing_contract`, which starts only once a buy
     * is actually sent — the wait for a usable proposal happens before that. Drives the Buy
     * button's loading state, so every exit path must clear it.
     */
    is_purchase_pending = false;
    // V2: hold proposals until the current symbol's contracts_for values are applied —
    // an earlier proposal carries the previous symbol's params and errors. Armed on load
    // and on every symbol change; released by processContractsForV2 or on fetch failure.
    is_awaiting_contracts_for = true;
    // Trade type applied from the URL's trade_type param, recorded only when the market offers it.
    // Set atomically with contract_type so consumers can tell a URL landing from manual navigation.
    url_trade_type: string | null = null;
    // True while reconcileUrlTradeTypeWithSymbol is switching the market to honour a URL trade type
    // the persisted market didn't offer. Keeps the trade page's full-screen loader up so the user
    // doesn't briefly see the stale market + wrong trade type before the switch completes.
    is_reconciling_url_trade_type = false;

    initial_barriers?: { barrier_1: string; barrier_2: string };
    is_initial_barrier_applied = false;
    is_digits_widget_active = false;
    should_skip_prepost_lifecycle = false;
    reconnectHandler?: () => Promise<void>;
    constructor({ root_store }: { root_store: TRootStore }) {
        const local_storage_properties = [
            'amount',
            'currency',
            'barrier_1',
            'barrier_2',
            'basis',
            'duration',
            'duration_unit',
            'expiry_date',
            'expiry_type',
            'growth_rate',
            'has_take_profit',
            'has_stop_loss',
            'has_cancellation',
            'short_barriers',
            'long_barriers',
            'strike_price_choices',
            'is_equal',
            'last_digit',
            'multiplier',
            'start_date',
            'start_time',
            'stop_loss',
            'take_profit',
            'is_trade_params_expanded',
            'v2_params_initial_values',
        ];
        const session_storage_properties = ['contract_type', 'symbol'];

        super({
            root_store,
            local_storage_properties,
            session_storage_properties,
            store_name,
            validation_rules: getValidationRules(),
        });

        makeObservable(this, {
            accumulator_range_list: observable,
            active_symbols: observable.ref, // Only react to reference changes
            amount: observable,
            barrier_1: observable,
            barrier_2: observable,
            barrier_count: observable,
            barrier_choices: observable,
            payout_choices: observable,
            barriers: observable,
            basis_list: observable.ref, // Array of objects - use ref
            basis: observable,
            payout_per_point: observable,
            cancellation_duration: observable,
            cancellation_price: observable,
            cancellation_range_list: observable.ref, // Array of objects - use ref
            cached_multiplier_cancellation_list: observable.ref, // Array of objects - use ref
            contract_expiry_type: computed,
            contract_type: observable,
            contract_types_list: observable.ref, // Object - use ref
            contract_types_list_v2: observable.ref, // Object - use ref
            currency: observable,
            default_stake: observable,
            digit_stats: observable,
            duration_min_max: observable.ref, // Object - use ref
            duration_unit: observable,
            duration_units_list: observable.ref, // Array of objects - use ref
            duration: observable,
            expiration: observable,
            expiry_date: observable,
            saved_expiry_date_v2: observable,
            unsaved_expiry_date_v2: observable,
            setSavedExpiryDateV2: action.bound,
            setUnsavedExpiryDateV2: action.bound,
            expiry_epoch: observable,
            expiry_time: observable,
            expiry_type: observable,
            form_components: observable,
            growth_rate: observable,
            has_cancellation: observable,
            has_equals_only: observable,
            has_open_accu_contract: computed,
            is_automation_params_locked: computed,
            is_automation_market_locked: computed,
            is_symbol_automatable: computed,
            automation_run_market: computed,
            has_stop_loss: observable,
            has_symbols_for_v2: observable,
            has_take_profit: observable,
            hovered_contract_type: observable,
            is_accumulator: computed,
            is_chart_loading: observable,
            is_digits_widget_active: observable,
            is_dtrader_v2: computed,
            is_awaiting_contracts_for: observable,
            is_equal: observable,
            is_market_closed: observable,
            is_mobile_digit_view_selected: observable,
            is_purchase_enabled: observable,
            is_purchase_pending: observable,
            is_synthetics_trading_market_available: computed,
            is_trade_component_mounted: observable,
            is_trade_enabled: observable,
            is_trade_enabled_v2: observable,
            is_trade_params_expanded: observable,
            is_turbos: computed,
            last_digit: observable,
            long_barriers: observable.ref, // Object - use ref
            main_barrier: observable,
            market_close_times: observable,
            market_open_times: observable,
            maximum_payout: observable,
            maximum_ticks: observable,
            validation_params: observable.ref, // Object - use ref
            multiplier_range_list: observable.ref, // Array of objects - use ref
            multiplier: observable,
            non_available_contract_types_list: observable.ref, // Object - use ref
            ref: observable,
            proposal_info: observable.ref,
            purchase_info: observable.ref,
            setDefaultStake: action.bound,
            sessions: observable,
            setDefaultGrowthRate: action.bound,
            setDigitStats: action.bound,
            setTickData: action.bound,
            short_barriers: observable.ref, // Object - use ref
            should_show_active_symbols_loading: observable,
            should_skip_prepost_lifecycle: observable,
            stake_boundary: observable.ref, // Object - use ref
            probed_stake_keys: observable.shallow,
            // struct: the limits are recomputed on every proposal response (validation_params is
            // reassigned each tick) but only change when the market does, and a fresh object each
            // tick would re-render both stake surfaces for an identical ladder.
            stake_preset_limits: computed.struct,
            start_date: observable,
            start_dates_list: observable.ref, // Array of objects - use ref
            start_time: observable,
            strike_price_choices: observable.ref, // Object - use ref
            stop_loss: observable,
            stop_out: observable,
            stop_out_level: observable,
            symbol: observable,
            open_markets_manual: observable,
            open_markets_automation: observable,
            open_markets: computed,
            is_automation_mode: computed,
            selecting_market_depth: observable,
            is_selecting_market: computed,
            take_profit: observable,
            tick_data: observable.ref, // Object - use ref
            tick_size_barrier_percentage: observable,
            ticks_history_stats: observable.ref, // Object - use ref
            trade_type_tab: observable,
            trade_types: observable.ref, // Object - use ref
            active_trade_panel_tab: observable,
            is_market_selector_open: observable,
            is_automation_page: observable,
            is_automation_tab: computed,
            setActiveTradePanelTab: action.bound,
            setMarketSelectorOpen: action.bound,
            setIsAutomationPage: action.bound,
            reconcileTradeModeMarket: action.bound,
            setIsAwaitingContractsFor: action.bound,
            url_trade_type: observable,
            clearUrlTradeType: action.bound,
            reconcileUrlTradeTypeWithSymbol: action.bound,
            is_reconciling_url_trade_type: observable,
            open_payout_wheelpicker: observable,
            togglePayoutWheelPicker: action.bound,
            v2_params_initial_values: observable.ref, // Object - use ref
            languageChangeListener: action.bound,
            barrier_pipsize: computed,
            barriers_flattened: computed,
            changeDurationValidationRules: action.bound,
            chartStateChange: action.bound,
            clearContracts: action.bound,
            clearLimitOrderBarriers: action.bound,
            clearPurchaseInfo: action.bound,
            clientInitListener: action.bound,
            clearV2ParamsInitialValues: action.bound,
            processContractsForV2: action.bound,
            enablePurchase: action.bound,
            endPurchaseAttempt: action.bound,
            exportLayout: action.bound,
            forgetAllProposal: action.bound,
            getFirstOpenMarket: action.bound,
            has_alternative_source: computed,
            initAccountCurrency: action.bound,
            is_multiplier: computed,
            is_symbol_in_active_symbols: computed,
            is_synthetics_available: computed,
            is_vanilla: computed,
            is_vanilla_fx: computed,
            loadActiveSymbols: action.bound,
            logoutListener: action.bound,
            main_barrier_flattened: computed,
            applyDefaultDuration: action.bound,
            networkStatusChangeListener: action.bound,
            onChange: action.bound,
            setTradeSubType: action.bound,
            onChangeMultiple: action.bound,
            selectMarketAndTradeType: action.bound,
            setActiveOpenMarkets: action.bound,
            addOpenMarket: action.bound,
            removeOpenMarket: action.bound,
            replaceOpenMarket: action.bound,
            setAutomationSupportedTradeTypes: action.bound,
            setReplacingMarket: action.bound,
            startSelectingMarket: action.bound,
            stopSelectingMarket: action.bound,
            resolveContractTypeAvailability: action.bound,
            onChartBarrierChange: action.bound,
            onHoverPurchase: action.bound,
            onMount: action.bound,
            onProposalResponse: action.bound,
            onPurchase: action.bound,
            onPurchaseV2: action.bound,
            onUnmount: override,
            prepareTradeStore: action.bound,
            preSwitchAccountListener: action.bound,
            processPurchase: action.bound,
            pushPurchaseDataToGtm: action.bound,
            refresh: action.bound,
            requestProposal: action.bound,
            resetAccumulatorData: action.bound,
            resetErrorServices: action.bound,
            setActiveSymbolsV2: action.bound,
            applyVanillaBarrierChoices: action.bound,
            setBarrierChoices: action.bound,
            setPayoutChoices: action.bound,
            setChartModeFromURL: action.bound,
            setChartStatus: action.bound,
            setContractTypesListV2: action.bound,
            setIsTradeParamsExpanded: action.bound,
            setIsDigitsWidgetActive: action.bound,
            setMarketStatus: action.bound,
            getTurbosChartBarrier: action.bound,
            setMobileDigitView: action.bound,
            setSkipPrePostLifecycle: action.bound,
            setStakeBoundary: action.bound,
            setTradeTypeTab: action.bound,
            setTradeStatus: action.bound,
            setV2ParamsInitialValues: action.bound,
            show_digits_stats: computed,
            updateStore: action.bound,
            setPayoutPerPoint: action.bound,
            handleTradeParamsResetOnSymbolChange: action.bound,
        });

        // Early symbol initialization from URL params enables contracts_for to fire
        // in parallel with active_symbols, eliminating one sequential round trip.
        // Must be set before reactions so reaction(() => this.symbol) sees this as initial value.
        if (this.is_dtrader_v2) {
            const searchParams = new URLSearchParams(window.location.search);
            const urlSymbol = searchParams.get('symbol');
            if (urlSymbol) {
                this.symbol = urlSymbol;
            }
        }

        // The single owner of initial market/trade-type selection. Fire-and-forget: each phase waits for the
        // data it needs and aborts if a user selection supersedes it.
        this.resolveInitialMarket().catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error('[TradeStore] resolveInitialMarket failed:', error);
        });

        reaction(
            () => [this.contract_expiry_type, this.duration_min_max, this.duration_unit, this.expiry_type],
            () => {
                this.changeDurationValidationRules();
            }
        );
        reaction(
            () => this.symbol,
            () => {
                // Re-arm the proposal hold on every symbol change. Some flows assign
                // this.symbol directly (URL when-blocks, loadActiveSymbols) without going
                // through updateStore, so this reaction is the only spot covering all paths.
                this.is_awaiting_contracts_for = true;
                const date = resetEndTimeOnVolatilityIndices(this.symbol, this.expiry_type);
                if (date) {
                    this.expiry_date = date;
                }
                this.setDefaultGrowthRate();
                this.resetAccumulatorData();
                this.root_store.notifications.removeTradeNotifications();
            }
        );
        // `contract_expiry_type` keys the per-expiry data `contracts_for` returns — barrier
        // defaults and duration limits — so it has to distinguish tick / intraday / daily. It
        // previously only ever wrote 'tick' or 'intraday', so a days duration or a future end time
        // resolved against the intraday entry. `getExpiryType` is the same derivation the
        // trade-params pipeline uses, so the reaction and the pipeline can no longer disagree, and
        // it depends on everything that derivation reads since several flows assign the
        // duration/expiry fields directly rather than going through the pipeline.
        // The bucket itself is computed; this reaction exists only for the side effect of crossing a
        // bucket boundary, which needs the previous value to detect.
        reaction(
            () => this.contract_expiry_type,
            (next_expiry_type, previous_expiry_type) => {
                if (!next_expiry_type) return;

                runInAction(() => {
                    // `contracts_for` returns a different default barrier per expiry_type, so
                    // crossing a boundary (minutes -> days flips relative to absolute) has to
                    // re-seed the barrier, or the previous type's value is left in a field that no
                    // longer accepts it. Owned here because this is the only writer that can see
                    // the transition; `onChangeExpiry` could only infer it by disagreeing with
                    // this observable, which stopped being a reliable signal once this reaction
                    // started deriving the value correctly.
                    if (!previous_expiry_type) return; // first resolve: the pipeline seeds it

                    const { barrier_1, barrier_2, barrier_count } = ContractType.getBarriers(
                        this.symbol,
                        this.contract_type,
                        next_expiry_type
                    );
                    // A contract may offer no barrier for the new expiry_type (e.g. a daily-only
                    // contract reached via an intraday end time). Leave the existing value rather
                    // than blanking the field.
                    if (!barrier_1) return;

                    this.barrier_1 = barrier_1;
                    this.barrier_2 = barrier_2;
                    this.barrier_count = barrier_count;
                });
            }
        );
        reaction(
            () => [this.has_stop_loss, this.has_take_profit],
            () => {
                if (!this.has_stop_loss) {
                    this.validation_errors.stop_loss = [];
                }
                if (!this.has_take_profit) {
                    this.validation_errors.take_profit = [];
                }
            }
        );
        reaction(
            () => [this.contract_type],
            () => {
                this.root_store.portfolio.setContractType(this.contract_type);
                if (this.is_accumulator || this.is_multiplier || this.is_turbos) {
                    // when switching back to Multiplier contract, re-apply Stop loss / Take profit validation rules
                    Object.assign(this.validation_rules, getMultiplierValidationRules());
                } else {
                    // we need to remove these two validation rules on contract_type change
                    // to be able to remove any existing Stop loss / Take profit validation errors
                    delete this.validation_rules.stop_loss;
                    delete this.validation_rules.take_profit;
                }
                this.resetAccumulatorData();
                this.root_store.notifications.removeTradeNotifications();
            }
        );
        reaction(
            () => this.root_store.common.current_language,
            () => {
                // Clear existing validation errors to prevent stale messages
                this.validation_errors = {};
                // Reinitialize barrier keys so observer components don't crash
                // accessing undefined before validation rules are reprocessed
                this.validation_errors.barrier_1 = [];
                this.validation_errors.barrier_2 = [];

                // Regenerate all validation rules with new language
                this.setValidationRules(getValidationRules());
                this.changeDurationValidationRules();
                if (!this.amount) {
                    this.validateAllProperties();
                }
                this.languageChangeListener();
            }
        );
        reaction(
            () => this.accumulator_range_list.length,
            () => {
                if (this.accumulator_range_list.length) {
                    this.setDefaultGrowthRate();
                }
            }
        );
    }

    get is_symbol_in_active_symbols() {
        return this.active_symbols.some(symbol_info => {
            const underlying = symbol_info.underlying_symbol;
            return underlying === this.symbol && symbol_info.exchange_is_open === 1;
        });
    }

    get has_open_accu_contract() {
        return (
            this.is_accumulator &&
            !!this.root_store.portfolio.open_accu_contract &&
            !!this.root_store.portfolio.active_positions.find(
                ({ contract_info, type }) =>
                    isAccumulatorContract(type) && contract_info.underlying_symbol === this.symbol
            )
        );
    }

    // True only when a run is active AND we're in the automation view. Used by the market strip to pin
    // to the run's market and block tab switching mid-run. The view signal is device-separated
    // (desktop panel tab / mobile /automate flag) via `is_automation_mode`. Deliberately false in
    // manual trading. This is the RUN-only lock — for the params lock see `is_automation_params_locked`.
    get is_automation_market_locked() {
        return this.root_store.modules.automation.is_active && this.is_automation_mode;
    }

    // Whether the active symbol can be traded by automation. A few markets (Cryptocurrencies,
    // Crash/Boom) are flagged non-automatable even when they offer an automatable trade type; on those
    // the user may stay on the tab, but Run and the params are disabled (see `is_automation_params_locked`).
    get is_symbol_automatable() {
        const symbol_info = this.active_symbols.find(s => s.underlying_symbol === this.symbol);
        return !symbol_info || !isMultiplierOnlySymbol(symbol_info);
    }

    // The params lock consumed by the shared trade params + automation fields: locked during a live
    // run OR when the active symbol isn't automatable. Kept distinct from `is_automation_market_locked`
    // (which the market strip uses) so the non-automatable case still lets the user switch to a
    // runnable market to clear the lock. False in manual trading so params aren't locked there.
    get is_automation_params_locked() {
        return this.is_automation_market_locked || (this.is_automation_mode && !this.is_symbol_automatable);
    }

    // The market a live automation run is bound to (app-format symbol + trade type), or null when
    // no run is active. Lets the shared market strip snap back to the exact running tab when the
    // user returns to the automation view after drifting the active market in manual — a symbol can
    // have several open tabs, so the trade type is needed to disambiguate. `contract_type` is the
    // app-format type captured at run start; it's null for runs recovered via auto_get (no analytics
    // payload), where the strip falls back to matching by symbol alone.
    get automation_run_market() {
        const { active_run, active_run_analytics, is_active } = this.root_store.modules.automation;
        const symbol = active_run?.contract_template?.underlying_symbol;
        if (!is_active || !symbol) return null;
        return { symbol, contract_type: active_run_analytics?.trade_type ?? null };
    }

    resetAccumulatorData() {
        this.root_store.contract_trade.clearAccumulatorBarriersData(false, true);
    }

    setV2ParamsInitialValues({
        value,
        name,
    }: {
        value: number | string | boolean;
        name: keyof TV2ParamsInitialValues;
    }) {
        this.v2_params_initial_values = { ...this.v2_params_initial_values, ...{ [name]: value } };
    }

    setSavedExpiryDateV2(date: string) {
        this.saved_expiry_date_v2 = date || '';
    }

    setUnsavedExpiryDateV2(date: string) {
        this.unsaved_expiry_date_v2 = date || '';
    }

    clearV2ParamsInitialValues() {
        this.v2_params_initial_values = {};
    }

    setDefaultGrowthRate() {
        if (
            this.is_accumulator &&
            !this.accumulator_range_list.includes(this.growth_rate) &&
            this.accumulator_range_list.length
        ) {
            this.growth_rate = this.accumulator_range_list[0];
        }
    }

    setSkipPrePostLifecycle(should_skip: boolean) {
        if (!!should_skip !== !!this.should_skip_prepost_lifecycle) {
            // to skip assignment if no change is made
            this.should_skip_prepost_lifecycle = should_skip;
        }
    }

    setTradeStatus(status: boolean) {
        this.is_trade_enabled = status;
    }

    refresh() {
        this.forgetAllProposal();
        this.proposal_info = {};
        this.purchase_info = {};
        this.proposal_requests = {};
    }

    clearContracts = () => {
        this.root_store.contract_trade.contracts = [];
    };

    // V2: active symbols arrive via the useActiveSymbols React Query hook — this only waits for
    // them to land in the store.
    async loadActiveSymbols() {
        await when(() => this.has_symbols_for_v2);
    }

    // The daily-only expiry default: server time (never browser-local), the next available
    // trading day, and no literal close time — StartDate.onChangeExpiry -> ContractType.getExpiryTime
    // resolves that once expiry_type/expiry_date land in the store (see the caller).
    private async getDailyExpirySeed() {
        const server_time = this.root_store.common.server_time || ServerTime.get();
        const has_intraday = hasIntradayDurationUnit(this.duration_units_list);
        const expiry_date = await ContractType.getNextTradingDayDate(this.symbol, server_time, has_intraday);
        return {
            expiry_type: 'endtime' as const,
            expiry_date,
            expiry_time: null,
        };
    }

    // Single owner of the default-duration value object, shared by both appliers.
    // Returns `is_daily_only` because callers must pass it as `is_changed_by_user` — that is what
    // runs processTradeParams, which resolves `expiry_time` from the seeded date.
    private async getDefaultDurationValues(default_duration: { unit: string; value: number }) {
        const is_daily_only = default_duration.unit === 'd';
        return {
            is_daily_only,
            values: {
                duration_unit: default_duration.unit,
                duration: default_duration.value,
                expiry_time: null,
                expiry_type: 'duration',
                ...(is_daily_only ? await this.getDailyExpirySeed() : {}),
            },
        };
    }

    async processContractsForV2() {
        // So a symbol change mid-await can't release the proposal hold for the wrong symbol.
        const symbol_at_start = this.symbol;
        const contract_categories = ContractType.getContractCategories(this.symbol);
        // Await sequentially: first sets contract_types_list, second sets barrier/duration values.
        // Without await, these race each other and the second call's forgetAllProposal
        // cancels the first call's work.
        // Pass should_forget_first=false to avoid cancelling proposals between calls.
        await this.processNewValuesAsync(
            { ...(contract_categories as Pick<TradeStore, 'contract_types_list'>) },
            false,
            null,
            false
        );
        await this.processNewValuesAsync(ContractType.getContractValues(this), false, null, false);

        // Apply the per-trade-type default duration the first time a trade-type group becomes
        // active (initial load / a symbol whose contracts_for just resolved), or reconcile a
        // retained duration that is out of range here. Tracking the group it was applied for
        // means a manually-set duration survives a plain symbol change (same type), while the
        // configured default still lands on first load — where the retained value may be valid.
        const should_apply_default = !isValidPersistedDuration(
            this.duration,
            this.duration_unit,
            this.duration_min_max,
            this.duration_units_list
        );
        if (this.contract_type && should_apply_default) {
            const default_duration = getDefaultDuration(
                this.contract_type,
                this.duration_min_max,
                this.duration_units_list
            );
            if (default_duration) {
                const { is_daily_only, values } = await this.getDefaultDurationValues(default_duration);
                // The daily seed above awaits a trading-times lookup, and useContractsFor invokes this
                // method un-awaited per `contracts_for` response — so a symbol change during that gap
                // would commit the previous symbol's expiry date. Same invariant as the hold release
                // below, re-checked after the async gap.
                if (this.symbol !== symbol_at_start) return;
                await this.processNewValuesAsync(values, is_daily_only, null, false);
                // Re-validate explicitly: the validation reaction fired against the stale
                // duration when the new limits arrived and won't re-fire on a duration-only
                // change — a leftover error would block requestProposal.
                this.changeDurationValidationRules();
            }
        }
        // A 'd' duration means the contract runs past a day boundary, and the API requires those to
        // expire at the end of a trading day — which this store models as expiry_type 'endtime'.
        // Enforce that independently of the default-duration gate above: on a cold load the persisted
        // duration is usually valid, so that gate does not open and nothing else would seed it.
        // Daily-only symbols only: where the contract also offers intraday units, a 'd' duration or a
        // same-day end date is a legitimate choice and must not be forced to an end time.
        if (
            this.contract_type &&
            this.duration_unit === 'd' &&
            this.expiry_type !== 'endtime' &&
            this.duration_units_list.length > 0 &&
            !hasIntradayDurationUnit(this.duration_units_list)
        ) {
            // The user's prior choice, if any, is the persisted expiry_date — the duration integer
            // is tick-preset residue (e.g. touch_no_touch's 10) left behind when the unit became
            // 'd', and converting it to days once put the end date 10 days out on reload. A kept
            // date that has gone stale or falls on a closed day is advanced by the validation below.
            const server_time = this.root_store.common.server_time || ServerTime.get();
            const has_future_date = !!this.expiry_date && toMoment(this.expiry_date).isAfter(server_time, 'day');
            const seed = has_future_date
                ? { expiry_type: 'endtime' as const, expiry_time: null }
                : await this.getDailyExpirySeed();
            // Skip the write, never the hold release below, if the symbol moved during the lookup.
            if (this.symbol === symbol_at_start) {
                await this.processNewValuesAsync(seed, true, null, false);
            }
        }

        // A carried-over expiry_date is only checked for being in the past (getExpiryDate's naive
        // `+1 day`), never for being a day this symbol actually trades — so a switch between symbols
        // with different calendars, or that +1 landing on a weekend, would price against a closed
        // day. Validate it against this symbol's own trading times; getNextTradingDayDate returns
        // the date unchanged when it is already tradeable.
        if (
            this.expiry_type === 'endtime' &&
            this.expiry_date &&
            this.duration_units_list.length > 0 &&
            !hasIntradayDurationUnit(this.duration_units_list)
        ) {
            const tradeable_date = await ContractType.getNextTradingDayDate(
                this.symbol,
                toMoment(this.expiry_date),
                true // start at expiry_date itself rather than the day after
            );
            // Skip the write, never the hold release below, if the symbol moved during the lookup.
            if (tradeable_date !== this.expiry_date && this.symbol === symbol_at_start) {
                await this.processNewValuesAsync({ expiry_date: tradeable_date }, true, null, false);
            }
        }

        // Turbos: seed payout_per_point from contracts_for choices before the first proposal, and
        // replace a value not in this market's own list — a request priced against it is rejected.
        if (
            this.is_turbos &&
            this.payout_choices.length &&
            (!this.payout_per_point || !this.payout_choices.includes(String(this.payout_per_point)))
        ) {
            this.payout_per_point = String(this.payout_choices[Math.floor(this.payout_choices.length / 2)]);
        }
        // Release the hold — unless the symbol changed mid-flight (the new symbol's
        // own run releases it).
        if (this.symbol === symbol_at_start) {
            this.is_awaiting_contracts_for = false;
        }
        // Explicitly trigger proposal after all contract values (barriers, duration, stake)
        // are applied. The processNewValuesAsync calls above use is_changed_by_user=false
        // and their keys don't always match the regex gate that triggers debouncedProposal.
        this.debouncedProposal();
    }

    async prepareTradeStore() {
        this.initial_barriers = { barrier_1: this.barrier_1, barrier_2: this.barrier_2 };
        await when(() => !this.root_store.client.is_logging_in);

        await runInAction(async () => {
            await this.processNewValuesAsync(
                {
                    // fallback to default currency if current logged-in client hasn't selected a currency yet
                    currency: this.root_store.client.currency || this.root_store.client.default_currency,
                },
                true,
                null,
                false
            );
        });
        await this.loadActiveSymbols();
        await this.processNewValuesAsync(
            {
                is_market_closed: isMarketClosed(this.active_symbols, this.symbol),
            },
            true,
            null,
            false
        );
    }

    async onChangeMultiple(values: Partial<TradeStore>) {
        Object.keys(values).forEach(name => {
            if (!(name in this)) {
                throw new Error(`Invalid Argument: ${name}`);
            }
        });

        await this.processNewValuesAsync({ ...values }, true); // wait for store to be updated
        this.validateAllProperties(); // then run validation before sending proposal
    }

    /**
     * Commits a market + trade type together for the redesigned market-selection info screen.
     *
     * Order matters: `symbol` is written first so its `contracts_for` refetch (in `useContractsFor`)
     * runs against the new market, then `contract_type`. If the chosen contract_type isn't offered by
     * the new symbol, `useContractsFor` will legitimately swap it to the first available one — the
     * desired behaviour. Uses per-field `onChange` (not `onChangeMultiple`) to keep each field's
     * pre-processing (chart-loading flag, Vanilla/accumulator resets) intact.
     */
    async selectMarketAndTradeType(underlying_symbol: string, contract_type: string) {
        // Every market tab shares this one store, so the outgoing tab's error state has to go
        // before the incoming tab's cascade starts — otherwise an error raised for the tab being
        // left is (re-)raised against a tab that is perfectly configured (issue #1246).
        //
        // Re-confirming the already-active pair is not a switch, and clearing there would drop the
        // field errors for a market that is not changing while the toast retraction — which keys on
        // the market actually changing — stays put, leaving the two out of step. Only this clear is
        // skipped: the rest of the method also owns the tab strip, the long-press replace flow and
        // the URL mirror, none of which are safe to bypass on a re-selection.
        const is_reselecting_active_market = underlying_symbol === this.symbol && contract_type === this.contract_type;
        if (!is_reselecting_active_market) this.clearTradeErrorState();
        // This call is now the newest selection intent: any older cascade still in flight must not
        // write symbol/contract_type past this point (each checks the epoch before its next write).
        const epoch = ++this.selection_seq;
        // Record the tab up-front, from the explicit intent — BEFORE the symbol-first/contract_type
        // cascade below (which transiently pairs the new symbol with the stale type, and may re-swap
        // the type via useContractsFor). The strip is thus never built from those transient values.
        const next_market = { symbol: underlying_symbol, contract_type };
        // Captured before mutating so the optimistic tab change can be rolled back on failure below.
        const replaced_market = this.replacing_market;
        // A tab whose (symbol, trade-type CATEGORY) already matches the commit — committing.
        const category_sibling_tab = this.open_markets.find(
            market =>
                market.symbol === underlying_symbol && this.isSameTradeTypeGroup(market.contract_type, contract_type)
        );
        // Set only when replaceOpenMarket actually runs below, so the failure-path rollback reverses
        // a replace that actually happened rather than assuming one did whenever `replaced_market` was set.
        let did_replace = false;
        if (replaced_market) {
            // Long-press "replace this tab" flow: swap the long-pressed tab in place — unless the
            // target is already open as a DIFFERENT tab (category_sibling_tab isn't the tapped tab
            // itself), in which case this is really a switch to that existing tab. Skip the mutation
            // so the symbol/contract_type commit below activates it without touching the strip.
            if (!category_sibling_tab || isSameMarket(category_sibling_tab, replaced_market)) {
                this.replaceOpenMarket(replaced_market, next_market);
                did_replace = true;
            }
            this.setReplacingMarket(null);
        } else if (!category_sibling_tab) {
            this.addOpenMarket(next_market);
        }
        // Guard the cascade so the tab strip's seed effect ignores the transient {new symbol, old
        // trade type} state and doesn't spawn a stale tab (the exact pair is already recorded above).
        this.startSelectingMarket();
        try {
            if (underlying_symbol && underlying_symbol !== this.symbol) {
                await this.onChange({ target: { name: 'symbol', value: underlying_symbol } });
            }
            // A newer selection started while the symbol cascade was in flight — it owns the state
            // now (its own tab is already recorded); writing our trade type would produce a hybrid
            // {its symbol, our trade type} pair.
            if (this.selection_seq !== epoch) return;
            if (contract_type && contract_type !== this.contract_type) {
                await this.onChange({ target: { name: 'contract_type', value: contract_type } });
            }
            // Commit fully settled — mirror the pair into the URL atomically.
            if (this.selection_seq === epoch) this.syncTradeURLParams();
        } catch (error) {
            // The commit failed (e.g. the WS dropped mid-cascade) — undo the optimistic tab change so
            // the strip doesn't keep a "phantom" tab whose chart never loaded. Re-throw so the caller
            // (commitAndClose) keeps the selector open for retry. Skipped when superseded (a newer
            // selection owns the strip) and when nothing was added (a pre-existing tab must survive).
            if (this.selection_seq === epoch) {
                if (did_replace && replaced_market) this.replaceOpenMarket(next_market, replaced_market);
                else if (!category_sibling_tab) this.removeOpenMarket(next_market);
            }
            throw error;
        } finally {
            this.stopSelectingMarket();
        }
    }

    setReplacingMarket(market: TOpenMarket | null) {
        this.replacing_market = market;
    }

    get is_selecting_market() {
        return this.selecting_market_depth > 0;
    }

    startSelectingMarket() {
        this.selecting_market_depth += 1;
    }

    stopSelectingMarket() {
        this.selecting_market_depth = Math.max(0, this.selecting_market_depth - 1);
    }

    /** Category matcher for open-market tabs, mirroring `isSameTradeTypeCategory` in
     * AppV2/Utils/trade-types-utils (not imported here — that module reaches back into the stores via
     * `useTraderStores`, which would create an import cycle). The only multi-member categories are
     * exactly the three prefix families checked by `checkContractTypePrefix` (rise/fall±equals,
     * turbos long/short, vanilla call/put); everything else matches by equality. */
    private isSameTradeTypeGroup(contract_type_1: string, contract_type_2: string) {
        return (
            contract_type_1 === contract_type_2 ||
            (!!contract_type_1 && !!contract_type_2 && checkContractTypePrefix([contract_type_1, contract_type_2]))
        );
    }

    /**
     * Applies the single policy for "the current trade type isn't offered by the current symbol",
     * using the freshly-loaded `contracts_for` availability. Called by `useContractsFor` for every
     * processed response — the hook only reports; the decision to change state lives here.
     *
     * Guarantees (vs the old in-hook swap, which caused phantom tabs on the strip):
     * - Evaluates against the store's CURRENT symbol/contract_type at execution time, never a stale
     *   render closure.
     * - Defers while a selection or URL reconcile is committing, then re-evaluates against the
     *   settled state — so it can never override a user's explicit choice mid-cascade.
     * - On a genuine swap, corrects the tab strip FIRST (replacing the now-dead tab in place — never
     *   appending) and runs the type change under the selecting-market guard, so the seed effect
     *   never turns the transient hop into a new tab.
     */
    resolveContractTypeAvailability(response_symbol: string, available_types: string[]) {
        if (!response_symbol || !available_types.length) return;
        if (this.is_selecting_market || this.is_reconciling_url_trade_type) {
            // A commit is in flight — its trade type may be about to change. Re-evaluate once every
            // in-flight cascade has settled (bounded so a stuck flag can't leak a pending resolve).
            when(() => !this.is_selecting_market && !this.is_reconciling_url_trade_type, { timeout: 30000 })
                .then(() => this.resolveContractTypeAvailability(response_symbol, available_types))
                .catch(() => undefined);
            return;
        }
        // Stale response: the active market moved on while this response was in flight/cached. The
        // current symbol's own response drives its own resolution.
        if (response_symbol !== this.symbol) return;
        const current = this.contract_type;
        const is_available = available_types.some(type => type === current || checkContractTypePrefix([current, type]));
        if (current && is_available) {
            // Keep the URL in sync even when nothing changes (on initial load the restored pair
            // never "changes", so no pipeline completion would otherwise stamp it).
            this.syncTradeURLParams();
            return;
        }
        const fallback = available_types[0];
        if (!fallback || fallback === current) return;
        // Correct the strip before the state hop. The tab carrying the unavailable type is dead
        // (its pair can never load a proposal) — replace it in place with the fallback pair, unless a
        // same-category tab for the fallback already exists (two tabs must never share a category).
        const dead_tab = current
            ? this.open_markets.find(
                  market => market.symbol === this.symbol && this.isSameTradeTypeGroup(market.contract_type, current)
              )
            : undefined;
        const has_fallback_tab = this.open_markets.some(
            market => market.symbol === this.symbol && this.isSameTradeTypeGroup(market.contract_type, fallback)
        );
        const fallback_market = { symbol: this.symbol, contract_type: fallback };
        if (dead_tab && !has_fallback_tab) this.replaceOpenMarket(dead_tab, fallback_market);
        else if (dead_tab && has_fallback_tab) this.removeOpenMarket(dead_tab);
        else if (!has_fallback_tab) this.addOpenMarket(fallback_market);
        // Commit the fallback under the guard. Deliberately not awaited: the store write inside
        // onChange is synchronous (callers like useContractsFor rely on reading the corrected type
        // right after), while the guard covers the async tail of the cascade.
        this.startSelectingMarket();
        this.onChange({ target: { name: 'contract_type', value: fallback } })
            .then(() => this.syncTradeURLParams())
            .catch(() => undefined)
            .finally(() => this.stopSelectingMarket());
    }

    // Persist `next` as the ACTIVE mode's collection (manual vs automation). All three mutators below
    // read `this.open_markets` (the active collection) and route the result back through here, so a
    // mutation only ever touches the mode the strip is currently showing.
    setActiveOpenMarkets(next: TOpenMarket[]) {
        // Elide no-op writes: the guard below reallocates via `filter`, so an unchanged list would still
        // churn every observer — which cancelled the first-Automate-entry seed mid-pick (#1071).
        if (this.is_automation_mode) {
            // Guard: once the automation-supported set is known, an unsupported trade type can never
            // be written to (or persisted in) the automation strip — enforced here, the single writer
            // for every add/replace/restore path, so it's a true add-time guard, not after-the-fact
            // cleanup. Empty set = not loaded yet → pass through unfiltered.
            const supported = this.automation_supported_trade_types;
            const guarded = supported.size ? next.filter(market => supported.has(market.contract_type)) : next;
            if (isSameOpenMarketList(guarded, this.open_markets_automation)) return;
            this.open_markets_automation = guarded;
            writeOpenMarkets('automation', guarded);
        } else {
            if (isSameOpenMarketList(next, this.open_markets_manual)) return;
            this.open_markets_manual = next;
            writeOpenMarkets('manual', next);
        }
    }

    addOpenMarket(market: TOpenMarket) {
        const next = addToOpenMarkets(this.open_markets, market);
        if (next === this.open_markets) return; // no-op (pair already open / invalid)
        this.setActiveOpenMarkets(next);
    }

    removeOpenMarket(market: TOpenMarket) {
        const next = removeFromOpenMarkets(this.open_markets, market);
        if (next.length === this.open_markets.length) return;
        this.setActiveOpenMarkets(next);
    }

    replaceOpenMarket(old_market: TOpenMarket, next_market: TOpenMarket) {
        if (isSameMarket(old_market, next_market)) return this.addOpenMarket(next_market);
        this.setActiveOpenMarkets(replaceInOpenMarkets(this.open_markets, old_market, next_market));
    }

    // Record the trade types automation supports (from server strategies). Setting it re-applies the
    // guard once to the current automation collection, dropping any unsupported tab already carried
    // over or restored from a legacy persisted state; all later adds are then blocked at the writer
    // (`setActiveOpenMarkets`). The automation tab-seeding effect keeps a supported market active if
    // this removed the active one. Reference-compared so it's a no-op when the set is unchanged.
    setAutomationSupportedTradeTypes(supported_trade_types: Set<string>) {
        if (this.automation_supported_trade_types === supported_trade_types) return;
        this.automation_supported_trade_types = supported_trade_types;
        if (this.is_automation_mode && supported_trade_types.size) this.setActiveOpenMarkets(this.open_markets);
    }

    // Trade-type group of the current contract type — an Up/Down or Allow-equals sub-toggle
    // stays in the same group, a real trade-type switch changes it.
    get current_duration_group() {
        return mapContractTypeToDurationPresetKey(this.contract_type) ?? '';
    }

    // Applies the configured per-trade-type default for the current contract type and records the
    // trade-type group it was applied for, so processContractsForV2 won't re-force it on a later
    // symbol change (a manual value survives). Returns early when the type has no configured default.
    async applyDefaultDuration() {
        if (!this.contract_type) return;
        const default_duration = getDefaultDuration(
            this.contract_type,
            this.duration_min_max,
            this.duration_units_list
        );
        if (!default_duration) return;
        const symbol_at_start = this.symbol;
        const group_at_start = this.current_duration_group;
        // Shares the daily branch with processContractsForV2; without it this mobile safety net would
        // knock a seeded daily contract back to expiry_type: 'duration'.
        const { values } = await this.getDefaultDurationValues(default_duration);
        // Same invariant as processContractsForV2: the daily seed's trading-times round trip can
        // outlive a switch, and committing then applies the previous market's expiry. The applied-for
        // flag is set only on the committing path, so a bail leaves the default still to be applied.
        if (this.symbol !== symbol_at_start || this.current_duration_group !== group_at_start) {
            return;
        }
        await this.onChangeMultiple(values);
    }

    async onChange(e: { target: { name: string; value: unknown } }) {
        const { name, value } = e.target;
        // Capture the outgoing trade-type group so we can apply the per-type default duration only
        // on a real trade-type switch (not on Up/Down sub-toggles within the same group).
        const previous_duration_group = this.current_duration_group;
        if (
            name === 'contract_type' &&
            ['accumulator', 'match_diff', 'even_odd', 'over_under'].includes(value as string)
        ) {
            this.prev_contract_type = this.contract_type;
        }

        // Reset duration and barrier when switching TO Vanilla contracts
        if (name === 'contract_type' && value) {
            const is_switching_to_vanilla = isVanillaContract(value as string);
            const was_vanilla = isVanillaContract(this.contract_type);

            if (is_switching_to_vanilla) {
                // Reset expiry type to duration for ALL Vanilla contract selections
                // This ensures the duration toggle always resets to "Duration" tab
                this.expiry_type = 'duration';
                this.root_store.ui.advanced_expiry_type = 'duration';
                this.expiry_time = null;
                this.expiry_date = null;

                // ALWAYS reset duration_unit to minutes for ALL Vanilla contract switches
                // This ensures that switching back to Vanilla always shows minutes, not days/hours
                this.duration_unit = 'm';

                // Also reset UI store duration units to ensure dropdowns show minutes
                this.root_store.ui.advanced_duration_unit = 'm';
                this.root_store.ui.simple_duration_unit = 'm';

                // Only reset the barrier when switching from non-Vanilla to Vanilla.
                // Duration is owned by applyDefaultDuration (runs after the new limits load).
                if (!was_vanilla) {
                    this.barrier_1 = '+0.1';
                }
            }
        }

        if (name === 'symbol' && value) {
            // set trade params skeleton and chart loader to true until processNewValuesAsync resolves
            this.setChartStatus(true);
            // reset market close status
            this.setMarketStatus(false);
            this.is_trade_enabled = false;
            // this.root_store.modules.contract_trade.contracts = [];
            // TODO: Clear the contracts in contract-trade-store
        } else if (name === 'currency') {
            // Only allow the currency dropdown change if client is not logged in
            if (!this.root_store.client.is_logged_in) {
                this.root_store.client.selectCurrency(value as string);
            }
        } else if (name === 'expiry_date') {
            this.expiry_time = null;
        } else if (!(name in this)) {
            throw new Error(`Invalid Argument: ${name}`);
        }

        await this.processNewValuesAsync(
            { [name]: value },
            true,
            name === 'contract_type' ? { contract_type: this.contract_type } : {}, // refer to [Multiplier validation rules] below
            true
        ); // wait for store to be updated
        // On a real trade-type switch (a different duration group), apply that type's default
        // duration now that processNewValuesAsync has loaded the new type's duration limits/units.
        if (name === 'contract_type' && this.contract_type && this.current_duration_group !== previous_duration_group) {
            await this.applyDefaultDuration();
        }
        // "Allow equals" flips the Rise/Fall sub-type (rise_fall ↔ rise_fall_equal). Done here in
        // the pipeline (not a store reaction) so the flip is an explicit step of the is_equal change
        // rather than an implicit reaction-driven contract_type write.
        if (name === 'is_equal' && this.contract_type?.includes(TRADE_TYPES.RISE_FALL)) {
            await this.setTradeSubType(this.is_equal ? TRADE_TYPES.RISE_FALL_EQUAL : TRADE_TYPES.RISE_FALL);
        }
        this.validateAllProperties(); // then run validation before sending proposal
        this.root_store.common.setSelectedContractType(this.contract_type);
    }

    /**
     * The ONLY writer for same-category trade-type sub-toggles (Allow equals, the Up/Down
     * segmented control). Fenced: a cross-category value is rejected, so this writer can change
     * the priced sub-type but provably never the tab identity — changing which (symbol, category)
     * is active must go through `selectMarketAndTradeType`.
     */
    async setTradeSubType(contract_type: string) {
        if (!contract_type || contract_type === this.contract_type) return;
        if (this.contract_type && !this.isSameTradeTypeGroup(this.contract_type, contract_type)) {
            // eslint-disable-next-line no-console
            console.error(
                `[TradeStore] setTradeSubType rejected cross-category switch: ${this.contract_type} → ${contract_type}`
            );
            return;
        }
        await this.onChange({ target: { name: 'contract_type', value: contract_type } });
        this.syncTradeURLParams();
    }

    setDefaultStake(default_stake?: number) {
        this.default_stake = default_stake;
    }

    setIsTradeParamsExpanded(value: boolean) {
        this.is_trade_params_expanded = value;
    }

    onHoverPurchase(is_over: boolean, contract_type?: string) {
        if (this.is_accumulator) return;
        if (this.is_purchase_enabled && this.main_barrier && !this.is_multiplier) {
            this.main_barrier.updateBarrierShade(is_over, contract_type ?? '');
        } else if (!is_over && this.main_barrier && !this.is_multiplier) {
            this.main_barrier.updateBarrierShade(false, contract_type ?? '');
        }

        this.hovered_contract_type = is_over ? contract_type : null;
        setLimitOrderBarriers({
            barriers: this.root_store.portfolio.barriers,
            is_over,
            contract_type,
            contract_info: this.proposal_info[contract_type ?? ''],
        });
    }

    clearLimitOrderBarriers() {
        this.hovered_contract_type = null;
        const { barriers } = this;
        setLimitOrderBarriers({
            barriers,
            is_over: false,
        });
    }

    get barrier_pipsize() {
        return getBarrierPipSize(this.barrier_1);
    }

    get main_barrier_flattened() {
        const is_digit_trade_type = isDigitTradeType(this.contract_type);
        return is_digit_trade_type ? null : toJS(this.main_barrier);
    }

    get barriers_flattened() {
        return this.root_store.portfolio.barriers && toJS(this.root_store.portfolio.barriers);
    }

    setMainBarrier = (proposal_info: TPriceProposalRequest) => {
        if (!proposal_info) {
            return;
        }
        const { contract_type, barrier, barrier2 } = proposal_info;
        if (isBarrierSupported(contract_type)) {
            // create barrier only when it's available in response
            this.main_barrier = new ChartBarrierStore(barrier, barrier2, this.onChartBarrierChange, {
                color: BARRIER_COLORS.BLUE,
                backgroundColor: BARRIER_COLORS.BLUE,
                foregroundColor: BARRIER_COLORS.WHITE,
                not_draggable: this.is_turbos || this.is_vanilla,
            });
        } else {
            this.main_barrier = null;
        }
    };

    async onPurchaseV2(
        trade_type: string,
        isMobile: boolean,
        callback?: (params: { message: string; redirectTo: string; title: string }, contract_id: number) => void
    ) {
        // The attempt starts here, not when the buy is sent: the wait for a usable proposal
        // below plus the debounce on onPurchase can take a while, and the Buy button's loading
        // state reads this flag. Deliberately not `is_purchasing_contract` — that one gates the
        // proposal-driven re-enable of purchasing, and holding it across this wait would stop
        // `is_purchase_enabled` from ever being restored.
        runInAction(() => {
            this.is_purchase_pending = true;
        });
        try {
            await when(
                () => {
                    const proposal_info_keys = Object.keys(this.proposal_info);
                    const proposal_request_keys = Object.keys(this.proposal_requests);

                    // Determine what type of keys we have
                    const hasHigherLowerKeys =
                        proposal_info_keys.includes('HIGHER') && proposal_info_keys.includes('LOWER');
                    const hasCallPutKeys = proposal_info_keys.includes('CALL') && proposal_info_keys.includes('PUT');

                    // Determine the expected key based on available keys
                    let expectedKey = trade_type;
                    if (hasHigherLowerKeys && !hasCallPutKeys) {
                        if (trade_type === 'CALL') expectedKey = 'HIGHER';
                        else if (trade_type === 'PUT') expectedKey = 'LOWER';
                    }

                    const hasRequiredProposal =
                        this.proposal_info[expectedKey] && !this.proposal_info[expectedKey].has_error;

                    // Standard condition: both proposal_info and proposal_requests have matching keys
                    const standardCondition =
                        proposal_info_keys.length > 0 && proposal_info_keys.length === proposal_request_keys.length;

                    // Higher/Lower condition: proposal_info has HIGHER/LOWER keys and the required proposal
                    const higherLowerCondition = hasHigherLowerKeys && hasRequiredProposal;

                    // Rise/Fall condition: proposal_info has CALL/PUT keys and the required proposal
                    const riseFallCondition = hasCallPutKeys && hasRequiredProposal;

                    const condition = standardCondition || higherLowerCondition || riseFallCondition;

                    return condition;
                },
                { timeout: PROPOSAL_WAIT_TIMEOUT }
            );

            // Determine the correct key to use based on what's available in proposal_info
            const proposal_info_keys = Object.keys(this.proposal_info);
            const hasHigherLowerKeys = proposal_info_keys.includes('HIGHER') && proposal_info_keys.includes('LOWER');
            const hasCallPutKeys = proposal_info_keys.includes('CALL') && proposal_info_keys.includes('PUT');

            let proposalKey = trade_type;

            if (hasHigherLowerKeys && !hasCallPutKeys) {
                // For Higher/Lower contracts, map CALL->HIGHER and PUT->LOWER
                if (trade_type === 'CALL') proposalKey = 'HIGHER';
                else if (trade_type === 'PUT') proposalKey = 'LOWER';
            }
            // If hasCallPutKeys, use trade_type directly (no mapping needed)

            const info = this.proposal_info?.[proposalKey];

            // An errored proposal is still stored under its contract type, but carries no id.
            // Dispatching on it sends a buy the server cannot match, so treat it as no proposal.
            if (info?.id && !info.has_error) {
                this.onPurchase(info.id, info.stake, trade_type, isMobile, callback, true);
            } else {
                this.endPurchaseAttempt();
            }
        } catch (error) {
            this.endPurchaseAttempt();
            // The Buy button calls this without awaiting, so rethrowing a timeout would surface as an
            // unhandled rejection. Report it through the same channel as a rejected buy instead —
            // the button has already been released above, so the user can retry.
            if ((error as Error)?.message === WHEN_TIMEOUT) {
                this.root_store.common.setServicesError(
                    {
                        type: 'buy',
                        code: 'ProposalTimeout',
                        message: localize('Something went wrong. Please try again.'),
                    },
                    this.is_dtrader_v2
                );
                return;
            }
            throw error;
        }
    }

    /** Ends an attempt that never reached the server, releasing the button's loading state. */
    endPurchaseAttempt() {
        this.is_purchase_pending = false;
    }

    onPurchase = debounce(this.processPurchase, 300);

    processPurchase(
        proposal_id: string,
        price: string | number,
        type: string,
        isMobile: boolean,
        callback?: (params: { message: string; redirectTo: string; title: string }, contract_id: number) => void,
        is_dtrader_v2?: boolean
    ) {
        // Purchasing is disabled while a buy is already in flight, and briefly whenever trade
        // params change until the next proposal re-enables it. Either way this attempt cannot
        // proceed, so end it rather than leaving the button spinning.
        if (!this.is_purchase_enabled) {
            this.endPurchaseAttempt();
            return;
        }
        if (proposal_id) {
            runInAction(() => {
                this.is_purchase_enabled = false;
                this.is_purchasing_contract = true;
            });
            const is_tick_contract = this.duration_unit === 't';
            processPurchase(proposal_id, price).then(
                action((response: TResponse<TBuyContractRequest, TBuyContractResponse, 'buy'>) => {
                    if (!this.is_trade_component_mounted) {
                        this.enablePurchase();
                        this.is_purchasing_contract = false;
                        this.endPurchaseAttempt();
                        return;
                    }

                    const last_digit = +this.last_digit;
                    if (response.error) {
                        if (response.error.code === 'ConnectionLost') {
                            // The connection died before the buy was answered — the trade may or
                            // may not have executed server-side. Surface an outcome-unknown message
                            // and keep the purchase button LOCKED (no enablePurchase): a retry
                            // could double-purchase. reconnectHandler re-enables it once the
                            // connection — and the portfolio subscription that shows the truth —
                            // is back.
                            this.root_store.common.setServicesError(
                                {
                                    type: response.msg_type,
                                    code: response.error.code,
                                    message: localize(
                                        "Connection lost — we couldn't confirm this request. Please check your positions before retrying."
                                    ),
                                },
                                this.is_dtrader_v2
                            );
                            this.proposal_info = {};
                            this.forgetAllProposal();
                            this.proposal_requests = {};
                            this.purchase_info = response;
                            this.is_purchasing_contract = false;
                            this.endPurchaseAttempt();
                            return;
                        }
                        // invalidToken error will handle in socket-general.js
                        if (response.error.code !== 'InvalidToken') {
                            this.root_store.common.setServicesError(
                                {
                                    type: response.msg_type,
                                    ...response.error,
                                },
                                this.is_dtrader_v2
                            );
                        }
                    } else if (response.buy) {
                        if (this.proposal_info[type] && this.proposal_info[type].id !== proposal_id) {
                            throw new Error('Proposal ID does not match.');
                        }

                        // Clear open positions filter from session storage when a new contract is purchased
                        sessionStorage.removeItem('open_positions_filter');

                        const contract_data: TContractDataForGTM = {
                            ...this.proposal_requests[type],
                            ...this.proposal_info[type],
                            buy_price: response.buy.buy_price,
                        };
                        const { contract_id, longcode, start_time } = response.buy;

                        // toggle smartcharts to contract mode
                        if (contract_id) {
                            const shortcode = response.buy.shortcode;
                            const { category, underlying_symbol } = extractInfoFromShortcode(shortcode);
                            const is_digit_contract = isDigitContractType(category?.toUpperCase() ?? '');
                            const is_multiplier = isMultiplierContract(category);
                            const contract_type = category?.toUpperCase();
                            const is_call = category.toUpperCase() === CONTRACT_TYPES.CALL;
                            const is_put = category.toUpperCase() === CONTRACT_TYPES.PUT;
                            const is_high_low = isHighLow({ shortcode_info: extractInfoFromShortcode(shortcode) });
                            let higher_lower_contact = CONTRACT_TYPES.LOWER.toLowerCase();
                            let rise_fall_contract = CONTRACT_TYPES.FALL.toLowerCase();
                            if (is_call) {
                                higher_lower_contact = CONTRACT_TYPES.HIGHER.toLowerCase();
                                rise_fall_contract = CONTRACT_TYPES.RISE.toLowerCase();
                            }
                            const call_put_contract = is_high_low ? higher_lower_contact : rise_fall_contract;

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            if ((window as any).hj) {
                                const event_string = `placed_${is_call || is_put ? call_put_contract : category}_trade`;
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (window as any).hj('event', event_string);
                            }

                            this.root_store.contract_trade.addContract({
                                contract_id,
                                start_time,
                                longcode,
                                underlying_symbol,
                                barrier: is_digit_contract ? last_digit : null,
                                contract_type,
                                is_tick_contract,
                            });
                            this.root_store.portfolio.onBuyResponse({
                                contract_id,
                                longcode,
                                contract_type,
                            });
                            // NOTE: changing chart granularity and chart_type has to be done in a different render cycle
                            // so we have to set chart granularity to zero, and change the chart_type to 'mountain' first,
                            // and then set the chart view to the start_time
                            // draw the start time line and show longcode then mount contract
                            // this.root_store.modules.contract_trade.drawContractStartTime(start_time, longcode, contract_id);
                            if (!is_dtrader_v2 || !isMobile) {
                                // Convert raw technical values to user-friendly display names
                                // For trade_type_name, use the title from getContractTypesConfig which has human-friendly names
                                const contract_types_config = getContractTypesConfig(this.symbol);
                                const trade_type_name =
                                    contract_types_config[this.contract_type]?.title || this.contract_type;
                                const market_type_name = getMarketName(this.symbol) || this.symbol;
                                // For contract_type, we use the specific contract type (like 'ONETOUCH' -> 'Touch')
                                const contract_type_display = getTradeTypeName(contract_type) || '';

                                trackAnalyticsEvent('ce_contracts_set_up_form_v2', {
                                    action: 'run_contract',
                                    trade_type_name,
                                    market_type_name,
                                    contract_id,
                                    contract_type: contract_type_display,
                                });
                            }

                            if (!isMobile) {
                                this.root_store.ui.openPositionsDrawer();
                            }
                            this.proposal_info = {};
                            this.forgetAllProposal();
                            this.purchase_info = response;
                            this.proposal_requests = {};
                            this.debouncedProposal();
                            this.clearLimitOrderBarriers();
                            this.pushPurchaseDataToGtm(contract_data);
                            if (this.root_store.ui.is_mobile) {
                                const shortcode = response.buy.shortcode;
                                const extracted_info_from_shortcode = extractInfoFromShortcode(shortcode);
                                const contract_id = response.buy.contract_id;
                                const currency = getCurrencyDisplayCode(this.root_store.client.currency);
                                const formatted_stake = `${getCardLabelsV2().STAKE}: ${formatMoney(
                                    currency,
                                    response.buy.buy_price,
                                    true,
                                    0,
                                    0
                                )} ${currency}`;
                                const trade_type = extracted_info_from_shortcode.category;

                                if (window.location.pathname === routes.index)
                                    callback?.(
                                        {
                                            message: getTradeNotificationMessage(shortcode),
                                            redirectTo: getContractPath(contract_id),
                                            title: formatted_stake,
                                        },
                                        contract_id
                                    );

                                this.root_store.notifications.addTradeNotification({
                                    buy_price: String(is_multiplier ? this.amount : response.buy.buy_price),
                                    contract_id,
                                    contract_type: trade_type,
                                    currency,
                                    profit: '0', // Initial profit is 0 for new contracts
                                    purchase_time: response.buy.purchase_time,
                                    shortcode,
                                    status: 'open',
                                    underlying_symbol: this.symbol,
                                });
                            }

                            // Auto-scroll to bottom of page to show chart fully after contract is opened
                            setTimeout(() => {
                                const scrollContainer = document.querySelector('.bottom-nav-selection');
                                if (scrollContainer) {
                                    scrollContainer.scrollTo({
                                        top: scrollContainer.scrollHeight,
                                        behavior: 'smooth',
                                    });
                                }
                            }, 100);

                            this.is_purchasing_contract = false;
                            this.endPurchaseAttempt();
                            return;
                        }
                    }
                    this.proposal_info = {};
                    // Order matters: forgetAllProposal() no-ops when proposal_requests is already
                    // empty, so the requests must still be there when it runs. Clearing first
                    // leaves the consumed subscription alive server-side, and the re-subscribe
                    // below is deduplicated onto that dead stream — no proposal ever arrives.
                    this.forgetAllProposal();
                    this.proposal_requests = {};
                    this.purchase_info = response;
                    this.enablePurchase();
                    this.is_purchasing_contract = false;
                    this.endPurchaseAttempt();
                    this.debouncedProposal();
                })
            );
        } else {
            // The proposal can error out or be dropped between the click and this call — an
            // errored proposal is stored without an id. Returning silently would strand the
            // button's loading state, so end the attempt explicitly.
            this.endPurchaseAttempt();
        }
    }

    enablePurchase() {
        this.is_purchase_enabled = true;
    }

    /**
     * Updates the store with new values
     * @param  {Object} new_state - new values to update the store with
     * @return {Object} returns the object having only those values that are updated
     */
    updateStore(new_state: Partial<TradeStore>) {
        // Protective logic: Prevent clearing barriers for markets that need them

        Object.keys(cloneObject(new_state) || {}).forEach(key => {
            if (key === 'root_store' || ['validation_rules', 'validation_errors', 'currency'].indexOf(key) > -1) return;
            // Derived fields have no setter; assigning one throws (MobX forbids writing a computed)
            // and aborts the whole cascade — first observed as the market selector needing two clicks.
            const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
            if (descriptor?.get && !descriptor?.set) {
                delete new_state[key as keyof TradeStore];
                return;
            }
            if (JSON.stringify(this[key as keyof this]) === JSON.stringify(new_state[key as keyof TradeStore])) {
                delete new_state[key as keyof TradeStore];
            } else {
                if (key === 'symbol') {
                    this.is_purchase_enabled = false;
                    this.is_trade_enabled = false;
                    // A symbol switch invalidates any attempt still waiting on a proposal, which
                    // would otherwise keep the Buy button in its loading state.
                    this.is_purchase_pending = false;
                }

                if (new_state.start_date && typeof new_state.start_date === 'string') {
                    new_state.start_date = parseInt(new_state.start_date);
                }

                // Clear barrier validation errors when barriers are programmatically updated (V2 only)
                if (this.is_dtrader_v2 && (key === 'barrier_1' || key === 'barrier_2')) {
                    this.validation_errors.barrier_1 = [];
                    this.validation_errors.barrier_2 = [];
                }

                this[key as 'currency'] = new_state[key as keyof TradeStore] as TradeStore['currency'];

                // validation is done in mobx intercept (base_store.js)
                // when barrier_1 is set, it is compared with store.barrier_2 (which is not updated yet)
                if (key === 'barrier_2' && new_state.barrier_1) {
                    this.barrier_1 = new_state.barrier_1; // set it again, after barrier_2 is updated in store
                }
            }
        });
        return new_state;
    }

    async processNewValuesAsync(
        obj_new_values: Partial<TradeStore> = {},
        is_changed_by_user = false,
        obj_old_values: Partial<TradeStore> | null = {},
        should_forget_first = true
    ) {
        // To switch to rise_fall_equal contract type when allow equal is checked on first page refresh or
        // when switch back to Rise/Fall from another contract type i.e.
        if (obj_new_values.contract_type && obj_new_values.contract_type === TRADE_TYPES.RISE_FALL && !!this.is_equal) {
            obj_new_values.contract_type = TRADE_TYPES.RISE_FALL_EQUAL;
        }
        // when accumulator is selected, we need to change chart type to mountain and granularity to 0
        // and we need to restore previous chart type and granularity when accumulator is unselected
        const {
            prev_chart_type,
            prev_granularity,
            chart_type,
            granularity,
            savePreviousChartMode,
            updateChartType,
            updateGranularity,
        } = this.root_store.contract_trade || {};
        if (isAccumulatorContract(obj_new_values.contract_type) || isDigitTradeType(obj_new_values.contract_type)) {
            savePreviousChartMode(chart_type, granularity);
            updateGranularity(0);
            updateChartType('line');
        } else if (
            (obj_new_values.contract_type || obj_new_values.symbol) &&
            prev_chart_type &&
            prev_granularity &&
            (prev_chart_type !== chart_type || prev_granularity !== granularity)
        ) {
            updateGranularity(prev_granularity);
            updateChartType(prev_chart_type);
            savePreviousChartMode('', null);
        }
        if (/\bduration\b/.test(Object.keys(obj_new_values) as unknown as string)) {
            // TODO: fix this in input-field.jsx
            if (typeof obj_new_values.duration === 'string') {
                obj_new_values.duration = +obj_new_values.duration;
            }
        }
        // Sets the default value to Amount when Currency has changed from Fiat to Crypto and vice versa.
        if (should_forget_first) {
            this.forgetAllProposal();
            this.proposal_requests = {};
        }
        if (is_changed_by_user && /\bcurrency\b/.test(Object.keys(obj_new_values) as unknown as string)) {
            const prev_currency = obj_old_values?.currency || this.currency;
            const has_currency_changed = obj_new_values.currency !== prev_currency;

            const should_reset_stake =
                isCryptocurrency(obj_new_values.currency ?? '') ||
                // For switch between fiat and crypto and vice versa
                isCryptocurrency(obj_new_values.currency ?? '') !== isCryptocurrency(prev_currency);

            if (has_currency_changed && should_reset_stake) {
                obj_new_values.amount = obj_new_values.amount || getMinPayout(obj_new_values.currency ?? '');
            }
            this.currency = obj_new_values.currency ?? '';
        }

        if (Object.keys(obj_new_values).includes('symbol')) {
            // Clear barrier validation errors immediately when symbol change starts (V2 only)
            if (this.is_dtrader_v2) {
                this.validation_errors.barrier_1 = [];
                this.validation_errors.barrier_2 = [];
            }

            const symbol_to_check = obj_new_values.symbol ?? '';
            if (symbol_to_check && symbol_to_check.trim() !== '') {
                this.setMarketStatus(isMarketClosed(this.active_symbols, symbol_to_check));

                // Handle trade parameters reset when switching between symbols with different duration/barrier support
                if (this.symbol && this.symbol !== symbol_to_check) {
                    const trade_params_reset_values = this.handleTradeParamsResetOnSymbolChange(
                        this.symbol,
                        symbol_to_check
                    );
                    if (trade_params_reset_values) {
                        Object.assign(obj_new_values, trade_params_reset_values);
                    }
                }
            } else {
                // Reset market status to false when no symbol is available
                this.setMarketStatus(false);
            }
        }

        // Set stake to default one (from contracts_for) on symbol or contract type switch.
        // On contract type we also additionally reset take profit and stop loss
        if (this.default_stake && this.is_dtrader_v2) {
            const has_symbol_changed = obj_new_values.symbol && this.symbol && this.symbol !== obj_new_values.symbol;
            // A within-group sub-type flip (e.g. Allow equals: rise_fall ↔ rise_fall_equal) is not a
            // trade-type switch, so it must not reset the stake — mirrors the duration-group guard.
            const has_contract_type_changed =
                obj_new_values.contract_type &&
                obj_old_values?.contract_type &&
                obj_new_values.contract_type !== obj_old_values.contract_type &&
                !this.isSameTradeTypeGroup(obj_old_values.contract_type, obj_new_values.contract_type);

            if (has_symbol_changed || has_contract_type_changed) {
                const is_crypto = isCryptocurrency(this.currency ?? '');
                const default_crypto_value = getMinPayout(this.currency ?? '') ?? '';
                // Every switch starts from the entered market's own derived default (its first
                // quick pick) — a customised stake is not carried across, on any trade type. The
                // boundary is read only when probed_stake_keys proves it came from this market;
                // otherwise the contracts_for default stands and the probe corrects it.
                // Key: tabs first (no mid-switch lag), displayed type for tab-less Accumulators.
                const boundary_key =
                    getInitialTradeTypeTab(obj_new_values.contract_type ?? this.contract_type) ||
                    getDisplayedContractTypes(this.trade_types, this.contract_type, this.trade_type_tab)[0];
                const target_stake_key = `${obj_new_values.symbol ?? this.symbol}:${boundary_key}`;
                const known_boundary = this.probed_stake_keys.has(target_stake_key)
                    ? this.stake_boundary[target_stake_key]
                    : undefined;
                const derived_default = getDerivedDefaultStake(
                    this.default_stake,
                    known_boundary?.min_stake,
                    known_boundary?.max_stake
                );
                obj_new_values.amount = is_crypto ? default_crypto_value : (derived_default ?? this.default_stake);
            }
            if (has_contract_type_changed) {
                obj_new_values.has_take_profit = false;
                obj_new_values.take_profit = '';
                obj_new_values.has_stop_loss = false;
                obj_new_values.stop_loss = '';
            }
        }

        const new_state = this.updateStore(cloneObject(obj_new_values));

        if (
            is_changed_by_user ||
            /\b(symbol|contract_types_list)\b/.test(Object.keys(new_state) as unknown as string)
        ) {
            this.updateStore({
                // disable purchase button(s), clear contract info
                is_purchase_enabled: false,
                proposal_info: {},
                validation_params: {},
            });

            // To prevent infinite loop when changing from advanced end_time to digit type contract
            if (obj_new_values.contract_type && this.root_store.ui.is_advanced_duration) {
                if (isDigitTradeType(obj_new_values.contract_type)) {
                    // Only clear barriers for digit contracts - they don't use barriers
                    this.barrier_1 = '';
                    this.barrier_2 = '';
                    this.expiry_type = 'duration';
                    this.root_store.ui.is_advanced_duration = false;
                }
            }

            // TODO: handle barrier updates on proposal api
            // const is_barrier_changed = 'barrier_1' in new_state || 'barrier_2' in new_state;
            await processTradeParams(this, new_state);

            this.updateStore({
                ...(!this.is_initial_barrier_applied ? this.initial_barriers : {}),
            });
            this.is_initial_barrier_applied = true;
            if (/\b(contract_type|currency)\b/.test(Object.keys(new_state) as unknown as string)) {
                this.validateAllProperties();
            }

            // Clear barrier validation errors after processing symbol changes (V2 only)
            if (this.is_dtrader_v2 && Object.keys(obj_new_values).includes('symbol')) {
                // Use setTimeout to ensure this runs after all synchronous validation
                setTimeout(() => {
                    this.validation_errors.barrier_1 = [];
                    this.validation_errors.barrier_2 = [];
                }, 0);
            }

            this.debouncedProposal();
        }
    }

    get is_dtrader_v2() {
        // V2 is now active on both mobile and desktop — always use V2 init paths
        // to avoid duplicate API calls (V1 loadActiveSymbols/setContractTypes
        // duplicated what useActiveSymbols/useContractsFor React Query hooks already do).
        return true;
    }

    get is_synthetics_available() {
        return !!this.active_symbols?.find(item => item.market === 'synthetic_index');
    }

    get is_synthetics_trading_market_available() {
        return !!this.active_symbols?.find(
            item => item.subgroup === 'synthetics' && !isMarketClosed(this.active_symbols, item.underlying_symbol)
        );
    }

    get show_digits_stats() {
        return isDigitTradeType(this.contract_type);
    }

    setDigitStats(digit_stats: number[]) {
        this.digit_stats = digit_stats;
    }

    setTickData(tick: TickSpotData | null) {
        this.tick_data = tick;
    }

    setMobileDigitView(bool: boolean) {
        this.is_mobile_digit_view_selected = bool;
    }

    pushPurchaseDataToGtm(contract_data: TContractDataForGTM) {
        const data = {
            event: 'buy_contract',
            bom_ui: 'new',
            contract: {
                amount: contract_data.amount,
                barrier1: contract_data.barrier,
                barrier2: contract_data.barrier2,
                basis: contract_data.basis,
                buy_price: contract_data.buy_price,
                contract_type: contract_data.contract_type,
                currency: contract_data.currency,
                date_expiry: contract_data.date_expiry,
                duration: contract_data.duration,
                duration_unit: contract_data.duration_unit,
                payout: contract_data.payout,
                symbol: contract_data.underlying_symbol,
            },
            settings: {
                theme: this.root_store.ui.is_dark_mode_on ? 'dark' : 'light',
                positions_drawer: this.root_store.ui.active_sidebar_flyout ? 'open' : 'closed',
                chart: {
                    toolbar_position: this.root_store.ui.is_chart_layout_default ? 'bottom' : 'left',
                    chart_asset_info: this.root_store.ui.is_chart_asset_info_visible ? 'visible' : 'hidden',
                    chart_type: this.root_store.contract_trade.chart_type,
                    granularity: this.root_store.contract_trade.granularity,
                },
            },
        };
        this.root_store.gtm.pushDataLayer(data);
    }

    clearPurchaseInfo() {
        this.purchase_info = {};
        this.proposal_requests = {};
        this.proposal_info = {};
    }

    requestProposal() {
        // Cancel old subscriptions before creating new ones to prevent stale responses.
        this.forgetAllProposal();

        // Don't request proposals for closed markets - the server would return MarketIsClosed errors
        // which trigger error snackbars. The closed market state is handled by ClosedMarketMessage.
        if (this.is_market_closed) {
            // Forget before clearing: forgetAllProposal decides whether to unsubscribe by inspecting
            // the request map. The map is dropped alongside the prices because a stale map left next
            // to an empty proposal_info makes the purchase wait's key-count comparison unsatisfiable.
            this.forgetAllProposal();
            runInAction(() => {
                this.proposal_info = {};
                this.purchase_info = {};
                this.proposal_requests = {};
            });
            return;
        }

        // Hold proposals until the symbol's contracts_for values are applied
        // (see is_awaiting_contracts_for); processContractsForV2 re-triggers once released.
        if (this.is_dtrader_v2 && this.is_awaiting_contracts_for) {
            runInAction(() => {
                this.proposal_info = {};
                this.purchase_info = {};
                this.proposal_requests = {};
            });
            return;
        }

        // A duration-taking contract whose parameters resolve to neither a duration nor a
        // date_expiry would send a request the backend rejects with "Please specify either
        // duration or date_expiry." — and that rejection is surfaced to the user as a red toast
        // over the Buy button. Withhold the request instead, using the same forget-then-clear
        // ordering the guards above require.
        if (!hasResolvableExpiry(this)) {
            this.forgetAllProposal();
            runInAction(() => {
                this.proposal_info = {};
                this.purchase_info = {};
                this.proposal_requests = {};
            });
            return;
        }

        const requests = createProposalRequests(this);
        if (Object.values(this.validation_errors).some(e => e.length)) {
            this.forgetAllProposal();
            runInAction(() => {
                this.proposal_info = {};
                this.purchase_info = {};
                this.proposal_requests = {};
            });
            if (this.is_accumulator) this.resetAccumulatorData();
            return;
        }

        if (!isEmptyObject(requests)) {
            runInAction(() => {
                this.proposal_requests = requests as Record<string, Partial<TPriceProposalRequest>>;
                this.purchase_info = {};
            });
            Object.keys(this.proposal_requests).forEach(type => {
                WS.subscribeProposal(this.proposal_requests[type], this.onProposalResponse);
            });
        }
        this.root_store.ui.resetPurchaseStates();
    }

    forgetAllProposal() {
        const length = Object.keys(this.proposal_requests).length;
        if (length > 0) WS.forgetAll('proposal');
    }

    setMarketStatus(status: boolean) {
        this.is_market_closed = status;
    }

    // eslint-disable-next-line class-methods-use-this
    getTurbosChartBarrier(response: TProposalResponse) {
        return (Number(response.proposal?.contract_details?.barrier) - Number(response.proposal?.spot)).toFixed(
            getBarrierPipSize(response.proposal?.contract_details?.barrier ?? '')
        );
    }

    /**
     * Records the reported stake band and, once per (symbol, contract type), settles the
     * platform-chosen entry stake on the derived default. Returns true when absorbed — the caller
     * must return before proposal_info, so the platform's own rejected stake never surfaces as the
     * user's error. The fence closes before any await: a stake set after it is the user's.
     */
    private async absorbStakeLimitsProbe(
        response: TResponse<TPriceProposalRequest, TProposalResponse, 'proposal'>,
        contract_type: string
    ): Promise<boolean> {
        const { min_stake, max_stake } = getStakeLimitsFromResponse(response);
        if (!min_stake) return false;

        // Recorded from every response, fenced or not, so the boundary tracks the market priced.
        this.setStakeBoundary(contract_type, min_stake, max_stake);

        const stake_key = `${this.symbol}:${contract_type}`;
        if (this.probed_stake_keys.has(stake_key)) return false;
        this.probed_stake_keys.add(stake_key);

        const derived_default = getDerivedDefaultStake(this.default_stake, Number(min_stake), Number(max_stake));

        // Only the stake this response was priced against can be settled; a mismatch means the
        // user changed it mid-flight and their value has its own proposal coming.
        const is_stake_in_play = Number(response.echo_req.amount) === Number(this.amount);

        // Any difference from the derived default is settled, not only below-minimum: a valid stake
        // carried in from a higher-minimum market still isn't this market's first quick pick.
        const needs_correction = !!derived_default && is_stake_in_play && Number(this.amount) !== derived_default;

        // Clean success at the settled stake: fall through, the price becomes visible. A rejection
        // is absorbed even without a correction — the fence means nothing would ever re-price it.
        if (!needs_correction && !response.error) return false;

        // A rejection answering a stake the user replaced mid-flight: swallow WITHOUT side effects.
        // Its choices were priced against the old stake and any standing error belongs to the new
        // draft; the user's own proposal is already in flight and delivers their state.
        if (!needs_correction && !is_stake_in_play) return true;

        if (needs_correction) await this.processNewValuesAsync({ amount: derived_default }, false, null, false);
        this.clearAbsorbedStakeError();
        this.applyAbsorbedContractChoices(response);
        this.debouncedProposal();
        return true;
    }

    // Drops the stake error a rejected probe left standing — requestProposal bails while any
    // validation error stands, which would block the re-price meant to replace it.
    private clearAbsorbedStakeError() {
        if (this.validation_errors.amount?.length) this.validation_errors.amount = [];
    }

    /**
     * Applies the contract values riding the same payload as the limits, for an absorbed response
     * — the early return skips the branches that normally apply them. Vanillas: barrier_choices.
     * Turbos: payout_per_point_choices (without them the re-price is unpriceable).
     */
    private applyAbsorbedContractChoices(response: TResponse<TPriceProposalRequest, TProposalResponse, 'proposal'>) {
        if (this.is_vanilla) {
            this.applyVanillaBarrierChoices(
                (response.proposal?.barrier_choices ?? response.error?.details?.barrier_choices) as string[] | undefined
            );
            return;
        }

        if (!this.is_turbos) return;

        const payout_per_point_choices = (response.proposal?.payout_choices ??
            response.error?.details?.payout_per_point_choices) as number[] | undefined;
        if (!payout_per_point_choices?.length) return;

        this.setPayoutChoices(payout_per_point_choices.map(choice => String(choice)));
        // Mid-list, matching the choice the visible error branch makes.
        this.payout_per_point = String(payout_per_point_choices[Math.floor(payout_per_point_choices.length / 2)]);
    }

    async onProposalResponse(response: TResponse<TPriceProposalRequest, TProposalResponse, 'proposal'>) {
        const { contract_type, underlying_symbol } = response.echo_req;

        // Ignore stale proposal responses: one raised for a previously selected symbol, and one for
        // a contract type with no outstanding request — the symbol check alone doesn't catch a
        // same-symbol trade-type switch, which the tab strip supports.
        // underlying_symbol is always present in proposal echo_req (set in createProposalRequests).
        // The falsy checks are intentional: if absent for any reason, fall through and process normally.
        if (underlying_symbol && underlying_symbol !== this.symbol) {
            return;
        }
        // Same staleness rule on the trade-type dimension: a type with no outstanding request is a
        // straggler from a tab the user left (forgotten subscription, response already in flight)
        // and must not settle stake or choices for a contract no longer on screen. This subsumes a
        // `trade_types` check — createProposalRequests rebuilds the map for the current tab, so a
        // type the tab no longer trades has no entry here either.
        if (contract_type && !(contract_type in this.proposal_requests)) {
            return;
        }
        // Ignore MarketIsClosed errors - the closed market state is already handled by
        // is_market_closed flag and the ClosedMarketMessage component in the UI.
        if (response.error?.code === 'MarketIsClosed') {
            return;
        }

        // Limits probe — absorbed responses never reach proposal_info (see its doc).
        if (await this.absorbStakeLimitsProbe(response, contract_type)) return;

        // add/update expiration or date_expiry for crypto indices from proposal
        const date_expiry = response.proposal?.date_expiry;
        this.expiry_epoch = date_expiry || this.expiry_epoch;

        if (!response.error && !!date_expiry && this.is_crypto_multiplier) {
            this.expiration = date_expiry;
        }

        this.proposal_info = {
            ...this.proposal_info,
            [contract_type]: getProposalInfo(this, response),
        };
        this.validation_params = {
            ...this.validation_params,
            [contract_type]: this.proposal_info[contract_type].validation_params,
        };

        if (this.is_multiplier && this.proposal_info && this.proposal_info.MULTUP) {
            const { cancellation, limit_order } = this.proposal_info.MULTUP;
            // cancellation.ask_price and the stop out loss amount are the same for MULTUP/MULTDOWN
            if (cancellation) {
                this.cancellation_price = cancellation.ask_price;
            }
            this.stop_out = limit_order?.stop_out?.order_amount;
            const selected_type = this.trade_type_tab || CONTRACT_TYPES.MULTIPLIER.UP;
            this.stop_out_level = this.proposal_info[selected_type]?.limit_order?.stop_out?.value;
        }

        if (this.is_accumulator && this.proposal_info?.ACCU) {
            const {
                barrier_spot_distance,
                maximum_ticks = 0,
                ticks_stayed_in,
                tick_size_barrier_percentage = '',
                last_tick_epoch,
                maximum_payout = 0,
                high_barrier,
                low_barrier,
                spot_time,
            } = this.proposal_info.ACCU;
            this.ticks_history_stats = getUpdatedTicksHistoryStats({
                previous_ticks_history_stats: this.ticks_history_stats,
                new_ticks_history_stats: ticks_stayed_in,
                last_tick_epoch,
            });
            this.maximum_ticks = maximum_ticks;
            this.maximum_payout = maximum_payout;
            this.tick_size_barrier_percentage = tick_size_barrier_percentage;
            const { updateAccumulatorBarriersData } = this.root_store.contract_trade || {};
            if (updateAccumulatorBarriersData) {
                updateAccumulatorBarriersData({
                    accumulators_high_barrier: high_barrier,
                    accumulators_low_barrier: low_barrier,
                    barrier_spot_distance,
                    current_spot_time: spot_time,
                    underlying: this.symbol,
                });
            }
        }

        if (!this.main_barrier || this.main_barrier?.shade) {
            if (this.is_turbos) {
                if (response.proposal) {
                    const chart_barrier = response.proposal.contract_details?.barrier_spot_distance;
                    this.setMainBarrier({
                        ...response.echo_req,
                        barrier: String(chart_barrier),
                    });
                }
            } else {
                this.setMainBarrier(response.echo_req);
            }
        }

        if (this.hovered_contract_type === contract_type) {
            setLimitOrderBarriers({
                barriers: this.root_store.portfolio.barriers,
                contract_info: this.proposal_info[this.hovered_contract_type ?? ''],
                contract_type,
                is_over: true,
            });
        }

        if (response.error) {
            const error_id = getProposalErrorField(response);
            if (error_id) {
                this.setValidationErrorMessages(error_id, [mapErrorMessage(response.error)]);
            }
            if (this.is_accumulator) this.resetAccumulatorData();

            // Sometimes when we navigate fast, `forget_all` proposal is called immediately after proposal subscription calls.
            // But, in the BE, `forget_all` proposal call is processed before the proposal subscriptions are registered. In this case, `forget_all` proposal doesn't forget the new subscriptions.
            // So when we send new proposal subscription requests, we get `AlreadySubscribed` error.
            // If we get an error message with code `AlreadySubscribed`, `forget_all` proposal will be called and all the existing subscriptions will be marked as complete in `deriv-api` and will subscribe to new proposals
            if (response.error.code === 'AlreadySubscribed') {
                this.refresh();

                if (this.is_trade_component_mounted) {
                    this.debouncedProposal();
                }
                return;
            }

            if (this.is_vanilla) {
                const { barrier_choices } = response.error.details ?? {};

                // The limits carried on this error were already recorded at the top of the handler,
                // which reads error.details for every Vanillas response — a plain stake rejection is
                // exactly where the market minimum shows up, so nothing is left to record here.

                // Sometimes the initial barrier doesn't match with current barrier choices received from API.
                // When this happens we want to populate the list of barrier choices to choose from since the value cannot be specified manually
                this.applyVanillaBarrierChoices(barrier_choices as string[] | undefined);
            }
            if (this.is_turbos && response.error.details?.payout_per_point_choices) {
                // Ignore stale error responses just as we do for success responses.
                if (Number(response.echo_req.amount) !== Number(this.amount)) return;

                const { payout_per_point_choices, min_stake, max_stake } = response.error.details;
                const payoutIndex = Math.floor(payout_per_point_choices.length / 2);
                this.setPayoutChoices(payout_per_point_choices.map(item => String(item)));
                this.setStakeBoundary(contract_type, min_stake, max_stake);
                this.onChange({
                    target: {
                        name: 'payout_per_point',
                        value: String(payout_per_point_choices[payoutIndex]),
                    },
                });
                if (response.proposal?.contract_details?.barrier) {
                    this.barrier_1 = String(this.getTurbosChartBarrier(response));
                }
            }
        } else {
            this.validateAllProperties();
            if (this.is_vanilla) {
                const { max_stake, min_stake, barrier_choices } = response.proposal ?? {};

                // Store the current barrier value before updating choices
                const previous_barrier = this.barrier_1;

                this.setBarrierChoices(barrier_choices as string[]);
                this.setStakeBoundary(contract_type, min_stake, max_stake);

                // If the current barrier is not in the new choices, find the closest match
                if (barrier_choices && !barrier_choices.includes(previous_barrier)) {
                    this.barrier_1 = this.findClosestBarrierValue(previous_barrier, barrier_choices as string[]);
                    this.onChange({
                        target: {
                            name: 'barrier_1',
                            value: this.barrier_1,
                        },
                    });
                }
            } else if (this.is_turbos) {
                // Ignore stale Turbo responses where the stake no longer matches.
                // payout_choices are stake-dependent, so applying choices from a different stake is always wrong.
                if (Number(response.echo_req.amount) !== Number(this.amount)) return;
                const { max_stake, min_stake, payout_choices } = response.proposal ?? {};
                const { barrier_spot_distance } = response.proposal?.contract_details ?? {};
                if (payout_choices) {
                    if (this.payout_per_point == '') {
                        this.onChange({
                            target: {
                                name: 'payout_per_point',
                                value: String(payout_choices[Math.floor(payout_choices.length / 2)]),
                            },
                        });
                    }
                    this.setPayoutChoices(payout_choices as string[]);
                    this.setStakeBoundary(contract_type, min_stake, max_stake);
                    this.barrier_1 = barrier_spot_distance ?? '';
                }
            }
        }

        if (!this.is_purchasing_contract) {
            this.enablePurchase();
        }
    }

    onChartBarrierChange(barrier_1: string, barrier_2?: string) {
        this.processNewValuesAsync({ barrier_1, barrier_2 }, true);
    }

    changeDurationValidationRules() {
        if (this.expiry_type === 'endtime' || this.form_components.indexOf('duration') === -1) {
            this.validation_errors.duration = [];
            return;
        }

        if (!this.validation_rules.duration) return;

        const index = this.validation_rules.duration.rules?.findIndex(item => item[0] === 'number');
        const limits = this.duration_min_max[this.contract_expiry_type] || false;

        if (limits) {
            const duration_options = {
                min: convertDurationLimit(+limits.min, this.duration_unit),
                max: convertDurationLimit(+limits.max, this.duration_unit),
            };

            if (Number(index) > -1 && this.validation_rules.duration.rules) {
                this.validation_rules.duration.rules[Number(index)][1] = duration_options;
            } else {
                this.validation_rules.duration.rules?.push(['number', duration_options]);
            }
            this.validateProperty('duration', this.duration);
        } else {
            // No limits for this expiry bucket (e.g. daily-only symbol while
            // contract_expiry_type says 'intraday') — a min/max error from the previous
            // bucket can't be re-validated and would block proposals; clear it.
            this.validation_errors.duration = [];
        }
    }

    async languageChangeListener() {
        await this.loadActiveSymbols();
        this.resetErrorServices();
    }

    preSwitchAccountListener() {
        this.clearContracts();
        this.is_trade_enabled = false;
        this.is_trade_enabled_v2 = false;
        return Promise.resolve();
    }

    async logoutListener() {
        this.clearContracts();
        this.refresh();
        this.resetErrorServices();
        await this.loadActiveSymbols();
        if (this.root_store.common.is_language_changing) {
            this.root_store.common.is_language_changing = false;
        }
        this.is_trade_enabled = true;
        this.is_trade_enabled_v2 = true;
        this.debouncedProposal();
    }

    clientInitListener() {
        this.initAccountCurrency(this.root_store.client.currency || this.root_store.client.default_currency);
        return Promise.resolve();
    }

    networkStatusChangeListener(is_online: boolean) {
        this.setTradeStatus(is_online);
        this.is_trade_enabled_v2 = is_online;
    }

    resetErrorServices() {
        this.root_store.ui.toggleServicesErrorModal(false);
    }

    onMount() {
        this.root_store.notifications.removeTradeNotifications();
        if (this.is_trade_component_mounted && this.should_skip_prepost_lifecycle) {
            const { chart_type, granularity } = this.root_store.contract_trade;
            setTradeURLParams({
                chartType: chart_type,
                granularity,
                symbol: this.symbol,
                contractType: this.contract_type,
            });
            return;
        }
        this.root_store.notifications.setShouldShowPopups(false);
        this.resetAccumulatorData();
        this.onLogout(this.logoutListener);
        this.onClientInit(this.clientInitListener);
        this.onNetworkStatusChange(this.networkStatusChangeListener);

        // Add reconnection handler - onReconnect is only called when account_id exists
        // Store the handler so we can remove it later
        this.reconnectHandler = async () => {
            if (!this.is_trade_component_mounted) {
                return;
            }

            // Release the ConnectionLost purchase lock: the connection is back, and the portfolio
            // resubscription (fired by the same reconnect) surfaces whether the unconfirmed buy
            // actually executed.
            this.enablePurchase();

            try {
                // Clear existing data
                this.refresh();

                // Wait for active symbols to be (re)available in the store
                await this.loadActiveSymbols();

                // Request new proposals
                this.debouncedProposal();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error during reconnection:', error);
                // Still attempt to get proposals with existing data as fallback
                this.debouncedProposal();
            }
        };

        WS.setOnReconnect(this.reconnectHandler);

        this.setChartModeFromURL();
        this.setChartStatus(true);
        runInAction(async () => {
            this.is_trade_component_mounted = true;
            await this.prepareTradeStore();
            this.root_store.notifications.setShouldShowPopups(true);
        });
    }

    setChartModeFromURL() {
        const { chartType: chartTypeParam, granularity: granularityParam, contractType } = getTradeURLParams();
        const { chart_type, granularity, updateChartType, updateGranularity } = this.root_store.contract_trade;

        if (!isNaN(Number(granularityParam)) && granularityParam !== granularity) {
            updateGranularity(Number(granularityParam));
        }
        if (chartTypeParam && chartTypeParam !== chart_type) {
            updateChartType(chartTypeParam);
        }

        const urlParams: {
            chartType: string;
            granularity: number;
            contractType?: string;
        } = {
            chartType: chartTypeParam ?? chart_type,
            granularity: granularityParam ?? Number(granularity),
        };

        // NOTE: deliberately does NOT write this.contract_type. This runs on every Trade-page
        // mount; the trade type is owned by the selection pipeline (resolveInitialMarket /
        // selectMarketAndTradeType / setTradeSubType) — a raw chart-mode handler must never be a
        // side-channel writer for it. It only mirrors the value back into the URL.
        if (contractType) {
            urlParams.contractType = contractType;
        }

        setTradeURLParams(urlParams);
    }

    setChartStatus(status: boolean, isFromChart?: boolean) {
        if (isFromChart) {
            this.debouncedSetChartStatus(status);
        } else {
            this.is_chart_loading = status;
            this.root_store.ui.setIsChartLoading(status);
        }
    }

    async initAccountCurrency(new_currency: string) {
        if (this.currency === new_currency) return;

        await this.processNewValuesAsync({ currency: new_currency }, true, { currency: this.currency }, false);
        this.refresh();
        this.debouncedProposal();
    }

    onUnmount() {
        if (this.should_skip_prepost_lifecycle) {
            return;
        }
        this.disposeLogout();
        this.disposeClientInit();
        this.disposeNetworkStatusChange();
        this.disposeThemeChange();
        if (this.reconnectHandler) {
            WS.removeOnReconnect(this.reconnectHandler);
        }
        this.is_trade_component_mounted = false;
        this.is_chart_loading = false;
        this.root_store.ui.setIsChartLoading(false);
        this.clearV2ParamsInitialValues();
        // TODO: Find a more elegant solution to unmount contract-trade-store
        this.root_store.contract_trade.onUnmount();
        this.refresh();

        this.resetAccumulatorData();

        this.resetErrorServices();
        if (this.root_store.notifications.is_notifications_visible) {
            this.root_store.notifications.toggleNotificationsModal();
        }
        if (this.prev_chart_layout) {
            this.prev_chart_layout.is_used = false;
        }
        this.clearContracts();
        this.resetAccumulatorData();
        if (this.is_vanilla) {
            this.setBarrierChoices([]);
        }
    }

    prev_chart_layout: TPrevChartLayout = null;

    get chart_layout() {
        let layout = null;
        if (this.prev_chart_layout && this.prev_chart_layout.is_used === false) {
            layout = this.prev_chart_layout;
        }
        return layout;
    }

    get is_crypto_multiplier() {
        return this.contract_type === TRADE_TYPES.MULTIPLIER && this.symbol.startsWith('cry');
    }

    exportLayout(layout: TChartLayout) {
        delete layout.previousMaxTicks; // TODO: fix it in smartcharts
        this.prev_chart_layout = layout;
        if (this.prev_chart_layout) {
            this.prev_chart_layout.isDone = () => {
                if (this.prev_chart_layout) this.prev_chart_layout.is_used = true;
                this.setChartStatus(false);
            };
        }
    }

    // ---------- WS ----------
    wsSubscribe = (req: TTicksHistoryRequest, callback: (response: TTicksResponse) => void) => {
        const passthrough_callback = (...args: [TTicksResponse]) => {
            callback(...args);
            if ('ohlc' in args[0] && this.root_store.contract_trade.granularity !== 0) {
                const { close, pip_size } = args[0].ohlc as { close: string; pip_size: number };
                if (close && pip_size) this.setTickData({ pip_size, quote: Number(close) });
            }
            interface AccumulatorBarriersData {
                current_spot?: number;
                current_spot_time?: number;
                tick_update_timestamp?: number;
                accumulators_high_barrier?: string;
                accumulators_low_barrier?: string;
                barrier_spot_distance?: string;
                previous_spot_time?: number;
                underlying?: string;
            }

            if (this.is_accumulator) {
                let current_spot_data: AccumulatorBarriersData = {};

                if ('tick' in args[0]) {
                    const { epoch, quote, symbol } = args[0].tick as TickSpotData;
                    if (this.symbol !== symbol) return;
                    current_spot_data = {
                        current_spot: quote,
                        current_spot_time: epoch,
                        underlying: symbol,
                    };
                } else if ('history' in args[0]) {
                    const { prices, times } = args[0].history as History;
                    const symbol = args[0].echo_req.ticks_history;
                    if (this.symbol !== symbol) return;
                    current_spot_data = {
                        current_spot: prices?.[prices?.length - 1],
                        current_spot_time: times?.[times?.length - 1],
                        previous_spot_time: times?.[times?.length - 2],
                        underlying: symbol,
                    };
                } else {
                    return;
                }

                this.root_store.contract_trade.updateAccumulatorBarriersData(current_spot_data);
            }
        };
        if (isMarketClosed(this.active_symbols, req.ticks_history)) {
            delete req.subscribe;
            WS.getTicksHistory(req).then(passthrough_callback, passthrough_callback);
        } else if (req.subscribe === 1) {
            const key = JSON.stringify(req);
            const subscriber = WS.subscribeTicksHistory(req, passthrough_callback);
            g_subscribers_map[key] = subscriber;
        }
    };

    wsForget = (req: TTicksHistoryRequest) => {
        const key = JSON.stringify(req);
        if (g_subscribers_map[key]) {
            g_subscribers_map[key]?.unsubscribe();
            delete g_subscribers_map[key];
        }
        // WS.forget('ticks_history', callback, match);
    };

    wsForgetStream = (stream_id: string) => {
        WS.forgetStream(stream_id);
    };

    wsSendRequest = (req: TTradingTimesRequest | TActiveSymbolsRequest | TServerTimeRequest) => {
        if ('time' in req) {
            return ServerTime.timePromise().then(server_time => {
                if (server_time) {
                    return {
                        msg_type: 'time',
                        time: server_time.unix(),
                    };
                }
                return WS.time();
            });
        }
        if ('active_symbols' in req) {
            if (this.root_store.client.is_logged_in) {
                return WS.authorized.activeSymbols('brief');
            }
            return WS.activeSymbols('brief');
        }
        if ('trading_times' in req) {
            return WS.tradingTimes(req.trading_times);
        }
        return WS.storage.send(req);
    };

    chartStateChange(state: string, option?: TChartStateChangeOption) {
        if (
            state === STATE_TYPES.MARKET_STATE_CHANGE &&
            this.is_trade_component_mounted &&
            option?.isClosed &&
            option.isClosed !== this.is_market_closed
        ) {
            this.prepareTradeStore();
        }
        if (state === STATE_TYPES.SET_CHART_MODE) {
            if (!isNaN(Number(option?.granularity))) {
                this.root_store.contract_trade.updateGranularity(Number(option?.granularity));
            }
            if (option?.chart_type_name) {
                this.root_store.contract_trade.updateChartType(option?.chart_type_name);
            }
        }
        const { data, event_type } = getChartAnalyticsData(state as keyof typeof STATE_TYPES, option) as TPayload;
        if (data) {
            trackAnalyticsEvent(event_type, {
                ...data,
                action: data.action,
                platform: 'DTrader',
            });
        }
    }

    get has_alternative_source() {
        return this.is_multiplier && !!this.hovered_contract_type;
    }

    get has_barrier() {
        return hasBarrier(this.contract_type);
    }

    get is_accumulator() {
        return this.contract_type === TRADE_TYPES.ACCUMULATOR;
    }

    get is_multiplier() {
        return this.contract_type === TRADE_TYPES.MULTIPLIER;
    }

    get is_automation_tab() {
        return this.active_trade_panel_tab === TRADE_PANEL_TABS.AUTOMATION;
    }

    // Whether the Trade page is currently in automated-trading mode (mobile uses the /automate route
    // flag, desktop the panel tab — mirrors `is_automation_params_locked`). Selects which open-markets
    // collection `open_markets` exposes so manual and automation keep independent tabs.
    get is_automation_mode() {
        return this.root_store.ui.is_mobile ? this.is_automation_page : this.is_automation_tab;
    }

    // The active mode's open-market tabs. Consumers read this; mutations go through
    // add/remove/replaceOpenMarket, which write back to whichever collection this reflects.
    get open_markets() {
        return this.is_automation_mode ? this.open_markets_automation : this.open_markets_manual;
    }

    get is_turbos() {
        return isTurbosContract(this.contract_type);
    }

    get is_vanilla() {
        return isVanillaContract(this.contract_type);
    }

    get is_vanilla_fx() {
        return isVanillaFxContract(this.contract_type, this.symbol);
    }

    get is_touch() {
        return isTouchContract(this.contract_type);
    }

    async getFirstOpenMarket(markets_to_search: string[]) {
        // Wait for active_symbols to be populated instead of fetching again
        if (!this.active_symbols?.length) {
            try {
                await when(() => !!this.active_symbols?.length, { timeout: 10000 });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[TradeStore] Timeout waiting for active_symbols:', error);
                return undefined;
            }
        }
        return findFirstOpenMarket(this.active_symbols, markets_to_search);
    }

    /**
     * Quick-pick limits for the active (symbol, contract type): floor = derived default (the
     * lowest chip IS the applied stake) and the market cap. Derived once so both stake surfaces
     * agree; undefined until this market's own limits are known (surfaces show a skeleton).
     * validation_params first (cleared on switch, never another market's); the market-qualified
     * boundary covers the absorb round trip and tab re-entry, when validation_params is empty.
     */
    get stake_preset_limits() {
        // Tabs first (no mid-switch lag); displayed type covers tab-less Accumulators.
        const key =
            getInitialTradeTypeTab(this.contract_type) ||
            getDisplayedContractTypes(this.trade_types, this.contract_type, this.trade_type_tab)[0];
        if (!key) return undefined;

        const { stake } = this.validation_params[key] ?? {};
        // Own sub-type first, then any probed sibling of this market — Turbos prices Up and Down
        // together and either can answer first; the band belongs to the market, not the direction.
        const probed_sibling = [...this.probed_stake_keys]
            .filter(probed_key => probed_key.startsWith(`${this.symbol}:`))
            .map(probed_key => this.stake_boundary[probed_key])
            .find(Boolean);
        const boundary = this.stake_boundary[`${this.symbol}:${key}`] ?? probed_sibling;

        const max = Number(stake?.max ?? boundary?.max_stake);
        const floor = getDerivedDefaultStake(this.default_stake, Number(stake?.min ?? boundary?.min_stake), max);

        return floor ? { floor, max: Number.isFinite(max) ? max : undefined } : undefined;
    }

    /**
     * Records a reported band under `${symbol}:${type}`. min alone is enough (rejections often
     * carry no max, and everything derives from the min); a known value survives a later partial
     * report.
     */
    setStakeBoundary(type: string, min_stake?: number, max_stake?: number) {
        if (!min_stake && !max_stake) return;

        const key = `${this.symbol}:${type}`;
        const existing = this.stake_boundary[key];
        this.stake_boundary = {
            ...this.stake_boundary,
            [key]: {
                min_stake: min_stake ?? existing?.min_stake,
                max_stake: max_stake ?? existing?.max_stake,
            },
        };
    }

    setActiveSymbolsV2(active_symbols: ActiveSymbols) {
        this.active_symbols = active_symbols;
        this.has_symbols_for_v2 = !!active_symbols.length;
    }

    setContractTypesListV2(contract_types_list: TContractTypesList) {
        this.contract_types_list_v2 = contract_types_list;
    }

    /**
     * Finds the closest barrier value from the available choices
     * @param current_value - The current barrier value selected by the user
     * @param barrier_choices - The list of available barrier choices
     * @returns The closest available barrier value to the user's selection
     */
    findClosestBarrierValue(current_value: string, barrier_choices: string[]): string {
        if (!barrier_choices.length) return current_value;
        if (barrier_choices.includes(current_value)) return current_value;

        // Convert strings to numbers for comparison
        // Handle both formats: absolute values like "1790.00" and relative values like "+0.650"
        const isRelative = current_value.startsWith('+') || current_value.startsWith('-');
        const current_numeric = parseFloat(current_value);

        // Find the closest value
        return barrier_choices.reduce(
            (closest, choice) => {
                const choice_numeric = parseFloat(choice);

                // If both are relative or both are absolute, compare directly
                if (
                    (isRelative && (choice.startsWith('+') || choice.startsWith('-'))) ||
                    (!isRelative && !choice.startsWith('+') && !choice.startsWith('-'))
                ) {
                    if (Math.abs(choice_numeric - current_numeric) < Math.abs(parseFloat(closest) - current_numeric)) {
                        return choice;
                    }
                }
                return closest;
            },
            barrier_choices[Math.floor(barrier_choices.length / 2)]
        ); // Default to median if comparison fails
    }

    /**
     * Applies the Vanillas strike choices carried on a proposal response and snaps barrier_1 to the
     * closest offered strike when the current one is not among them. Extracted from the error branch
     * of onProposalResponse so the limits probe can run it on the response it absorbs: the limits and
     * the strike reconciliation arrive on the same payload, and returning early to re-price the stake
     * without applying the choices would leave barrier_1 on a strike the market already rejected.
     * A response with no barrier_choices is a no-op, matching the previous guard.
     */
    applyVanillaBarrierChoices(barrier_choices?: string[]) {
        if (!barrier_choices) return;

        // Store the current barrier value before updating choices
        const previous_barrier = this.barrier_1;

        this.setBarrierChoices(barrier_choices);
        if (!this.barrier_choices.includes(previous_barrier)) {
            // Find the closest value instead of defaulting to median
            this.barrier_1 = this.findClosestBarrierValue(previous_barrier, this.barrier_choices);
            this.onChange({
                target: {
                    name: 'barrier_1',
                    value: this.barrier_1,
                },
            });
        }
    }

    setBarrierChoices(barrier_choices: string[]) {
        this.barrier_choices = barrier_choices ?? [];
        if (this.is_vanilla) {
            this.strike_price_choices = { barrier: this.barrier_1, barrier_choices };
        }
    }

    setPayoutChoices(payout_choices: string[]) {
        this.payout_choices = payout_choices ?? [];
        const stored_barriers_data = { barrier: this.barrier_1, payout_choices };
        if (getContractSubtype(this.contract_type) === 'Long') {
            this.long_barriers = stored_barriers_data;
        } else {
            this.short_barriers = stored_barriers_data;
        }
    }

    togglePayoutWheelPicker() {
        this.open_payout_wheelpicker = !this.open_payout_wheelpicker;
    }
    setPayoutPerPoint(val: string) {
        if (val && val !== this.payout_per_point) {
            this.payout_per_point = val;
            this.onChange({
                target: {
                    name: 'payout_per_point',
                    value: String(this.payout_per_point),
                },
            });
        }
    }
    setIsDigitsWidgetActive(is_active: boolean) {
        this.is_digits_widget_active = is_active;
    }

    setTradeTypeTab(label = '') {
        this.trade_type_tab = label;
    }

    setActiveTradePanelTab(tab: TTradePanelTab) {
        const prev_is_automation = this.is_automation_mode;
        this.active_trade_panel_tab = tab;
        localStorage.setItem('active_trade_panel_tab', tab);
        this.reconcileTradeModeMarket(prev_is_automation);
    }

    setMarketSelectorOpen(is_open: boolean) {
        this.is_market_selector_open = is_open;
    }

    setIsAutomationPage(is_page: boolean) {
        const prev_is_automation = this.is_automation_mode;
        this.is_automation_page = is_page;
        this.reconcileTradeModeMarket(prev_is_automation);
    }

    // Called after a manual/automation mode flip. Snapshots the market of the mode we left, then
    // restores the mode we entered to its own market (remembered slot, else its most-recent tab) so
    // each mode's tabs stay independent. Skips when the flip didn't actually cross modes, or when the
    // entered mode has no market to restore yet (first automation entry — the tab strip's automation
    // effect seeds a supported default instead).
    reconcileTradeModeMarket(prev_is_automation: boolean) {
        const next_is_automation = this.is_automation_mode;
        if (prev_is_automation === next_is_automation) return;
        const leaving = { symbol: this.symbol, contract_type: this.contract_type };
        if (prev_is_automation) this.active_market_automation = leaving;
        else this.active_market_manual = leaving;
        const collection = next_is_automation ? this.open_markets_automation : this.open_markets_manual;
        const remembered = next_is_automation ? this.active_market_automation : this.active_market_manual;
        const target = remembered ?? collection[collection.length - 1];
        if (target && (target.symbol !== this.symbol || target.contract_type !== this.contract_type)) {
            this.selectMarketAndTradeType(target.symbol, target.contract_type);
        } else if (!next_is_automation) {
            // Entering manual mode with nothing to restore (first visit, empty strip): materialise
            // the carried-over pair as the manual tab explicitly — tabs are never derived from
            // watched state. (Automation seeds its own supported default via the strip's effect.)
            this.recordActiveMarketTab();
        }
    }

    setIsAwaitingContractsFor(is_awaiting: boolean) {
        this.is_awaiting_contracts_for = is_awaiting;
    }

    clearUrlTradeType() {
        this.url_trade_type = null;
    }

    /**
     * The single owner of initial market + trade-type selection, run once from the constructor.
     *
     * Priority ladder:
     *   symbol:      valid URL symbol → session-restored symbol (validated) → default pick
     *   trade type:  URL trade_type (offered → commit; known-but-not-offered → switch to a
     *                compatible market via reconcileUrlTradeTypeWithSymbol; unknown → modal)
     *                → session-restored type (validated by resolveContractTypeAvailability when
     *                the symbol's contracts_for lands — not here)
     *
     * Ends by recording the resolved pair as the ONE initial tab on the strip — initial tabs are
     * created here explicitly, never derived by watching store state. Each phase re-checks the
     * selection epoch so a user selection made mid-resolve always wins.
     */
    async resolveInitialMarket() {
        const search_params = new URLSearchParams(window.location.search);
        const url_symbol = search_params.get('symbol');
        const url_trade_type = search_params.get('trade_type');
        const epoch = ++this.selection_seq;

        // Only a genuine deep link may create a NEW tab, switch markets for a URL trade type, or
        // show the URL-unavailable modal; a restore CONVERGES to the tab strip instead of trusting
        // mirrors that can be stale (or an actives list that is only half-loaded pre-auth).
        const stored_session = (safeParse(sessionStorage.getItem('trade_store') ?? '') ?? {}) as {
            symbol?: string;
            contract_type?: string;
        };
        const is_deep_link =
            (!!url_symbol && url_symbol !== stored_session.symbol) ||
            (!!url_trade_type && url_trade_type !== stored_session.contract_type);

        // BaseStore applies the sessionStorage restore (symbol/contract_type) one macrotask after
        // construction (see the setTimeout in its constructor). Wait it out so the resolver always
        // evaluates the RESTORED pair, never the pre-restore blank/URL-seeded intermediate.
        await new Promise(resolve => setTimeout(resolve, 0));
        // ---- Phase 1: symbol (needs active_symbols) ----
        await when(() => this.has_symbols_for_v2);
        const isAvailable = (symbol?: string | null) =>
            !!symbol && this.active_symbols.some(info => info.underlying_symbol === symbol);

        let resolved_symbol = this.symbol; // session-restored, or URL-seeded by the constructor
        if (url_symbol) {
            if (isAvailable(url_symbol)) resolved_symbol = url_symbol;
            // The modal is deep-link-only: on a restore an "invalid" symbol usually just means the
            // actives list is half-loaded (e.g. pre-auth after a browser restart) — not user error.
            // Name the value that actually failed: toggleUrlUnavailableModal defaults to
            // 'trade_type', so omitting the reason here labelled a dead-end market as
            // "Unsupported trade type" (GRWT-9320).
            else if (is_deep_link) this.root_store.ui.toggleUrlUnavailableModal(true, 'symbol');
        }
        if (!isAvailable(resolved_symbol) && !is_deep_link) {
            // Restore with a stale/unavailable symbol: prefer a symbol the user explicitly has open
            // over inventing a default (pickDefaultSymbol can dredge up chart favourites the user
            // never traded.
            const strip_symbol = [...this.open_markets].reverse().find(market => isAvailable(market.symbol))?.symbol;
            if (strip_symbol) resolved_symbol = strip_symbol;
        }
        if (!isAvailable(resolved_symbol)) {
            resolved_symbol = (await pickDefaultSymbol(this.active_symbols)) || '1HZ100V';
        }
        if (this.selection_seq !== epoch) return; // user already picked a market — honour it
        if (resolved_symbol && resolved_symbol !== this.symbol) {
            await this.onChange({ target: { name: 'symbol', value: resolved_symbol } });
        }

        // ---- Phase 2: URL trade-type intent — deep links only (needs the market's processed type
        // list). On a restore the URL type is just a mirror of the session, not intent; if it turns
        // out not to be offered any more, resolveContractTypeAvailability corrects it in place. ----
        if (url_trade_type && !is_deep_link && url_trade_type === this.contract_type) {
            // Self-stamped restore: still record the landing type so consumers (e.g. automation
            // fallbacks) treat reloads as URL landings — the documented pre-existing behaviour.
            runInAction(() => {
                this.url_trade_type = url_trade_type;
            });
        }
        if (url_trade_type && is_deep_link) {
            await when(() => !isEmptyObject(this.contract_types_list_v2));
            if (this.selection_seq !== epoch) return;
            if (this.isTradeTypeOfferedInV2List(url_trade_type)) {
                // Record the URL landing atomically with the type so consumers (e.g. automation
                // fallbacks) can tell a URL landing from manual navigation.
                runInAction(() => {
                    this.url_trade_type = url_trade_type;
                });
                if (this.contract_type !== url_trade_type) {
                    await this.onChange({ target: { name: 'contract_type', value: url_trade_type } });
                }
            } else if (!Object.keys(getContractTypesConfig()).includes(url_trade_type)) {
                // Unknown trade type in the URL (a genuine dead-end deep link) — show the modal.
                this.root_store.ui.toggleUrlUnavailableModal(true, 'trade_type');
            } else {
                // A real trade type the resolved market doesn't offer (e.g. arriving from Deriv
                // Home with trade_type=rise_fall while the last-used market only offers
                // Multipliers). Prioritise the URL trade type: switch to a market that offers it.
                await this.reconcileUrlTradeTypeWithSymbol(url_trade_type, epoch);
            }
        }

        // ---- Phase 3: record the resolved pair as the one initial tab, and stamp it into the
        // URL atomically (the per-field reactions deliberately no longer write the URL) ----
        if (this.selection_seq !== epoch) return;
        const has_matching_tab = this.open_markets.some(
            market =>
                market.symbol === this.symbol && this.isSameTradeTypeGroup(market.contract_type, this.contract_type)
        );
        if (!has_matching_tab && !is_deep_link && this.open_markets.length && !this.is_automation_mode) {
            // Stale-mirror convergence: on a restore, a resolved pair with no tab was never
            // explicitly committed by the user (hybrid mirrors, half-loaded actives, a default
            // pick) — activating it would materialise a phantom tab. Converge to the strip's most
            // recent tab instead: the strip is the durable record of explicit intent.
            const last_tab = this.open_markets[this.open_markets.length - 1];
            await this.selectMarketAndTradeType(last_tab.symbol, last_tab.contract_type);
            return;
        }
        this.recordActiveMarketTab();
        this.syncTradeURLParams();
    }

    // Mirror the committed (symbol, contract_type) pair into the URL ATOMICALLY.
    private syncTradeURLParams() {
        if (!this.symbol || !this.contract_type) return;
        setTradeURLParams({ symbol: this.symbol, contractType: this.contract_type });
    }

    /** Ensure the active (symbol, contract_type) pair has a tab, matched by trade-type category.
     * Only the init resolver calls this (manual mode only — the automation strip seeds its own
     * supported default): every other tab is recorded by selectMarketAndTradeType at click time. */
    recordActiveMarketTab() {
        if (!this.symbol || !this.contract_type || this.is_automation_mode) return;
        const has_matching_tab = this.open_markets.some(
            market =>
                market.symbol === this.symbol && this.isSameTradeTypeGroup(market.contract_type, this.contract_type)
        );
        if (!has_matching_tab) this.addOpenMarket({ symbol: this.symbol, contract_type: this.contract_type });
    }

    /**
     * Prioritise a trade type coming from a URL param over a persisted/loaded symbol that doesn't
     * offer it. Scenario: the user arrives from Deriv Home with e.g. `trade_type=rise_fall` while the
     * last-used symbol (restored from storage) was Boom 1000, which only offers Multipliers. Instead
     * of silently overriding the requested trade type with the symbol's default, switch to a symbol
     * that offers the requested trade type and keep the trade type.
     *
     * If no open symbol offers the trade type, fall back to the URL-unavailable modal (the trade type
     * is effectively unavailable), leaving the current symbol untouched.
     */
    async reconcileUrlTradeTypeWithSymbol(trade_type: string, existing_epoch?: number) {
        // The URL intent is a selection like any other: it supersedes older in-flight cascades, and a
        // user selection made while this reconcile awaits supersedes IT (checked before each write).
        // When called from resolveInitialMarket it continues the resolver's own epoch instead of
        // starting a new one (the reconcile IS the URL intent, not a competing selection).
        const epoch = existing_epoch ?? ++this.selection_seq;
        // Set synchronously (before the first await) so it is observed in the same render that
        // useContractsFor unblocks the page loader — keeps the loader up instead of flashing the
        // stale market + wrong trade type.
        this.is_reconciling_url_trade_type = true;
        // Timeout guards so a market list / active_symbols that never settle (API failure, native-app
        // trade-type filtering) can't leave this awaiting forever. On timeout `when` rejects and the
        // catch leaves the current state as-is — useContractsFor still keeps the UI consistent.
        const WAIT_TIMEOUT = 30000;
        try {
            // The market list (contract_types_list_v2) can arrive from useContractsFor before
            // active_symbols land in the store from useActiveSymbols. Wait for the symbols so the
            // search has candidates — otherwise it would find nothing and wrongly show the modal.
            await when(() => this.active_symbols.length > 0, { timeout: WAIT_TIMEOUT });
            const compatible_symbol = await findSymbolForTradeType(this.active_symbols, trade_type);
            // Superseded by a newer selection (e.g. the user already picked a market while we waited)
            // — honour the user's choice and drop the URL intent silently (no modal, no writes).
            if (this.selection_seq !== epoch) return;
            if (!compatible_symbol) {
                this.root_store.ui.toggleUrlUnavailableModal(true, 'trade_type');
                return;
            }
            // Mark this as a URL landing so downstream fallbacks (e.g. automation) honour the intent.
            runInAction(() => {
                this.url_trade_type = trade_type;
            });
            if (compatible_symbol !== this.symbol) {
                await this.onChange({ target: { name: 'symbol', value: compatible_symbol } });
                // useContractsFor refetches for the new market asynchronously and, on that run, defaults
                // the trade type to the market's first available one. Wait until its list is populated and
                // offers the requested trade type, then apply it last so default-selection can't override it.
                await when(() => this.isTradeTypeOfferedInV2List(trade_type), { timeout: WAIT_TIMEOUT });
            } else if (!this.isTradeTypeOfferedInV2List(trade_type)) {
                // The compatible market is already the current one, but its processed V2 list doesn't
                // expose the trade type (e.g. native-app/region filtering that the raw contracts_for the
                // search relies on doesn't apply). Nothing will refetch to change that, so fail fast to the
                // modal instead of waiting out the timeout — consistent with the "no available market" path.
                this.root_store.ui.toggleUrlUnavailableModal(true, 'trade_type');
                return;
            }
            // Same supersession check after the waits above: never overwrite a user selection that
            // started while the reconcile was pending.
            if (this.selection_seq !== epoch) return;
            if (this.contract_type !== trade_type) {
                await this.onChange({ target: { name: 'contract_type', value: trade_type } });
            }
            if (this.selection_seq === epoch) this.syncTradeURLParams();
        } catch (error) {
            // active_symbols/market list didn't settle in time (when timeout), or a switch failed — leave
            // the current state untouched rather than surfacing an error. Logged so a timeout is
            // distinguishable from a genuine programming error during local testing/QA.
            // eslint-disable-next-line no-console
            console.error('[reconcileUrlTradeTypeWithSymbol] failed:', error);
        } finally {
            runInAction(() => {
                this.is_reconciling_url_trade_type = false;
            });
        }
    }

    /** Whether the current V2 market list exposes `trade_type` as a selectable (available) category. */
    isTradeTypeOfferedInV2List(trade_type: string) {
        return Object.values(this.contract_types_list_v2 ?? {}).some(category =>
            (category?.categories ?? []).some(item => (item as { value?: string })?.value === trade_type)
        );
    }

    /**
     * Clears barrier validation errors consistently across the application
     * This method ensures validation errors are cleared when barriers are programmatically updated
     */
    private clearBarrierValidationErrors(): void {
        if (this.is_dtrader_v2) {
            this.validation_errors.barrier_1 = [];
            this.validation_errors.barrier_2 = [];
        }
    }

    /**
     * Per-field reset of the trade-parameter validation errors, mirroring
     * `clearBarrierValidationErrors` above. The field list comes from `getValidationRules` so it
     * cannot drift, and clearing field-by-field (rather than replacing `validation_errors`) leaves
     * anything another owner put on the object untouched.
     */
    private clearTradeParamValidationErrors(): void {
        Object.keys(getValidationRules()).forEach(field => {
            if (this.validation_errors[field]?.length) this.validation_errors[field] = [];
        });
    }

    /**
     * Drops every error surface a market tab can leave behind: the cached proposal error, the
     * trade-parameter validation errors, and any pending service error. Called before a tab's
     * symbol/contract-type cascade so the window between the tap and the first `onChange` carries
     * no error from the tab being left.
     */
    private clearTradeErrorState(): void {
        this.proposal_info = {};
        this.validation_params = {};
        this.clearTradeParamValidationErrors();
        // Guarded so a plain tab tap doesn't fire the action on every switch, matching the
        // portfolio store's guarded reset.
        if (!isEmptyObject(this.root_store.common.services_error)) {
            this.root_store.common.resetServicesError();
        }
    }

    /**
     * Reads the default barrier that `contracts_for` returns for a contract type + `expiry_type`
     * (the same data `getBarriers` parses into `barrier_1`). Returns undefined when the currently
     * loaded contracts_for config (which only covers the active symbol) has no entry for it.
     */
    private getApiDefaultBarrier(
        contract_type: string = this.contract_type,
        expiry_type: string = this.contract_expiry_type,
        // The symbol to read config for. handleTradeParamsResetOnSymbolChange runs before
        // `this.symbol` is updated, so it must ask for the incoming symbol explicitly — the default
        // would hand it the outgoing market's barrier.
        symbol: string | null = this.symbol
    ): string | undefined {
        if (!contract_type || !expiry_type) return undefined;

        const default_barrier = getPropertyValue(ContractType.getFullContractTypes(symbol), [
            contract_type,
            'config',
            'barriers',
            expiry_type,
            'barrier',
        ]);

        return typeof default_barrier === 'string' && default_barrier ? default_barrier : undefined;
    }

    /**
     * Derives barrier support (relative offset vs absolute price) from the sign of the API's
     * per-expiry-type default barrier: a leading `+`/`-` means relative, a bare number means
     * absolute. Returns null when no default barrier is available for this contract type +
     * expiry_type (e.g. contracts_for for it hasn't loaded yet).
     */
    public getBarrierSupportFromApiDefault(
        contract_type: string = this.contract_type,
        expiry_type: string = this.contract_expiry_type,
        symbol: string | null = this.symbol
    ): BarrierSupportType | null {
        const default_barrier = this.getApiDefaultBarrier(contract_type, expiry_type, symbol);
        if (!default_barrier) return null;

        return /^[+-]/.test(default_barrier) ? 'relative' : 'absolute';
    }

    /**
     * Pre-populated default barrier for the current contract type + expiry_type: the store's
     * `barrier_1` when it's already been set from the API (by `getBarriers`), otherwise the
     * hardcoded BARRIER_DEFAULTS fallback for the given support type.
     */
    public getDefaultBarrierValue(
        support: BarrierSupportType = this.getBarrierSupportFromApiDefault() ?? 'absolute'
    ): string {
        if (this.barrier_1) return this.barrier_1;

        if (support === 'absolute') {
            const current_spot = this.tick_data?.quote;
            return current_spot
                ? (current_spot + BARRIER_DEFAULTS.ABSOLUTE_BARRIER_OFFSET).toFixed(
                      BARRIER_DEFAULTS.ABSOLUTE_BARRIER_DECIMAL_PLACES
                  )
                : BARRIER_DEFAULTS.FALLBACK_ABSOLUTE_BARRIER;
        }
        return BARRIER_DEFAULTS.DEFAULT_RELATIVE_BARRIER;
    }

    /**
     * Helper function to determine if a symbol supports relative barriers (Above/Below spot).
     *
     * Falls back to 'relative' while the symbol list hasn't loaded or the symbol isn't in it: the
     * barrier field renders from a static per-trade-type map that doesn't wait for
     * `active_symbols`, and most barrier symbols are synthetics, so guessing 'absolute' shows a
     * fixed-price field that then switches to the sign control once the data arrives.
     *
     * @param symbol - The symbol to check
     * @returns 'relative' for synthetic indices, 'absolute' for forex markets
     */
    public getSymbolBarrierSupport(symbol: string): BarrierSupportType {
        if (!symbol || !this.active_symbols.length) return 'relative';

        const symbol_info = this.active_symbols.find(s => s.underlying_symbol === symbol);

        if (!symbol_info) return 'relative';

        // Prefer the live API default-barrier sign for the currently selected symbol's contract
        // type. A prospective symbol (one we haven't switched to yet) has no contracts_for
        // loaded, so it falls through to the market-based heuristic below.
        // Any symbol whose contracts_for is cached can answer for itself now that the cache is keyed
        // by symbol — an unloaded one yields undefined and falls through to the heuristic below.
        const api_default_support = this.getBarrierSupportFromApiDefault(undefined, undefined, symbol);
        if (api_default_support) return api_default_support;

        // Forex symbols typically only support absolute barriers
        // Synthetic indices typically support relative barriers
        const market = symbol_info.market;
        const symbol_type = symbol_info.underlying_symbol_type;

        // Forex markets only support absolute barriers
        if (market === 'forex' || symbol_type === 'forex') {
            return 'absolute';
        }

        // Most other markets (synthetic_index, etc.) support relative barriers
        return 'relative';
    }

    /**
     * Helper function to determine if a symbol supports ticks or only endtime
     * @param symbol - The symbol to check
     * @returns 'ticks' for synthetic indices, 'endtime' for forex markets
     */
    private getSymbolDurationSupport(symbol: string): DurationSupportType {
        if (!symbol || !this.active_symbols.length) return 'endtime';

        const symbol_info = this.active_symbols.find(s => s.underlying_symbol === symbol);

        if (!symbol_info) return 'endtime';

        // Forex symbols typically only support endtime (no tick-based contracts)
        // Synthetic indices typically support ticks
        const market = symbol_info.market;
        const symbol_type = symbol_info.underlying_symbol_type;

        // Forex markets only support endtime
        if (market === 'forex' || symbol_type === 'forex') {
            return 'endtime';
        }

        // Most other markets (synthetic_index, etc.) support ticks
        return 'ticks';
    }

    /**
     * Handles trade parameters reset when switching between symbols with different support
     * This includes both barrier and duration resets for all platforms (desktop and mobile)
     * @param old_symbol - The previous symbol
     * @param new_symbol - The new symbol being switched to
     * @returns Object with trade parameters to reset, or null if no reset needed
     */
    handleTradeParamsResetOnSymbolChange(old_symbol: string, new_symbol: string): Partial<TradeStore> | null {
        if (!old_symbol || !new_symbol || old_symbol === new_symbol) return null;

        const old_barrier_support = this.getSymbolBarrierSupport(old_symbol);
        const new_barrier_support = this.getSymbolBarrierSupport(new_symbol);
        const old_duration_support = this.getSymbolDurationSupport(old_symbol);
        const new_duration_support = this.getSymbolDurationSupport(new_symbol);

        const barrier_support_changed = old_barrier_support !== new_barrier_support;
        const duration_support_changed = old_duration_support !== new_duration_support;

        // Only reset if switching between different support types
        if (barrier_support_changed || duration_support_changed) {
            // Clear ALL localStorage values related to barriers and duration
            try {
                // Barrier-related localStorage keys
                localStorage.removeItem('deriv_spot_barrier_value');
                localStorage.removeItem('deriv_fixed_barrier_value');
                localStorage.removeItem('deriv_barrier_type_selection');
                localStorage.removeItem('deriv_barrier_1');
                localStorage.removeItem('deriv_barrier_2');

                // Duration-related localStorage keys
                localStorage.removeItem('deriv_duration');
                localStorage.removeItem('deriv_duration_unit');
                localStorage.removeItem('deriv_expiry_type');
                localStorage.removeItem('deriv_expiry_date');
                localStorage.removeItem('deriv_expiry_time');

                // V2-specific localStorage keys
                localStorage.removeItem('deriv_v2_params_initial_values');
            } catch (error) {
                // Ignore localStorage errors
            }

            const reset_values: Partial<TradeStore> = {};

            // Reset barrier values if barrier support changed
            if (barrier_support_changed) {
                // Clear barrier validation errors before updating values to prevent "required field" errors
                this.clearBarrierValidationErrors();

                // Prefer the live API default barrier for the new symbol — with two tabs open its
                // contracts_for is usually already cached. This previously defaulted to `this.symbol`,
                // which is still the OUTGOING market here, so it seeded the barrier we just left.
                const api_default_barrier = this.getApiDefaultBarrier(undefined, undefined, new_symbol);

                if (new_barrier_support === 'absolute') {
                    // Switching to absolute barriers (e.g., forex)
                    // Get current spot price or use a reasonable default
                    const current_spot = this.tick_data?.quote;
                    const default_barrier =
                        api_default_barrier ||
                        (current_spot
                            ? (current_spot + BARRIER_DEFAULTS.ABSOLUTE_BARRIER_OFFSET).toFixed(
                                  BARRIER_DEFAULTS.ABSOLUTE_BARRIER_DECIMAL_PLACES
                              )
                            : BARRIER_DEFAULTS.FALLBACK_ABSOLUTE_BARRIER);
                    reset_values.barrier_1 = default_barrier;
                    reset_values.barrier_2 = '';
                } else {
                    // Switching to relative barriers (e.g., synthetics)
                    // Reset to default relative barrier
                    reset_values.barrier_1 = api_default_barrier || BARRIER_DEFAULTS.DEFAULT_RELATIVE_BARRIER;
                    reset_values.barrier_2 = '';
                }
            }

            return Object.keys(reset_values).length > 0 ? reset_values : null;
        }

        return null;
    }
}
