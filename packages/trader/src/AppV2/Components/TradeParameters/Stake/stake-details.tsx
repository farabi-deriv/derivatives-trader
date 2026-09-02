import React from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';

import { clickAndKeyEventHandler, formatMoney, getTradeTypeName, TRADE_TYPES } from '@deriv/shared';
import { Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';

import { getCurrencySymbol } from 'AppV2/Utils/currency-utils';
import { useTraderStore } from 'Stores/useTraderStores';
import { TTradeStore } from 'Types';

type TStakeDetailsProps = Pick<TTradeStore, 'contract_type' | 'currency' | 'is_multiplier'> & {
    contract_types: string[];
    details: {
        error_1?: string;
        error_2?: string;
        first_contract_payout: number;
        is_first_payout_exceeded?: boolean;
        is_second_payout_exceeded?: boolean;
        max_payout: string | number;
        max_stake: string | number;
        min_stake: string | number;
        second_contract_payout: number;
        stop_out?: number | string;
    };
    is_loading_proposal: boolean;
    is_empty?: boolean;
    should_show_payout_details: boolean;
    /** Mobile only: open the Stop out / Stop out level explanation as a page within the stake sheet.
     * When omitted (desktop), both are plain labels. */
    onOpenStopOut?: () => void;
    onOpenStopOutLevel?: () => void;
};

const StakeDetails = observer(
    ({
        contract_type,
        contract_types,
        currency,
        details,
        is_loading_proposal,
        is_multiplier,
        is_empty,
        should_show_payout_details,
        onOpenStopOut,
        onOpenStopOutLevel,
    }: TStakeDetailsProps) => {
        // Stop out level is read live from the store rather than from `details`: the popover's own
        // proposal is a one-shot request, so anything derived from it is a snapshot taken when the
        // popover opened. The store's copy comes from the trade page's proposal subscription and keeps
        // tracking the spot. It is stake-independent (a function of the multiplier and the spot), so
        // using the committed-parameter value is correct even while the stake is being edited — unlike
        // the stop out *amount*, which scales with the stake and stays on `details`.
        const { root_store, stop_out_level } = useTraderStore();
        const is_mobile = root_store?.ui?.is_mobile;
        const currency_symbol = getCurrencySymbol(currency);

        const [displayed_values, setDisplayedValues] = React.useState({
            is_first_payout_exceeded: false,
            is_second_payout_exceeded: false,
            first_contract_payout: '',
            max_payout: '',
            second_contract_payout: '',
            stop_out: '',
        });

        React.useEffect(() => {
            const getDisplayedValue = (new_value?: number | string, current_value?: string) => {
                return (current_value === '-' && is_loading_proposal) || !new_value || is_empty
                    ? '-'
                    : formatMoney(currency, Number(new_value), true);
            };

            const {
                first_contract_payout,
                is_first_payout_exceeded,
                is_second_payout_exceeded,
                second_contract_payout,
                stop_out: stop_out_value,
                max_payout,
            } = displayed_values;
            const new_payout_1 = getDisplayedValue(details.first_contract_payout, first_contract_payout);
            const new_payout_2 = getDisplayedValue(details.second_contract_payout, second_contract_payout);
            const new_stop_out = getDisplayedValue(Math.abs(Number(details.stop_out)), stop_out_value);
            const new_max_payout = getDisplayedValue(details.max_payout, max_payout);

            if (
                first_contract_payout !== new_payout_1 ||
                displayed_values.is_first_payout_exceeded !== is_first_payout_exceeded ||
                displayed_values.is_second_payout_exceeded !== is_second_payout_exceeded ||
                second_contract_payout !== new_payout_2 ||
                stop_out_value !== new_stop_out ||
                max_payout !== new_max_payout
            ) {
                setDisplayedValues({
                    first_contract_payout: new_payout_1,
                    is_first_payout_exceeded,
                    is_second_payout_exceeded,
                    second_contract_payout: new_payout_2,
                    stop_out: new_stop_out,
                    max_payout: new_max_payout,
                });
            }
        }, [currency, details, displayed_values, is_loading_proposal, is_empty]);

        const payout_title = <Localize i18n_default_text='Payout' />;
        const content = [
            {
                // Deliberately independent of Take profit / Stop loss: stop out is the platform's own
                // liquidation point (a function of the stake and the multiplier), while an SL is an
                // additional trader-chosen limit that may sit anywhere inside it. Hiding the harder of
                // the two limits once an SL exists was issue #1305 — mobile has no other surface for it.
                is_displayed: is_multiplier && !should_show_payout_details,
                is_stop_out: true,
                label: <Localize i18n_default_text='Stop out' />,
                value: displayed_values.stop_out,
            },
            {
                is_displayed: is_multiplier && !should_show_payout_details,
                is_stop_out_level: true,
                // A price, not an amount — rendered without a currency code.
                has_no_currency: true,
                label: <Localize i18n_default_text='Stop out level' />,
                value: is_empty ? '-' : (stop_out_level ?? '-'),
            },
            {
                is_displayed: !!details.max_payout && should_show_payout_details,
                label: <Localize i18n_default_text='Max payout' />,
                value: formatMoney(currency, +details.max_payout, true), // symbol added at render
            },
            {
                contract_type: getTradeTypeName(contract_types[0], {
                    isHighLow: contract_type === TRADE_TYPES.HIGH_LOW,
                }),
                is_displayed: !!contract_types.length && should_show_payout_details,
                label: payout_title,
                has_error: details.is_first_payout_exceeded,
                value: displayed_values.first_contract_payout,
            },
            {
                contract_type: getTradeTypeName(contract_types[1], {
                    isHighLow: contract_type === TRADE_TYPES.HIGH_LOW,
                }),
                is_displayed: contract_types.length > 1 && should_show_payout_details,
                label: payout_title,
                has_error: details.is_second_payout_exceeded,
                value: displayed_values.second_contract_payout,
            },
        ];

        // A tappable label that opens its explanation as a page within the stake sheet (mobile).
        const renderClickableLabel = (label: React.ReactNode, onOpen: () => void) => (
            <Text
                size='sm'
                className='stake-content__info-label'
                role='button'
                tabIndex={0}
                onClick={(e: React.MouseEvent<HTMLElement>) => clickAndKeyEventHandler(onOpen, e)}
                onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => clickAndKeyEventHandler(onOpen, e)}
            >
                {label}
            </Text>
        );

        // Stop out and Stop out level open their explanation as a page within the stake sheet on mobile;
        // on desktop they are plain labels.
        const renderLabel = ({
            contract_type: row_contract_type,
            is_stop_out,
            is_stop_out_level,
            label,
        }: (typeof content)[number]) => {
            if (is_stop_out && onOpenStopOut) return renderClickableLabel(label, onOpenStopOut);
            if (is_stop_out_level && onOpenStopOutLevel) return renderClickableLabel(label, onOpenStopOutLevel);
            return (
                <Text size='sm'>
                    {label}
                    {is_mobile && row_contract_type && ` (${row_contract_type})`}
                </Text>
            );
        };

        return (
            <div className='stake-content__details'>
                {content.map(
                    (row, idx) =>
                        row.is_displayed && (
                            <div
                                key={`${idx}_${row.value}`}
                                className={clsx('stake-content__details-row', row.has_error && 'error')}
                            >
                                {renderLabel(row)}
                                <Text size='sm'>
                                    {row.has_no_currency || row.value === '-'
                                        ? row.value
                                        : `${currency_symbol}${row.value}`}
                                </Text>
                            </div>
                        )
                )}
            </div>
        );
    }
);

export default StakeDetails;
