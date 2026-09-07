import React from 'react';

import { useTranslations } from '@deriv-com/translations';

import type { VerticalTabItem } from '../../InputPopover/vertical-tab-selector';
import VerticalTabSelector from '../../InputPopover/vertical-tab-selector';

interface DurationUnitSelectorProps {
    selectedUnit: string;
    onSelectUnit: (unit: string) => void;
    availableUnits?: string[];
    className?: string;
}

const DurationUnitSelector: React.FC<DurationUnitSelectorProps> = ({
    selectedUnit,
    onSelectUnit,
    availableUnits,
    className,
}) => {
    // Hook, not the module export: its own `languageChanged` subscription, not an ancestor's (#960).
    // Deliberately unmemoised — `useMemo(…, [])` would pin the labels to the mount language.
    const { localize } = useTranslations();

    const ALL_DURATION_UNITS: VerticalTabItem[] = [
        { value: 't', label: localize('Ticks') },
        { value: 's', label: localize('Seconds') },
        { value: 'm', label: localize('Minutes') },
        { value: 'h', label: localize('Hours') },
        { value: 'end_time', label: localize('End time') },
    ];

    const DURATION_UNITS =
        !availableUnits || availableUnits.length === 0
            ? ALL_DURATION_UNITS
            : ALL_DURATION_UNITS.filter(unit => availableUnits.includes(unit.value));

    return (
        <VerticalTabSelector
            items={DURATION_UNITS}
            selectedValue={selectedUnit}
            onSelect={onSelectUnit}
            className={className}
        />
    );
};

export default DurationUnitSelector;
