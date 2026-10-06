import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import { TActiveSymbolsResponse } from '@deriv/api';
import {
    LabelPairedChevronRightSmRegularIcon,
    StandaloneArrowLeftBoldIcon,
    StandaloneCircleInfoRegularIcon,
    StandaloneClockThreeRegularIcon,
    StandaloneLockBoldIcon,
    StandaloneStarFillIcon,
    StandaloneStarRegularIcon,
} from '@deriv/quill-icons';
import { getSymbolDisplayName, trackMarketInfoTradeClicked } from '@deriv/shared';
import { observer } from '@deriv/stores';
import { CaptionText, Skeleton, Tag, Text, Tooltip } from '@deriv-com/quill-ui';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import useFavouriteMarkets from 'AppV2/Hooks/useFavouriteMarkets';
import useLiveTick from 'AppV2/Hooks/useLiveTick';
import useMarketDiscovery from 'AppV2/Hooks/useMarketDiscovery';
import useMarketInfoTradeTypes from 'AppV2/Hooks/useMarketInfoTradeTypes';
import useSymbolTradingTimes from 'AppV2/Hooks/useSymbolTradingTimes';
import { getMarketDescription } from 'AppV2/Utils/market-descriptions';
import { DEFAULT_DISCOVERY_WINDOW, formatChangePercentage, TDiscoveryWindow } from 'AppV2/Utils/market-discovery-utils';
import { TAvailableContract } from 'AppV2/Utils/trade-types-utils';
import IconTradeCategory from 'Assets/Trading/Categories/icon-trade-categories';
import { useTraderStore } from 'Stores/useTraderStores';

import SymbolIconsMapper from '../SymbolIconsMapper/symbol-icons-mapper';

import MarketChangesDropdown from './market-changes-dropdown';
import MarketSparkline from './market-sparkline';

type TMarketInfoScreen = {
    item: NonNullable<TActiveSymbolsResponse['active_symbols']>[0];
    onBack: () => void;
    /** Called after committing the market + trade type, to close the whole selector. */
    onTraded: () => void;
    /**
     * The trade type the info icon was opened from (the browsed tab / favourite group / search
     * group). Used as the default the top Favourite button keys off; falls back to the first
     * available trade type when absent or not offered by this symbol.
     */
    default_trade_type?: string;
};

const formatPrice = (value: number | null, pip_size?: number) => (value === null ? '–' : value.toFixed(pip_size ?? 2));

/**
 * The dedicated market info screen: market summary + daily stats, description, a worm chart, and a
 * "Trade on" row where each available trade type is a direct CTA — tapping one commits the market
 * under that trade type into the active trade context and opens the trade page — plus trading times.
 */
const MarketInfoScreen = observer(({ item, onBack, onTraded, default_trade_type }: TMarketInfoScreen) => {
    const underlying_symbol = item.underlying_symbol ?? '';
    const { contract_type, selectMarketAndTradeType } = useTraderStore();
    const { isFavourite, toggleFavourite } = useFavouriteMarkets();
    // Live tick for the headline price; its subscription is forgotten when the screen unmounts / the
    // symbol changes. The window snapshot below supplies the pre-tick fallback price + pip size, so no
    // separate daily-stats request is needed.
    const live_tick = useLiveTick(underlying_symbol);
    const { trade_types, isLoading: is_trade_types_loading } = useMarketInfoTradeTypes(underlying_symbol);
    const { market_availability, isLoading: is_trading_times_loading } = useSymbolTradingTimes(
        underlying_symbol,
        !!item.exchange_is_open
    );

    const { isMobile } = useDevice();

    // The id of the trade type currently being committed (empty when idle) — guards against
    // double-taps and lets the tapped card show its in-flight state.
    const [committing_id, setCommittingId] = useState('');
    // The worm chart's window, changed via the duration dropdown (defaults to 5m, matching discovery).
    const [chart_window, setChartWindow] = useState<TDiscoveryWindow>(DEFAULT_DISCOVERY_WINDOW);
    // When this info page was opened, for the `time_spent_on_info_page` analytics field. Reset per
    // symbol so it's accurate whether the screen remounts or is reused with a new `item`.
    const opened_at_ref = useRef(Date.now());
    useEffect(() => {
        opened_at_ref.current = Date.now();
    }, [underlying_symbol]);

    // `auto_refresh: false` — fetch the window snapshot once per window; the live
    // tick subscription below carries freshness from there. The symbol list is memoised so its
    // identity is stable per render — an inline `[underlying_symbol]` would make the hook's memos (and
    // thus `series_by_symbol`) rebuild every render.
    const discovery_symbols = useMemo(() => [underlying_symbol], [underlying_symbol]);
    // A closed market has no ticks in the recent window; fetch the last-available data instead so a
    // (greyed) worm still renders under the "Market closed" overlay.
    const is_market_closed = !item.exchange_is_open;
    const {
        series_by_symbol,
        change_by_symbol,
        pip_size_by_symbol,
        isLoading: is_chart_loading,
    } = useMarketDiscovery(discovery_symbols, chart_window, {
        auto_refresh: false,
        fetch_latest: is_market_closed,
    });
    const chart_change = change_by_symbol.get(underlying_symbol) ?? null;
    // The worm is a static snapshot of the selected window — no live sliding (PO decision). Memoised
    // so its stable identity doesn't churn the `period_stats` memo below.
    const chart_data = useMemo(
        () => series_by_symbol.get(underlying_symbol) ?? [],
        [series_by_symbol, underlying_symbol]
    );

    // OHLC for the SELECTED window (not the day): derived from the same snapshot the worm draws, so
    // the stats and the chart always agree. Open/close are the window's first/last points; high/low
    // its extremes. A closed market shows dashes instead (the last-available snapshot isn't "today").
    const period_stats = useMemo(() => {
        if (is_market_closed || !chart_data.length) return { open: null, high: null, low: null, close: null };
        return {
            open: chart_data[0],
            // reduce (not Math.max/min(...chart_data)) so a large series can't overflow the call stack.
            high: chart_data.reduce((acc, val) => (val > acc ? val : acc), chart_data[0]),
            low: chart_data.reduce((acc, val) => (val < acc ? val : acc), chart_data[0]),
            close: chart_data[chart_data.length - 1],
        };
    }, [chart_data, is_market_closed]);

    // Price + pip size: the live tick, falling back to the window snapshot (its close / pip size)
    // before the first tick lands.
    const chart_pip_size = pip_size_by_symbol.get(underlying_symbol);
    const latest_price = live_tick?.quote ?? period_stats.close;
    const price_pip_size = live_tick?.pip_size ?? chart_pip_size;

    // Headline change is scoped to the selected window (matching the worm chart + dropdown) and stays
    // live: the LIVE latest price against the window's opening price (first point of the rolling
    // window). Falls back to the chart's own windowed % until the series is available.
    const window_open_price = chart_data[0];
    const change_percentage =
        typeof latest_price === 'number' && typeof window_open_price === 'number' && window_open_price !== 0
            ? ((latest_price - window_open_price) / window_open_price) * 100
            : chart_change;

    // Favourites are keyed by {symbol, trade type}. With no explicit selection on this screen, the
    // top Favourite button defaults to the trade type the info icon was opened from, falling back to
    // the first available trade type when that isn't offered by (or wasn't passed for) this symbol.
    const favourite_trade_type = trade_types.find(contract => contract.id === default_trade_type) ?? trade_types[0];
    const description = getMarketDescription(underlying_symbol);
    const is_favourite = isFavourite(underlying_symbol, favourite_trade_type?.id ?? '');
    const is_positive = (change_percentage ?? 0) > 0;
    const is_negative = (change_percentage ?? 0) < 0;
    const is_loading = is_chart_loading || is_trade_types_loading || is_trading_times_loading;

    // Each trade-type card is a direct CTA: commit the market under that trade type (preferring the
    // app's current contract type when the trade type offers it) and open the trade page.
    const handleSelectTradeType = async (contract: TAvailableContract) => {
        if (committing_id) return;
        const contract_type_to_commit = contract.for.includes(contract_type) ? contract_type : contract.for[0];
        trackMarketInfoTradeClicked({
            market_name: getSymbolDisplayName(underlying_symbol),
            trade_type: contract.id,
            time_spent_on_info_page: Math.round((Date.now() - opened_at_ref.current) / 1000),
        });
        setCommittingId(contract.id);
        try {
            await selectMarketAndTradeType(underlying_symbol, contract_type_to_commit);
            onTraded();
        } catch {
            // Commit failed — clear the in-flight state so the screen doesn't hang and the user can
            // retry. (On success the selector unmounts, so no reset is needed there.)
            setCommittingId('');
        }
    };

    // OHLC order (Open, High, Low, Close): the desktop one-row reads left-to-right in this order; the
    // mobile 2×2 fills column-first, so Open/High land in the left column and Low/Close in the right.
    const stat_cells = [
        { label: <Localize i18n_default_text='Open price' />, value: period_stats.open },
        { label: <Localize i18n_default_text='Highest price' />, value: period_stats.high },
        { label: <Localize i18n_default_text='Lowest price' />, value: period_stats.low },
        { label: <Localize i18n_default_text='Close price' />, value: period_stats.close },
    ];

    // The "•"-separated segments beside the availability status: next-open when closed; the current
    // session's close + reopen for a multi-session market; or a countdown to close for a single one.
    const getAvailabilitySegments = (): JSX.Element[] => {
        const { is_all_day, closes_in_minutes, session, next_open } = market_availability;
        if (is_market_closed) {
            if (!next_open) return [];
            const { when, time } = next_open;
            if (when === 'today')
                return [<Localize key='opens' i18n_default_text='Opens today at {{time}} GMT' values={{ time }} />];
            if (when === 'tomorrow')
                return [<Localize key='opens' i18n_default_text='Opens tomorrow at {{time}} GMT' values={{ time }} />];
            return [
                <Localize key='opens' i18n_default_text='Opens {{day}} at {{time}} GMT' values={{ day: when, time }} />,
            ];
        }
        // An all-day session (00:00–23:59:59) reads as "24 hours" rather than a countdown to midnight.
        if (is_all_day) return [<Localize key='all-day' i18n_default_text='24 hours a day (GMT)' />];
        if (session) {
            const segments = [
                <Localize key='closes' i18n_default_text='Closes {{time}} GMT' values={{ time: session.close }} />,
            ];
            if (session.reopen) {
                segments.push(
                    <Localize
                        key='reopens'
                        i18n_default_text='Reopens {{time}} GMT'
                        values={{ time: session.reopen }}
                    />
                );
            }
            return segments;
        }
        if (closes_in_minutes == null) return [];
        const hours = Math.floor(closes_in_minutes / 60);
        const minutes = closes_in_minutes % 60;
        if (hours > 0)
            return [
                <Localize
                    key='closes'
                    i18n_default_text='Closes in {{hours}} hr {{minutes}} min'
                    values={{ hours, minutes }}
                />,
            ];
        return [<Localize key='closes' i18n_default_text='Closes in {{minutes}} min' values={{ minutes }} />];
    };
    const availability_segments = getAvailabilitySegments();

    return (
        <div className='market-info'>
            <div className='market-info__header'>
                <button type='button' className='market-info__back' aria-label={localize('Back')} onClick={onBack}>
                    <StandaloneArrowLeftBoldIcon iconSize='sm' fill='var(--component-textIcon-normal-default)' />
                </button>
            </div>

            {is_loading ? (
                <div className='market-info__body' data-testid='dt_market_info_skeleton'>
                    <div className='market-info__summary'>
                        <Skeleton.Square width={40} height={40} rounded />
                        <div className='market-info__summary-text'>
                            <Skeleton.Square width={160} height={40} rounded />
                        </div>
                    </div>
                    <Skeleton.Square height={42} rounded />
                    <div className='market-info__overview'>
                        <Skeleton.Square height={isMobile ? 195 : 251} rounded />
                        <div className='market-info__stats'>
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div className='market-info__stat' key={index}>
                                    <Skeleton.Square width={80} height={48} rounded />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='market-info__section'>
                        <Skeleton.Square width={100} height={24} rounded />
                        <div className='market-info__trade-types'>
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton.Square key={index} width={120} height={80} rounded />
                            ))}
                        </div>
                    </div>
                    <div className='market-info__section'>
                        <Skeleton.Square width={110} height={24} rounded />
                        <Skeleton.Square height={24} rounded />
                    </div>
                </div>
            ) : (
                <div className='market-info__body'>
                    <div className='market-info__intro'>
                        <div className='market-info__summary'>
                            <SymbolIconsMapper symbol={underlying_symbol} />
                            <div className='market-info__summary-text'>
                                <div className='market-info__name-row'>
                                    <Text size='xl' bold className='market-info__name'>
                                        {getSymbolDisplayName(underlying_symbol)}
                                    </Text>
                                </div>
                                <div className='market-info__price-row'>
                                    {is_market_closed ? (
                                        <Tag
                                            label={<Localize i18n_default_text='Closed' />}
                                            color='error'
                                            variant='fill'
                                            showIcon={false}
                                            size='sm'
                                        />
                                    ) : (
                                        <>
                                            <Text className='market-info__price'>
                                                {formatPrice(latest_price, price_pip_size)}
                                            </Text>
                                            {change_percentage !== null && (
                                                <span
                                                    className={clsx('market-info__change', {
                                                        'market-info__change--positive': is_positive,
                                                        'market-info__change--negative': is_negative,
                                                    })}
                                                >
                                                    <CaptionText>
                                                        {formatChangePercentage(change_percentage)}
                                                    </CaptionText>
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                type='button'
                                className='market-info__favourite'
                                aria-label={localize(is_favourite ? 'Unfavourite' : 'Favourite')}
                                aria-pressed={is_favourite}
                                onClick={() =>
                                    toggleFavourite(underlying_symbol, favourite_trade_type?.id ?? '', 'market_info')
                                }
                            >
                                {is_favourite ? (
                                    <StandaloneStarFillIcon fill='var(--core-color-solid-mustard-700)' iconSize='sm' />
                                ) : (
                                    <StandaloneStarRegularIcon
                                        iconSize='sm'
                                        fill='var(--semantic-color-monochrome-surface-normal-high)'
                                    />
                                )}
                                <Text size='md' className='market-info__favourite-label'>
                                    {is_favourite ? (
                                        <Localize i18n_default_text='Unfavourite' />
                                    ) : (
                                        <Localize i18n_default_text='Favourite' />
                                    )}
                                </Text>
                            </button>
                        </div>

                        {description && (
                            <Text size='sm' className='market-info__description'>
                                {description}
                            </Text>
                        )}
                    </div>

                    {/* Chart and stats: stacked in portrait, side by side in landscape. */}
                    <div className='market-info__overview'>
                        <div className='market-info__chart'>
                            <div className='market-info__chart-header'>
                                <MarketChangesDropdown
                                    selected_window={chart_window}
                                    onSelect={setChartWindow}
                                    disabled={is_market_closed}
                                />
                            </div>
                            {is_chart_loading ? (
                                <Skeleton.Square height={200} rounded />
                            ) : (
                                <div
                                    className={clsx('market-info__chart-body', {
                                        'market-info__chart-body--closed': is_market_closed,
                                    })}
                                >
                                    {chart_data.length > 1 && (
                                        <MarketSparkline
                                            data={chart_data}
                                            is_positive={!is_market_closed && (change_percentage ?? 0) > 0}
                                            is_negative={!is_market_closed && (change_percentage ?? 0) < 0}
                                            with_area
                                            responsive
                                            width={300}
                                            height={200}
                                            className='market-info__chart-svg'
                                        />
                                    )}
                                    {is_market_closed && (
                                        <div className='market-info__chart-closed'>
                                            <span className='market-info__chart-closed-pill'>
                                                <StandaloneLockBoldIcon
                                                    iconSize='sm'
                                                    fill='var(--component-textIcon-normal-subtle)'
                                                />
                                                <Text size='sm'>
                                                    <Localize i18n_default_text='Market closed' />
                                                </Text>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className='market-info__stats'>
                            {stat_cells.map((cell, index) => (
                                <div className='market-info__stat' key={index}>
                                    <Text bold className='market-info__stat-value'>
                                        {formatPrice(cell.value, chart_pip_size)}
                                    </Text>
                                    <CaptionText className='market-info__stat-label'>{cell.label}</CaptionText>
                                </div>
                            ))}
                        </div>
                    </div>

                    {trade_types.length > 0 && (
                        <div className='market-info__section'>
                            <Text bold className='market-info__section-title'>
                                <Localize i18n_default_text='Trade on' />
                            </Text>
                            <div className='market-info__trade-types'>
                                {trade_types.map(contract => (
                                    <button
                                        key={contract.id}
                                        type='button'
                                        className='market-info__trade-type-card'
                                        disabled={!!committing_id}
                                        aria-busy={committing_id === contract.id}
                                        onClick={() => handleSelectTradeType(contract)}
                                    >
                                        <span className='market-info__trade-type-card-top'>
                                            <span className='market-info__trade-type-card-icon'>
                                                <IconTradeCategory category={contract.for[0]} />
                                            </span>
                                            <LabelPairedChevronRightSmRegularIcon fill='var(--component-textIcon-normal-subtle)' />
                                        </span>
                                        <Text size='sm' className='market-info__trade-type-card-label'>
                                            {contract.tradeType}
                                        </Text>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {market_availability.description && (
                        <div className='market-info__section'>
                            <div className='market-info__availability-header'>
                                <Text bold className='market-info__section-title'>
                                    <Localize i18n_default_text='Market availability' />
                                </Text>
                                <Tooltip
                                    as='button'
                                    className='market-info__availability-info'
                                    tooltipContent={market_availability.description}
                                    tooltipPosition='top'
                                    popoverAlign='start'
                                >
                                    <StandaloneCircleInfoRegularIcon
                                        iconSize='sm'
                                        fill='var(--component-textIcon-normal-default, rgba(0, 0, 0, 0.72))'
                                    />{' '}
                                </Tooltip>
                            </div>
                            <div className='market-info__availability-status'>
                                <StandaloneClockThreeRegularIcon
                                    iconSize='sm'
                                    fill='var(--component-textIcon-normal-default, rgba(0, 0, 0, 0.72))'
                                />{' '}
                                <Text
                                    size='sm'
                                    className={clsx('market-info__availability-state', {
                                        'market-info__availability-state--open': !is_market_closed,
                                        'market-info__availability-state--closed': is_market_closed,
                                    })}
                                >
                                    {is_market_closed ? (
                                        <Localize i18n_default_text='Closed' />
                                    ) : (
                                        <Localize i18n_default_text='Open' />
                                    )}
                                </Text>
                                {availability_segments.map((segment, index) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <Fragment key={index}>
                                        <span className='market-info__availability-separator'>•</span>
                                        <Text size='sm' color='quill-typography__color--default'>
                                            {segment}
                                        </Text>
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default MarketInfoScreen;
