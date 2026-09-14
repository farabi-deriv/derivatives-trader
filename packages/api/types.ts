import type {
    ActiveSymbolsRequest as BaseActiveSymbolsRequest,
    ActiveSymbolsResponse as BaseActiveSymbolsResponse,
    AuthorizeRequest as BaseAuthorizeRequest,
    AuthorizeResponse as BaseAuthorizeResponse,
    BalanceRequest as BaseBalanceRequest,
    BalanceResponse as BaseBalanceResponse,
    BuyContractRequest as BaseBuyContractRequest,
    BuyContractResponse as BaseBuyContractResponse,
    CancelAContractRequest as BaseCancelAContractRequest,
    CancelAContractResponse as BaseCancelAContractResponse,
    ContractsForSymbolRequest as BaseContractsForSymbolRequest,
    ContractsForSymbolResponse as BaseContractsForSymbolResponse,
    ForgetAllRequest,
    ForgetAllResponse,
    ForgetRequest,
    ForgetResponse,
    LogOutRequest,
    LogOutResponse,
    PingRequest,
    PingResponse,
    PortfolioRequest as BasePortfolioRequest,
    PortfolioResponse as BasePortfolioResponse,
    PriceProposalOpenContractsRequest as BasePriceProposalOpenContractsRequest,
    PriceProposalOpenContractsResponse as BasePriceProposalOpenContractsResponse,
    PriceProposalRequest as BasePriceProposalRequest,
    PriceProposalResponse as BasePriceProposalResponse,
    ProfitTableRequest as BaseProfitTableRequest,
    ProfitTableResponse as BaseProfitTableResponse,
    SellContractRequest as BaseSellContractRequest,
    SellContractResponse as BaseSellContractResponse,
    ServerTimeRequest,
    ServerTimeResponse,
    StatementRequest as BaseStatementRequest,
    StatementResponse as BaseStatementResponse,
    TicksHistoryRequest,
    TicksHistoryResponse,
    TicksStreamRequest,
    TicksStreamResponse,
    TradingTimesRequest,
    TradingTimesResponse as BaseTradingTimesResponse,
    TransactionsStreamRequest as BaseTransactionsStreamRequest,
    TransactionsStreamResponse as BaseTransactionsStreamResponse,
    UpdateContractHistoryRequest as BaseUpdateContractHistoryRequest,
    UpdateContractHistoryResponse as BaseUpdateContractHistoryResponse,
    UpdateContractRequest as BaseUpdateContractRequest,
    UpdateContractResponse as BaseUpdateContractResponse,
} from '@deriv/api-types';
import type { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

// V2 API overrides
type ActiveSymbolsRequest = Omit<
    BaseActiveSymbolsRequest,
    'landing_company' | 'landing_company_short' | 'product_type' | 'loginid' | 'barrier_category'
>;

type ActiveSymbolsResponse = Omit<BaseActiveSymbolsResponse, 'active_symbols'> & {
    active_symbols?: Array<
        Omit<
            NonNullable<BaseActiveSymbolsResponse['active_symbols']>[0],
            | 'allow_forward_starting'
            | 'delay_amount'
            | 'display_name'
            | 'market_display_name'
            | 'subgroup_display_name'
            | 'submarket_display_name'
            | 'quoted_currency_symbol'
            | 'spot'
            | 'spot_time'
            | 'spot_age'
            | 'spot_percentage_change'
            | 'exchange_name'
            | 'intraday_interval_minutes'
            | 'pip'
            | 'symbol'
            | 'symbol_type'
        > & {
            pip_size?: number;
            underlying_symbol?: string;
            underlying_symbol_type?: string;
        }
    >;
};

type ContractsForSymbolRequest = Omit<
    BaseContractsForSymbolRequest,
    'currency' | 'landing_company' | 'landing_company_short' | 'product_type' | 'loginid'
>;

type ContractsForSymbolResponse = Omit<BaseContractsForSymbolResponse, 'contracts_for'> & {
    contracts_for?: Omit<
        NonNullable<BaseContractsForSymbolResponse['contracts_for']>,
        | 'contract_category_display'
        | 'contract_display'
        | 'duration_choices'
        | 'trade_risk_profile_choices'
        | 'exchange_name'
        | 'forward_starting_options'
        | 'trading_periods'
        | 'start_type'
        | 'barrier_category'
        | 'available'
    > & {
        available: Array<
            Omit<
                NonNullable<NonNullable<BaseContractsForSymbolResponse['contracts_for']>['available']>[0],
                'symbol'
            > & {
                underlying_symbol?: string;
                default_stake?: number;
                payout_choices?: number[];
            }
        >;
    };
};

type PriceProposalRequest = Omit<
    BasePriceProposalRequest,
    | 'barrier_range'
    | 'date_start'
    | 'product_type'
    | 'trade_risk_profile'
    | 'trading_period_start'
    | 'loginid'
    | 'symbol'
> & {
    underlying_symbol?: string;
};

type PriceProposalResponse = Omit<BasePriceProposalResponse, 'proposal'> & {
    proposal?: Omit<NonNullable<BasePriceProposalResponse['proposal']>, 'display_value'> & {
        payout_choices?: string[];
    };
};

type BuyContractRequest = Omit<BaseBuyContractRequest, 'loginid' | 'parameters'> & {
    parameters?: Omit<
        NonNullable<BaseBuyContractRequest['parameters']>,
        'barrier_range' | 'date_start' | 'product_type' | 'trade_risk_profile' | 'trading_period_start' | 'symbol'
    > & {
        underlying_symbol?: string;
    };
};

type BuyContractResponse = BaseBuyContractResponse;

type PriceProposalOpenContractsRequest = Omit<BasePriceProposalOpenContractsRequest, 'loginid'>;

type PriceProposalOpenContractsResponse = Omit<BasePriceProposalOpenContractsResponse, 'proposal_open_contract'> & {
    proposal_open_contract?: Omit<
        NonNullable<BasePriceProposalOpenContractsResponse['proposal_open_contract']>,
        | 'caution_price'
        | 'coupon_collection_epochs'
        | 'coupon_rate'
        | 'num_of_coupons'
        | 'profit_price'
        | 'trade_risk_profile'
        | 'current_spot_display_value'
        | 'display_name'
        | 'display_value'
        | 'entry_spot_display_value'
        | 'entry_tick'
        | 'entry_tick_display_value'
        | 'exit_tick'
        | 'exit_tick_display_value'
        | 'is_forward_starting'
        | 'sell_spot_display_value'
        | 'bid_price'
        | 'buy_price'
        | 'commission'
        | 'current_spot'
        | 'entry_spot'
        | 'exit_spot'
        | 'payout'
        | 'profit'
        | 'selected_spot'
        | 'sell_price'
        | 'sell_spot'
        | 'entry_tick_time'
        | 'exit_tick_time'
        | 'underlying'
    > & {
        // Changed to string type
        bid_price?: string;
        buy_price?: string;
        commission?: string;
        current_spot?: string;
        entry_spot?: string;
        exit_spot?: string;
        payout?: string;
        profit?: string;
        selected_spot?: string;
        sell_price?: string;
        sell_spot?: string;
        // Renamed fields
        entry_spot_time?: number;
        exit_spot_time?: number;
        underlying_symbol?: string;
        // Autotrader field — present when the contract was purchased by an automated run
        auto_run_id?: string;
    };
};

type SellContractRequest = Omit<BaseSellContractRequest, 'loginid'>;

type SellContractResponse = BaseSellContractResponse;

type UpdateContractRequest = Omit<BaseUpdateContractRequest, 'loginid'>;

type UpdateContractResponse = BaseUpdateContractResponse;

type UpdateContractHistoryRequest = Omit<BaseUpdateContractHistoryRequest, 'loginid'>;

type UpdateContractHistoryResponse = BaseUpdateContractHistoryResponse;

type StatementRequest = BaseStatementRequest;

type StatementResponse = Omit<BaseStatementResponse, 'statement'> & {
    statement?: Omit<NonNullable<BaseStatementResponse['statement']>, 'transactions'> & {
        transactions?: Array<
            Omit<NonNullable<NonNullable<BaseStatementResponse['statement']>['transactions']>[0], 'withdrawal_details'>
        >;
    };
};

type ProfitTableRequest = BaseProfitTableRequest;

type ProfitTableResponse = Omit<BaseProfitTableResponse, 'profit_table'> & {
    profit_table?: Omit<NonNullable<BaseProfitTableResponse['profit_table']>, 'transactions'> & {
        transactions?: Array<
            Omit<NonNullable<NonNullable<BaseProfitTableResponse['profit_table']>['transactions']>[0], 'symbol'> & {
                underlying_symbol?: string;
                auto_run_id?: string;
            }
        >;
    };
};

type PortfolioRequest = BasePortfolioRequest;

type PortfolioResponse = Omit<BasePortfolioResponse, 'portfolio'> & {
    portfolio?: Omit<NonNullable<BasePortfolioResponse['portfolio']>, 'contracts'> & {
        contracts?: Array<
            Omit<NonNullable<NonNullable<BasePortfolioResponse['portfolio']>['contracts']>[0], 'symbol'> & {
                underlying_symbol?: string;
            }
        >;
    };
};

type BalanceRequest = Omit<BaseBalanceRequest, 'accounts' | 'loginid'>;

type BalanceResponse = Omit<BaseBalanceResponse, 'balance'> & {
    balance?: Omit<NonNullable<BaseBalanceResponse['balance']>, 'accounts' | 'loginid' | 'total'>;
};

type AuthorizeRequest = Omit<BaseAuthorizeRequest, 'add_to_login_history' | 'tokens'>;

type AuthorizeResponse = Omit<BaseAuthorizeResponse, 'authorize'> & {
    authorize?: Omit<
        NonNullable<BaseAuthorizeResponse['authorize']>,
        | 'account_list'
        | 'country'
        | 'email'
        | 'fullname'
        | 'landing_company_name'
        | 'landing_company_fullname'
        | 'linked_to'
        | 'local_currencies'
        | 'preferred_language'
        | 'scopes'
        | 'upgradeable_landing_companies'
        | 'user_id'
    >;
};

type CancelAContractRequest = Omit<BaseCancelAContractRequest, 'loginid'>;

type CancelAContractResponse = BaseCancelAContractResponse;

type TransactionsStreamRequest = Omit<BaseTransactionsStreamRequest, 'loginid'>;

type TradingTimesResponse = Omit<BaseTradingTimesResponse, 'trading_times' | 'echo_req'> & {
    echo_req: {
        trading_times?: string;
        [k: string]: unknown;
    };
    trading_times?: Omit<NonNullable<BaseTradingTimesResponse['trading_times']>, 'markets'> & {
        markets: Array<
            Omit<NonNullable<NonNullable<BaseTradingTimesResponse['trading_times']>['markets']>[0], 'submarkets'> & {
                submarkets?: Array<
                    Omit<
                        NonNullable<
                            NonNullable<
                                NonNullable<BaseTradingTimesResponse['trading_times']>['markets']
                            >[0]['submarkets']
                        >[0],
                        'symbols'
                    > & {
                        symbols?: Array<
                            Omit<
                                NonNullable<
                                    NonNullable<
                                        NonNullable<
                                            NonNullable<BaseTradingTimesResponse['trading_times']>['markets']
                                        >[0]['submarkets']
                                    >[0]['symbols']
                                >[0],
                                'symbol'
                            > & {
                                underlying_symbol: string;
                            }
                        >;
                    }
                >;
            }
        >;
    };
};

type TransactionsStreamResponse = Omit<BaseTransactionsStreamResponse, 'transaction'> & {
    transaction?: Omit<
        NonNullable<BaseTransactionsStreamResponse['transaction']>,
        | 'barrier'
        | 'display_name'
        | 'high_barrier'
        | 'low_barrier'
        | 'stop_loss'
        | 'stop_out'
        | 'take_profit'
        | 'symbol'
    > & {
        underlying_symbol?: string;
    };
};

// --- Autotrader API types ---

type TAutoRunStatus = 'running' | 'paused' | 'stopped';
type TAutoStopReason = 'user_stopped' | 'condition_triggered' | 'error';
export type TAutoStopReasonCode = string;
type TAutoContractStatus = 'open' | 'won' | 'lost';

export type TAutoContractItem = {
    contract_id: number;
    buy_price: number;
    purchase_time: number;
    sell_price?: number;
    sell_time?: number;
    contract_status?: TAutoContractStatus;
};

export type TAutoRun = {
    run_id: string;
    strategy_id: string;
    strategy_parameters: Record<string, unknown>;
    contract_template: TAutoContractTemplate;
    contracts: TAutoContractItem[];
    total_stake: number;
    total_payout: number;
    status: TAutoRunStatus;
    start_time: number;
    stop_time?: number;
    stop_reason?: TAutoStopReason;
    /** Present when `stop_reason === 'condition_triggered'`. */
    stop_reason_code?: TAutoStopReasonCode;
};

/** A single property inside the strategy parameters JSON Schema. */
export type TAutoStrategyParameterProperty = {
    description?: string;
    type?: string;
    /** Inclusive lower bound (JSON Schema `minimum`). */
    minimum?: number;
    /** Exclusive lower bound — the value must be strictly greater than this. */
    exclusiveMinimum?: number;
    /** Inclusive upper bound — the value may equal this. */
    maximum?: number;
    default?: unknown;
};

/** JSON Schema that describes the strategy_parameters object for auto_start. */
export type TAutoStrategyParametersSchema = {
    $schema?: string;
    type?: string;
    properties: Record<string, TAutoStrategyParameterProperty>;
    required?: string[];
    additionalProperties?: boolean;
};

export type TAutoStrategyDescriptor = {
    strategy_id: string;
    display_name: string;
    description?: string;
    supported_contract_types: string[];
    parameters: TAutoStrategyParametersSchema;
};

export type TAutoContractTemplate = {
    contract_type: string;
    currency: string;
    underlying_symbol: string;
    amount?: number;
    basis?: 'stake' | 'payout';
    duration?: number;
    duration_unit?: 's' | 'm' | 'h' | 'd' | 't';
    date_expiry?: number;
    barrier?: string;
    barrier2?: string;
    growth_rate?: number;
    multiplier?: number;
    selected_tick?: number;
    limit_order?: {
        stop_loss?: number;
        take_profit?: number;
    };
};

type AutoListStrategiesRequest = { auto_list_strategies: 1 };
type AutoListStrategiesResponse = {
    auto_list_strategies: {
        strategies: TAutoStrategyDescriptor[];
    };
    msg_type: 'auto_list_strategies';
};

type AutoStartRequest = {
    auto_start: 1;
    strategy_id: string;
    strategy_parameters: Record<string, unknown>;
    contract_template: TAutoContractTemplate;
    subscribe?: number;
};
type AutoStartResponse = {
    auto_start: TAutoRun;
    subscription?: { id: string };
    msg_type: 'auto_start';
};

type AutoListRequest = { auto_list: 1 };
type AutoListResponse = {
    auto_list: { runs: TAutoRun[] };
    msg_type: 'auto_list';
};

type AutoGetRequest = {
    auto_get: 1;
    run_id: string;
    subscribe?: number;
};
type AutoGetResponse = {
    auto_get: TAutoRun;
    subscription?: { id: string };
    msg_type: 'auto_get';
};

type AutoStopRequest = { auto_stop: 1; run_id: string };
type AutoStopResponse = {
    auto_stop: TAutoRun;
    msg_type: 'auto_stop';
};

type AutoPauseRequest = { auto_pause: 1; run_id: string };
type AutoPauseResponse = {
    auto_pause: TAutoRun;
    msg_type: 'auto_pause';
};

type AutoResumeRequest = {
    auto_resume: 1;
    run_id: string;
    subscribe?: number;
};
type AutoResumeResponse = {
    auto_resume: TAutoRun;
    subscription?: { id: string };
    msg_type: 'auto_resume';
};

type TSocketEndpoints = {
    auto_list_strategies: {
        request: AutoListStrategiesRequest;
        response: AutoListStrategiesResponse;
    };
    auto_start: {
        request: AutoStartRequest;
        response: AutoStartResponse;
    };
    auto_list: {
        request: AutoListRequest;
        response: AutoListResponse;
    };
    auto_get: {
        request: AutoGetRequest;
        response: AutoGetResponse;
    };
    auto_stop: {
        request: AutoStopRequest;
        response: AutoStopResponse;
    };
    auto_pause: {
        request: AutoPauseRequest;
        response: AutoPauseResponse;
    };
    auto_resume: {
        request: AutoResumeRequest;
        response: AutoResumeResponse;
    };
    active_symbols: {
        request: ActiveSymbolsRequest;
        response: ActiveSymbolsResponse;
    };
    authorize: {
        request: AuthorizeRequest;
        response: AuthorizeResponse;
    };
    balance: {
        request: BalanceRequest;
        response: BalanceResponse;
    };
    buy: {
        request: BuyContractRequest;
        response: BuyContractResponse;
    };
    cancel: {
        request: CancelAContractRequest;
        response: CancelAContractResponse;
    };
    contracts_for: {
        request: ContractsForSymbolRequest;
        response: ContractsForSymbolResponse;
    };
    contract_update: {
        request: UpdateContractRequest;
        response: UpdateContractResponse;
    };
    contract_update_history: {
        request: UpdateContractHistoryRequest;
        response: UpdateContractHistoryResponse;
    };
    forget_all: {
        request: ForgetAllRequest;
        response: ForgetAllResponse;
    };
    forget: {
        request: ForgetRequest;
        response: ForgetResponse;
    };
    logout: {
        request: LogOutRequest;
        response: LogOutResponse;
    };
    ping: {
        request: PingRequest;
        response: PingResponse;
    };
    portfolio: {
        request: PortfolioRequest;
        response: PortfolioResponse;
    };
    profit_table: {
        request: ProfitTableRequest;
        response: ProfitTableResponse;
    };
    proposal_open_contract: {
        request: PriceProposalOpenContractsRequest;
        response: PriceProposalOpenContractsResponse;
    };
    proposal: {
        request: PriceProposalRequest;
        response: PriceProposalResponse;
    };
    sell: {
        request: SellContractRequest;
        response: SellContractResponse;
    };
    statement: {
        request: StatementRequest;
        response: StatementResponse;
    };
    ticks_history: {
        // The generated TicksHistoryRequest types `count` as the impossible `number & string`;
        // correct it to `number` so callers can pass a candle count without casting.
        request: Omit<TicksHistoryRequest, 'count'> & { count?: number };
        response: TicksHistoryResponse;
    };
    ticks: {
        request: TicksStreamRequest;
        response: TicksStreamResponse;
    };
    time: {
        request: ServerTimeRequest;
        response: ServerTimeResponse;
    };
    trading_times: {
        request: TradingTimesRequest;
        response: TradingTimesResponse;
    };
    transaction: {
        request: TransactionsStreamRequest;
        response: TransactionsStreamResponse;
    };
};

export type TSocketEndpointNames = keyof TSocketEndpoints;

export type TSocketSubscribableEndpointNames = KeysMatching<TSocketEndpoints, { request: { subscribe?: number } }>;

export type TSocketResponse<T extends TSocketEndpointNames> = TSocketEndpoints[T]['response'];

export type TSocketError<T extends TSocketEndpointNames> = {
    /**
     * Echo of the request made.
     */
    echo_req: {
        [k: string]: unknown;
    };
    /**
     * Error object.
     */
    error: {
        code: string;
        message: string;
        subcode?: string;
        details?: {
            field?: string;
            [key: string]: unknown;
        };
        code_args?: string[];
    };
    /**
     * Action name of the request made.
     */
    msg_type: T;
    /**
     * [Optional] Used to map request to response.
     */
    req_id?: number;
};

export type TSocketResponseData<T extends TSocketEndpointNames> = Omit<
    NoStringIndex<TSocketResponse<T>>,
    'req_id' | 'msg_type' | 'echo_req' | 'subscription'
>;

export type TSocketRequest<T extends TSocketEndpointNames> = TSocketEndpoints[T]['request'];

type TRemovableEndpointName<T extends TSocketEndpointNames> = T extends KeysMatching<TSocketRequest<T>, 1> ? T : never;

type TSocketRequestCleaned<T extends TSocketEndpointNames> = Omit<
    TSocketRequest<T>,
    TRemovableEndpointName<T> | 'passthrough' | 'req_id' | 'subscribe'
>;

export type TSocketPaginatateableRequestCleaned<T extends TSocketPaginateableEndpointNames> = Omit<
    TSocketRequest<T>,
    TRemovableEndpointName<T> | 'passthrough' | 'req_id' | 'subscribe'
> & {
    /** Number of records to skip */
    offset?: number;
    /** Number of records to return */
    limit?: number;
};

export type TSocketRequestPayload<
    T extends TSocketEndpointNames | TSocketPaginateableEndpointNames = TSocketEndpointNames,
> =
    Partial<TSocketRequestCleaned<T>> extends TSocketRequestCleaned<T>
        ? {
              payload?: T extends TSocketPaginateableEndpointNames
                  ? TSocketPaginatateableRequestCleaned<T>
                  : TSocketRequestCleaned<T>;
          }
        : {
              payload: T extends TSocketPaginateableEndpointNames
                  ? TSocketPaginatateableRequestCleaned<T>
                  : TSocketRequestCleaned<T>;
          };

export type TSocketRequestQueryOptions<T extends TSocketEndpointNames> = Parameters<
    typeof useQuery<TSocketResponseData<T>, TSocketError<T>['error']>
>[2];

export type TSocketRequestInfiniteQueryOptions<T extends TSocketEndpointNames> = Parameters<
    typeof useInfiniteQuery<TSocketResponseData<T>, TSocketError<T>['error']>
>[2];

export type TSocketRequestMutationOptions<T extends TSocketEndpointNames> = Parameters<
    typeof useMutation<TSocketResponseData<T>, TSocketError<T>['error'], TSocketAcceptableProps<T>>
>[2];

type TSocketRequestWithOptions<
    T extends TSocketEndpointNames,
    O extends boolean = false,
    OT extends 'useQuery' | 'useInfiniteQuery' = 'useQuery',
> = Omit<
    TSocketRequestPayload<T> & {
        options?: OT extends 'useQuery' ? TSocketRequestQueryOptions<T> : TSocketRequestInfiniteQueryOptions<T>;
    },
    | (TSocketRequestPayload<T>['payload'] extends Record<string, never> ? 'payload' : never)
    | (TNever<TSocketRequestPayload<T>['payload']> extends undefined ? 'payload' : never)
    | (O extends true ? never : 'options')
>;

type TNever<T> = T extends Record<string, never> ? never : T;

type TSocketRequestProps<
    T extends TSocketEndpointNames,
    O extends boolean = false,
    OT extends 'useQuery' | 'useInfiniteQuery' = 'useQuery',
> = TNever<TSocketRequestWithOptions<T, O, OT>>;

export type TSocketAcceptableProps<
    T extends TSocketEndpointNames,
    O extends boolean = false,
    OT extends 'useQuery' | 'useInfiniteQuery' = 'useQuery',
> =
    TSocketRequestProps<T, O, OT> extends never
        ? [undefined?]
        : Partial<TSocketRequestProps<T, O, OT>> extends TSocketRequestProps<T, O, OT>
          ? [TSocketRequestProps<T, O, OT>?]
          : [TSocketRequestProps<T, O, OT>];

export type TSocketPaginateableEndpointNames = KeysMatching<
    TSocketEndpoints,
    { request: { limit?: number; offset?: number } }
>;

// Export commonly used type aliases for cleaner imports
export type TActiveSymbolsRequest = TSocketRequest<'active_symbols'>;
export type TActiveSymbolsResponse = TSocketResponse<'active_symbols'>;

export type TAuthorizeRequest = TSocketRequest<'authorize'>;
export type TAuthorizeResponse = TSocketResponse<'authorize'>;

export type TBalanceRequest = TSocketRequest<'balance'>;
export type TBalanceResponse = TSocketResponse<'balance'>;

export type TBuyContractRequest = TSocketRequest<'buy'>;
export type TBuyContractResponse = TSocketResponse<'buy'>;

export type TCancelAContractRequest = TSocketRequest<'cancel'>;
export type TCancelAContractResponse = TSocketResponse<'cancel'>;

export type TContractsForSymbolRequest = TSocketRequest<'contracts_for'>;
export type TContractsForSymbolResponse = TSocketResponse<'contracts_for'>;

export type TPriceProposalRequest = TSocketRequest<'proposal'>;
export type TPriceProposalResponse = TSocketResponse<'proposal'>;

export type TPriceProposalOpenContractsRequest = TSocketRequest<'proposal_open_contract'>;
export type TPriceProposalOpenContractsResponse = TSocketResponse<'proposal_open_contract'>;

export type TSellContractRequest = TSocketRequest<'sell'>;
export type TSellContractResponse = TSocketResponse<'sell'>;

export type TUpdateContractRequest = TSocketRequest<'contract_update'>;
export type TUpdateContractResponse = TSocketResponse<'contract_update'>;

export type TUpdateContractHistoryRequest = TSocketRequest<'contract_update_history'>;
export type TUpdateContractHistoryResponse = TSocketResponse<'contract_update_history'>;

export type TStatementRequest = TSocketRequest<'statement'>;
export type TStatementResponse = TSocketResponse<'statement'>;

export type TProfitTableRequest = TSocketRequest<'profit_table'>;
export type TProfitTableResponse = TSocketResponse<'profit_table'>;

export type TPortfolioRequest = TSocketRequest<'portfolio'>;
export type TPortfolioResponse = TSocketResponse<'portfolio'>;

export type TTransactionsStreamRequest = TSocketRequest<'transaction'>;
export type TTransactionsStreamResponse = TSocketResponse<'transaction'>;

export type TTradingTimesRequest = TSocketRequest<'trading_times'>;
export type TTradingTimesResponse = TSocketResponse<'trading_times'>;

export type TTicksHistoryRequest = TSocketRequest<'ticks_history'>;
export type TTicksHistoryResponse = TSocketResponse<'ticks_history'>;

export type TTicksStreamRequest = TSocketRequest<'ticks'>;
export type TTicksStreamResponse = TSocketResponse<'ticks'>;

export type TServerTimeRequest = TSocketRequest<'time'>;
export type TServerTimeResponse = TSocketResponse<'time'>;

export type TForgetRequest = TSocketRequest<'forget'>;
export type TForgetResponse = TSocketResponse<'forget'>;

export type TForgetAllRequest = TSocketRequest<'forget_all'>;
export type TForgetAllResponse = TSocketResponse<'forget_all'>;

export type TLogOutRequest = TSocketRequest<'logout'>;
export type TLogOutResponse = TSocketResponse<'logout'>;

// Autotrader type aliases
export type TAutoListStrategiesRequest = TSocketRequest<'auto_list_strategies'>;
export type TAutoListStrategiesResponse = TSocketResponse<'auto_list_strategies'>;

export type TAutoStartRequest = TSocketRequest<'auto_start'>;
export type TAutoStartResponse = TSocketResponse<'auto_start'>;

export type TAutoListRequest = TSocketRequest<'auto_list'>;
export type TAutoListResponse = TSocketResponse<'auto_list'>;

export type TAutoGetRequest = TSocketRequest<'auto_get'>;
export type TAutoGetResponse = TSocketResponse<'auto_get'>;

export type TAutoStopRequest = TSocketRequest<'auto_stop'>;
export type TAutoStopResponse = TSocketResponse<'auto_stop'>;

export type TAutoPauseRequest = TSocketRequest<'auto_pause'>;
export type TAutoPauseResponse = TSocketResponse<'auto_pause'>;

export type TAutoResumeRequest = TSocketRequest<'auto_resume'>;
export type TAutoResumeResponse = TSocketResponse<'auto_resume'>;

/**
 * REST API Types for Derivatives Account Endpoint
 */
export type TDerivativesAccount = {
    account_id: string;
    balance: string;
    currency: string;
    group: string;
    status: 'active' | 'inactive' | 'trading_disabled';
    account_type: 'real' | 'demo';
};

export type TDerivativesAccountResponse = {
    data: TDerivativesAccount[];
    meta?: {
        endpoint: string;
        method: string;
        timing: number;
    };
};
