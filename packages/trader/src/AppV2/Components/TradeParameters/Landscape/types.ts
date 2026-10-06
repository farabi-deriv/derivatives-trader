import React from 'react';

export type TLandscapeParamKey = 'stake' | 'take_profit';

/**
 * One shape per parameter, produced by an adapter hook. The pill/chip/panel deal only in ladder
 * indices; the adapter owns the mapping to a stake amount or a take-profit value (with its "off"
 * sentinel), the store commit, and — for stake alone — the balance hint and commit suppression.
 */
export type TLandscapeParamAdapter = {
    key: TLandscapeParamKey;
    label: string;
    /** The chip's collapsed display, e.g. `$10.00` or `-` (take profit off). */
    display_value: string;
    is_disabled: boolean;
    last_index: number;
    /** Index of the current store value, to the nearest rung; for take profit off, the last amount. */
    selected_index: number;
    /**
     * Whether a switchable parameter is currently on (take profit only; omitted by stake, which cannot
     * be switched off). Its panel carries the switch; while off it shows the ladder faded and inert.
     */
    is_on?: boolean;
    /**
     * Switches the parameter on/off. Present only alongside `is_on`. Turning
     * on lands at `index` — the value the panel is showing — or the ladder's floor without one. The off
     * state is deliberately NOT a rung of the ladder, so it can never be scrolled onto.
     */
    toggle?: (index?: number) => void;
    /** Row label for an index, currency-formatted. */
    labelAt: (index: number) => string;
    /** Commits the value at an index to the store. */
    commit: (index: number) => void;
    /** Balance hint for the value at an index (stake only; take profit returns null). */
    getHint: (index: number) => React.ReactNode;
    /** Whether the commit is suppressed for the value at an index (stake unaffordable; else false). */
    shouldBlockCommit: (index: number) => boolean;
};
