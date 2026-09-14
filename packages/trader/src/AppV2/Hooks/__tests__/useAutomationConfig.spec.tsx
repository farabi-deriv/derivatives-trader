import { renderHook } from '@testing-library/react-hooks';

import { KNOWN_PARAM_KEYS } from 'AppV2/Components/AutomationPanel/automation-config';
import { useAutomationStore } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import useAutoStrategies from '../useAutoStrategies';
import useAutomationConfig from '../useAutomationConfig';

jest.mock('../useAutoStrategies', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('Stores/useAutomationStore', () => ({ __esModule: true, useAutomationStore: jest.fn() }));
jest.mock('Stores/useTraderStores', () => ({ __esModule: true, useTraderStore: jest.fn() }));
jest.mock('@deriv-com/ui', () => ({ useDevice: () => ({ isMobile: false }) }));

const mockStrategies = useAutoStrategies as jest.Mock;
const mockAutomationStore = useAutomationStore as jest.Mock;
const mockTraderStore = useTraderStore as jest.Mock;

/** Builds an auto_list_strategies descriptor with the given `multiplier` schema. */
const withMultiplierSchema = (multiplier: Record<string, unknown>) => [
    {
        strategy_id: 'martingale',
        display_name: 'Martingale',
        supported_contract_types: ['CALL'],
        parameters: { type: 'object', properties: { multiplier }, required: [] },
    },
];

const setup = (strategies: unknown[], strategy = 'martingale') => {
    mockStrategies.mockReturnValue({ strategies, isLoading: false, error: null });
    mockAutomationStore.mockReturnValue({ config: { strategy, strategy_params: {} } });
    mockTraderStore.mockReturnValue({ contract_type: 'CALL' });
    return renderHook(() => useAutomationConfig());
};

describe('useAutomationConfig getParamBounds', () => {
    afterEach(() => jest.clearAllMocks());

    it('reads exclusiveMinimum and the inclusive maximum from the schema', () => {
        const { result } = setup(withMultiplierSchema({ type: 'number', exclusiveMinimum: 1, maximum: 10 }));
        expect(result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)).toEqual({
            min: 1,
            max: 10,
            is_min_exclusive: true,
        });
    });

    it('treats a plain `minimum` as inclusive', () => {
        const { result } = setup(withMultiplierSchema({ type: 'number', minimum: 2, maximum: 8 }));
        expect(result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)).toEqual({
            min: 2,
            max: 8,
            is_min_exclusive: false,
        });
    });

    it('prefers exclusiveMinimum when the schema sends both forms', () => {
        const { result } = setup(withMultiplierSchema({ type: 'number', minimum: 1, exclusiveMinimum: 3, maximum: 9 }));
        const bounds = result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER);
        expect(bounds.min).toBe(3);
        expect(bounds.is_min_exclusive).toBe(true);
    });

    it('falls back per end when the schema supplies only one bound', () => {
        const { result } = setup(withMultiplierSchema({ type: 'number', maximum: 4 }));
        // Lower bound falls back to the client default; the upper bound is the schema's.
        expect(result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)).toEqual({
            min: 1,
            max: 4,
            is_min_exclusive: true,
        });
    });

    it('falls back entirely for a parameter the schema does not bound', () => {
        const { result } = setup(withMultiplierSchema({ type: 'string' }));
        expect(result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)).toEqual({
            min: 1,
            max: 10,
            is_min_exclusive: true,
        });
    });

    it('falls back before auto_list_strategies resolves', () => {
        const { result } = setup([]);
        expect(result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER)).toEqual({
            min: 1,
            max: 10,
            is_min_exclusive: true,
        });
    });

    it('returns a stable object identity so consumer memos are not invalidated', () => {
        const { result } = setup(withMultiplierSchema({ type: 'number', exclusiveMinimum: 1, maximum: 10 }));
        const first = result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER);
        const second = result.current.getParamBounds(KNOWN_PARAM_KEYS.MULTIPLIER);
        expect(second).toBe(first);
    });
});
