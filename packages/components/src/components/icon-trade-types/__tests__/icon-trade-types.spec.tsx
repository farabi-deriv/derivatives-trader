import React from 'react';

import { CONTRACT_TYPES, TRADE_TYPES, tradeTypeIcons, unsupported_contract_types_list } from '@deriv/shared';
import { render } from '@testing-library/react';

import IconTradeTypes from '../icon-trade-types';

/**
 * The 10 trade types the trade-type filter hides. DCR-056 records a settled decision: their icon-map
 * entries and `icon-trade-types` switch arms are KEPT permanently, because they render HISTORICAL
 * positions for users who traded those types before the filter. Each row pairs a filtered trade type
 * with the contract types a position of that type carries, and the icon each one must resolve to.
 */
const FILTERED_TRADE_TYPES = [
    {
        trade_type: TRADE_TYPES.CALL_PUT_SPREAD,
        contracts: [
            { contract_type: CONTRACT_TYPES.CALL_PUT_SPREAD.CALL, icon: 'IcTradetypeCallspread' },
            { contract_type: CONTRACT_TYPES.CALL_PUT_SPREAD.PUT, icon: 'IcTradetypePutspread' },
        ],
    },
    {
        trade_type: TRADE_TYPES.RUN_HIGH_LOW,
        contracts: [
            { contract_type: CONTRACT_TYPES.RUN_HIGH_LOW.HIGH, icon: 'IcTradetypeRunhigh' },
            { contract_type: CONTRACT_TYPES.RUN_HIGH_LOW.LOW, icon: 'IcTradetypeRunlow' },
        ],
    },
    {
        trade_type: TRADE_TYPES.RESET,
        contracts: [
            { contract_type: CONTRACT_TYPES.RESET.CALL, icon: 'IcTradetypeResetcall' },
            { contract_type: CONTRACT_TYPES.RESET.PUT, icon: 'IcTradetypeResetput' },
        ],
    },
    {
        trade_type: TRADE_TYPES.ASIAN,
        contracts: [
            { contract_type: CONTRACT_TYPES.ASIAN.UP, icon: 'IcTradetypeAsianu' },
            { contract_type: CONTRACT_TYPES.ASIAN.DOWN, icon: 'IcTradetypeAsiand' },
        ],
    },
    {
        trade_type: TRADE_TYPES.TICK_HIGH_LOW,
        contracts: [
            { contract_type: CONTRACT_TYPES.TICK_HIGH_LOW.HIGH, icon: 'IcTradetypeTickhigh' },
            { contract_type: CONTRACT_TYPES.TICK_HIGH_LOW.LOW, icon: 'IcTradetypeTicklow' },
        ],
    },
    {
        trade_type: TRADE_TYPES.END,
        contracts: [
            { contract_type: CONTRACT_TYPES.END.OUT, icon: 'IcTradetypeExpirymiss' },
            { contract_type: CONTRACT_TYPES.END.IN, icon: 'IcTradetypeExpiryrange' },
        ],
    },
    {
        trade_type: TRADE_TYPES.STAY,
        contracts: [
            { contract_type: CONTRACT_TYPES.STAY.IN, icon: 'IcTradetypeRange' },
            { contract_type: CONTRACT_TYPES.STAY.OUT, icon: 'IcTradetypeUpordown' },
        ],
    },
    {
        trade_type: TRADE_TYPES.LB_CALL,
        contracts: [{ contract_type: CONTRACT_TYPES.LB_CALL, icon: 'IcTradetypeLbcall' }],
    },
    {
        trade_type: TRADE_TYPES.LB_PUT,
        contracts: [{ contract_type: CONTRACT_TYPES.LB_PUT, icon: 'IcTradetypeLbput' }],
    },
    {
        trade_type: TRADE_TYPES.LB_HIGH_LOW,
        contracts: [{ contract_type: CONTRACT_TYPES.LB_HIGH_LOW, icon: 'IcTradetypeLbhighlow' }],
    },
];

const FILTERED_CONTRACTS = FILTERED_TRADE_TYPES.flatMap(({ trade_type, contracts }) =>
    contracts.map(contract => ({ trade_type, ...contract }))
);

const markupFor = (type: string) => render(<IconTradeTypes type={type} />).container.innerHTML;

describe('<IconTradeTypes />', () => {
    // The `default:` arm of the switch — what a type with no arm of its own falls through to.
    const unknown_icon_markup = markupFor('a-contract-type-that-has-no-arm');

    it('falls back to the unknown icon for a type the switch does not name', () => {
        expect(unknown_icon_markup).toContain('<svg');
    });

    it('renders a live trade type at the requested size', () => {
        const view = render(<IconTradeTypes type={CONTRACT_TYPES.MULTIPLIER.UP} iconSize='lg' />);

        expect(view.container.innerHTML).toMatch(/width="48"/);
        expect(view.container.innerHTML).toMatch(/height="48"/);
        // md is this component's own default, not the mapper's xs.
        expect(markupFor(CONTRACT_TYPES.MULTIPLIER.UP)).toMatch(/width="32"/);
    });

    describe('[DCR-056] the filtered trade types keep their icons permanently', () => {
        it('[DCR-056] covers exactly the trade types the filter hides', () => {
            expect(FILTERED_TRADE_TYPES.map(({ trade_type }) => trade_type).sort()).toEqual(
                [...unsupported_contract_types_list].sort()
            );
        });

        it.each(FILTERED_CONTRACTS)(
            '[DCR-056] $trade_type: $contract_type still has an entry in tradeTypeIcons',
            ({ icon }) => {
                const IconComponent = tradeTypeIcons[icon as keyof typeof tradeTypeIcons];

                expect(tradeTypeIcons).toHaveProperty(icon);
                // Quill icons are forwardRef/memo objects, so the check is that the entry is a
                // usable element type rather than that it is a plain function.
                expect(IconComponent).toBeDefined();
                expect(React.isValidElement(<IconComponent />)).toBe(true);
            }
        );

        it.each(FILTERED_CONTRACTS)(
            '[DCR-056] $trade_type: a historical $contract_type position renders its own icon, not the fallback',
            ({ contract_type }) => {
                // Positions pass the contract type lower-cased, the way the statement and positions
                // tables do.
                const markup = markupFor(contract_type.toLowerCase());

                expect(markup).toContain('<svg');
                expect(markup).not.toBe(unknown_icon_markup);
            }
        );

        it('[DCR-056] each filtered contract type resolves to a distinct icon', () => {
            const rendered = FILTERED_CONTRACTS.map(({ contract_type }) => markupFor(contract_type.toLowerCase()));

            expect(new Set(rendered).size).toBe(FILTERED_CONTRACTS.length);
        });
    });
});
