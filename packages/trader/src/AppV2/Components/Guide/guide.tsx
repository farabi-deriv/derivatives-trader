import React from 'react';

import { LabelPairedChevronRightSmRegularIcon } from '@deriv/quill-icons';
import { trackAnalyticsEvent } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { Button, Text } from '@deriv-com/quill-ui';
import { Localize, localize } from '@deriv-com/translations';

import useAvailableContracts from 'AppV2/Hooks/useAvailableContracts';
import useGuideContractTypes from 'AppV2/Hooks/useGuideContractTypes';
import useIsPhoneViewport from 'AppV2/Hooks/useIsPhoneViewport';
import { AVAILABLE_CONTRACTS, TAvailableContract } from 'AppV2/Utils/trade-types-utils';
import ImageGuide from 'Assets/SvgComponents/trade_explanations/img-guide.svg';
import { useTraderStore } from 'Stores/useTraderStores';

import GuideDefinitionModal from './guide-definition-modal';
import GuideDescriptionModal from './guide-description-modal';

import './guide.scss';

type TGuide = {
    is_open_by_default?: boolean;
    show_guide_for_selected_contract?: boolean;
    show_trigger_button?: boolean;
    show_description_in_a_modal?: boolean;
    show_all_trade_types_in_guide?: boolean;
    force_compact_trigger?: boolean;
    /** Force which trade type the guide opens on (e.g. the market selector's selected type), instead
     * of deriving it from the store's current contract_type. */
    guide_contract_type?: string;
    /** Override the trade types shown as chips (e.g. the market selector's own list), instead of the
     * ones derived from the store's current symbol. */
    guide_contract_types?: TAvailableContract[];
    /** Hand the trigger press to the caller instead of opening the built-in description. */
    onTriggerClick?: () => void;
};

const Guide = observer(
    ({
        is_open_by_default,
        show_guide_for_selected_contract,
        show_trigger_button = true,
        show_description_in_a_modal = true,
        show_all_trade_types_in_guide,
        force_compact_trigger,
        guide_contract_type,
        guide_contract_types,
        onTriggerClick,
    }: TGuide) => {
        const {
            ui: { is_dark_mode_on },
            common: { current_language },
        } = useStore();
        const { contract_type } = useTraderStore();
        // Viewport, not width: at 844px landscape would widen the trigger to a link.
        const is_phone_viewport = useIsPhoneViewport();
        const show_compact_trigger = is_phone_viewport || force_compact_trigger;
        const available_contracts = useAvailableContracts();
        const contract_type_title =
            guide_contract_type ?? available_contracts.find(item => item.for.includes(contract_type))?.id ?? '';
        const { trade_types } = useGuideContractTypes();

        const filtered_contract_list =
            guide_contract_types ??
            (show_all_trade_types_in_guide
                ? available_contracts
                : available_contracts.filter(contract =>
                      trade_types.some((trade: { text?: string }) => trade.text === contract.id)
                  ));

        // Follow the single trade-type display order (AVAILABLE_CONTRACTS) so the Guide stays in sync
        // with the market-selector tabs, sidebar, and search rather than defining its own order.
        const ordered_contract_list = [...filtered_contract_list].sort(
            (a, b) =>
                AVAILABLE_CONTRACTS.findIndex(item => item.id === a.id) -
                AVAILABLE_CONTRACTS.findIndex(item => item.id === b.id)
        );

        const [is_description_opened, setIsDescriptionOpened] = React.useState(is_open_by_default);
        const [selected_contract_type, setSelectedContractType] = React.useState(contract_type_title);
        const [selected_term, setSelectedTerm] = React.useState<string>('');

        const onChipSelect = React.useCallback((id: string) => setSelectedContractType(id ?? ''), []);

        const onClose = React.useCallback(() => setIsDescriptionOpened(false), []);

        // Shared by both triggers, so the analytics stay in one place.
        const onTrigger = () => {
            trackAnalyticsEvent('ce_trade_types_form_v2', {
                action: 'info_open',
                trade_type_name: contract_type_title || contract_type,
                source: 'trade_page',
            });
            if (onTriggerClick) onTriggerClick();
            else setIsDescriptionOpened(true);
        };

        React.useEffect(() => {
            if (show_guide_for_selected_contract) setSelectedContractType(contract_type_title);
        }, [show_guide_for_selected_contract, contract_type_title]);

        React.useEffect(() => {
            setIsDescriptionOpened(is_description_opened);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [is_open_by_default]);

        return (
            <React.Fragment>
                {show_trigger_button &&
                    (show_compact_trigger ? (
                        <Button
                            color={is_dark_mode_on ? 'white' : 'black'}
                            className='trade__guide'
                            aria-label={localize('Guide')}
                            onClick={onTrigger}
                            variant='tertiary'
                            key={current_language}
                        >
                            <ImageGuide />
                        </Button>
                    ) : (
                        <div className='guide-link' onClick={onTrigger}>
                            <Text size='sm' color='quill-typography__color--prominent'>
                                <Localize
                                    i18n_default_text='How to trade {{trade_type}}?'
                                    values={{ trade_type: contract_type_title || 'this' }}
                                />
                            </Text>
                            <LabelPairedChevronRightSmRegularIcon />
                        </div>
                    ))}
                <GuideDescriptionModal
                    contract_list={ordered_contract_list}
                    is_dark_mode_on={is_dark_mode_on}
                    is_open={is_description_opened}
                    onChipSelect={(id: string) => {
                        const selected_trade_type = ordered_contract_list.find(item => item.id === id);
                        trackAnalyticsEvent('ce_trade_types_form_v2', {
                            action: 'info_switcher',
                            trade_type_name: selected_trade_type?.id ?? '',
                        });
                        onChipSelect(id);
                    }}
                    onClose={onClose}
                    onTermClick={setSelectedTerm}
                    selected_contract_type={selected_contract_type}
                    show_guide_for_selected_contract={show_guide_for_selected_contract}
                    show_description_in_a_modal={show_description_in_a_modal}
                    show_all_trade_types_in_guide={show_all_trade_types_in_guide}
                />
                {is_phone_viewport && (
                    <GuideDefinitionModal
                        contract_type={selected_contract_type}
                        term={selected_term}
                        onClose={() => setSelectedTerm('')}
                    />
                )}
            </React.Fragment>
        );
    }
);

export default Guide;
