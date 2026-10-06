import { render, screen } from '@testing-library/react';

import { buildLadder } from 'AppV2/Utils/landscape-wheel-utils';

import LandscapeValueRows from '../landscape-value-rows';

describe('LandscapeValueRows', () => {
    const ladder = buildLadder({ min: 1, max: 10 }); // whole units 1..10, indices 0..9
    const labelAt = (index: number) => `$${ladder.valueAt(index).toFixed(2)}`;

    it('[LTP-005] renders exactly three value rows', () => {
        render(<LandscapeValueRows last_index={ladder.last_index} index={1} labelAt={labelAt} />);

        expect(screen.getAllByTestId(/^dt_landscape_value_row_/)).toHaveLength(3);
    });

    it('[LTP-005] shows index-1, index, index+1 stepping by a whole unit', () => {
        render(<LandscapeValueRows last_index={ladder.last_index} index={1} labelAt={labelAt} />);

        expect(screen.getByTestId('dt_landscape_value_row_prev')).toHaveTextContent('$1.00');
        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('$2.00');
        expect(screen.getByTestId('dt_landscape_value_row_next')).toHaveTextContent('$3.00');
    });

    it('[LTP-005] blanks the previous row at index 0', () => {
        render(<LandscapeValueRows last_index={ladder.last_index} index={0} labelAt={labelAt} />);

        expect(screen.getByTestId('dt_landscape_value_row_prev')).toHaveTextContent('');
        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('$1.00');
        expect(screen.getByTestId('dt_landscape_value_row_next')).toHaveTextContent('$2.00');
    });

    it('[LTP-005] never blanks the current row, even if the ladder shrank under the index', () => {
        // A commit's in-flight proposal can briefly drop `validation_params`, reshaping the ladder
        // under a live index. Neighbours may blank; the selected value must not — a blank there reads
        // as the stake vanishing.
        render(<LandscapeValueRows last_index={2} index={9} labelAt={labelAt} />);

        expect(screen.getByTestId('dt_landscape_value_row_current')).not.toHaveTextContent('');
        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('$3.00');
    });

    it('[LTP-005] blanks the next row at the last index', () => {
        render(<LandscapeValueRows last_index={ladder.last_index} index={ladder.last_index} labelAt={labelAt} />);

        expect(screen.getByTestId('dt_landscape_value_row_current')).toHaveTextContent('$10.00');
        expect(screen.getByTestId('dt_landscape_value_row_next')).toHaveTextContent('');
    });
});
