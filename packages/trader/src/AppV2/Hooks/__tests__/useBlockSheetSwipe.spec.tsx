import { fireEvent, render, screen } from '@testing-library/react';

import useBlockSheetSwipe from '../useBlockSheetSwipe';

const Harness = ({
    onParentPointerDown,
    onParentTouchStart,
}: {
    onParentPointerDown: () => void;
    onParentTouchStart: () => void;
}) => {
    const block_sheet_swipe = useBlockSheetSwipe();

    return (
        <div onPointerDown={onParentPointerDown} onTouchStart={onParentTouchStart}>
            <div {...block_sheet_swipe}>
                <ul role='listbox'>
                    <li className='quill-wheel-picker__data-item' role='option' aria-selected={false}>
                        <span>1 tick</span>
                    </li>
                    <li className='quill-wheel-picker__data-item' role='option' aria-selected={false}>
                        <span>2 ticks</span>
                    </li>
                </ul>
                <span>Not a row</span>
            </div>
        </div>
    );
};

describe('useBlockSheetSwipe', () => {
    let scrollIntoView: jest.Mock, onParentPointerDown: jest.Mock, onParentTouchStart: jest.Mock;
    const original_scroll_into_view = HTMLElement.prototype.scrollIntoView;

    beforeEach(() => {
        scrollIntoView = jest.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
        onParentPointerDown = jest.fn();
        onParentTouchStart = jest.fn();
    });

    afterEach(() => {
        HTMLElement.prototype.scrollIntoView = original_scroll_into_view;
    });

    const renderHarness = () =>
        render(<Harness onParentPointerDown={onParentPointerDown} onParentTouchStart={onParentTouchStart} />);
    const getRow = (label: string) => screen.getByRole('option', { name: label });

    it('[WPT-001] scrolls a tapped row to the centre the way the wheel row click does', () => {
        renderHarness();
        fireEvent.pointerDown(screen.getByText('1 tick'));
        fireEvent.pointerUp(screen.getByText('1 tick'));

        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(getRow('1 tick'));
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    });

    it('[WPT-002] keeps a press on a row from reaching the sheet', () => {
        renderHarness();
        fireEvent.pointerDown(getRow('1 tick'));
        fireEvent.touchStart(getRow('1 tick'));

        expect(onParentPointerDown).not.toHaveBeenCalled();
        expect(onParentTouchStart).not.toHaveBeenCalled();
    });

    it('[WPT-002] does not re-centre a row when the press is cancelled', () => {
        renderHarness();
        fireEvent.pointerDown(getRow('1 tick'));
        fireEvent.pointerCancel(getRow('1 tick'));
        fireEvent.pointerUp(getRow('1 tick'));

        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('[WPT-002] does not re-centre either row when the press is released on another row', () => {
        renderHarness();
        fireEvent.pointerDown(getRow('1 tick'));
        fireEvent.pointerUp(getRow('2 ticks'));

        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('[WPT-002] ignores a press outside any row', () => {
        renderHarness();
        fireEvent.pointerDown(screen.getByText('Not a row'));
        fireEvent.pointerUp(screen.getByText('Not a row'));

        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
