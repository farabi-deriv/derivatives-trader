import classNames from 'classnames';
import React from 'react';
import { LegacyChevronDown1pxIcon } from '@deriv/quill-icons';

type TSelectNative = {
    className?: string;
    label?: string;
    should_show_empty_option?: boolean;
    suffix_icon?: React.ReactElement;
    hide_selected_value?: boolean;
    hide_top_placeholder?: boolean;
    value?: string | number;
    list_items: Array<TListItem> | { [key: string]: Array<TListItem> };
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value'>; // Default type of value in HTMLSelectElement is only string but here string | number is required

type TSelectNativeOptions = {
    list_items: Array<TListItem>;
};

type TListItem = {
    text: string;
    value: string;
    disabled?: boolean;
    nativepicker_text?: React.ReactNode;
    group?: string;
    id?: string;
};

const getDisplayText = (list_items: Array<TListItem> | { [key: string]: Array<TListItem> }, value: string | number) => {
    const dropdown_items = Array.isArray(list_items)
        ? list_items
        : ([] as Array<TListItem>).concat(...Object.values(list_items)); //typecasting since [] is inferred to be type never[]
    const list_obj = dropdown_items.find(item =>
        typeof item.value !== 'string'
            ? item.value === value
            : item.value.toLowerCase() === (value as string).toLowerCase()
    );

    if (list_obj) return list_obj.text;
    return '';
};

const SelectNativeOptions = ({ list_items }: TSelectNativeOptions) => {
    const options = list_items.filter(opt => !opt.disabled);
    const has_group = Array.isArray(list_items) && !!list_items[0]?.group;

    if (has_group) {
        const dropdown_items = options.reduce((dropdown_map: { [key: string]: Array<TListItem> }, item) => {
            if (item.group) {
                const index = item.group;
                dropdown_map[index] = dropdown_map[index] || [];
                dropdown_map[index].push(item);
            }
            return dropdown_map;
        }, {});
        const group_names = Object.keys(dropdown_items);
        return (
            <React.Fragment>
                {group_names.map(option => (
                    <optgroup key={option} label={option}>
                        {dropdown_items[option].map((value: TListItem) => (
                            <option key={value.id || value.value} value={value.value}>
                                {value.nativepicker_text || value.text}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </React.Fragment>
        );
    }
    return (
        <React.Fragment>
            {options.map(option => (
                <option key={option.id || option.value} value={option.value}>
                    {option.nativepicker_text || option.text}
                </option>
            ))}
        </React.Fragment>
    );
};

const SelectNative = ({
    className,
    disabled,
    hide_selected_value,
    label,
    list_items,
    should_show_empty_option = true,
    suffix_icon,
    value,
    hide_top_placeholder = false,
    ...props
}: TSelectNative) => (
    <div
        className={classNames(className, 'dc-select-native', {
            'dc-select-native--disabled': disabled,
            'dc-select-native--hide-selected-value': hide_selected_value,
        })}
    >
        <div className='dc-select-native__wrapper'>
            <div className={classNames('dc-input', { 'dc-input--disabled': disabled })}>
                <div
                    className={classNames('dc-select-native__container', {
                        'dc-select-native__container--disabled': disabled,
                    })}
                >
                    <div className='dc-select-native__display'>
                        {list_items && value && (
                            <div className='dc-select-native__display-text' data-testid='selected_value'>
                                {!hide_selected_value && getDisplayText(list_items, value)}
                            </div>
                        )}
                    </div>
                    <div
                        className={classNames('dc-select-native__placeholder', {
                            'dc-select-native__placeholder--has-value': value,
                            'dc-select-native__placeholder--hide-top-placeholder': value && hide_top_placeholder,
                            'dc-select-native__placeholder--disabled': disabled,
                        })}
                    >
                        {label}
                    </div>
                    {!suffix_icon ? (
                        <LegacyChevronDown1pxIcon
                            className='dc-select-native__arrow'
                            iconSize='xs'
                            fill='var(--color-text-primary)'
                        />
                    ) : (
                        React.cloneElement(suffix_icon, {
                            className: 'dc-select-native__suffix-icon',
                            iconSize: 'xs',
                            fill: 'var(--color-text-primary)',
                        })
                    )}
                    <select
                        className='dc-select-native__picker'
                        value={value}
                        disabled={disabled}
                        {...props}
                        id='dt_components_select-native_select-tag'
                    >
                        {Array.isArray(list_items) ? (
                            <React.Fragment>
                                {/*
                                 * In native select, first option is selected by default.
                                 * Added an empty option to avoid it from selecting first item
                                 * from list_items provided
                                 */}
                                {should_show_empty_option && <option value='' />}
                                {/*
                                 * Safari on ios allows to select a disabled option. So, we should avoid showing it
                                 */}
                                <SelectNativeOptions list_items={list_items} />
                            </React.Fragment>
                        ) : (
                            Object.keys(list_items).map((key: string) => {
                                const items = list_items[key].filter((opt: TListItem) => !opt.disabled);

                                if (items.length > 0) {
                                    return (
                                        <optgroup key={key} label={key}>
                                            {/*
                                             * Safari on ios allows to select a disabled option. So, we should avoid showing it
                                             */}
                                            <SelectNativeOptions list_items={list_items[key]} />
                                        </optgroup>
                                    );
                                }

                                return null;
                            })
                        )}
                    </select>
                </div>
            </div>
        </div>
    </div>
);

export default SelectNative;
