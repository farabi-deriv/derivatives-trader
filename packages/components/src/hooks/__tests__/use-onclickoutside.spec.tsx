import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { useOnClickOutside } from '../use-onclickoutside';

type THarness = {
    handler: (event: MouseEvent) => void;
    validationFn?: (event: MouseEvent) => boolean;
    mouseEvent?: 'mousedown' | 'mouseup';
};

const Harness = ({ handler, validationFn, mouseEvent }: THarness) => {
    const ref = React.useRef<HTMLDivElement>(null);
    useOnClickOutside(ref, handler, validationFn, mouseEvent);

    return (
        <div>
            <div ref={ref} data-testid='dt_inside'>
                <span data-testid='dt_descendant'>descendant</span>
            </div>
            <div data-testid='dt_outside'>outside</div>
        </div>
    );
};

describe('useOnClickOutside', () => {
    it('[DCR-020] fires the handler on a mousedown outside the ref', () => {
        const handler = jest.fn();
        render(<Harness handler={handler} />);

        fireEvent.mouseDown(screen.getByTestId('dt_outside'));

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('[DCR-020] ignores a click on the ref or one of its descendants', () => {
        const handler = jest.fn();
        render(<Harness handler={handler} />);

        fireEvent.mouseDown(screen.getByTestId('dt_inside'));
        fireEvent.mouseDown(screen.getByTestId('dt_descendant'));

        expect(handler).not.toHaveBeenCalled();
    });

    it('[DCR-020] suppresses the handler when the validation function returns false', () => {
        const handler = jest.fn();
        render(<Harness handler={handler} validationFn={() => false} />);

        fireEvent.mouseDown(screen.getByTestId('dt_outside'));

        expect(handler).not.toHaveBeenCalled();
    });

    it('[DCR-020] listens on the mouse event it is given', () => {
        const handler = jest.fn();
        render(<Harness handler={handler} mouseEvent='mouseup' />);

        fireEvent.mouseDown(screen.getByTestId('dt_outside'));
        expect(handler).not.toHaveBeenCalled();

        fireEvent.mouseUp(screen.getByTestId('dt_outside'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('[DCR-020] calls the latest handler after a re-render without re-subscribing', () => {
        const first_handler = jest.fn();
        const second_handler = jest.fn();
        const { rerender } = render(<Harness handler={first_handler} />);

        rerender(<Harness handler={second_handler} />);
        fireEvent.mouseDown(screen.getByTestId('dt_outside'));

        expect(first_handler).not.toHaveBeenCalled();
        expect(second_handler).toHaveBeenCalledTimes(1);
    });

    it('[DCR-020] stops listening once the component unmounts', () => {
        const handler = jest.fn();
        const { unmount } = render(<Harness handler={handler} />);

        unmount();
        fireEvent.mouseDown(document.body);

        expect(handler).not.toHaveBeenCalled();
    });
});
