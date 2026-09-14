import React from 'react';
import classNames from 'classnames';
import VerticalTabWrapper from './vertical-tab-wrapper';
import VerticalTabHeader, { TItem } from './vertical-tab-header';

type TVerticalTabHeaders = {
    is_floating?: boolean;
    is_routed?: boolean;
    items: TItem[];
    onChange: (item: TItem) => void;
    selected: TItem;
    selectedKey?: string;
};

const offsetTop = (
    is_floating: boolean | undefined,
    ref: React.RefObject<HTMLDivElement>,
    selected: Partial<TItem>
) => {
    let calculated_offset = 0;
    let item_offset = 0;
    let selected_el: HTMLDivElement | undefined;
    const headers = ref?.current?.querySelectorAll<HTMLDivElement>('.dc-vertical-tab__header__link');

    if (headers) {
        selected_el = [...headers].find(header =>
            selected.getTitle ? header.innerText === selected.getTitle() : header.innerText === selected.label
        );
    }

    if (selected_el) {
        item_offset = is_floating ? 18 : 10;
        calculated_offset = selected_el.offsetTop && selected_el.offsetTop - item_offset;
    }

    return calculated_offset;
};

const VerticalTabHeaders = ({
    is_floating,
    is_routed,
    items,
    onChange,
    selected,
    selectedKey = 'label',
}: TVerticalTabHeaders) => {
    const ref = React.useRef(null);
    const [top, setTop] = React.useState(0);

    React.useEffect(() => {
        const selected_item = items.find(
            item => item[selectedKey as keyof TItem] === selected[selectedKey as keyof TItem]
        );
        if (selected_item?.label) setTop(offsetTop(is_floating, ref, { label: selected_item.label }));
    }, [selected, is_floating, selectedKey, items]);
    return (
        <VerticalTabWrapper
            wrapper_ref={ref}
            className={classNames({
                'dc-vertical-tab__tab--floating': is_floating,
            })}
        >
            {items.map((item, idx) => (
                <VerticalTabHeader
                    item={item}
                    onChange={onChange}
                    is_floating={is_floating}
                    is_routed={is_routed}
                    selected={selected}
                    key={idx}
                    selectedKey={selectedKey}
                />
            ))}
            <span
                style={{ transition: 'transform 0.25s ease', transform: `translate3d(0, ${top}px, 0)` }}
                className='dc-vertical-tab__header--highlight'
            />
        </VerticalTabWrapper>
    );
};

export default VerticalTabHeaders;
