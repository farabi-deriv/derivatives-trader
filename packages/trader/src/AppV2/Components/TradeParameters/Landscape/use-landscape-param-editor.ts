import React from 'react';

import { TLandscapeParamAdapter } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Owns the draft index for the parameter being edited. Commit fires only on settle, is idempotent,
 * never fires on open, and is suppressed while the adapter blocks it (an unaffordable stake).
 */
const useLandscapeParamEditor = (live_adapter: TLandscapeParamAdapter | null) => {
    const [index, setIndex] = React.useState(0);
    const index_ref = React.useRef(0);
    const adapter_ref = React.useRef<TLandscapeParamAdapter | null>(null);
    const last_committed_ref = React.useRef<number | null>(null);

    // The caller rebuilds its adapter every render from live bounds, so step and commit
    // against that, not the one captured by `open()`. A ref, because a keypress opens, steps and settles
    // in one handler, before the caller's state has re-rendered.
    React.useLayoutEffect(() => {
        adapter_ref.current = live_adapter;
    });

    const setIdx = React.useCallback((next: number) => {
        index_ref.current = next;
        setIndex(next);
    }, []);

    const open = React.useCallback(
        (adapter: TLandscapeParamAdapter) => {
            adapter_ref.current = adapter;
            // Seed last-committed with the opening index so opening never writes to the store.
            last_committed_ref.current = adapter.selected_index;
            setIdx(adapter.selected_index);
        },
        [setIdx]
    );

    const stepBy = React.useCallback(
        (delta: number) => {
            const adapter = adapter_ref.current;
            if (!adapter) return;
            setIdx(clamp(index_ref.current + delta, 0, adapter.last_index));
        },
        [setIdx]
    );

    const settle = React.useCallback(() => {
        const adapter = adapter_ref.current;
        if (!adapter) return;
        const idx = index_ref.current;
        if (idx !== last_committed_ref.current) {
            adapter.commit(idx);
            last_committed_ref.current = idx;
        }
    }, []);

    const reset = React.useCallback(() => {
        adapter_ref.current = null;
        last_committed_ref.current = null;
    }, []);

    return { index, open, stepBy, settle, reset };
};

export default useLandscapeParamEditor;
