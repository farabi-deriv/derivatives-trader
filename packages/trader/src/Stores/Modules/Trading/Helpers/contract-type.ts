import { TContractsForSymbolResponse, TTradingTimesResponse } from '@deriv/api';
import {
    buildBarriersConfig,
    buildDurationConfig,
    cloneObject,
    type Dayjs,
    getCleanedUpCategories,
    getContractCategoriesConfig,
    getContractSubtype,
    getContractTypesConfig,
    getExpiryType as getContractExpiryType,
    getLocalizedBasis,
    getPropertyValue,
    getSortedTradeTypes,
    getUnitMap,
    hasIntradayDurationUnit,
    isTimeValid,
    toMoment,
    TRADE_TYPES,
    TTradeTypesCategories,
    unsupported_contract_types_list,
    WS,
} from '@deriv/shared';

import { TConfig, TTradeStore } from 'Types';

import ServerTime from '_common/base/server_time';

type TBarriers = Record<
    keyof TTradeStore['duration_min_max'],
    {
        barrier?: string;
        high_barrier?: string;
        low_barrier?: string;
    }
> & {
    count: number;
};

type TNonAvailableContractsList = Record<'contract_category' | 'contract_display_name' | 'contract_type', string>[];
type TTextValueStrings = {
    text: string;
    value: string;
};
type TTimes = {
    open: string[];
    close: string[];
};
type TEvents =
    | {
          dates: string;
          descrip: string;
      }[]
    | [];

export const ContractType = (() => {
    type TContractValues = ReturnType<typeof getComponents> &
        ReturnType<typeof getBasis> &
        ReturnType<typeof getTradeTypes> &
        ReturnType<typeof getBarriers> &
        ReturnType<typeof getDurationUnit> &
        ReturnType<typeof getDurationUnitsList> &
        ReturnType<typeof getDurationMinMax> &
        ReturnType<typeof getAccumulatorRange> &
        ReturnType<typeof getMultiplierRange> &
        ReturnType<typeof getCancellation> &
        ReturnType<typeof getExpiryType> &
        ReturnType<typeof getEqualProps>;

    type TSymbolConfig = {
        available_contract_types: ReturnType<typeof getContractTypesConfig>;
        available_categories: TTradeTypesCategories;
        contract_types: ReturnType<typeof getContractTypesConfig>;
        non_available_categories: TTradeTypesCategories;
    };

    const EMPTY_SYMBOL_CONFIG: TSymbolConfig = {
        available_contract_types: {},
        available_categories: {},
        contract_types: {} as ReturnType<typeof getContractTypesConfig>,
        non_available_categories: {},
    };

    // One entry per symbol. This was a single set of slots rebuilt wholesale on every contracts_for
    // response, so with two markets open a reader could be handed the other market's barriers.
    const config_by_symbol: Record<string, TSymbolConfig> = {};
    // Readers state which symbol they want; an unknown symbol yields empty config, never another's.
    const configFor = (symbol?: string | null): TSymbolConfig =>
        (symbol && config_by_symbol[symbol]) || EMPTY_SYMBOL_CONFIG;
    const trading_events: { [key: string]: Record<string, TEvents | undefined> } = {};
    const trading_times: { [key: string]: Record<string, TTimes> } = {};

    // Process a contracts_for response to populate the closure state.
    // Extracted so it can be called with pre-fetched data (from React Query) or from a WS response.
    const processContractsForResponse = (r: Required<TContractsForSymbolResponse>, symbol: string): void => {
        const has_contracts = getPropertyValue(r, ['contracts_for']);
        if (!has_contracts) return;
        const contract_categories = getContractCategoriesConfig();
        const contract_types = getContractTypesConfig(symbol);
        const available_contract_types: ReturnType<typeof getContractTypesConfig> = {};
        let non_available_categories: TTradeTypesCategories = {};
        let available_categories = cloneObject(contract_categories);
        r.contracts_for.available.forEach(contract => {
            const type = Object.keys(contract_types).find(key => {
                const isContractTypeMatch = contract_types[key].trade_types.indexOf(contract.contract_type) !== -1;

                if (contract.contract_category) {
                    if (contract.contract_category === 'callput' && key === 'rise_fall') {
                        return isContractTypeMatch;
                    }
                    if (contract.contract_category === 'higherLower' && key === 'high_low') {
                        return isContractTypeMatch;
                    }
                    if (contract.contract_category !== 'callput' && contract.contract_category !== 'higherLower') {
                        return isContractTypeMatch;
                    }
                    return false;
                }

                return (
                    isContractTypeMatch &&
                    (typeof contract_types[key].barrier_count === 'undefined' ||
                        Number(contract_types[key].barrier_count) === contract.barriers)
                );
            });

            if (!type) return;

            if (!available_contract_types[type]) {
                const sub_cats =
                    available_categories[
                        Object.keys(available_categories).find(
                            key => available_categories[key].categories.indexOf(type) !== -1
                        ) ?? ''
                    ].categories;

                if (!sub_cats) return;

                sub_cats[(sub_cats as string[]).indexOf(type)] = { value: type, text: contract_types[type].title };

                available_contract_types[type] = cloneObject(contract_types[type]);
            }
            const config: TConfig = available_contract_types[type].config || {};

            config.has_spot = true;
            config.durations = config.hide_duration ? undefined : buildDurationConfig(contract, config.durations);
            config.trade_types = buildTradeTypesConfig(contract, config.trade_types);
            config.barriers = buildBarriersConfig(contract, config.barriers);
            config.barrier_choices = contract.barrier_choices as TConfig['barrier_choices'];
            config.payout_choices = contract.payout_choices as TConfig['payout_choices'];
            config.growth_rate_range = contract.growth_rate_range as TConfig['growth_rate_range'];
            config.multiplier_range = contract.multiplier_range as TConfig['multiplier_range'];
            config.cancellation_range = contract.cancellation_range as TConfig['cancellation_range'];

            available_contract_types[type].config = config;
        });
        available_categories = getCleanedUpCategories(available_categories);

        non_available_categories = {};
        const mutable_contracts_config = cloneObject(contract_categories);
        const getCategories = (key = ''): string[] => mutable_contracts_config[key]?.categories ?? [];
        const non_available_contracts = r.contracts_for.non_available as TNonAvailableContractsList;

        if (non_available_contracts) {
            non_available_contracts.forEach(({ contract_type }) => {
                const type =
                    Object.keys(contract_types).find(key => contract_types[key].trade_types.includes(contract_type)) ??
                    '';
                const key = Object.keys(mutable_contracts_config).find(key => getCategories(key).includes(type));
                const categories: Array<string | TTextValueStrings> = getCategories(key);
                const title = contract_types[type]?.title;
                const is_available = !!available_categories[key as keyof TTradeTypesCategories]?.categories?.find(
                    (el: TTextValueStrings) => el.text === title
                );
                if (categories.includes(type) && !is_available) {
                    categories[categories.indexOf(type)] = { value: type, text: title };
                }
                if (key) {
                    non_available_categories[key] = mutable_contracts_config[key];
                }
            });
        }
        non_available_categories = getCleanedUpCategories(non_available_categories);

        config_by_symbol[symbol] = {
            available_contract_types,
            available_categories,
            contract_types,
            non_available_categories,
        };
    };

    const buildContractTypesConfig = (symbol: string): Promise<void> =>
        WS.contractsFor(symbol).then((r: Required<TContractsForSymbolResponse>) => {
            processContractsForResponse(r, symbol);
        });

    const buildTradeTypesConfig = (
        contract: NonNullable<TContractsForSymbolResponse['contracts_for']>['available'][number],
        trade_types: { [key: string]: string } = {}
    ) => {
        // contract_display property has been removed from the API
        // Using contract_type as the display value since display properties are no longer provided
        trade_types[contract.contract_type] = contract.contract_type;
        return trade_types;
    };

    const getArrayDefaultValue = <T>(arr_new_values: Array<T>, value: T): T =>
        arr_new_values.indexOf(value) !== -1 ? value : arr_new_values[0];

    const getContractValues = (store: TTradeStore): TContractValues | Record<string, never> => {
        const {
            contract_expiry_type,
            contract_type,
            basis,
            duration_unit,
            expiry_type,
            multiplier,
            cancellation_duration,
            short_barriers,
            long_barriers,
            strike_price_choices,
            v2_params_initial_values,
        } = store;

        if (!contract_type) return {};
        // Mid tab-switch the store briefly pairs the new symbol with the outgoing contract_type (or
        // an unloaded catalogue). Deriving from that mismatch blanked barrier_1, and rapid switching
        // could price the empty field before the correct pair's own cascade repaired it. Absence of
        // the type in this symbol's catalogue means derive nothing, not derive empties.
        if (!configFor(store.symbol).available_contract_types[contract_type]) return {};

        let stored_barriers_data: TTradeStore['short_barriers' | 'long_barriers' | 'strike_price_choices'];
        switch (getContractSubtype(contract_type)) {
            case 'Short':
                stored_barriers_data = short_barriers;
                break;
            case 'Long':
                stored_barriers_data = long_barriers;
                break;
            case 'Call':
            case 'Put':
                stored_barriers_data = v2_params_initial_values?.strike
                    ? ({
                          ...strike_price_choices,
                          barrier: v2_params_initial_values.strike,
                      } as TTradeStore['strike_price_choices'])
                    : strike_price_choices;
                break;
            default:
                stored_barriers_data = {};
        }

        // Every derivation is addressed to this store's own symbol, so a contracts_for response for
        // another open market can no longer be read here — the switch-time race that mixed barriers.
        const symbol = store.symbol;
        const form_components = getComponents(symbol, contract_type);
        const obj_basis = getBasis(symbol, contract_type, basis);
        const obj_trade_types = getTradeTypes(symbol, contract_type);
        const obj_duration_unit = getDurationUnit(symbol, duration_unit, contract_type);

        const obj_duration_units_list = getDurationUnitsList(symbol, contract_type);
        // The store's bucket is computed from its live duration fields, which mid tab-switch still
        // belong to the outgoing tab — a valid (symbol, type) pair then reads a bucket it does not
        // offer and blanks the barrier. Re-derive from the incoming type's own resolved unit and
        // units; `duration_unit` decides the bucket before the list is even consulted.
        const next_contract_expiry_type =
            (store.root_store?.common?.server_time &&
                getContractExpiryType({
                    ...store,
                    // A spread of the live store does not carry root_store in the app (it does for
                    // the plain-object test mocks, which is why tests missed this) — pass it
                    // explicitly or the shared getExpiryType crashes reading root_store.common.
                    root_store: store.root_store,
                    duration_unit: obj_duration_unit.duration_unit,
                    duration_units_list: obj_duration_units_list.duration_units_list,
                })) ||
            contract_expiry_type;
        const obj_barrier = getBarriers(
            symbol,
            contract_type,
            next_contract_expiry_type,
            stored_barriers_data?.barrier
        );
        // A type can offer no barrier for the resolved bucket (e.g. daily-only reached mid-switch
        // from an intraday tab). Leave the store's existing value rather than blanking the field —
        // the same convention the bucket-crossing reaction documents.
        if (obj_barrier.barrier_count > 0 && !obj_barrier.barrier_1) {
            delete (obj_barrier as Partial<typeof obj_barrier>).barrier_1;
            delete (obj_barrier as Partial<typeof obj_barrier>).barrier_2;
        }
        const obj_duration_units_min_max = getDurationMinMax(symbol, contract_type);
        const obj_accumulator_range_list = getAccumulatorRange(symbol, contract_type);
        const obj_barrier_choices = getBarrierChoices(symbol, contract_type, stored_barriers_data?.barrier_choices);
        const obj_payout_choices = getPayoutChoices(symbol, contract_type);
        const obj_multiplier_range_list = getMultiplierRange(symbol, contract_type, multiplier);
        const obj_cancellation = getCancellation(symbol, contract_type, cancellation_duration);
        const obj_expiry_type = getExpiryType(obj_duration_units_list.duration_units_list, expiry_type);
        const obj_equal = getEqualProps(symbol, contract_type);

        return {
            ...form_components,
            ...obj_basis,
            ...obj_trade_types,
            ...obj_barrier,
            ...obj_duration_unit,
            ...obj_duration_units_list,
            ...obj_duration_units_min_max,
            ...obj_expiry_type,
            ...obj_accumulator_range_list,
            ...obj_barrier_choices,
            ...obj_payout_choices,
            ...obj_multiplier_range_list,
            ...obj_cancellation,
            ...obj_equal,
        };
    };

    const getContractType = (list: TTradeTypesCategories, contractType: string) => {
        const filteredList = Object.keys(list || {})
            .reduce<string[]>((k, l) => [...k, ...(list[l].categories as TTextValueStrings[]).map(ct => ct.value)], [])
            .filter(
                type =>
                    !unsupported_contract_types_list.includes(type as (typeof unsupported_contract_types_list)[number])
            );
        const sortedList = getSortedTradeTypes(filteredList);

        return {
            contract_type: getArrayDefaultValue(sortedList, contractType),
        };
    };

    const getComponents = (symbol: string | null, c_type: string) => {
        const { contract_types } = configFor(symbol);
        if (!contract_types) return {};
        const check = ['duration', 'amount', ...(contract_types[c_type]?.components ?? [])].filter(
            component =>
                !(
                    component === 'duration' &&
                    contract_types[c_type].config &&
                    contract_types[c_type].config?.hide_duration
                )
        );
        return (
            contract_types && {
                form_components: check,
            }
        );
    };

    const getDurationUnitsList = (symbol: string | null, contract_type: string) => {
        const { available_contract_types } = configFor(symbol);
        return {
            duration_units_list:
                (getPropertyValue(available_contract_types, [
                    contract_type,
                    'config',
                    'durations',
                    'units_display',
                ]) as TTextValueStrings[]) || [],
        };
    };

    const getDurationUnit = (symbol: string | null, duration_unit: string, contract_type: string) => {
        const { available_contract_types } = configFor(symbol);
        // For Vanilla contracts, validate that the duration_unit is supported
        // If not supported, default to 'm' (minutes)
        // This preserves user selection while ensuring valid duration units
        const vanillaContractTypes = [
            'vanilla_call',
            'vanilla_put',
            'vanillalongcall',
            'vanillalongput',
            'call_put',
            'rise_fall',
            'rise_fall_equal',
            'higher_lower',
            'call',
            'put',
        ];

        if (vanillaContractTypes.includes(contract_type)) {
            // Get available duration units for this contract type
            const { duration_units_list } = getDurationUnitsList(symbol, contract_type);
            const available_units = duration_units_list.map(unit => unit.value);

            // If the requested duration_unit is available, use it; otherwise default to 'm'
            if (available_units.includes(duration_unit)) {
                return {
                    duration_unit,
                };
            }
            return {
                duration_unit: 'm',
            };
        }

        const duration_units =
            (getPropertyValue(available_contract_types, [
                contract_type,
                'config',
                'durations',
                'units_display',
            ]) as TTextValueStrings[]) || [];
        const arr_units: string[] = [];
        duration_units.forEach(obj => {
            arr_units.push(obj.value);
        });

        const resolved_duration_unit = getArrayDefaultValue(arr_units, duration_unit);

        return {
            duration_unit: resolved_duration_unit || duration_unit,
        };
    };

    const getDurationMinMax = (symbol: string | null, contract_type: string, contract_expiry_type?: string) => {
        const { available_contract_types } = configFor(symbol);
        let duration_min_max: TTradeStore['duration_min_max'] =
            getPropertyValue(available_contract_types, [contract_type, 'config', 'durations', 'min_max']) || {};

        if (contract_expiry_type) {
            duration_min_max =
                'contract_expiry_type' in duration_min_max
                    ? (duration_min_max as unknown as { [key: string]: TTradeStore['duration_min_max'] })[
                          contract_expiry_type
                      ]
                    : {};
        }

        return { duration_min_max };
    };

    const getFullContractTypes = (symbol: string | null) => configFor(symbol).available_contract_types;

    const buildMoment = (date: string | number | null, time?: string | null) => {
        const [hour, minute] = isTimeValid(time ?? '') ? (time?.split(':') ?? []) : [0, 0];
        return toMoment(date || ServerTime.get())
            .hour(+hour)
            .minute(+minute);
    };

    const getStartTime = (start_date: number, start_time?: string | null) => ({
        start_time: start_date ? buildMoment(start_date, start_time).format('HH:mm') : null,
    });

    const getTradingEvents = async (date: string, underlying: string | null = null) => {
        if (!date) {
            return [];
        }
        if (!(date in trading_events)) {
            const trading_times_response: TTradingTimesResponse = await WS.tradingTimes(date);
            const trading_times_data = trading_times_response.trading_times as NonNullable<
                TTradingTimesResponse['trading_times']
            >;
            if (getPropertyValue(trading_times_response, ['trading_times', 'markets'])) {
                for (let i = 0; i < trading_times_data.markets.length; i++) {
                    const submarkets = trading_times_data.markets[i].submarkets;
                    if (submarkets) {
                        for (let j = 0; j < submarkets.length; j++) {
                            const symbols = submarkets[j].symbols;
                            if (symbols) {
                                for (let k = 0; k < symbols.length; k++) {
                                    const symbol = symbols[k];
                                    if (!trading_events[trading_times_response.echo_req.trading_times as string]) {
                                        trading_events[trading_times_response.echo_req.trading_times as string] = {};
                                    }
                                    trading_events[trading_times_response.echo_req.trading_times as string][
                                        symbol.underlying_symbol
                                    ] = symbol.events as TEvents;
                                }
                            }
                        }
                    }
                }
            }
        }

        return trading_events[date][underlying as string];
    };

    const getTradingDays = async (date: string, underlying: string | null = null) => {
        if (!date || !underlying) return null;

        const response: TTradingTimesResponse = await WS.tradingTimes(date);
        const trading_times = response.trading_times as NonNullable<TTradingTimesResponse['trading_times']>;

        if (!getPropertyValue(response, ['trading_times', 'markets'])) return null;

        const symbol_data = trading_times.markets.flatMap(
            market =>
                market.submarkets?.flatMap(
                    submarket => submarket.symbols?.find(symbol => symbol.underlying_symbol === underlying) || []
                ) || []
        )[0];

        return symbol_data?.trading_days || null;
    };

    const getTradingTimes = async (
        date: string | null,
        underlying: string | null = null
    ): Promise<Record<string, never> | TTimes | Record<string, TTimes>> => {
        if (!date) {
            return {};
        }

        if (!(date in trading_times)) {
            const trading_times_response: TTradingTimesResponse = await WS.tradingTimes(date);
            const trading_times_data = trading_times_response.trading_times as NonNullable<
                TTradingTimesResponse['trading_times']
            >;
            if (getPropertyValue(trading_times_response, ['trading_times', 'markets'])) {
                for (let i = 0; i < trading_times_data.markets.length; i++) {
                    const submarkets = trading_times_data.markets[i].submarkets;
                    if (submarkets) {
                        for (let j = 0; j < submarkets.length; j++) {
                            const symbols = submarkets[j].symbols;
                            if (symbols) {
                                for (let k = 0; k < symbols.length; k++) {
                                    const symbol = symbols[k];
                                    if (!trading_times[trading_times_response.echo_req.trading_times as string]) {
                                        trading_times[trading_times_response.echo_req.trading_times as string] = {};
                                    }
                                    trading_times[trading_times_response.echo_req.trading_times as string][
                                        symbol.underlying_symbol
                                    ] = {
                                        open: (symbol.times as TTimes).open,
                                        close: (symbol.times as TTimes).close,
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        return underlying ? trading_times[date][underlying] : trading_times[date];
    };

    // Finds the next date, on or after `from_moment`, that is an available trading day for
    // `symbol` — server time in, never local time. `close?.[0] === '--'` is this codebase's
    // existing "closed on that date" signal (see getExpiryTime below and day.tsx's picker).
    // Missing/unusable trading_times data degrades to the unmodified candidate rather than
    // blocking, since a WS response without an entry for the requested date is not distinguishable
    // here from a genuinely open market.
    const getNextTradingDayDate = async (
        symbol: string | null,
        from_moment: Dayjs,
        has_intraday: boolean
    ): Promise<string> => {
        let candidate = has_intraday ? from_moment.clone() : from_moment.clone().add(1, 'day');
        const MAX_ITERATIONS = 7;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const candidate_date = candidate.format('YYYY-MM-DD');
            let times: TTimes | undefined;
            try {
                // Each iteration depends on the previous one's result (step forward only while the
                // prior candidate was closed), so this cannot be parallelized.
                times = (await getTradingTimes(candidate_date, symbol)) as TTimes; // eslint-disable-line no-await-in-loop
            } catch {
                return candidate_date;
            }

            if (!Array.isArray(times?.close)) {
                return candidate_date;
            }
            if (times.close[0] !== '--') {
                return candidate_date;
            }
            candidate = candidate.clone().add(1, 'day');
        }

        return candidate.format('YYYY-MM-DD');
    };

    const getExpiryType = (
        duration_units_list: ReturnType<typeof getDurationUnitsList>['duration_units_list'],
        expiry_type: string | null
    ) => {
        if (duration_units_list) {
            if (
                (!expiry_type && duration_units_list.length > 0) ||
                (duration_units_list.length === 1 && duration_units_list[0].value === 't')
            ) {
                return { expiry_type: 'duration' };
            }
            if (duration_units_list.length === 0) {
                return { expiry_type };
            }
        }

        return { expiry_type };
    };

    const getExpiryDate = (
        duration_units_list: ReturnType<typeof getDurationUnitsList>['duration_units_list'],
        expiry_date: string | null,
        expiry_type: string | null,
        start_date: number
    ) => {
        let proper_expiry_date = null;

        if (expiry_type === 'endtime') {
            const moment_start = toMoment(start_date);
            const moment_expiry = toMoment(expiry_date);

            // Advance a same-day date only when the units are KNOWN to be daily-only. An empty list
            // means the symbol's contracts_for is not cached yet (the first cascade after a reload
            // runs before it arrives) — treating that as daily-only pushed a restored same-day end
            // date to tomorrow on every refresh of an intraday-capable symbol.
            if (duration_units_list.length > 0 && !hasIntradayDurationUnit(duration_units_list)) {
                const is_invalid = moment_expiry.isSameOrBefore(moment_start, 'day');
                proper_expiry_date = (is_invalid ? moment_start.clone().add(1, 'day') : moment_expiry).format(
                    'YYYY-MM-DD'
                );
            } else {
                proper_expiry_date = moment_expiry.format('YYYY-MM-DD');
            }
        }

        return { expiry_date: proper_expiry_date };
    };

    // Confirm that end time is at least 5 minutes after start time.
    const getExpiryTime = (
        expiry_date: string | null,
        expiry_time: string | null,
        expiry_type: string | null,
        market_close_times: string[] | undefined | TTimes,
        start_date: number,
        start_time?: string | null
    ) => {
        let end_time: Dayjs | string | null = null;

        if (expiry_type === 'endtime') {
            let market_close_time = '23:59:59';

            if (Array.isArray(market_close_times) && market_close_times?.length && market_close_times[0] !== '--') {
                // Some of underlyings (e.g. Australian Index) have two close time during a day so we always select the further one as the end time of the contract.
                market_close_time = market_close_times.slice(-1)[0];
            }

            // For contracts with a duration of more that 24 hours must set the expiry_time to the market's close time on the expiry date.
            if (!start_date && ServerTime.get()?.isBefore(buildMoment(expiry_date), 'day')) {
                end_time = market_close_time;
            } else {
                const start_moment = start_date ? buildMoment(start_date, start_time) : (ServerTime.get() as Dayjs);
                // `HH:mm` is deliberate here, not a gap: no same-day picker (TimeGridPicker,
                // adjusted_start_time, getClosestTimeToCurrentGMT) ever offers seconds, and the API
                // accepts/echoes same-day seconds unchanged regardless — see the Evidence section of
                // proposal.md for the probe that confirmed this.
                const end_moment = buildMoment(expiry_date, expiry_time);

                end_time = end_moment.format('HH:mm');
                if (end_moment.isSameOrBefore(start_moment) || end_moment.diff(start_moment, 'minute') < 5) {
                    const is_end_of_day = start_moment.get('hours') === 23 && start_moment.get('minute') >= 55;
                    // Only round when 5 minutes was actually added: is_end_of_day already decided not
                    // to push the clamp past the end of the day, and rounding that unrounded value can
                    // roll `.minute(60)` into the next day (DCE-005).
                    const should_add_five_minutes = !is_end_of_day;
                    end_time = start_moment.clone().add(should_add_five_minutes ? 5 : 0, 'minutes');
                    if (should_add_five_minutes) {
                        // Set the end_time to be multiple of 5 to be equal as the SELECTED_TIME that shown to the client.
                        const rounded = setMinuteMultipleByFive(end_time as Dayjs);
                        // The above rounding can still push the minute to 60 for a start moment in
                        // the last ~9 minutes of the day (e.g. 23:51 + 5 = 23:56, rounds up to
                        // "23:60"), rolling into the next day. The caller pairs this HH:mm with the
                        // *unchanged* expiry_date, so a rollover here yields a date_expiry in the
                        // past (DCE-005) — clamp to the end of the start day instead of crossing it.
                        end_time = rounded.isSame(start_moment, 'day')
                            ? rounded
                            : start_moment.clone().hour(23).minute(59);
                    }
                    end_time = (end_time as Dayjs).format('HH:mm');
                }
            }
        }
        return { expiry_time: end_time };
    };

    const setMinuteMultipleByFive = (moment_obj: Dayjs) => moment_obj.minute(Math.ceil(moment_obj.minute() / 5) * 5);

    const getTradeTypes = (symbol: string | null, contract_type: string) => ({
        trade_types: getPropertyValue(configFor(symbol).available_contract_types, [
            contract_type,
            'config',
            'trade_types',
        ]),
    });

    const getBarriers = (
        symbol: string | null,
        contract_type: string,
        expiry_type: string,
        stored_barrier_value?: string
    ) => {
        const { available_contract_types } = configFor(symbol);
        const barriers =
            (getPropertyValue(available_contract_types, [contract_type, 'config', 'barriers']) as TBarriers) || {};
        const barrier_values = barriers[expiry_type] || {};
        const barrier_1 = barrier_values.barrier || barrier_values.high_barrier || '';
        const barrier_2 = barrier_values.low_barrier || '';
        return {
            barrier_count: barriers.count || 0,
            barrier_1: stored_barrier_value || barrier_1.toString(),
            barrier_2: barrier_2.toString(),
        };
    };

    const getBasis = (symbol: string | null, contract_type: string, basis: string) => {
        const { available_contract_types } = configFor(symbol);
        const arr_basis: string[] = getPropertyValue(available_contract_types, [contract_type, 'basis']) || [];
        const localized_basis = getLocalizedBasis();
        const basis_list = arr_basis.reduce<TTextValueStrings[]>(
            (cur, bas) => [...cur, { text: localized_basis[bas as keyof typeof localized_basis], value: bas }],
            []
        );

        return {
            basis_list,
            basis: getArrayDefaultValue(arr_basis, basis),
        };
    };

    const getAccumulatorRange = (symbol: string | null, contract_type: string) => ({
        accumulator_range_list:
            (getPropertyValue(configFor(symbol).available_contract_types, [
                contract_type,
                'config',
                'growth_rate_range',
            ]) as number[]) || [],
    });

    const getBarrierChoices = (
        symbol: string | null,
        contract_type: string,
        stored_barrier_choices = [] as string[]
    ) => ({
        barrier_choices: stored_barrier_choices.length
            ? stored_barrier_choices
            : getPropertyValue(configFor(symbol).available_contract_types, [
                  contract_type,
                  'config',
                  'barrier_choices',
              ]) || [],
    });

    const getPayoutChoices = (symbol: string | null, contract_type: string): { payout_choices: string[] } => {
        const { available_contract_types } = configFor(symbol);
        const choices: number[] =
            getPropertyValue(available_contract_types, [contract_type, 'config', 'payout_choices']) || [];
        return { payout_choices: choices.map(String) };
    };

    const getMultiplierRange = (symbol: string | null, contract_type: string, multiplier: number) => {
        const { available_contract_types } = configFor(symbol);
        const arr_multiplier: number[] =
            getPropertyValue(available_contract_types, [contract_type, 'config', 'multiplier_range']) || [];

        return {
            multiplier_range_list: arr_multiplier.map(m => ({ text: `x${m}`, value: m })),
            multiplier: getArrayDefaultValue(arr_multiplier, multiplier),
        };
    };

    const getCancellation = (symbol: string | null, contract_type: string, cancellation_duration: string) => {
        const { available_contract_types } = configFor(symbol);
        const arr_cancellation_range: string[] =
            getPropertyValue(available_contract_types, [contract_type, 'config', 'cancellation_range']) || [];
        const cached_multipliers_cancellation: string[] =
            getPropertyValue(available_contract_types, [TRADE_TYPES.MULTIPLIER, 'config', 'cancellation_range']) || [];
        const regex = /(^(?:\d){1,})|((?:[a-zA-Z]){1,}$)/g;
        const getText = (str: string) => {
            const [duration, unit] = str.match(regex) ?? [];
            const unit_map = getUnitMap();
            const unit_names = unit_map[unit as keyof typeof unit_map];
            const name = 'name_plural' in unit_names ? unit_names.name_plural : unit_names.name;
            return `${duration} ${name}`;
        };
        const mapCancellationRangeList = (d: string) => ({ text: `${getText(d)}`, value: d });

        const should_show_cancellation = !!arr_cancellation_range.length;

        return {
            cancellation_duration: getArrayDefaultValue(arr_cancellation_range, cancellation_duration),
            cancellation_range_list: arr_cancellation_range.map(mapCancellationRangeList),
            cached_multiplier_cancellation_list: cached_multipliers_cancellation.map(mapCancellationRangeList),
            ...(should_show_cancellation ? {} : { has_cancellation: false }),
        };
    };

    const getEqualProps = (symbol: string | null, contract_type: string) => {
        const { available_contract_types } = configFor(symbol);
        const base_contract_type = /^(.*)_equal$/.exec(contract_type)?.[1];

        if (base_contract_type && !available_contract_types[base_contract_type]) {
            return {
                is_equal: 1,
                has_equals_only: true,
            };
        }
        return {};
    };

    return {
        buildContractTypesConfig,
        getBarriers,
        getContractType,
        getContractValues,
        getDurationMinMax,
        getDurationUnit,
        getDurationUnitsList,
        getFullContractTypes,
        getExpiryDate,
        getExpiryTime,
        getExpiryType,
        getStartTime,
        getTradingEvents,
        getTradingDays,
        getTradingTimes,
        getNextTradingDayDate,
        getContractCategories: (symbol: string | null) => ({
            contract_types_list: configFor(symbol).available_categories,
            non_available_contract_types_list: configFor(symbol).non_available_categories,
        }),
        processContractsForResponse,
    };
})();
