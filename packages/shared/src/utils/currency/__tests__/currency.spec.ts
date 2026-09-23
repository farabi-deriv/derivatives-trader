import * as CurrencyUtils from '../currency';
import { TCurrenciesConfig } from '../currency';

const currencies_config: TCurrenciesConfig = {
    AUD: { fractional_digits: 2, type: 'fiat' },
    EUR: { fractional_digits: 2, type: 'fiat' },
    GBP: { fractional_digits: 2, type: 'fiat' },
    USD: { fractional_digits: 2, type: 'fiat', transfer_between_accounts: { limits: { max: 2500, min: 1.0 } } },
    BTC: { fractional_digits: 8, type: 'crypto' },
};

// Mock getCurrencies at module level
jest.spyOn(CurrencyUtils, 'getCurrencies').mockImplementation(() => currencies_config);

describe('CurrencyUtils', () => {
    describe('.formatMoney()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.formatMoney('USD', '123.55')).toBe(`${CurrencyUtils.formatCurrency('USD')}123.55`);
            expect(CurrencyUtils.formatMoney('GBP', '123.55')).toBe(`${CurrencyUtils.formatCurrency('GBP')}123.55`);
            expect(CurrencyUtils.formatMoney('EUR', '123.55')).toBe(`${CurrencyUtils.formatCurrency('EUR')}123.55`);
            expect(CurrencyUtils.formatMoney('AUD', '123.55')).toBe(`${CurrencyUtils.formatCurrency('AUD')}123.55`);
            expect(CurrencyUtils.formatMoney('BTC', '0.005432110')).toBe(
                `${CurrencyUtils.formatCurrency('BTC')}0.00543211`
            );
            expect(CurrencyUtils.formatMoney('BTC', '0.005432116')).toBe(
                `${CurrencyUtils.formatCurrency('BTC')}0.00543212`
            );
            expect(CurrencyUtils.formatMoney('BTC', '0.00000001')).toBe(
                `${CurrencyUtils.formatCurrency('BTC')}0.00000001`
            );
            // don't remove trailing zeroes for now
            expect(CurrencyUtils.formatMoney('BTC', '0.00010000')).toBe(
                `${CurrencyUtils.formatCurrency('BTC')}0.00010000`
            );
        });

        it('works with negative values', () => {
            expect(CurrencyUtils.formatMoney('USD', '-123.55')).toBe(`-${CurrencyUtils.formatCurrency('USD')}123.55`);
        });

        it('works when exclude currency', () => {
            expect(CurrencyUtils.formatMoney('USD', '123.55', true)).toBe('123.55');
        });
    });

    describe('.formatCurrency()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.formatCurrency('USD')).toBe('<span class="symbols usd"></span>');
        });
    });

    describe('.addComma()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.addComma('123')).toBe('123');
            expect(CurrencyUtils.addComma('1234567')).toBe('1,234,567');
        });

        it('works with decimal places', () => {
            expect(CurrencyUtils.addComma('1234.5678')).toBe('1,234.5678');
            expect(CurrencyUtils.addComma('1234.5678', 2)).toBe('1,234.57');
            expect(CurrencyUtils.addComma('1234', 2)).toBe('1,234.00');
            expect(CurrencyUtils.addComma('1234.45', 0)).toBe('1,234');
            expect(CurrencyUtils.addComma('1234.56', 0)).toBe('1,235');
        });

        it('works with negative numbers', () => {
            expect(CurrencyUtils.addComma('-1234')).toBe('-1,234');
        });

        it('handles null values', () => {
            expect(CurrencyUtils.addComma()).toBe('0');
            expect(CurrencyUtils.addComma(null)).toBe('0');
            expect(CurrencyUtils.addComma(undefined)).toBe('0');
            expect(CurrencyUtils.addComma('')).toBe('0');
        });
    });

    describe('.getDecimalPlaces()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.getDecimalPlaces('AUD')).toBe(2);
            expect(CurrencyUtils.getDecimalPlaces('EUR')).toBe(2);
            expect(CurrencyUtils.getDecimalPlaces('GBP')).toBe(2);
            expect(CurrencyUtils.getDecimalPlaces('USD')).toBe(2);
            expect(CurrencyUtils.getDecimalPlaces('BTC')).toBe(8);
        });

        it('works with dummy currencies', () => {
            expect(CurrencyUtils.getDecimalPlaces('ZZZ')).toBe(2);
        });

        it('works with undefined', () => {
            expect(CurrencyUtils.getDecimalPlaces()).toBe(2);
        });
    });

    describe('.getCurrencies()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.getCurrencies()).toEqual(currencies_config);
        });
    });

    describe('.isCryptocurrency()', () => {
        it('works as expected', () => {
            expect(CurrencyUtils.isCryptocurrency('AUD')).toBe(false);
            expect(CurrencyUtils.isCryptocurrency('EUR')).toBe(false);
            expect(CurrencyUtils.isCryptocurrency('GBP')).toBe(false);
            expect(CurrencyUtils.isCryptocurrency('USD')).toBe(false);
            expect(CurrencyUtils.isCryptocurrency('BTC')).toBe(true);
        });

        it('works with undefined currencies', () => {
            expect(CurrencyUtils.isCryptocurrency('ZZZ')).toBe(false);
        });
    });

    /**
     * DCR-055 stripped the cashier-era `min_withdrawal` / `pa_min_withdrawal` / `pa_max_withdrawal`
     * fields from every CryptoConfig entry. The file stays live, so what it still has to resolve is
     * pinned here by value — display code, name and decimal places for every currency — rather than
     * by self-consistency, which would follow a wrong edit.
     */
    describe('[DCR-055] the crypto currency config still resolves every display value', () => {
        // [display_code, name, fractional_digits] as the config resolved them before the removal.
        const expected_config: Record<string, [string, string, number]> = {
            BTC: ['BTC', 'Bitcoin', 8],
            BUSD: ['BUSD', 'Binance USD', 2],
            DAI: ['DAI', 'Multi-Collateral DAI', 2],
            EURS: ['EURS', 'STATIS Euro', 2],
            IDK: ['IDK', 'IDK', 0],
            PAX: ['PAX', 'Paxos Standard', 2],
            TUSD: ['TUSD', 'True USD', 2],
            USDC: ['USDC', 'USD Coin', 2],
            USDK: ['USDK', 'USDK', 2],
            eUSDT: ['eUSDT', 'Tether ERC20', 2],
            tUSDT: ['tUSDT', 'Tether TRC20', 2],
            BCH: ['BCH', 'Bitcoin Cash', 8],
            ETH: ['ETH', 'Ether', 8],
            ETC: ['ETC', 'Ether Classic', 8],
            LTC: ['LTC', 'Litecoin', 8],
            UST: ['USDT', 'Tether Omni', 2],
            XRP: ['XRP', 'Ripple', 6],
        };

        it('[DCR-055] covers every currency the config declares, and no other', () => {
            expect(Object.keys(CurrencyUtils.CryptoConfig.get()).sort()).toEqual(Object.keys(expected_config).sort());
        });

        it.each(Object.entries(expected_config))(
            '[DCR-055] %s keeps its display code, name and decimal places',
            (currency: string, [display_code, name, fractional_digits]: [string, string, number]) => {
                const entry = CurrencyUtils.CryptoConfig.get()[currency];

                expect(entry.display_code).toBe(display_code);
                expect(entry.name).toBe(name);
                expect(entry.fractional_digits).toBe(fractional_digits);

                // The public readers of those three fields must resolve the same values.
                expect(CurrencyUtils.getCurrencyDisplayCode(currency)).toBe(display_code);
                expect(CurrencyUtils.getDecimalPlaces(currency)).toBe(fractional_digits);
                expect(CurrencyUtils.calcDecimalPlaces(currency)).toBe(fractional_digits);
                expect(CurrencyUtils.isCryptocurrency(currency)).toBe(true);
            }
        );

        it('[DCR-055] still upper-cases a lower-case code, except the two Tether variants', () => {
            expect(CurrencyUtils.getCurrencyDisplayCode('btc')).toBe('BTC');
            expect(CurrencyUtils.getCurrencyDisplayCode('ust')).toBe('USDT');
            expect(CurrencyUtils.getCurrencyDisplayCode('eUSDT')).toBe('eUSDT');
            expect(CurrencyUtils.getCurrencyDisplayCode('tUSDT')).toBe('tUSDT');
            // An unknown code is echoed back rather than resolved.
            expect(CurrencyUtils.getCurrencyDisplayCode('ZZZ')).toBe('ZZZ');
        });

        it('[DCR-055] still formats crypto amounts to the configured precision', () => {
            expect(CurrencyUtils.formatMoney('BTC', '0.005432116', true)).toBe('0.00543212');
            expect(CurrencyUtils.formatMoney('XRP', '1.1234567', true)).toBe('1.123457');
            expect(CurrencyUtils.formatMoney('IDK', '1234.5', true)).toBe('1,235');
        });
    });
});
