import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TAccumulatorGrowthRatePicker } from 'AppV2/Hooks/useAccumulatorGrowthRatePicker';

import ChartGrowthRate from '../chart-growth-rate';

const onStep = jest.fn();
const onSettle = jest.fn();

const buildPicker = (overrides: Partial<TAccumulatorGrowthRatePicker> = {}): TAccumulatorGrowthRatePicker => ({
    index: 2,
    last_index: 4,
    labelAt: (index: number) => `${index + 1}%`,
    onStep,
    onSettle,
    container_ref: React.createRef<HTMLDivElement>(),
    ...overrides,
});

// A real MouseEvent, like the landscape params spec uses: jsdom's synthetic
// pointer events carry no coordinates, and the drag maths reads them.
const pointer = (el: Element, type: string, coords: { clientY: number }) =>
    fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, ...coords }));

/** A vertical drag on the picker, the way the Stake wheel is scrolled. */
const dragBy = (element: HTMLElement, dy: number) => {
    pointer(element, 'pointerdown', { clientY: 200 });
    pointer(element, 'pointermove', { clientY: 200 - dy });
};

describe('ChartGrowthRate', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders nothing while the picker is closed', () => {
        render(<ChartGrowthRate picker={null} />);

        expect(screen.queryByTestId('dt_chart_growth_rate')).not.toBeInTheDocument();
    });

    it('shows the rate being picked, with its neighbours either side', () => {
        render(<ChartGrowthRate picker={buildPicker({ index: 2 })} />);

        expect(screen.getByText('Growth rate')).toBeInTheDocument();
        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('3%');
        expect(screen.getByTestId('dt_landscape_value_row_prev')).toHaveTextContent('2%');
        expect(screen.getByTestId('dt_landscape_value_row_next')).toHaveTextContent('4%');
    });

    it('blanks the neighbour at the end of the ladder', () => {
        render(<ChartGrowthRate picker={buildPicker({ index: 4, last_index: 4 })} />);

        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('5%');
        expect(screen.getByTestId('dt_landscape_value_row_next')).toHaveTextContent('');
    });

    it('carries neither the slider nor the barrier values any more', () => {
        render(<ChartGrowthRate picker={buildPicker()} />);

        // The band's own labels say what the barriers are; repeating them here
        // was the old readout's job, and the cue has gone with it.
        expect(screen.queryByTestId('dt_chart_growth_rate_cue')).not.toBeInTheDocument();
        expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
    });

    it('steps the rate when dragged, like the Stake wheel', () => {
        render(<ChartGrowthRate picker={buildPicker()} />);

        // Upwards, far enough to clear one step of travel.
        dragBy(screen.getByTestId('dt_chart_growth_rate'), 48);

        expect(onStep).toHaveBeenCalled();
        expect(onStep.mock.calls[0][0]).toBeGreaterThan(0);
    });

    it('steps the other way when dragged down', () => {
        render(<ChartGrowthRate picker={buildPicker()} />);

        dragBy(screen.getByTestId('dt_chart_growth_rate'), -48);

        expect(onStep.mock.calls[0][0]).toBeLessThan(0);
    });

    describe('where it renders', () => {
        it('renders in place when given nowhere else to go', () => {
            const { container } = render(<ChartGrowthRate picker={buildPicker()} />);

            expect(container).toContainElement(screen.getByTestId('dt_chart_growth_rate'));
        });

        it('portals into the container it is given', () => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            const host_ref = { current: host };

            const { container } = render(<ChartGrowthRate picker={buildPicker()} portal_container={host_ref} />);

            // `.trade__chart` clips its overflow, so a card lifted clear of the params pill would be
            // cut off at the top rather than drawn over the stats strip. Rendering into the page root
            // is what lets it be bounded by the viewport instead.
            expect(host).toContainElement(screen.getByTestId('dt_chart_growth_rate'));
            expect(container).toBeEmptyDOMElement();

            host.remove();
        });

        it('falls back to rendering in place when the container is not mounted', () => {
            const { container } = render(
                <ChartGrowthRate picker={buildPicker()} portal_container={{ current: null }} />
            );

            expect(container).toContainElement(screen.getByTestId('dt_chart_growth_rate'));
        });

        it('still scrolls once portalled', () => {
            const host = document.createElement('div');
            document.body.appendChild(host);

            render(<ChartGrowthRate picker={buildPicker()} portal_container={{ current: host }} />);
            dragBy(screen.getByTestId('dt_chart_growth_rate'), 40);

            // React events cross a portal, but the drag listens on the node itself — worth pinning,
            // since moving the card out of the chart is exactly the kind of change that could
            // silently cost it its gestures.
            expect(onStep).toHaveBeenCalled();

            host.remove();
        });
    });
});
