import clsx from 'clsx';

import { Text, Tooltip } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import useAvailableContracts from 'AppV2/Hooks/useAvailableContracts';
import { getCategoryLabel, groupTradeTypesByCategory, TAvailableContract } from 'AppV2/Utils/trade-types-utils';

import FireIcon from '../FireIcon';
import Guide from '../Guide';

type TMarketSelectionSidebar = {
    selected_trade_type_id: string;
    is_favourites_selected: boolean;
    favourites_count: number;
    onSelectTradeType: (contract: TAvailableContract) => void;
    onSelectFavourites: () => void;
    /** When set (e.g. in Automate), restrict the sidebar to these trade-type values. */
    supported_trade_types?: Set<string>;
    /** Off for touch: quill only closes the tooltip on mouseleave, which a tap never sends. */
    with_tooltips?: boolean;
};

// Directional first (Rise/Fall …), then Growth based, then Digit based — matches the desktop design.
const CATEGORY_ORDER = ['directional', 'growth_based', 'digit_based'];

/**
 * Trade-types sidebar (left column of the desktop panel and the landscape shell): the trade types
 * grouped by category (Directional / Growth based / Digit based) with a Favourite entry pinned at the
 * bottom. Selecting a trade type scopes the market list on the right; Favourite shows the favourites
 * view. The header carries the Guide trigger, mirroring the mobile header.
 */
const MarketSelectionSidebar = ({
    selected_trade_type_id,
    is_favourites_selected,
    favourites_count,
    onSelectTradeType,
    onSelectFavourites,
    supported_trade_types,
    with_tooltips = true,
}: TMarketSelectionSidebar) => {
    const all_contracts = useAvailableContracts();
    // An empty set means "not loaded yet" (e.g. automation strategies still fetching) — show all
    // rather than nothing until the supported set arrives.
    const contracts = supported_trade_types?.size
        ? all_contracts.filter(contract => contract.for.some(type => supported_trade_types.has(type)))
        : all_contracts;
    const grouped_contracts = groupTradeTypesByCategory(contracts);

    return (
        <div className='market-selection-sidebar'>
            <div className='market-selection-sidebar__header'>
                <Text bold size='xl' className='market-selection-sidebar__header-label'>
                    <Localize i18n_default_text='Trade types' />
                </Text>
                <Guide
                    show_guide_for_selected_contract
                    show_all_trade_types_in_guide
                    force_compact_trigger
                    guide_contract_type={selected_trade_type_id}
                    guide_contract_types={contracts}
                />
            </div>
            <div className='market-selection-sidebar__groups'>
                {CATEGORY_ORDER.map(category => {
                    const contracts = grouped_contracts[category];
                    if (!contracts || contracts.length === 0) return null;

                    return (
                        <div key={category} className='market-selection-sidebar__group'>
                            <Text bold size='sm' className='market-selection-sidebar__group-label'>
                                {getCategoryLabel(category)}
                            </Text>
                            {contracts.map(contract => {
                                const is_selected = !is_favourites_selected && contract.id === selected_trade_type_id;
                                const item_props = {
                                    type: 'button' as const,
                                    className: clsx('market-selection-sidebar__item', {
                                        'market-selection-sidebar__item--selected': is_selected,
                                    }),
                                    'aria-pressed': is_selected,
                                    onClick: () => onSelectTradeType(contract),
                                };
                                const item_content = (
                                    <>
                                        <Text
                                            size='md'
                                            bold={is_selected}
                                            className='market-selection-sidebar__item-label'
                                        >
                                            {contract.tradeType}
                                        </Text>
                                        {contract.badge && (
                                            <span className='market-selection-sidebar__badge'>{contract.badge}</span>
                                        )}
                                        {contract.show_fire_icon && <FireIcon />}
                                    </>
                                );

                                return with_tooltips ? (
                                    <Tooltip
                                        key={contract.id}
                                        as='button'
                                        tooltipContent={contract.tooltip as JSX.Element}
                                        tooltipPosition='right'
                                        {...item_props}
                                    >
                                        {item_content}
                                    </Tooltip>
                                ) : (
                                    <button key={contract.id} {...item_props}>
                                        {item_content}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            <button
                type='button'
                className={clsx('market-selection-sidebar__item', 'market-selection-sidebar__favourite', {
                    'market-selection-sidebar__item--selected': is_favourites_selected,
                })}
                aria-pressed={is_favourites_selected}
                onClick={onSelectFavourites}
            >
                <Text size='md' bold={is_favourites_selected}>
                    <Localize i18n_default_text='Favourite ({{count}})' values={{ count: favourites_count }} />
                </Text>
            </button>
        </div>
    );
};

export default MarketSelectionSidebar;
