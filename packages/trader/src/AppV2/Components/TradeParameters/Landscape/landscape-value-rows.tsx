import clsx from 'clsx';

type TLandscapeValueRows = {
    last_index: number;
    index: number;
    /** Label for a ladder index — the adapter formats currency and the take-profit "off" sentinel. */
    labelAt: (index: number) => string;
    className?: string;
};

// The glass panel's three-row readout — index-1 dimmed, index large, index+1 dimmed. Only three
// values are ever in the DOM, so no virtualisation is needed however long the ladder is.
// Out-of-range neighbours are blanked.
const LandscapeValueRows = ({ last_index, index, labelAt, className }: TLandscapeValueRows) => {
    const rows = [
        { key: 'prev', index: index - 1, is_current: false },
        { key: 'current', index, is_current: true },
        { key: 'next', index: index + 1, is_current: false },
    ] as const;

    return (
        <div data-testid='dt_landscape_value_rows' className={clsx('landscape-value-rows', className)}>
            {rows.map(row => {
                const in_range = row.index >= 0 && row.index <= last_index;
                return (
                    <div
                        key={row.key}
                        data-testid={`dt_landscape_value_row_${row.key}`}
                        className={clsx('landscape-value-rows__row', {
                            'landscape-value-rows__row--current': row.is_current,
                        })}
                    >
                        {/* Neighbours may blank at the ladder's ends; the current row never may — a
                            blank there reads as the value vanishing, so it clamps instead. */}
                        {row.is_current
                            ? labelAt(Math.min(Math.max(row.index, 0), last_index))
                            : in_range
                              ? labelAt(row.index)
                              : ''}
                    </div>
                );
            })}
        </div>
    );
};

export default LandscapeValueRows;
