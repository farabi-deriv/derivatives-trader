import React from 'react';
import classNames from 'classnames';
import { CSSTransition } from 'react-transition-group';
import { TList, findNextFocusableNode, findPreviousFocusableNode, TListItem } from './utility';
import Items from './items';
import DisplayText from './display-text';
import { useOnClickOutside } from '../../hooks';
import ThemedScrollbars from '../themed-scrollbars/themed-scrollbars';
import { LegacyChevronDown1pxIcon } from '@deriv/quill-icons';

type TDropdown = {
    className?: string;
    classNameDisplay?: string;
    classNameItems?: string;
    id?: string;
    is_align_text_left?: boolean;
    is_alignment_top?: boolean;
    list: TList;
    name?: string;
    no_border?: boolean;
    onChange?: (e: { target: { name: string; value: string } }) => void;
    placeholder?: string;
    suffix_icon?: React.ReactElement;
    should_open_on_hover?: boolean;
    should_scroll_to_selected?: boolean;
    should_auto_close_dropdown_list?: boolean;
    should_autohide?: boolean;
    value?: string | number;
};

type TDropdownList = {
    classNameItems?: string;
    handleSelect: (item: TListItem) => void;
    is_align_text_left?: boolean;
    is_alignment_top?: boolean;
    is_list_visible: boolean;
    list: TList;
    nodes: React.RefObject<Map<string, HTMLDivElement | null>>;
    onKeyPressed: (event: KeyboardEvent, item: TListItem) => void;
    suffix_icon?: React.ReactElement;
    should_scroll_to_selected?: boolean;
    should_autohide?: boolean;
    value?: string | number;
};

const DropdownList = React.forwardRef<HTMLDivElement, TDropdownList>((props, list_ref) => {
    const {
        classNameItems,
        handleSelect,
        is_align_text_left,
        is_alignment_top,
        is_list_visible,
        list,
        nodes,
        onKeyPressed,
        suffix_icon,
        should_scroll_to_selected,
        should_autohide,
        value,
    } = props;

    const [list_dimensions, setListDimensions] = React.useState([0, 0]);
    const [scroll_height, setScrollHeight] = React.useState<number>();

    /**
     * Calculate the offset for the dropdown list based on its height
     *
     * @return {{transform: string}}
     */
    const computed_offset_top = () => {
        return {
            transform: `translate3d(0, calc(-${list_dimensions[1]}px - 16px), 0px)`,
        };
    };

    const dropdownListClassName = () => {
        return classNames('dc-dropdown__list', {
            'dc-dropdown__list--top': is_alignment_top,
        });
    };

    const listClassNames = () => {
        return classNames('dc-list', {
            'dc-list--has-suffix-icon': suffix_icon,
        });
    };

    // Upon render via css transition group, we use this as a callback to set the width/height of the dropdown list in the state
    const setListDimension = () =>
        setListDimensions([
            (list_ref as React.MutableRefObject<HTMLElement>).current.offsetWidth,
            (list_ref as React.MutableRefObject<HTMLElement>).current.offsetHeight,
        ]);

    const getDropDownAlignment = () => (is_alignment_top ? computed_offset_top() : undefined);

    const transition_ref = React.useRef(null);

    return (
        <CSSTransition
            in={is_list_visible}
            timeout={100}
            classNames={{
                enter: 'dc-dropdown__list--enter',
                enterDone: 'dc-dropdown__list--enter-done',
                exit: 'dc-dropdown__list--exit',
            }}
            onEntered={setListDimension}
            unmountOnExit
            nodeRef={transition_ref}
        >
            <div ref={transition_ref} className={dropdownListClassName()}>
                <div
                    className={listClassNames()}
                    style={getDropDownAlignment()}
                    aria-expanded={is_list_visible}
                    role='list'
                    ref={list_ref}
                >
                    <ThemedScrollbars
                        height={list_dimensions[1] && list_dimensions[1] > 200 ? list_dimensions[1] : '200px'}
                        scroll_height={scroll_height}
                        should_scroll_to_selected={should_scroll_to_selected}
                        autohide={should_autohide}
                    >
                        {Array.isArray(list) ? (
                            <Items
                                onKeyPressed={onKeyPressed}
                                className={classNameItems}
                                handleSelect={handleSelect}
                                items={list}
                                is_align_text_left={is_align_text_left}
                                value={value}
                                nodes={nodes.current}
                                setScrollHeight={setScrollHeight}
                            />
                        ) : (
                            Object.keys(list).map((key, idx) => (
                                <React.Fragment key={key}>
                                    <div className='dc-list__label'>{key}</div>
                                    <Items
                                        onKeyPressed={onKeyPressed}
                                        className={classNameItems}
                                        handleSelect={handleSelect}
                                        items={list[key]}
                                        is_align_text_left={is_align_text_left}
                                        value={value}
                                        nodes={nodes.current}
                                    />
                                    {idx !== Object.keys(list).length - 1 && <span className='dc-list__separator' />}
                                </React.Fragment>
                            ))
                        )}
                    </ThemedScrollbars>
                </div>
            </div>
        </CSSTransition>
    );
});

DropdownList.displayName = 'DropdownList';

const Dropdown = ({
    className,
    classNameDisplay,
    classNameItems,
    is_align_text_left,
    is_alignment_top,
    list,
    name,
    no_border,
    onChange,
    placeholder,
    suffix_icon,
    should_open_on_hover = false,
    should_scroll_to_selected,
    should_auto_close_dropdown_list,
    should_autohide,
    value,
}: TDropdown) => {
    const dropdown_ref = React.useRef<HTMLDivElement>(null);
    const wrapper_ref = React.useRef<HTMLDivElement>(null);
    const nodes = React.useRef(new Map());
    const list_ref = React.useRef<HTMLDivElement>(null);

    const [is_list_visible, setIsListVisible] = React.useState(false);
    const initial_render = React.useRef(true);

    const onClickOutSide = () => setIsListVisible(false);

    useOnClickOutside(wrapper_ref, onClickOutSide, () => is_list_visible);

    const isSingleOption = () => list.length < 2;

    const containerClassName = () => {
        return classNames('dc-dropdown-container', className, {
            'dc-dropdown--has-placeholder': placeholder,
            'dc-dropdown--show': is_list_visible,
            'dc-dropdown--disabled': isSingleOption(),
            'dc-dropdown--has-suffix-icon': suffix_icon,
        });
    };

    const dropdownDisplayClassName = () => {
        return classNames('dc-dropdown__display', classNameDisplay, {
            'dc-dropdown__display--clicked': is_list_visible,
            'dc-dropdown__display--no-border': no_border,
            'dc-dropdown__display--is-left-text': is_align_text_left,
        });
    };

    React.useEffect(() => {
        if (should_auto_close_dropdown_list) {
            setIsListVisible(false);
        }
    }, [should_auto_close_dropdown_list]);

    React.useEffect(() => {
        if (!initial_render.current && !is_list_visible && value) dropdown_ref?.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_list_visible]);

    const handleSelect = (item: TListItem) => {
        if (item.value !== value) onChange?.({ target: { name: name || '', value: item.value } });

        handleVisibility();
    };

    const handleVisibility = (e?: React.MouseEvent<HTMLDivElement>) => {
        if (e && ['mouseover', 'mouseleave'].includes(e.type)) {
            if (!should_open_on_hover) return;
            if (e.type === 'mouseover') setIsListVisible(true);
            else setIsListVisible(false);
            return;
        }

        setIsListVisible(!is_list_visible);
    };

    const onKeyPressed = (event: KeyboardEvent, item: TListItem) => {
        if (isSingleOption()) return;

        // Tab -> before preventDefault() to be able to go to the next tabIndex
        if (event.keyCode === 9 && !is_list_visible) return;

        event.preventDefault();
        event.stopPropagation();

        switch (event.keyCode) {
            case 27: // esc
                if (is_list_visible) handleVisibility();
                break;
            case 9: // Tab
            case 13: // Enter
            case 32: // Space
                if (!item) return;
                handleSelect(item);
                break;
            case 38: // Up Arrow
            case 40: // Down Arrow
                if (is_list_visible) {
                    focusNextListItem(event.keyCode);
                } else {
                    handleVisibility();
                }
                break;
            default:
        }

        // For char presses, we do a search for the item:
        if (event.key.length === 1 && list.length) {
            const char = event.key.toLowerCase();
            const item_starting_with_char = list.find(li => li.value && li.value[0].toLowerCase() === char);
            if (!item_starting_with_char) return;

            const item_ref = nodes.current.get(item_starting_with_char.value);
            if (item_ref) item_ref.focus();
        }
    };

    const focusNextListItem = (direction: number) => {
        const { activeElement } = document;

        if (activeElement?.id === 'dropdown-display') {
            const el = Array.from(nodes.current.values())[0];
            if (el && el.focus instanceof Function) {
                el.focus();
            }
        } else {
            const active_node = nodes.current.get(activeElement?.id);
            if (active_node) {
                if (direction === 40) {
                    const next_node = findNextFocusableNode(active_node.nextSibling);
                    if (next_node) next_node.focus();
                }
                if (direction === 38) {
                    const prev_node = findPreviousFocusableNode(active_node.previousSibling);
                    if (prev_node) prev_node.focus();
                }
            }
        }
    };

    React.useEffect(() => {
        if (initial_render.current) {
            initial_render.current = false;
        }
    }, []);

    return (
        <React.Fragment>
            <input
                className='dc-dropdown__inner'
                autoComplete='off'
                name={name}
                readOnly
                type='hidden'
                value={value || 0}
            />
            <div
                ref={wrapper_ref}
                className={containerClassName()}
                onMouseOver={handleVisibility}
                onFocus={() => null}
                onMouseLeave={handleVisibility}
            >
                <div
                    className={classNames('dc-dropdown__container', {
                        'dc-dropdown__container--suffix-icon': suffix_icon,
                    })}
                    data-testid='dt_dropdown_container'
                >
                    <div
                        className={dropdownDisplayClassName()}
                        data-testid='dt_dropdown_display'
                        tabIndex={isSingleOption() ? -1 : 0}
                        onClick={handleVisibility}
                        onKeyDown={onKeyPressed as unknown as React.KeyboardEventHandler}
                        id='dropdown-display'
                        ref={dropdown_ref}
                    >
                        {!!suffix_icon &&
                            React.cloneElement(suffix_icon, {
                                className: 'suffix-icon',
                                iconSize: 'xs',
                                fill: 'var(--color-text-primary)',
                            })}
                        <DisplayText
                            className={classNames({
                                'dc-dropdown__display--has-suffix-icon-text': suffix_icon,
                            })}
                            name={name}
                            is_align_text_left={is_align_text_left}
                            placeholder={placeholder}
                            value={value ?? 0}
                            list={list}
                        />
                    </div>
                    {!(isSingleOption() || !!suffix_icon) && (
                        <LegacyChevronDown1pxIcon
                            className={classNames('dc-dropdown__select-arrow', {
                                'dc-dropdown__select-arrow--up': is_list_visible,
                            })}
                            iconSize='xs'
                            fill='var(--color-text-primary)'
                        />
                    )}
                    <DropdownList
                        classNameItems={classNameItems}
                        handleSelect={handleSelect}
                        is_align_text_left={is_align_text_left}
                        is_alignment_top={is_alignment_top}
                        is_list_visible={is_list_visible}
                        list={list}
                        nodes={nodes}
                        onKeyPressed={onKeyPressed}
                        ref={list_ref}
                        suffix_icon={suffix_icon}
                        should_scroll_to_selected={should_scroll_to_selected}
                        should_autohide={should_autohide}
                        value={value}
                    />
                </div>
            </div>
        </React.Fragment>
    );
};

export default Dropdown;
