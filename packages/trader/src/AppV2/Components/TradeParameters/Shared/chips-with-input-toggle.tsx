import React from 'react';

import { ValueChips, ValueChipsSkeleton } from 'AppV2/Components/InputPopover';

interface ChipsWithInputToggleProps {
    activeTab: 'chips' | 'input';
    chipValues: number[];
    selectedValue?: number;
    onSelect: (value: number) => void;
    formatValue?: (value: number) => string;
    inputComponent: React.ReactNode;
    className?: string;
    /** The chip values are still being derived: hold the row's space with a skeleton. */
    isLoading?: boolean;
}

const ChipsWithInputToggle = ({
    activeTab,
    chipValues,
    selectedValue,
    onSelect,
    formatValue,
    inputComponent,
    className,
    isLoading,
}: ChipsWithInputToggleProps) => {
    if (activeTab === 'input') return <>{inputComponent}</>;

    if (isLoading) return <ValueChipsSkeleton className={className} />;

    return (
        <ValueChips
            values={chipValues}
            selectedValue={selectedValue}
            onSelect={onSelect}
            formatValue={formatValue}
            className={className}
        />
    );
};

export default ChipsWithInputToggle;
