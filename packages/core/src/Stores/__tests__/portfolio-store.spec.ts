import { autorun, configure } from 'mobx';

import PortfolioStore from '../portfolio-store';

configure({ safeDescriptors: false });

let mockedPortfolioStore: PortfolioStore;

const symbol = '1HZ100V';
const contracts = [
    {
        buy_price: 10,
        contract_id: 229749680508,
        contract_type: 'MULTUP',
        currency: 'USD',
        date_start: 1705570990,
        expiry_time: 4859222399,
        longcode:
            "If you select 'Up', your total profit/loss will be the percentage increase in Volatility 100 (1s) Index, multiplied by 100, minus commissions.",
        payout: 0,
        purchase_time: 1705570990,
        shortcode: 'MULTUP_1HZ100V_10.00_10_1705570990_4859222399_0_0.00',
        symbol,
        transaction_id: 458367398868,
    },
    {
        buy_price: 10,
        contract_id: 230152813328,
        contract_type: 'MULTDOWN',
        currency: 'USD',
        date_start: 1705921444,
        expiry_time: 4859567999,
        longcode:
            "If you select 'Down', your total profit/loss will be the percentage decrease in AUD/JPY, multiplied by 300, minus commissions.",
        payout: 0,
        purchase_time: 1705921444,
        shortcode: 'MULTDOWN_FRXAUDJPY_10.00_30_1705921444_4859567999_0_0.00',
        symbol,
        transaction_id: 459167693628,
    },
];

beforeEach(() => {
    mockedPortfolioStore = new PortfolioStore({
        active_symbols: {
            active_symbols: [
                {
                    allow_forward_starting: 1,
                    display_name: 'Volatility 100 (1s) Index',
                    display_order: 3,
                    exchange_is_open: 1,
                    is_trading_suspended: 0,
                    market: 'synthetic_index',
                    market_display_name: 'Derived',
                    pip: 0.01,
                    subgroup: 'synthetics',
                    subgroup_display_name: 'Synthetics',
                    submarket: 'random_index',
                    submarket_display_name: 'Volatility Indices',
                    symbol,
                    symbol_type: 'stockindex',
                },
            ],
        },
        contract_trade: {
            addContract: jest.fn(),
            updateProposal: jest.fn(),
        },
        contract_replay: {
            contract_id: null,
            populateConfig: jest.fn(),
        },
        common: {
            services_error: {},
            resetServicesError: jest.fn(),
        },
        ui: {
            is_mobile: false,
        },
    });
    mockedPortfolioStore.portfolioHandler({
        echo_req: {
            portfolio: 1,
            req_id: 8,
        },
        msg_type: 'portfolio',
        portfolio: {
            contracts,
        },
        req_id: 8,
    });
});

describe('PortfolioStore', () => {
    it('getPositionById() should return a position by its id, or undefined when id is incorrect or not provided', () => {
        expect(mockedPortfolioStore.getPositionById(230152813328)).toMatchObject({
            contract_info: contracts[1],
            contract_update: undefined,
            details: contracts[1].longcode,
            display_name: 'AUD/JPY',
            id: contracts[1].contract_id,
            indicative: 0,
            payout: contracts[1].payout,
            purchase: contracts[1].buy_price,
            reference: contracts[1].transaction_id,
            type: contracts[1].contract_type,
        });
        expect(mockedPortfolioStore.getPositionById('incorrect-id')).toEqual(undefined);
        expect(mockedPortfolioStore.getPositionById(null)).toEqual(undefined);
        expect(mockedPortfolioStore.getPositionById(undefined)).toEqual(undefined);
    });

    it('proposalOpenContractHandler() should preserve entry_spot as string with trailing zeros', () => {
        const contract_id = contracts[0].contract_id;

        mockedPortfolioStore.proposalOpenContractHandler({
            proposal_open_contract: {
                contract_id,
                contract_type: 'MULTUP',
                shortcode: contracts[0].shortcode,
                bid_price: '10.00',
                profit: '0.50',
                entry_spot: '975.40',
                barrier: '980.00',
                is_valid_to_sell: 1,
            },
        });

        const position = mockedPortfolioStore.positions_map[contract_id];
        expect(typeof position.entry_spot).toBe('string');
        expect(position.entry_spot).toBe('975.40');
        expect(typeof position.barrier).toBe('number');
        expect(position.barrier).toBe(980);
    });

    describe('populateResultDetails()', () => {
        const getClosedContractResponse = () => ({
            proposal_open_contract: {
                contract_id: contracts[0].contract_id,
                contract_type: 'MULTUP',
                shortcode: contracts[0].shortcode,
                bid_price: '10.50',
                buy_price: 10,
                profit: '0.50',
                entry_spot: '975.40',
                barrier: '980.00',
                currency: 'USD',
                date_start: contracts[0].date_start,
                date_expiry: contracts[0].expiry_time,
                exit_tick_time: contracts[0].date_start + 60,
                sell_time: contracts[0].date_start + 60,
                sell_price: '10.50',
                is_expired: 1,
                is_sold: 1,
                is_valid_to_sell: 0,
                status: 'sold',
            },
        });

        it('should clear stale services_error when a contract closes', () => {
            mockedPortfolioStore.root_store.common.services_error = {
                code: 'ContractSellFailure',
                message: 'Mock sell error',
                type: 'sell',
            };

            mockedPortfolioStore.populateResultDetails(getClosedContractResponse());

            expect(mockedPortfolioStore.root_store.common.resetServicesError).toHaveBeenCalled();
        });

        it('should not call resetServicesError when there is no services_error', () => {
            mockedPortfolioStore.root_store.common.services_error = {};

            mockedPortfolioStore.populateResultDetails(getClosedContractResponse());

            expect(mockedPortfolioStore.root_store.common.resetServicesError).not.toHaveBeenCalled();
        });
    });

    it('active_positions notifies observers when a position profit is updated in place', () => {
        // Regression: `active_positions` was annotated `observable.struct`. Because
        // proposalOpenContractHandler mutates position objects in place, the re-filtered
        // array held identical references, deepEqual reported no change, and consumers
        // (e.g. the positions drawer Total P/L) stayed frozen until a position was
        // added or removed.
        const totalProfit = () =>
            mockedPortfolioStore.active_positions.reduce(
                (total, position) => total + (Number(position.profit_loss) || 0),
                0
            );

        const observed: number[] = [];
        const dispose = autorun(() => observed.push(totalProfit()));

        expect(observed).toEqual([0]);

        const emitProfit = (contract_id: number, profit: string) => {
            mockedPortfolioStore.proposalOpenContractHandler({
                proposal_open_contract: {
                    contract_id,
                    contract_type: 'MULTUP',
                    shortcode: contracts[0].shortcode,
                    bid_price: '10.00',
                    profit,
                },
            });
            mockedPortfolioStore.updatePositions();
        };

        emitProfit(contracts[0].contract_id, '5.00');
        emitProfit(contracts[1].contract_id, '2.50');

        dispose();

        expect(totalProfit()).toBe(7.5);
        expect(observed).toEqual([0, 5, 7.5]);
    });

    it('setContractType drives is_multiplier', () => {
        mockedPortfolioStore.setContractType('multiplier');

        expect(mockedPortfolioStore.contract_type).toBe('multiplier');
        expect(mockedPortfolioStore.is_multiplier).toBe(true);
    });

    it('proposalOpenContractHandler updates the position and leaves the chart barriers intact', () => {
        const contract_id = contracts[0].contract_id;

        expect(() =>
            mockedPortfolioStore.proposalOpenContractHandler({
                proposal_open_contract: {
                    contract_id,
                    contract_type: 'MULTUP',
                    shortcode: contracts[0].shortcode,
                    bid_price: '10.50',
                    profit: '0.50',
                    barrier: '980.00',
                    is_valid_to_sell: 1,
                },
            })
        ).not.toThrow();

        expect(mockedPortfolioStore.positions_map[contract_id].profit_loss).toBe(0.5);
        expect(Array.isArray(mockedPortfolioStore.barriers)).toBe(true);
        expect(Array.isArray(mockedPortfolioStore.active_positions)).toBe(true);
    });
});
