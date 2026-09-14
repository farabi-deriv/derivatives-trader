import React, { useMemo } from 'react';
import classNames from 'classnames';
import { matchRoute } from '@deriv/shared';
import VerticalTabContentContainer from './vertical-tab-content-container';
import { TItem } from './vertical-tab-header';
import VerticalTabHeaders from './vertical-tab-headers';

type TSetSelectedIndex = {
    current_path: string;
    list: TItem[];
    is_routed?: boolean;
    selected_index?: number | TItem;
    setCurrTabIndex: (index: number) => void;
    setVerticalTabIndex?: (index: number) => void;
};

type TVerticalTab = {
    current_path: string;
    is_floating?: boolean;
    is_full_width?: boolean;
    is_routed?: boolean;
    is_sidebar_enabled?: boolean;
    list: TItem[];
    setVerticalTabIndex?: (index: number) => void;
};

const setSelectedIndex = ({
    current_path,
    list,
    is_routed,
    selected_index,
    setCurrTabIndex,
    setVerticalTabIndex,
}: TSetSelectedIndex) => {
    let index: number;

    if (typeof selected_index === 'undefined') {
        index = is_routed
            ? Math.max(
                  list.indexOf(
                      (list.find(item => matchRoute(item, current_path)) || list.find(item => item.default)) as TItem
                  ),
                  0
              )
            : 0;
    } else {
        index = typeof selected_index === 'object' ? list.indexOf(selected_index) : selected_index;
    }

    setCurrTabIndex(index);
    setVerticalTabIndex?.(index);
};

const VerticalTab = ({
    current_path,
    is_floating,
    is_full_width,
    is_routed,
    is_sidebar_enabled = true,
    list,
    setVerticalTabIndex,
}: TVerticalTab) => {
    const [curr_tab_index, setCurrTabIndex] = React.useState(0);
    const selected = useMemo(() => list[curr_tab_index] || list[0], [curr_tab_index, list]);

    const changeSelected = (e: TItem) => {
        setSelectedIndex({
            current_path,
            list,
            selected_index: e,
            setCurrTabIndex,
            setVerticalTabIndex,
        });
    };

    React.useEffect(() => {
        setSelectedIndex({
            current_path,
            list,
            is_routed,
            setCurrTabIndex,
            setVerticalTabIndex,
        });
    }, [list, setVerticalTabIndex, is_routed, current_path]);

    return (
        <div
            className={classNames('dc-vertical-tab', {
                'dc-vertical-tab--floating': is_floating, // This is currently only configured for use in PageOverlay
                'dc-vertical-tab--full-screen': is_full_width,
            })}
        >
            {is_sidebar_enabled && (
                <div
                    className={classNames('dc-vertical-tab__tab-meta-wrapper', {
                        'dc-vertical-tab__tab-meta-wrapper--floating': is_floating,
                    })}
                >
                    <VerticalTabHeaders
                        items={list}
                        onChange={changeSelected}
                        selected={selected}
                        is_floating={is_floating}
                        is_routed={is_routed}
                    />
                </div>
            )}
            <VerticalTabContentContainer
                is_floating={is_floating}
                items={list}
                selected={selected}
                is_routed={is_routed}
            />
        </div>
    );
};

export default VerticalTab;
