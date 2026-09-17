import { useQuery } from '@deriv/api';
import { cloneObject, getContractCategoriesConfig, getContractTypesConfig } from '@deriv/shared';
import { mockStore } from '@deriv/stores';
import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import TraderProviders from '../../../trader-providers';
import useContractsFor from '../useContractsFor';

jest.mock('@deriv/api', () => ({
    ...jest.requireActual('@deriv/api'),
    useQuery: jest.fn(() => ({
        data: null,
        error: null,
        isLoading: false,
    })),
}));

jest.mock('@deriv/shared', () => ({
    ...jest.requireActual('@deriv/shared'),
    getContractCategoriesConfig: jest.fn(),
    getContractTypesConfig: jest.fn(),
    cloneObject: jest.fn(),
}));

jest.mock('Stores/Modules/Trading/Helpers/contract-type', () => ({
    ContractType: {
        processContractsForResponse: jest.fn(),
    },
}));

describe('useContractsFor', () => {
    let mocked_store: ReturnType<typeof mockStore>;

    const wrapper = ({ children }: { children: JSX.Element }) => (
        <TraderProviders store={mocked_store}>{children}</TraderProviders>
    );

    beforeEach(() => {
        jest.clearAllMocks();

        mocked_store = {
            ...mockStore({}),
            client: {
                ...mockStore({}).client,
                landing_company_shortcode: 'maltainvest',
                loginid: 'ROT1234',
            },
            modules: {
                trade: {
                    setContractTypesListV2: jest.fn(),
                    setIsAwaitingContractsFor: jest.fn(),
                    onChange: jest.fn(),
                    processContractsForV2: jest.fn(),
                    resolveContractTypeAvailability: jest.fn(),
                    setDefaultStake: jest.fn(),
                    setPayoutChoices: jest.fn(),
                    contract_type: 'type_1',
                    symbol: 'R_50',
                },
            },
        };

        (getContractCategoriesConfig as jest.Mock).mockReturnValue({
            category_1: { categories: ['type_1'] },
            category_2: { categories: ['type_2'] },
        });

        (getContractTypesConfig as jest.Mock).mockReturnValue({
            type_1: { trade_types: ['type_1'], title: 'Type 1', barrier_count: 0 },
            type_2: { trade_types: ['type_2'], title: 'Type 2', barrier_count: 1 },
        });

        (cloneObject as jest.Mock).mockImplementation(obj => JSON.parse(JSON.stringify(obj)));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch and set contract types for the company successfully', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [
                        { contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 },
                        { contract_type: 'type_2', underlying_symbol: 'GBPUSD', default_stake: 20 },
                    ],
                    hit_count: 2,
                },
            },
            error: null,
            isLoading: false,
        });

        const { result } = renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(result.current.contract_types_list).toEqual({
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
                category_2: { categories: [{ value: 'type_2', text: 'Type 2' }] },
            });
            expect(mocked_store.modules.trade.setContractTypesListV2).toHaveBeenCalledWith({
                category_1: { categories: [{ value: 'type_1', text: 'Type 1' }] },
                category_2: { categories: [{ value: 'type_2', text: 'Type 2' }] },
            });
        });
    });

    it('re-pushes the newly active type stake config on a same-symbol trade-type switch', async () => {
        // contracts_for is fetched per symbol, so switching trade type within a symbol re-renders
        // with the SAME cached response — the main processing effect does not re-run. Without a
        // contract_type-keyed push, the store keeps the previous type's default_stake and payout
        // choices, and a switch into Turbos can send its first proposal without a payout_per_point.
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [
                        { contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 },
                        {
                            contract_type: 'type_2',
                            underlying_symbol: 'GBPUSD',
                            default_stake: 20,
                            payout_choices: [7, 8, 9],
                        },
                    ],
                    hit_count: 2,
                },
            },
            error: null,
            isLoading: false,
        });

        const { rerender } = renderHook(() => useContractsFor(), { wrapper });
        await waitFor(() => {
            expect(mocked_store.modules.trade.setDefaultStake).toHaveBeenCalledWith(10);
        });

        (mocked_store.modules.trade.setDefaultStake as jest.Mock).mockClear();
        (mocked_store.modules.trade.setPayoutChoices as jest.Mock).mockClear();
        mocked_store.modules.trade.contract_type = 'type_2';
        rerender();

        await waitFor(() => {
            expect(mocked_store.modules.trade.setDefaultStake).toHaveBeenCalledWith(20);
            expect(mocked_store.modules.trade.setPayoutChoices).toHaveBeenCalledWith(['7', '8', '9']);
        });
    });

    it('pushes the active contract payout choices into the store, so the first Turbos proposal is never sent without one', async () => {
        // A Turbos proposal with neither a payout_per_point nor choices to fall back on is rejected
        // with an error carrying no limits and no choices (verified against the live API) — nothing
        // downstream recovers, and the market never prices. contracts_for is the only source that
        // exists BEFORE the first proposal, so the hook must wire it into the store.
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [
                        {
                            contract_type: 'type_1',
                            underlying_symbol: 'EURUSD',
                            default_stake: 10,
                            payout_choices: [1, 2, 3],
                        },
                        {
                            contract_type: 'type_2',
                            underlying_symbol: 'GBPUSD',
                            default_stake: 20,
                            payout_choices: [7, 8, 9],
                        },
                    ],
                    hit_count: 2,
                },
            },
            error: null,
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            // Strings, as the store's payout_choices are stored — and only the ACTIVE contract
            // type's choices, exactly as setDefaultStake is scoped.
            expect(mocked_store.modules.trade.setPayoutChoices).toHaveBeenCalledWith(['1', '2', '3']);
            expect(mocked_store.modules.trade.setPayoutChoices).not.toHaveBeenCalledWith(['7', '8', '9']);
        });
    });

    it('should handle API errors gracefully', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: null,
            error: { message: 'Some error' },
            isLoading: false,
        });

        const { result } = renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(result.current.contract_types_list).toEqual([]);
            expect(mocked_store.modules.trade.setContractTypesListV2).not.toHaveBeenCalled();
        });
    });

    it('should release the proposal hold when the API errors', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: null,
            error: { message: 'Some error' },
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(mocked_store.modules.trade.setIsAwaitingContractsFor).toHaveBeenCalledWith(false);
        });
    });

    it('should release the proposal hold when the response has no available contracts', async () => {
        // A settled empty response never reaches processContractsForV2 — without an
        // explicit release the trade panel would stay frozen with no error.
        (useQuery as jest.Mock).mockReturnValue({
            data: { contracts_for: { available: [], hit_count: 0 } },
            error: null,
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(mocked_store.modules.trade.setIsAwaitingContractsFor).toHaveBeenCalledWith(false);
        });
    });

    it('should not release the proposal hold directly on the success path (processContractsForV2 owns it)', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [{ contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 }],
                    hit_count: 1,
                },
            },
            error: null,
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(mocked_store.modules.trade.processContractsForV2).toHaveBeenCalled();
        });
        expect(mocked_store.modules.trade.setIsAwaitingContractsFor).not.toHaveBeenCalled();
    });

    it('reports availability to the store instead of changing the trade type itself', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [
                        { contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 },
                        { contract_type: 'type_2', underlying_symbol: 'GBPUSD', default_stake: 20 },
                    ],
                    hit_count: 2,
                },
            },
            error: null,
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(mocked_store.modules.trade.resolveContractTypeAvailability).toHaveBeenCalledWith('R_50', [
                'type_1',
                'type_2',
            ]);
        });
        // The old in-hook swap called onChange from a (possibly stale) render closure; the hook must
        // never mutate the trade type directly any more — that decision lives in the store.
        expect(mocked_store.modules.trade.onChange).not.toHaveBeenCalled();
    });

    it('reports availability BEFORE processContractsForV2 runs (it needs the corrected type)', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [{ contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 }],
                    hit_count: 1,
                },
            },
            error: null,
            isLoading: false,
        });

        renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(mocked_store.modules.trade.processContractsForV2).toHaveBeenCalled();
        });
        const resolve_order = (mocked_store.modules.trade.resolveContractTypeAvailability as jest.Mock).mock
            .invocationCallOrder[0];
        const process_order = (mocked_store.modules.trade.processContractsForV2 as jest.Mock).mock
            .invocationCallOrder[0];
        expect(resolve_order).toBeLessThan(process_order);
    });

    it('should not set unsupported contract types', async () => {
        (useQuery as jest.Mock).mockReturnValue({
            data: {
                contracts_for: {
                    available: [{ contract_type: 'unsupported_type', underlying_symbol: 'UNSUPPORTED' }],
                    hit_count: 1,
                },
            },
            error: null,
            isLoading: false,
        });

        const { result } = renderHook(() => useContractsFor(), { wrapper });

        await waitFor(() => {
            expect(result.current.trade_types).toEqual([]);
        });
    });

    describe('Symbol validation fix', () => {
        it('should prevent query when symbol is undefined', async () => {
            mocked_store.modules.trade.symbol = undefined;

            renderHook(() => useContractsFor(), { wrapper });

            await waitFor(() => {
                expect(useQuery).toHaveBeenCalledWith(
                    'contracts_for',
                    expect.objectContaining({
                        options: expect.objectContaining({
                            enabled: false,
                        }),
                    })
                );
            });
        });

        it('should prevent query when symbol is null', async () => {
            mocked_store.modules.trade.symbol = null;

            renderHook(() => useContractsFor(), { wrapper });

            await waitFor(() => {
                expect(useQuery).toHaveBeenCalledWith(
                    'contracts_for',
                    expect.objectContaining({
                        options: expect.objectContaining({
                            enabled: false,
                        }),
                    })
                );
            });
        });

        it('should prevent query when symbol is empty string', async () => {
            mocked_store.modules.trade.symbol = '';

            renderHook(() => useContractsFor(), { wrapper });

            await waitFor(() => {
                expect(useQuery).toHaveBeenCalledWith(
                    'contracts_for',
                    expect.objectContaining({
                        options: expect.objectContaining({
                            enabled: false,
                        }),
                    })
                );
            });
        });

        it('should allow query when symbol is present', async () => {
            mocked_store.modules.trade.symbol = 'R_100';

            renderHook(() => useContractsFor(), { wrapper });

            await waitFor(() => {
                expect(useQuery).toHaveBeenCalledWith('contracts_for', {
                    payload: {
                        contracts_for: 'R_100',
                    },
                    options: {
                        enabled: true,
                        staleTime: 60 * 1000,
                    },
                });
            });
        });
    });

    describe('Trade-type availability (no native-app allow-list)', () => {
        it('[MBR-004] offers the full server-available set with no remote-config allow-list filtering', async () => {
            (useQuery as jest.Mock).mockReturnValue({
                data: {
                    contracts_for: {
                        available: [
                            { contract_type: 'type_1', underlying_symbol: 'EURUSD', default_stake: 10 },
                            { contract_type: 'type_2', underlying_symbol: 'GBPUSD', default_stake: 20 },
                        ],
                        hit_count: 2,
                    },
                },
                error: null,
                isLoading: false,
            });

            const { result } = renderHook(() => useContractsFor(), { wrapper });

            await waitFor(() => {
                expect(result.current.trade_types.map(type => type.value)).toEqual(['type_1', 'type_2']);
            });
        });
    });
});
