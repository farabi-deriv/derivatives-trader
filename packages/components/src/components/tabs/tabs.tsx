import classNames from 'classnames';
import React from 'react';
import Tab from './tab';
import { useConstructor } from '../../hooks';
import ThemedScrollbars from '../themed-scrollbars/themed-scrollbars';

// TODO: Remove this declaration after changing label to data-label in Tabs component
declare module 'react' {
    interface HTMLAttributes<T> extends React.AriaAttributes, React.DOMAttributes<T> {
        label?: string;
        hash?: string;
    }
}

type TTabsProps = {
    children: (React.ReactElement | null)[];
    className?: string;
    onTabItemClick?: (active_tab_index: number) => void;
    top: boolean;
};

const Tabs = ({ children, className = '', onTabItemClick, top }: TTabsProps) => {
    const [active_line_style, updateActiveLineStyle] = React.useState({});
    const active_tab_ref = React.useRef<HTMLLIElement>(null);
    const tabs_wrapper_ref = React.useRef<HTMLUListElement>(null);

    const setActiveLineStyle = React.useCallback(() => {
        const html = document.querySelector('html');
        const is_screen_rotated = html?.classList.contains('tablet-landscape');

        const tabs_wrapper_bounds = tabs_wrapper_ref?.current?.getBoundingClientRect();
        const active_tab_bounds = active_tab_ref?.current?.getBoundingClientRect();
        if (tabs_wrapper_bounds && active_tab_bounds) {
            updateActiveLineStyle(
                is_screen_rotated
                    ? {
                          left: tabs_wrapper_bounds.bottom - active_tab_bounds.bottom,
                          width: active_tab_bounds.height,
                      }
                    : {
                          left: active_tab_bounds.left - tabs_wrapper_bounds.left,
                          width: active_tab_bounds.width,
                      }
            );
        } else {
            setTimeout(() => {
                setActiveLineStyle();
            }, 500);
        }
    }, []);

    useConstructor(() => {
        setActiveLineStyle();
    });

    const [active_tab_index, setActiveTabIndex] = React.useState(0);

    React.useEffect(() => {
        if (active_tab_index > 0) {
            onTabItemClick?.(active_tab_index);
        }
        setActiveLineStyle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab_index, setActiveLineStyle]);

    const onClickTabItem = (index: number) => {
        setActiveTabIndex(index);
        setActiveLineStyle();
    };

    const valid_children = children.filter(child => child);
    const tab_width = `${(100 / valid_children.length).toFixed(2)}%`;

    return (
        <div
            className={classNames('dc-tabs', {
                [`dc-tabs--${className}`]: className,
                'dc-tabs--top': top,
            })}
            style={{ '--tab-width': `${tab_width}` } as React.CSSProperties}
        >
            <div className={classNames({ [`dc-tabs__list--header--${className}`]: className })}>
                <ul
                    className={classNames('dc-tabs__list', 'dc-tabs__list--border-bottom', {
                        'dc-tabs__list--top': top,
                        [`dc-tabs__list--${className}`]: className,
                    })}
                    ref={tabs_wrapper_ref}
                >
                    <ThemedScrollbars className='dc-themed-scrollbars-wrapper' is_only_horizontal is_scrollbar_hidden>
                        {React.Children.map(children, (child, index) => {
                            if (!child) return null;
                            const { icon, label, id } = child.props;
                            const header_content = child.props['data-header-content'];
                            const count = child.props['data-count'];
                            return (
                                <Tab
                                    className={className}
                                    count={count}
                                    icon={icon}
                                    is_active={index === active_tab_index}
                                    key={label}
                                    label={label}
                                    id={id}
                                    top={top}
                                    active_tab_ref={index === active_tab_index ? active_tab_ref : null}
                                    header_content={header_content}
                                    onClick={() => onClickTabItem(index)}
                                    setActiveLineStyle={setActiveLineStyle}
                                />
                            );
                        })}
                        <span
                            className={classNames('dc-tabs__active-line', {
                                'dc-tabs__active-line--top': top,
                            })}
                            style={active_line_style}
                        />
                    </ThemedScrollbars>
                </ul>
            </div>
            <div
                className={classNames('dc-tabs__content', {
                    [`dc-tabs__content--${className}`]: className,
                })}
            >
                {React.Children.map(children, (child, index) => {
                    if (!child) return null;
                    if (index !== active_tab_index) {
                        return undefined;
                    }
                    return child.props.children;
                })}
            </div>
        </div>
    );
};

export default Tabs;
