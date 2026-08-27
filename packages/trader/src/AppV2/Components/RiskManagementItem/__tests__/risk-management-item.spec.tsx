import React from 'react';

import { CONTRACT_TYPES } from '@deriv/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import useContractDetails from 'AppV2/Hooks/useContractDetails';

import RiskManagementItem from '../risk-management-item';

jest.mock('@deriv-com/translations', () => ({
    Localize: ({ i18n_default_text }: { i18n_default_text: string }) => <span>{i18n_default_text}</span>,
    localize: (text: string) => text,
    useTranslations: () => ({
        localize: (text: string) => text,
    }),
}));

jest.mock('@deriv-com/quill-ui', () => ({
    ActionSheet: {
        Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Header: ({
            closeAction,
            saveAction,
            isSaveActionDisabled,
        }: {
            closeAction?: { ariaLabel: string };
            saveAction?: { ariaLabel: string; onAction: () => void };
            isSaveActionDisabled?: boolean;
        }) => (
            <div>
                Action Sheet Title
                {closeAction && <button aria-label={closeAction.ariaLabel}>{closeAction.ariaLabel}</button>}
                {saveAction && (
                    <button
                        aria-label={saveAction.ariaLabel}
                        disabled={isSaveActionDisabled}
                        onClick={saveAction.onAction}
                    >
                        {saveAction.ariaLabel}
                    </button>
                )}
            </div>
        ),
        Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
    Text: ({ children, color }: { children: React.ReactNode; color?: string }) => (
        <span className={color}>{children}</span>
    ),
    ToggleSwitch: ({
        checked,
        onChange,
        disabled,
    }: {
        checked: boolean;
        onChange: (value: boolean) => void;
        disabled?: boolean;
    }) => <input type='checkbox' checked={checked} onChange={() => onChange(!checked)} disabled={disabled} />,
    // After the stepper swap both the read-only display field and the editable amount field render as
    // a plain TextField, so a single stub covers both call shapes (display: onClick/onFocus/disabled;
    // editable: onChange/value/message/status/placeholder).
    TextField: ({
        value,
        onClick,
        onFocus,
        onChange,
        disabled,
        placeholder,
        message,
        status,
    }: {
        value: string | number;
        onClick?: () => void;
        onFocus?: () => void;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        disabled?: boolean;
        placeholder?: string;
        message?: React.ReactNode;
        status?: string;
    }) => (
        <div>
            <input
                type='text'
                value={value}
                onClick={onClick}
                onFocus={onFocus}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
            />
            {message && <span>{message}</span>}
            {status === 'error' && <span>Error</span>}
        </div>
    ),
}));

jest.mock('AppV2/Hooks/useContractDetails', () => jest.fn());

jest.mock('../../RiskManagementInfoModal', () => ({
    __esModule: true,
    default: jest.fn(({ body_content, info_message }) => (
        <div>
            <span>{body_content}</span>
            <span>{info_message}</span>
        </div>
    )),
}));

describe('RiskManagementItem component', () => {
    const mockUseContractDetails = useContractDetails as jest.MockedFunction<typeof useContractDetails>;

    beforeEach(() => {
        mockUseContractDetails.mockReturnValue({
            contract_info: {
                contract_type: CONTRACT_TYPES.MULTIPLIER.UP,
                currency: 'USD',
                contract_id: 1,
                is_valid_to_cancel: 1,
                validation_params: {
                    stop_loss: { min: '1', max: '100' },
                    take_profit: { min: '1', max: '100' },
                },
            },
            contract: {
                contract_info: {
                    contract_id: 1,
                    validation_params: {
                        stop_loss: { min: '1', max: '100' },
                        take_profit: { min: '1', max: '100' },
                    },
                },
                contract_update_history: [],
                contract_update_take_profit: 100,
                contract_update_stop_loss: 10,
                validation_errors: {
                    contract_update_stop_loss: [],
                    contract_update_take_profit: [],
                },
                updateLimitOrder: jest.fn(),
                clearContractUpdateConfigValues: jest.fn(),
                onChange: jest.fn(),
                digits_info: {},
                display_status: '',
                has_contract_update_take_profit: false,
                has_contract_update_stop_loss: false,
                is_digit_contract: false,
                is_ended: false,
            },
            is_loading: false,
        });
    });

    const renderComponent = (props = {}) =>
        render(<RiskManagementItem label='Test Label' modal_body_content={<p>Modal content</p>} {...props} />);

    /** The mocked contract is a multiplier, so its total profit/loss is `bid_price - buy_price`. */
    const mockProfit = ({ bid_price, buy_price }: { bid_price?: string; buy_price?: string }) => {
        const details = mockUseContractDetails();
        mockUseContractDetails.mockReturnValue({
            ...details,
            contract_info: { ...details.contract_info, bid_price, buy_price },
        });
    };

    it('renders the label', () => {
        renderComponent();
        expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('renders the modal content', async () => {
        renderComponent();
        await userEvent.click(screen.getByText('Test Label'));
        expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('opens action sheet with a header save action when toggle is enabled', async () => {
        renderComponent({ value: 10 });
        await userEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('displays correct value in text field', async () => {
        renderComponent({ value: 10 });
        const textField = screen.getByRole('textbox');
        await userEvent.click(textField);
        expect(textField).toHaveValue('10.00 USD');
    });

    it('disables the header save action on open (nothing changed yet)', async () => {
        renderComponent({ value: 10 });
        await userEvent.click(screen.getByRole('textbox'));
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('enables the header save action once the amount changes', async () => {
        renderComponent({ value: 10 });
        await userEvent.click(screen.getByRole('textbox'));
        fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '50' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('commits the change when the header save action is tapped', async () => {
        renderComponent({ value: 10 });
        await userEvent.click(screen.getByRole('textbox'));
        fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '50' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(mockUseContractDetails().contract.updateLimitOrder).toHaveBeenCalled();
    });

    it('does not commit when the sheet is dismissed via the close action', async () => {
        renderComponent({ value: 10 });
        await userEvent.click(screen.getByRole('textbox'));
        fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '50' } });
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockUseContractDetails().contract.updateLimitOrder).not.toHaveBeenCalled();
    });

    describe('Total profit/loss row in the editor sheet', () => {
        const sheet_props = { value: 10, type: 'take_profit' as const };
        const element = (
            <RiskManagementItem label='Test Label' modal_body_content={<p>Modal content</p>} {...sheet_props} />
        );

        it('shows the row when the total profit/loss is exactly zero', () => {
            mockProfit({ bid_price: '10', buy_price: '10' });
            renderComponent(sheet_props);

            expect(screen.getByTestId('dt_total_profit_loss')).toHaveTextContent('0.00');
        });

        it('keeps the row mounted as the live profit/loss ticks through zero', () => {
            // Zero is one tick on the way from profit to loss. Hiding the row on that tick removed a
            // row from the sheet and put it straight back, which read as a flicker on mobile.
            mockProfit({ bid_price: '15', buy_price: '10' });
            const { rerender } = renderComponent(sheet_props);
            expect(screen.getByTestId('dt_total_profit_loss')).toBeInTheDocument();

            ['10', '5'].forEach(bid_price => {
                mockProfit({ bid_price, buy_price: '10' });
                rerender(element);
                expect(screen.getByTestId('dt_total_profit_loss')).toBeInTheDocument();
            });
        });

        it('omits the row while no profit/loss figure is available', () => {
            // No bid price yet, so the multiplier profit computes to NaN rather than to a real zero.
            renderComponent(sheet_props);

            expect(screen.queryByTestId('dt_total_profit_loss')).not.toBeInTheDocument();
        });
    });
});
