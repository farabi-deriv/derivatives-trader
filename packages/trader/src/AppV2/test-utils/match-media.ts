import { act } from '@testing-library/react';

type TChangeListener = (event?: MediaQueryListEvent) => void;

export type TQueryMatchMediaMock = {
    setMatches: (query: string, matches: boolean) => void;
    fire: (query: string) => void;
    listenerCount: (query: string) => number;
    matchMedia: jest.Mock;
};

/**
 * Query-aware `window.matchMedia` stand-in: the global jsdom stub always reports
 * `{ matches: false }` and never invokes its listeners, so no spec can observe an
 * orientation change. This keys state per query string and can fire registered
 * `change` listeners inside `act()`. Pass `{ legacy: true }` to expose only the
 * deprecated `addListener`/`removeListener` API (iOS Safari < 14).
 */
export const createMatchMediaMock = ({ legacy = false }: { legacy?: boolean } = {}): TQueryMatchMediaMock => {
    const state = new Map<string, { matches: boolean; listeners: Set<TChangeListener> }>();

    const entry = (query: string) => {
        if (!state.has(query)) state.set(query, { matches: false, listeners: new Set() });
        return state.get(query) as { matches: boolean; listeners: Set<TChangeListener> };
    };

    const matchMedia = jest.fn((query: string) => {
        const e = entry(query);
        // Every call returns a fresh MediaQueryList whose listener add/remove close over the
        // SAME per-query set, so a listener registered on one handle fires for all of them.
        const mql: Record<string, unknown> = {
            get matches() {
                return e.matches;
            },
            media: query,
            onchange: null,
        };
        if (legacy) {
            mql.addListener = (cb: TChangeListener) => e.listeners.add(cb);
            mql.removeListener = (cb: TChangeListener) => e.listeners.delete(cb);
        } else {
            mql.addEventListener = (_type: string, cb: TChangeListener) => e.listeners.add(cb);
            mql.removeEventListener = (_type: string, cb: TChangeListener) => e.listeners.delete(cb);
        }
        return mql as unknown as MediaQueryList;
    });

    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    return {
        setMatches: (query, matches) => {
            entry(query).matches = matches;
        },
        fire: query => {
            act(() => {
                entry(query).listeners.forEach(l => l());
            });
        },
        listenerCount: query => entry(query).listeners.size,
        matchMedia,
    };
};
