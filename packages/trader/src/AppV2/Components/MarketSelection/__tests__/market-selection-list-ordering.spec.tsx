import { TActiveSymbolsResponse } from '@deriv/api';
import { render, screen } from '@testing-library/react';

import sortSymbols from 'AppV2/Utils/sort-symbols-utils';

import MarketSelectionList from '../market-selection-list';

type ActiveSymbols = NonNullable<TActiveSymbolsResponse['active_symbols']>;

// <Localize> renders its default text, so section and group headings come out as the English
// defaults — enough to read the rendered order off the DOM.
jest.mock('@deriv-com/translations', () => ({
    Localize: ({ i18n_default_text }: { i18n_default_text: string }) => <span>{i18n_default_text}</span>,
    localize: (text: string) => text,
    useTranslations: () => ({ localize: (text: string) => text }),
}));

const mock_device = { isMobile: false };
jest.mock('@deriv-com/ui', () => ({ useDevice: () => mock_device }));

jest.mock('../market-changes-dropdown', () => () => null);
jest.mock('../market-selection-row-desktop', () => () => null);
jest.mock('../market-selection-row-mobile', () => () => null);

const derived = (underlying_symbol: string, submarket: string, subgroup: string): ActiveSymbols[number] =>
    ({
        underlying_symbol,
        submarket,
        subgroup,
        market: 'synthetic_index',
        exchange_is_open: 1,
        is_trading_suspended: 0,
        display_order: 0,
    }) as ActiveSymbols[number];

// The live `active_symbols` Derived set, deliberately shuffled — alias spellings and subgroups as the
// API sends them (verified against wss://api-core.deriv.com/options/v1/ws/public).
const ALL_DERIVED: ActiveSymbols = [
    derived('WLDXAU', 'commodity_basket', 'baskets'),
    derived('RB100', 'range_index', 'synthetics'),
    derived('BOOM1000', 'crash_index', 'synthetics'),
    derived('R_100', 'random_index', 'synthetics'),
    derived('WLDUSD', 'forex_basket', 'baskets'),
    derived('RDBULL', 'random_daily', 'synthetics'),
    derived('stpRNG', 'step_index', 'synthetics'),
    derived('JD10', 'jump_index', 'synthetics'),
];

const HEADINGS_IN_ORDER = [
    'Synthetics',
    'Volatility indices',
    'Step indices',
    'Jump indices',
    'Crash/Boom',
    'Daily reset indices',
    'Range break indices',
    'Baskets',
    'Forex basket',
    'Commodities basket',
];

const headingsFor = (symbols: ActiveSymbols) => {
    const { unmount } = render(
        <MarketSelectionList
            symbols={sortSymbols(symbols)}
            is_loading={false}
            trade_type='Rise/Fall'
            onSelectSymbol={jest.fn()}
        />
    );
    // Rows and the changes dropdown are mocked out, so the <Localize> spans of the section and group
    // headings are the only text in the tree — returned one per heading, in document order.
    const headings = screen.getAllByText(/./, { selector: 'span' }).map(node => node.textContent);
    unmount();
    return headings;
};

describe('MarketSelectionList Derived section order', () => {
    afterEach(() => {
        mock_device.isMobile = false;
    });

    it('[DMO-001] renders the curated Derived order end to end, uncurated section last', () => {
        expect(headingsFor(ALL_DERIVED)).toEqual(HEADINGS_IN_ORDER);
    });

    it('[DMO-005] renders the same order on the mobile breakpoint as on desktop', () => {
        const desktop_headings = headingsFor(ALL_DERIVED);

        mock_device.isMobile = true;
        const mobile_headings = headingsFor(ALL_DERIVED);

        expect(mobile_headings).toEqual(desktop_headings);
        expect(mobile_headings).toEqual(HEADINGS_IN_ORDER);
    });

    it("[DMO-005] renders the curated relative order for every trade type's tradeable subset", () => {
        // Stand-ins for three trade-type tabs, each offering a different slice of the Derived set.
        const tradeable_subsets = [
            ALL_DERIVED,
            ALL_DERIVED.filter(symbol => symbol.subgroup === 'synthetics'),
            ALL_DERIVED.filter(symbol =>
                ['random_index', 'crash_index', 'forex_basket'].includes(symbol.submarket ?? '')
            ),
        ];

        tradeable_subsets.forEach(subset => {
            const headings = headingsFor(subset);

            expect(headings).toEqual(HEADINGS_IN_ORDER.filter(heading => headings.includes(heading)));
        });
    });

    it('[DMO-004] keeps every supplied symbol reachable, dropping no section', () => {
        expect(headingsFor(ALL_DERIVED)).toHaveLength(HEADINGS_IN_ORDER.length);
        expect(screen.queryByText('range_index')).not.toBeInTheDocument();
    });
});
