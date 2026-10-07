import { TContractInfo, CONTRACT_TYPES } from '@deriv/shared';
import {
    calculateMarker,
    createTickMarkers,
    getMarkerContractType,
    getPriorTickEpoch,
    getStartText,
} from '../chart-markers';

describe('createTickMarkers', () => {
    let contract_info: TContractInfo;
    beforeEach(() => {
        contract_info = {
            contract_type: CONTRACT_TYPES.CALL,
            status: 'open',
            tick_stream: [
                { epoch: 1, tick: 1.2345, tick_display_value: '1.2345' },
                { epoch: 2, tick: 1.235, tick_display_value: '1.235' },
                { epoch: 3, tick: 1.2355, tick_display_value: '1.2355' },
                { epoch: 4, tick: 1.236, tick_display_value: '1.236' },
                { epoch: 5, tick: 1.2365, tick_display_value: '1.2365' },
                { epoch: 6, tick: 1.237, tick_display_value: '1.237' },
                { epoch: 7, tick: 1.2375, tick_display_value: '1.2375' },
                { epoch: 8, tick: 1.238, tick_display_value: '1.238' },
                { epoch: 9, tick: 1.2385, tick_display_value: '1.2385' },
                { epoch: 10, tick: 1.239, tick_display_value: '1.239' },
            ],
            entry_spot_time: 1,
            entry_spot: '1.2345',
            tick_count: 10,
        };
    });
    it('should return an empty array if tick_stream is empty', () => {
        contract_info.tick_stream = [];
        contract_info.tick_count = 0;
        const result = createTickMarkers(contract_info);
        expect(result).toEqual([]);
    });
    it('should return an array with markers for every tick in tick_stream when contract is open', () => {
        contract_info.tick_count = 10;
        const result = createTickMarkers(contract_info);
        expect(result).toHaveLength(10);
        expect(result[0].content_config.className).toBe('chart-spot__entry');
        expect(result[1].content_config.is_value_hidden).toBe(false);
        expect(result[1].content_config.spot_className).toBe('chart-spot__spot');
        expect(result[1].content_config.spot_count).toBe(1);
        expect(result[1].content_config.spot_epoch).toBe('2');
        expect(result[1].content_config.spot_value).toBe('1.235');
    });
    it('should return an array with markers for all ticks when any tick contract is closed', () => {
        contract_info.audit_details = { all_ticks: contract_info.tick_stream };
        contract_info.tick_count = 10;
        contract_info.status = 'won';
        contract_info.exit_spot_time = 10;
        contract_info.exit_spot = '1.239';
        const result = createTickMarkers(contract_info);
        expect(result).toHaveLength(10);
        expect(result[result.length - 1].content_config.spot_value).toBe('1.239');
        expect(result[result.length - 1].type).toBe('SPOT_EXIT');
    });
    it('should mark only the entry and exit spots of a closed accumulator contract', () => {
        Object.assign(contract_info, {
            contract_type: CONTRACT_TYPES.ACCUMULATOR,
            audit_details: { all_ticks: contract_info.tick_stream },
            status: 'lost',
            exit_spot_time: 10,
            exit_spot: '1.239',
        });
        const result = createTickMarkers(contract_info);
        expect(result.map(({ type }) => type)).toEqual(['SPOT_ENTRY', 'SPOT_EXIT']);
        expect(result[1].content_config.spot_value).toBe('1.239');
        expect(result[1].content_config.spot_className).toContain('--accumulator-exit');
    });
    it('should mark only the entry spot of an open accumulator contract', () => {
        contract_info.contract_type = CONTRACT_TYPES.ACCUMULATOR;
        contract_info.status = 'open';
        const result = createTickMarkers(contract_info);
        // no per-tick dots, and the exit tick is not marked for an ongoing contract
        expect(result.map(({ type }) => type)).toEqual(['SPOT_ENTRY']);
    });

    it('should get the correct contract type', () => {
        contract_info.contract_type = CONTRACT_TYPES.ACCUMULATOR;
        expect(getMarkerContractType(contract_info)).toBe('AccumulatorContract');

        contract_info.contract_type = CONTRACT_TYPES.CALL;
        contract_info.tick_count = 1;
        expect(getMarkerContractType(contract_info)).toBe('TickContract');
    });

    it('should get the correct start text', () => {
        contract_info.contract_type = CONTRACT_TYPES.ACCUMULATOR;
        contract_info.tick_count = undefined;
        Object.assign(contract_info, {
            contract_type: CONTRACT_TYPES.CALL,
            tick_count: undefined,
            profit: '1',
            barrier: '1000',
            currency: 'USD',
        });
        const result = getStartText(contract_info);
        expect(result).toBe('+$1.00');
    });

    it('should not show the profit text of a non-tick contract once it is sold', () => {
        Object.assign(contract_info, {
            contract_type: CONTRACT_TYPES.CALL,
            tick_count: undefined,
            profit: '1',
            barrier: '1000',
            currency: 'USD',
            is_sold: 1,
        });
        expect(getStartText(contract_info)).toBeUndefined();
    });

    it('should keep showing the tick counter of a tick contract after it is sold', () => {
        Object.assign(contract_info, { tick_passed: 10, is_sold: 1 });
        expect(getStartText(contract_info)).toBe('10/10');
    });
});

describe('getPriorTickEpoch', () => {
    const tick_stream = [
        { epoch: 10, tick: 1.1, tick_display_value: '1.1' },
        { epoch: 20, tick: 1.2, tick_display_value: '1.2' },
        { epoch: 30, tick: 1.3, tick_display_value: '1.3' },
    ];

    it('should return the last tick before the exit', () => {
        expect(getPriorTickEpoch(tick_stream, 30)).toBe(20);
    });

    it('should return the same tick whether or not the exit tick has landed in the stream yet', () => {
        // The exit tick is appended a beat after exit_spot_time arrives. Both
        // shapes must resolve to the same barrier epoch, otherwise the finished
        // contract's band shifts after it has already rendered.
        const without_exit_tick = tick_stream.slice(0, -1);
        expect(getPriorTickEpoch(without_exit_tick, 30)).toBe(getPriorTickEpoch(tick_stream, 30));
    });

    it('should ignore ticks at or after the exit', () => {
        expect(getPriorTickEpoch(tick_stream, 10)).toBeUndefined();
    });

    it('should return undefined for an empty or missing tick stream', () => {
        expect(getPriorTickEpoch([], 30)).toBeUndefined();
        expect(getPriorTickEpoch(undefined, 30)).toBeUndefined();
    });
});

describe('calculateMarker exit spot for accumulators', () => {
    const finished_accumulator = {
        contract_type: CONTRACT_TYPES.ACCUMULATOR,
        status: 'sold',
        is_sold: 1,
        // calculateMarker returns an empty group until the first POC lands.
        transaction_ids: { buy: 1, sell: 2 },
        date_start: 100,
        entry_spot: '1.2',
        entry_spot_time: 101,
        exit_spot: '1.25',
        exit_spot_time: 110,
        profit: '5',
        currency: 'USD',
        tick_stream: [
            { epoch: 105, tick: 1.24, tick_display_value: '1.24' },
            { epoch: 110, tick: 1.25, tick_display_value: '1.25' },
        ],
    } as unknown as TContractInfo;

    const markerTypes = (contract_info: TContractInfo) =>
        (calculateMarker(contract_info, false, true)?.markers ?? []).map(({ type }: { type: string }) => type);

    it('should not push an exitSpot marker for a finished accumulator', () => {
        // The closed-band annotation already paints the exit dot and its
        // Won/Loss callout; a marker would stack a second dot on the same point.
        expect(markerTypes(finished_accumulator)).not.toContain('exitSpot');
    });

    it('should still push an exitSpot marker for a finished non-accumulator', () => {
        const finished_call = { ...finished_accumulator, contract_type: CONTRACT_TYPES.CALL };
        expect(markerTypes(finished_call)).toContain('exitSpot');
    });
});
