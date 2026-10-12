import { act, renderHook } from '@testing-library/react';

import { TLandscapeParamAdapter } from '../types';
import useLandscapeParamEditor from '../use-landscape-param-editor';

const makeAdapter = (overrides: Partial<TLandscapeParamAdapter> = {}) =>
    ({
        selected_index: 0,
        last_index: 10,
        commit: jest.fn(),
        ...overrides,
    }) as unknown as TLandscapeParamAdapter;

describe('useLandscapeParamEditor', () => {
    it('[LTP-021] commits against the live adapter, not the one captured when the panel opened', () => {
        // The caller rebuilds its adapter every render, e.g. as new bounds arrive with the panel open.
        const opened = makeAdapter();
        const live = makeAdapter();
        const { result, rerender } = renderHook(({ adapter }) => useLandscapeParamEditor(adapter), {
            initialProps: { adapter: opened },
        });

        act(() => result.current.open(opened));
        rerender({ adapter: live });
        act(() => {
            result.current.stepBy(1);
            result.current.settle();
        });

        expect(live.commit).toHaveBeenCalledWith(1);
        expect(opened.commit).not.toHaveBeenCalled();
    });

    it('[LTP-021] clamps a step to the live range', () => {
        const opened = makeAdapter({ last_index: 10 });
        const live = makeAdapter({ last_index: 2 });
        const { result, rerender } = renderHook(({ adapter }) => useLandscapeParamEditor(adapter), {
            initialProps: { adapter: opened },
        });

        act(() => result.current.open(opened));
        rerender({ adapter: live });
        act(() => result.current.stepBy(5));

        expect(result.current.index).toBe(2);
    });

    it('[LTP-021] still steps and settles in the same handler as open, before any re-render', () => {
        // A chip's arrow key opens, steps and settles in one keydown, while the caller still passes null.
        const adapter = makeAdapter();
        const { result } = renderHook(() => useLandscapeParamEditor(null));

        act(() => {
            result.current.open(adapter);
            result.current.stepBy(1);
            result.current.settle();
        });

        expect(adapter.commit).toHaveBeenCalledWith(1);
    });
});
