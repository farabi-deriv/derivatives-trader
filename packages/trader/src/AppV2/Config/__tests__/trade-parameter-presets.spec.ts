import * as presets_module from '../trade-parameter-presets';
import { getStakePresets, TRADE_PARAMETER_PRESETS } from '../trade-parameter-presets';

describe('stake presets', () => {
    describe('getStakePresets', () => {
        it('returns the shared presets for a trade type', () => {
            expect(getStakePresets('turbos')).toEqual(TRADE_PARAMETER_PRESETS.stake.turbos);
            expect(getStakePresets('rise_fall_higher_lower')).toEqual(
                TRADE_PARAMETER_PRESETS.stake.rise_fall_higher_lower
            );
            expect(getStakePresets('vanillas')).toEqual(TRADE_PARAMETER_PRESETS.stake.vanillas);
        });

        it('returns the same presets whatever the market', () => {
            // The base set no longer varies by symbol: a market whose minimum invalidates the lower
            // values is handled by deriving its ladder from the reported minimum, not by swapping in
            // a different base here.
            expect(getStakePresets('turbos')).toEqual([1, 2, 5, 10, 15, 25]);
        });
    });

    // Characterization guard: every market's stake ladder is derived at runtime from its own
    // min_stake, so no per-symbol table may be reintroduced here. This is the ticket's explicit
    // "do not hard-code" constraint, and the high-minimum symbols below are the ones that used to
    // carry hand-written stake lists (Turbos on the 1s volatility indices and Volatility 75).
    describe('stake presets stay table-free', () => {
        it('keeps a single shared base per trade type', () => {
            expect(TRADE_PARAMETER_PRESETS.stake.vanillas).toEqual([1, 5, 10, 20, 50, 75]);
            expect(TRADE_PARAMETER_PRESETS.stake.turbos).toEqual([1, 2, 5, 10, 15, 25]);
        });

        it('exposes no per-symbol override table or lookup at all', () => {
            // Both the table and its accessor were deleted with the derivation; naming them here
            // makes a reintroduction fail loudly rather than silently shadow the derived ladder.
            expect(presets_module).not.toHaveProperty('STAKE_PRESET_SYMBOL_OVERRIDES');
            expect(presets_module).not.toHaveProperty('getStakePresetOverride');
        });

        it('serves the previously-curated symbols from the shared base', () => {
            // getStakePresets takes no symbol argument any more, so these markets cannot be special
            // cased. Their ladders come from getStakeLadderValues against the market's own limits.
            expect(getStakePresets('turbos')).toEqual(TRADE_PARAMETER_PRESETS.stake.turbos);
            expect(getStakePresets('vanillas')).toEqual(TRADE_PARAMETER_PRESETS.stake.vanillas);
        });
    });
});
