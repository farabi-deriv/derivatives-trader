# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer/verify-transfer-mt5-fa-gate.spec.ts >> Transfer — MT5 deposit financial-assessment gate >> VERIFY an outstanding MT5 deposit financial assessment opens the verification checklist instead of the review sheet
- Location: playwright/tests/transfer/verify-transfer-mt5-fa-gate.spec.ts:95:9

# Error details

```
Error: Outstanding financial assessment row should carry a status badge

expect(locator).toBeVisible() failed

Locator: getByTestId('cfd-mt5-verification-modal-badge-fa')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Outstanding financial assessment row should carry a status badge with timeout 45000ms
  - waiting for getByTestId('cfd-mt5-verification-modal-badge-fa')

```

```yaml
- alert: Deriv - Online Trading Platform
- main:
      - button "Back":
            - img
      - heading "Transfer" [level=1]
      - button "From Wallet 49427.90 USD":
            - paragraph: From
            - img
            - paragraph: Wallet
            - paragraph: 49427.90 USD
            - img
      - button:
            - img
      - button "To Financial 1532.10 USD":
            - paragraph: To
            - img
            - paragraph: Financial
            - paragraph: 1532.10 USD
            - img
      - text: Amount
      - textbox "0.00": '0.1'
      - text: USD
      - button "25%"
      - button "50%"
      - button "75%"
      - button "100%"
      - text: You'll receive
      - paragraph: 0.10 USD
      - button "Transfer"
- dialog "Complete verification":
      - heading "Complete verification" [level=2]
      - paragraph: 'To continue, complete the remaining steps:'
      - list:
            - listitem:
                  - img
                  - text: Additional information
            - listitem:
                  - img
                  - text: Financial assessment
      - button "Complete verification"
```

# Test source

```ts
  2847 |         await expect(this.transferBtn, "Transfer button should be disabled when the amount exceeds the balance").toBeDisabled();
  2848 |     }
  2849 |
  2850 |     /**
  2851 |      * Verify a mapped transfer-validation message and its disabled submit state.
  2852 |      * @param expected - Exact localized English message expected for the mocked i18n key.
  2853 |      * @returns A promise that resolves when both assertions pass.
  2854 |      */
  2855 |     async verifyMappedValidateError(expected: string): Promise<void> {
  2856 |         await expect(this.amountError, `Mapped validation error should read "${expected}"`).toHaveText(expected);
  2857 |         await expect(this.transferBtn, 'Transfer button should stay disabled for a validation error').toBeDisabled();
  2858 |     }
  2859 |
  2860 |     /** @returns A promise that resolves when the rate-unavailable state is verified. */
  2861 |     async verifyRateUnavailableError(): Promise<void> {
  2862 |         // i18n key: cashier.transfer_rate_unavailable
  2863 |         await expect(
  2864 |             this.amountError,
  2865 |             'Exchange-rate failure should show the rate-unavailable amount error',
  2866 |         ).toHaveText("We can't process this transfer right now. Try again in a few minutes.");
  2867 |         await expect(this.transferBtn, 'Transfer button should stay disabled while the exchange rate is unavailable').toBeDisabled();
  2868 |         await expect(this.youllReceiveText, 'You will receive should stay hidden without an exchange rate').toBeHidden();
  2869 |     }
  2870 |
  2871 |     /** @returns A promise that resolves when the From currency is the selected default. */
  2872 |     async verifyCurrencyToggleDefaultsToFrom(): Promise<void> {
  2873 |         await expect(this.currencyFromBtn, 'Source-currency toggle should be visible for a cross-currency pair').toBeVisible();
  2874 |         await expect(this.currencyToBtn, 'Destination-currency toggle should be visible for a cross-currency pair').toBeVisible();
  2875 |         // Selection is conveyed by class, not aria-pressed, on the toggle buttons:
  2876 |         // the active side carries `text-neutral-800`; the inactive side `text-neutral-500`.
  2877 |         await expect(this.currencyFromBtn, 'Source-currency toggle should be selected by default').toHaveClass(/text-neutral-800/);
  2878 |         await expect(this.currencyToggleIndicator, 'Currency-toggle sliding indicator should be visible under the source currency').toBeVisible();
  2879 |     }
  2880 |
  2881 |     /** @returns A promise that resolves when matching display codes hide both currency toggles. */
  2882 |     async verifySameDisplayCurrencyToggleHidden(): Promise<void> {
  2883 |         await expect(this.currencyFromBtn, 'Source-currency toggle should be hidden for matching display codes').toBeHidden();
  2884 |         await expect(this.currencyToBtn, 'Destination-currency toggle should be hidden for matching display codes').toBeHidden();
  2885 |     }
  2886 |
  2887 |     /** @returns A promise that resolves when the same-display-code panel presentation is verified. */
  2888 |     async verifySameDisplayCurrencyPresentation(): Promise<void> {
  2889 |         await this.verifySameDisplayCurrencyToggleHidden();
  2890 |         await expect(this.youllReceiveText, 'You will receive should be visible for matching display codes').toBeVisible();
  2891 |         await expect(this.youllReceiveText.locator('p'), 'You will receive should contain only one amount line').toHaveCount(1);
  2892 |     }
  2893 |
  2894 |     /** @returns A promise that resolves when the same-display-code review presentation is verified. */
  2895 |     async verifySameDisplayCurrencyReview(): Promise<void> {
  2896 |         await expect(this.reviewModal, 'Review modal should be visible for the same-display-code transfer').toBeVisible();
  2897 |         await expect(this.reviewConvertedGross, 'Converted gross line should be absent for matching display codes').toBeHidden();
  2898 |         await expect(this.reviewReceivedFromEquivalent, 'Received-in-source line should be absent for matching display codes').toBeHidden();
  2899 |     }
  2900 |
  2901 |     /** @returns A promise that resolves when all KYC-required modal controls are visible. */
  2902 |     async verifyKycRequiredModal(): Promise<void> {
  2903 |         await expect(this.kycRequiredModal, 'Fiat-to-crypto KYC-required modal should be visible').toBeVisible();
  2904 |         await expect(this.kycRequiredTitle, 'KYC-required modal title should be visible').toBeVisible();
  2905 |         await expect(this.kycRequiredMessage, 'KYC-required modal message should be visible').toBeVisible();
  2906 |         await expect(this.kycRequiredVerifyBtn, 'KYC-required Verify now button should be visible').toBeVisible();
  2907 |         await expect(this.kycRequiredCancelBtn, 'KYC-required Cancel button should be visible').toBeVisible();
  2908 |     }
  2909 |
  2910 |     /** @returns A promise that resolves when rejected-UAE suitability copy is verified. */
  2911 |     async verifyRejectedUaeFeaturesPausedModal(): Promise<void> {
  2912 |         await expect(this.featuresPausedModal, 'UAE features-paused modal should be visible for rejected risk acceptance').toBeVisible();
  2913 |         // i18n key: cashier.transfer_features_paused_title
  2914 |         await expect(this.featuresPausedTitle, 'Features-paused title should be visible').toHaveText('Some features are paused');
  2915 |         // i18n key: cashier.transfer_features_paused_body_uae_rejected
  2916 |         await expect(
  2917 |             this.featuresPausedBody,
  2918 |             'Rejected UAE assessment should ask the user to retake the suitability assessment',
  2919 |         ).toHaveText('To make a transfer and start trading, retake the trading suitability assessment.');
  2920 |     }
  2921 |
  2922 |     /** @returns A promise that resolves when the incomplete-phone P2P setup state is verified. */
  2923 |     async verifyP2pSetupForIncompletePhone(): Promise<void> {
  2924 |         await expect(this.reviewModal, 'Review modal should not open while P2P onboarding is incomplete').toBeHidden();
  2925 |         await expect(this.p2pSetupModal, 'P2P setup sheet should open for incomplete onboarding').toBeVisible();
  2926 |         // i18n key: cashier.transfer_p2p_setup_title
  2927 |         await expect(this.p2pSetupTitle, 'P2P setup sheet title should be Complete your information').toHaveText('Complete your information');
  2928 |         await expect(this.p2pSetupBadge('profile'), 'Completed profile should have a completion badge').toBeVisible();
  2929 |         await expect(this.p2pSetupBadge('phone'), 'Incomplete phone should not have a completion badge').toBeHidden();
  2930 |         await expect(this.p2pSetupBadge('poi'), 'Approved POI should have a completion badge').toBeVisible();
  2931 |         await expect(this.p2pSetupBadge('poa'), 'Approved POA should have a completion badge').toBeVisible();
  2932 |     }
  2933 |
  2934 |     /**
  2935 |      * Verify the MT5 deposit financial-assessment gate blocked the review step.
  2936 |      *
  2937 |      * Mirrors the mobile app: an MT5 destination whose onboarding row still has
  2938 |      * `actions.fa_required.deposit` outstanding must not reach "Review and
  2939 |      * confirm" — the verification checklist opens instead.
  2940 |      * @returns A promise that resolves when the blocked state is verified.
  2941 |      */
  2942 |     async verifyMt5FaGateBlocksReview(): Promise<void> {
  2943 |         await expect(this.mt5FaVerificationModal, 'MT5 verification sheet should open when the deposit financial assessment is outstanding').toBeVisible();
  2944 |         await expect(this.reviewModal, 'Review modal should not open while the MT5 deposit financial assessment is outstanding').toBeHidden();
  2945 |         // i18n key: accounts.mt5_complete_verification_title
  2946 |         await expect(this.mt5FaVerificationTitle, 'MT5 verification sheet title should be Complete verification').toHaveText('Complete verification');
> 2947 |         await expect(this.mt5FaVerificationBadge('fa'), 'Outstanding financial assessment row should carry a status badge').toBeVisible();
       |                                                                                                                             ^ Error: Outstanding financial assessment row should carry a status badge
  2948 |         await expect(this.mt5FaVerificationCtaBtn, 'MT5 verification sheet should offer the Complete verification action').toBeVisible();
  2949 |     }
  2950 |
  2951 |     /**
  2952 |      * Asserts the checklist suppresses the POI/POA rows Core reported as
  2953 |      * `not_required` while still showing the outstanding financial assessment.
  2954 |      * A suppressed row must leave no list item and no badge behind — it is
  2955 |      * excluded from the checklist, not merely rendered as already satisfied.
  2956 |      * @returns A promise that resolves once the suppressed rows are verified absent.
  2957 |      */
  2958 |     async verifyMt5FaGateHidesNotRequiredKycRows(): Promise<void> {
  2959 |         await expect(this.mt5FaVerificationModal, 'MT5 verification sheet should open when the deposit financial assessment is outstanding').toBeVisible();
  2960 |         await expect(this.mt5FaVerificationRow('fa'), 'Outstanding financial assessment row should still be listed').toBeVisible();
  2961 |         await expect(this.mt5FaVerificationRow('poi'), 'Proof of identity row should be absent when Core reports poi_required as not_required').toHaveCount(0);
  2962 |         await expect(this.mt5FaVerificationRow('poa'), 'Proof of address row should be absent when Core reports poa_required as not_required').toHaveCount(0);
  2963 |         await expect(this.mt5FaVerificationBadge('poi'), 'Suppressed proof of identity row should leave no status badge').toHaveCount(0);
  2964 |         await expect(this.mt5FaVerificationBadge('poa'), 'Suppressed proof of address row should leave no status badge').toHaveCount(0);
  2965 |     }
  2966 |
  2967 |     /** @returns A promise that resolves when TradingView chooser actions are verified. */
  2968 |     async verifyTradingViewChooserActions(): Promise<void> {
  2969 |         await expect(this.tradingViewChooserBrowserBtn, 'Continue in browser should be visible in the TradingView chooser').toBeVisible();
  2970 |         await expect(this.tradingViewChooserGetAppBtn, 'Get the TradingView app should be visible in the chooser').toBeVisible();
  2971 |         await expect(this.successTradePopup, 'MT5/cTrader trade popup should not be used for TradingView').toBeHidden();
  2972 |     }
  2973 |
  2974 |     /**
  2975 |      * Verify amount/currency direction in a trading-to-wallet transaction detail drawer.
  2976 |      * @param fromAccount - Source trading account label expected in transaction history.
  2977 |      * @param toWallet - Destination wallet label expected in transaction history.
  2978 |      * @param toCurrencyCode - Destination currency code expected in amount fields.
  2979 |      * @returns A promise that resolves when transaction direction and local date/time pass.
  2980 |      */
  2981 |     async verifyTradingToWalletDetailDirection(
  2982 |         fromAccount: string,
  2983 |         _toWallet: string,
  2984 |         toCurrencyCode: string,
  2985 |     ): Promise<void> {
  2986 |         await this.goToPortfolio();
  2987 |         await NavigationUtils.waitForDerivApiSettled(this.page);
  2988 |         await this.portfolioPage.verifyPortfolioPage();
  2989 |         await this.openCryptoWalletSidebar(toCurrencyCode);
  2990 |         // Platform-to-wallet transfers show "{platformLabel} → Wallet" in the
  2991 |         // transaction list (see wallet-tx-helpers.ts `getWalletTxSubtitle`).
  2992 |         // platformLabel may include the login-id suffix (e.g. "Financial (MTR12345)"),
  2993 |         // so assert the parts separately rather than an exact concatenation.
  2994 |         const firstRow = this.portfolioPage.firstTransactionItem;
  2995 |         await firstRow.waitFor({ state: "visible", timeout: 10_000 });
  2996 |         await expect(
  2997 |             firstRow,
  2998 |             `Transaction row should contain trading account name "${fromAccount}"`,
  2999 |         ).toContainText(fromAccount);
  3000 |         await expect(
  3001 |             firstRow,
  3002 |             'Platform-to-wallet transaction should route to "Wallet"',
  3003 |         ).toContainText("→ Wallet");
  3004 |         await expect(
  3005 |             firstRow,
  3006 |             `Transaction row should show currency code "${toCurrencyCode}"`,
  3007 |         ).toContainText(toCurrencyCode);
  3008 |         await firstRow.click();
  3009 |         await expect(
  3010 |             this.portfolioPage.transactionDetailsTransferAmountField,
  3011 |             'Trading-to-wallet sent amount should use the platform USD chargeable amount',
  3012 |         ).toContainText('USD');
  3013 |         await expect(
  3014 |             this.portfolioPage.transactionDetailsTransferAmountSecondField,
  3015 |             `Trading-to-wallet sent equivalent should use ${toCurrencyCode}`,
  3016 |         ).toContainText(toCurrencyCode);
  3017 |         await expect(
  3018 |             this.portfolioPage.transactionDetailsAmountReceivePrimaryField,
  3019 |             `Trading-to-wallet received primary amount should use ${toCurrencyCode}`,
  3020 |         ).toContainText(toCurrencyCode);
  3021 |         await expect(
  3022 |             this.portfolioPage.transactionDetailsAmountReceiveSecondaryField,
  3023 |             'Trading-to-wallet received equivalent should use USD',
  3024 |         ).toContainText('USD');
  3025 |         await this.portfolioPage.verifyTransactionDateTime();
  3026 |     }
  3027 |
  3028 |     /**
  3029 |      * Verify a To-account URL preset and its funded source selection.
  3030 |      * @param accountName - Account name expected in the To selector.
  3031 |      * @returns A promise that resolves when both preset assertions pass.
  3032 |      */
  3033 |     async verifyToAccountPreset(accountName: string): Promise<void> {
  3034 |         await expect(this.toAccountBtn, `To account should be preselected as "${accountName}"`).toContainText(accountName);
  3035 |         await expect(this.fromAccountBtn, 'A funded source account should be preselected for the To-account deep link').toBeVisible();
  3036 |     }
  3037 | }
  3038 |
```
