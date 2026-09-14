import classNames from 'classnames';
import React from 'react';
import Counter from '../counter';

type TTabProps = {
    active_tab_ref?: React.RefObject<HTMLLIElement> | null;
    className?: string;
    count: number;
    header_content: React.ReactElement;
    icon: React.ReactElement;
    id?: string;
    is_active: boolean;
    label: string;
    onClick: React.MouseEventHandler<HTMLLIElement>;
    setActiveLineStyle: () => void;
    top: boolean;
};

const Tab = ({
    active_tab_ref,
    className = '',
    count,
    header_content,
    icon,
    id = '',
    is_active,
    label,
    onClick,
    setActiveLineStyle,
    top,
}: TTabProps) => {
    React.useEffect(() => {
        setActiveLineStyle();
    }, [count, label, header_content, setActiveLineStyle]);

    const classes = classNames('dc-tabs__item', {
        'dc-tabs__active': is_active,
        [`dc-tabs__active--${className}`]: className && is_active,
        'dc-tabs__item--top': top,
        [`dc-tabs__item--${className}`]: className,
    });
    return (
        <li id={id} className={classes} onClick={onClick} ref={active_tab_ref}>
            {icon &&
                React.cloneElement(icon, {
                    className: 'dc-tabs__item__icon',
                })}
            {header_content || label}
            {!!count && <Counter className='dc-tabs__item__counter' count={count} />}
        </li>
    );
};

export default Tab;
