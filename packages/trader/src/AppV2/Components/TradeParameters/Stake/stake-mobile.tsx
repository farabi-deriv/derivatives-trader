import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { LabelPairedArrowLeftMdRegularIcon } from '@deriv/quill-icons';
import { CONTRACT_TYPES } from '@deriv/shared';
import { ActionSheet, TextField } from '@deriv-com/quill-ui';
import { Localize, useTranslations } from '@deriv-com/translations';

import Carousel from 'AppV2/Components/Carousel';
import CarouselHeader from 'AppV2/Components/Carousel/carousel-header';
import TradeParamDefinition from 'AppV2/Components/TradeParamDefinition';
import { getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { AutomationStoreContext } from 'Stores/useAutomationStore';
import { useTraderStore } from 'Stores/useTraderStores';

import { AutomationLockOverlay } from '../Shared';
import { TTradeParametersProps } from '../trade-parameters';

import StakeInput from './stake-input';

// Page order within the stake sheet carousel.
const STAKE_PAGE = 0;
const STOP_OUT_PAGE = 1;
const STOP_OUT_LEVEL_PAGE = 2;

type TStakeHeaderActions = {
    onSave: () => void;
    is_save_disabled: boolean;
    close_aria_label: string;
    save_aria_label: string;
};

// Carousel header for the stake sheet: a back arrow on the config pages (stop out / stop out level),
// and the value-editor header actions (X / check) on the stake input page (page 0). The inner config
// pages keep back-arrow navigation only; the check/X live on page 0 exclusively.
const StakeSheetHeader = ({
    current_index,
    onPrevClick,
    title,
    header_actions,
}: React.ComponentProps<typeof CarouselHeader> & { header_actions?: TStakeHeaderActions }) => {
    if (current_index) {
        return (
            <ActionSheet.Header
                title={title}
                icon={<LabelPairedArrowLeftMdRegularIcon onClick={onPrevClick} />}
                iconPosition='left'
            />
        );
    }
    return (
        <ActionSheet.Header
            title={title}
            closeAction={{ ariaLabel: header_actions?.close_aria_label }}
            saveAction={{ onAction: header_actions?.onSave, ariaLabel: header_actions?.save_aria_label }}
            isSaveActionDisabled={header_actions?.is_save_disabled}
            shouldCloseOnSaveActionClick={false}
        />
    );
};

const Stake = observer(({ is_minimized, is_automation }: TTradeParametersProps) => {
    const {
        amount,
        currency,
        has_open_accu_contract,
        is_automation_params_locked,
        is_market_closed,
        is_multiplier,
        proposal_info,
        is_automation_tab,
    } = useTraderStore();
    const automation_store = React.useContext(AutomationStoreContext);
    const { localize } = useTranslations();

    const [is_open, setIsOpen] = React.useState(false);
    const [carousel_index, setCarouselIndex] = React.useState(STAKE_PAGE);

    // `StakeInput` owns the draft/validation state, so it publishes its commit handler and gate here
    // (page 0's header check). The handler lives in a ref (a new identity every render) so it never
    // re-triggers a render; only the disabled flag is state, and React bails out on an unchanged value.
    const save_handler_ref = React.useRef<() => void>(() => undefined);
    const [is_save_disabled, setIsSaveDisabled] = React.useState(true);
    const registerHeaderActions = React.useCallback(
        ({ onSave, is_save_disabled: disabled }: { onSave: () => void; is_save_disabled: boolean }) => {
            save_handler_ref.current = onSave;
            setIsSaveDisabled(disabled);
        },
        []
    );

    const onClose = React.useCallback(() => {
        setCarouselIndex(STAKE_PAGE);
        setIsOpen(false);
    }, []);

    // The Stop out / Stop out level explanation pages shown within the stake sheet (multipliers only).
    // Stop out is derived as a % of the stake (both from the same proposal) so it reflects the real
    // level (e.g. 90% for CRASH1000) — mirrors MultipliersInformation.
    const stop_out_amount =
        proposal_info?.[CONTRACT_TYPES.MULTIPLIER.UP]?.limit_order?.stop_out?.order_amount ??
        proposal_info?.[CONTRACT_TYPES.MULTIPLIER.DOWN]?.limit_order?.stop_out?.order_amount;
    const stake_amount = Number(
        proposal_info?.[CONTRACT_TYPES.MULTIPLIER.UP]?.stake ?? proposal_info?.[CONTRACT_TYPES.MULTIPLIER.DOWN]?.stake
    );
    const stop_out_percentage =
        stop_out_amount != null && stake_amount > 0
            ? Math.round((Math.abs(stop_out_amount) / stake_amount) * 100)
            : undefined;
    const stop_out_description =
        stop_out_percentage != null ? (
            <Localize
                i18n_default_text='Your contract will be closed automatically when your loss reaches {{stop_out_percentage}}% of your stake.'
                values={{ stop_out_percentage }}
            />
        ) : (
            <Localize i18n_default_text='Your contract will be closed automatically when your loss reaches a certain percentage of your stake.' />
        );
    const stop_out_level_description = (
        <Localize i18n_default_text='The price at which your position closes automatically, capping your loss at your stake.' />
    );
    const getSheetTitle = () => {
        if (carousel_index === STOP_OUT_PAGE) return <Localize i18n_default_text='Stop out' />;
        if (carousel_index === STOP_OUT_LEVEL_PAGE) return <Localize i18n_default_text='Stop out level' />;
        return <Localize i18n_default_text='Stake' />;
    };

    const pages = [
        {
            id: STAKE_PAGE,
            component: (
                <StakeInput
                    onClose={onClose}
                    is_open={is_open}
                    onOpenStopOut={() => setCarouselIndex(STOP_OUT_PAGE)}
                    onOpenStopOutLevel={() => setCarouselIndex(STOP_OUT_LEVEL_PAGE)}
                    registerHeaderActions={registerHeaderActions}
                />
            ),
        },
    ];
    if (is_multiplier) {
        pages.push(
            { id: STOP_OUT_PAGE, component: <TradeParamDefinition description={stop_out_description} /> },
            { id: STOP_OUT_LEVEL_PAGE, component: <TradeParamDefinition description={stop_out_level_description} /> }
        );
    }

    // Inject the page-0 header actions into the carousel header (Carousel only forwards its own props).
    // `save_handler_ref` is read at click time, so only the disabled flag / localize drive the identity.
    const header = React.useCallback(
        (props: React.ComponentProps<typeof StakeSheetHeader>) => (
            <StakeSheetHeader
                {...props}
                header_actions={{
                    onSave: () => save_handler_ref.current(),
                    is_save_disabled,
                    close_aria_label: localize('Close'),
                    save_aria_label: localize('Save'),
                }}
            />
        ),
        [is_save_disabled, localize]
    );

    const is_field_disabled = has_open_accu_contract || is_market_closed || is_automation_params_locked;

    // Keep initial_stake in sync with the stake field in automation context.
    // `is_automation_tab` only flips on desktop (the panel-tab switcher); the
    // mobile /automate route relies on the `is_automation` prop instead.
    React.useEffect(() => {
        if ((is_automation_tab || is_automation) && amount && automation_store) {
            automation_store.setStrategyParam('initial_stake', String(amount));
        }
    }, [amount, is_automation_tab, is_automation, automation_store]);

    return (
        <React.Fragment>
            <div className='trade-params__field-locked'>
                <TextField
                    disabled={is_field_disabled}
                    variant='fill'
                    readOnly
                    label={
                        <Localize
                            i18n_default_text={is_automation_tab ? 'Initial stake' : 'Stake'}
                            key={`stake${is_minimized ? '-minimized' : ''}`}
                        />
                    }
                    noStatusIcon
                    onClick={() => setIsOpen(true)}
                    value={`${getCurrencySymbol(currency)}${amount}`}
                    className={clsx('trade-params__option', is_minimized && 'trade-params__option--minimized')}
                    status='neutral'
                />
                {is_automation_params_locked && <AutomationLockOverlay />}
            </div>
            <ActionSheet.Root
                isOpen={is_open}
                onClose={onClose}
                position='left'
                expandable={false}
                shouldBlurOnClose={is_open}
            >
                <ActionSheet.Portal showHandlebar={false} shouldDetectSwipingOnContainer shouldCloseOnDrag>
                    <div className='stake-container'>
                        <Carousel
                            classname='stake__carousel'
                            header={header}
                            title={getSheetTitle()}
                            current_index={carousel_index}
                            setCurrentIndex={setCarouselIndex}
                            onPreviousButtonClick={() => setCarouselIndex(STAKE_PAGE)}
                            pages={pages}
                        />
                    </div>
                </ActionSheet.Portal>
            </ActionSheet.Root>
        </React.Fragment>
    );
});

export default Stake;
