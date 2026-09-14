# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crypto-exchange/verify-exchange-deposit-deriv-wallet.spec.ts >> Crypto Exchange — Deposit via Deriv Wallet >> VERIFY USD Wallet row is excluded from the deposit coin list
- Location: playwright/tests/crypto-exchange/verify-exchange-deposit-deriv-wallet.spec.ts:181:9

# Error details

```
Error: Deposit coin list picker container should be visible

expect(locator).toBeVisible() failed

Locator: getByTestId('exchange-deposit-wallet-picker')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Deposit coin list picker container should be visible with timeout 45000ms
  - waiting for getByTestId('exchange-deposit-wallet-picker')

```

```yaml
- alert
- main:
      - button "Go back":
            - img
      - heading "Select crypto asset to deposit" [level=1]
      - paragraph: Deposit paused
      - paragraph: Deposits are temporarily unavailable. Try again later.
      - button "Got it"
```

# Test source

```ts
  937  |   // ============================================
  938  |   // VERIFICATIONS
  939  |   // ============================================
  940  |
  941  |   /**
  942  |    * Verify the empty state for a user with NO real trading account.
  943  |    *
  944  |    * Expected UI:
  945  |    * - Hero title "Deriv Crypto Exchange" visible
  946  |    * - Hero subtitle visible
  947  |    * - "Try real trading" CTA visible
  948  |    * - "Deposit" CTA is NOT visible (only shown when hasRealAccount = true)
  949  |    */
  950  |   async verifyEmptyStateNoRealAccount(): Promise<void> {
  951  |     await expect(
  952  |       this.heroTitle,
  953  |       'Hero title should read "Deriv Crypto Exchange"'
  954  |     ).toBeVisible();
  955  |
  956  |     await expect(
  957  |       this.heroSubtitle,
  958  |       "Hero subtitle should be visible describing the exchange"
  959  |     ).toBeVisible();
  960  |
  961  |     await expect(
  962  |       this.tryRealTradingButton,
  963  |       '"Try real trading" button should be visible when user has no real account'
  964  |     ).toBeVisible();
  965  |
  966  |     await expect(
  967  |       this.depositButton,
  968  |       '"Deposit" button should NOT be visible when user has no real account'
  969  |     ).not.toBeVisible();
  970  |   }
  971  |
  972  |   /**
  973  |    * Verify the hero banner reads "Deriv Crypto Exchange" and exposes the
  974  |    * real-account CTA (`exchange-btn-try-real-trading`) — the empty state shown
  975  |    * to a user with NO real trading account (e.g. an Antarctica demo-only account).
  976  |    *
  977  |    * Asserts the actual rendered text (not just visibility) so a regression that
  978  |    * changes the banner title is caught. The CTA label is matched tolerantly
  979  |    * ("Setup real account" / "Try real trading") because the copy differs between
  980  |    * environments — staging currently renders "Setup real account" while the local
  981  |    * `src/` locale still reads "Try real trading"; both drive the same real-account
  982  |    * action on the stable `exchange-btn-try-real-trading` testid.
  983  |    */
  984  |   async verifyHeroBannerWithTryRealTrading(): Promise<void> {
  985  |     await expect(
  986  |       this.heroTitle,
  987  |       'Hero banner title should read "Deriv Crypto Exchange"'
  988  |     ).toBeVisible();
  989  |     await expect(
  990  |       this.heroTitle,
  991  |       'Hero banner title text should be "Deriv Crypto Exchange"'
  992  |     ).toContainText("Deriv Crypto Exchange");
  993  |
  994  |     await expect(
  995  |       this.tryRealTradingButton,
  996  |       "Real-account CTA should be visible in the hero banner"
  997  |     ).toBeVisible();
  998  |     await expect(
  999  |       this.tryRealTradingButton,
  1000 |       'Real-account CTA should be labelled "Setup real account" (or legacy "Try real trading")'
  1001 |     ).toContainText(/Setup real account|Try real trading/i);
  1002 |   }
  1003 |
  1004 |   /**
  1005 |    * Verify the deposit method picker screen is rendered with the Deriv Wallet option.
  1006 |    */
  1007 |   async verifyDepositMethodPickerVisible(): Promise<void> {
  1008 |     await expect(
  1009 |       this.depositMethodPickerTitle,
  1010 |       "Deposit method picker title should be visible"
  1011 |     ).toBeVisible();
  1012 |
  1013 |     await expect(
  1014 |       this.depositMethodPickerDerivWalletCard,
  1015 |       '"Deriv Wallet" option should be visible on the deposit method picker'
  1016 |     ).toBeVisible();
  1017 |   }
  1018 |
  1019 |   /**
  1020 |    * Verify the deposit wallet coin list screen is rendered.
  1021 |    *
  1022 |    * NOTE: This only confirms the shell (title + picker container) is present.
  1023 |    * The picker container is rendered during the loading-skeleton phase too, so
  1024 |    * it is NOT a reliable signal that coin rows have loaded. Call
  1025 |    * {@link waitForDepositCoinListItemsLoaded} before asserting on individual
  1026 |    * rows (e.g. USD exclusion).
  1027 |    */
  1028 |   async verifyDepositCoinListVisible(): Promise<void> {
  1029 |     await expect(
  1030 |       this.depositCoinListTitle,
  1031 |       "Deposit coin list title should be visible"
  1032 |     ).toBeVisible({ timeout: 15_000 });
  1033 |
  1034 |     await expect(
  1035 |       this.depositCoinListPicker,
  1036 |       "Deposit coin list picker container should be visible"
> 1037 |     ).toBeVisible();
       |       ^ Error: Deposit coin list picker container should be visible
  1038 |   }
  1039 |
  1040 |   /**
  1041 |    * Wait for the deposit coin list to finish loading.
  1042 |    *
  1043 |    * The coin list has three terminal states once loading completes:
  1044 |    *   1. Real coin-row buttons render inside the picker (account has ≥1
  1045 |    *      deposit-able wallet), OR
  1046 |    *   2. The no-funds sheet opens (deposit, zero balance — picker is empty), OR
  1047 |    *   3. The rate-unavailable screen replaces the picker (market data error).
  1048 |    *
  1049 |    * The loading-skeleton phase renders `<div>` placeholders inside the picker
  1050 |    * with no `data-testid`, so `depositCoinListFirstRow` only resolves once real
  1051 |    * rows replace the skeletons. This guard prevents negative-assertion races:
  1052 |    * asserting a row is absent while skeletons are showing would pass trivially
  1053 |    * (no rows exist yet), defeating the assertion.
  1054 |    *
  1055 |    * @returns `"rows"` if coin rows rendered, `"no_funds"` if the zero-balance
  1056 |    *          sheet opened, or `"rate_unavailable"` if the market-data error
  1057 |    *          screen showed — so callers can branch (e.g. skip when empty).
  1058 |    */
  1059 |   async waitForDepositCoinListItemsLoaded(timeout = 20_000): Promise<"rows" | "no_funds" | "rate_unavailable"> {
  1060 |     let state: "rows" | "no_funds" | "rate_unavailable" | "" = "";
  1061 |     await expect.poll(
  1062 |       async () => {
  1063 |         const hasRow = await this.depositCoinListFirstRow.isVisible();
  1064 |         const noFunds = await this.depositNoFundsSheet.isVisible();
  1065 |         const rateUnavailable = await this.depositRateUnavailable.isVisible();
  1066 |         if (hasRow) state = "rows";
  1067 |         else if (noFunds) state = "no_funds";
  1068 |         else if (rateUnavailable) state = "rate_unavailable";
  1069 |         else state = "";
  1070 |         return state;
  1071 |       },
  1072 |       {
  1073 |         message: "Deposit coin list should finish loading (rows, no-funds sheet, or rate-unavailable screen)",
  1074 |         timeout,
  1075 |       },
  1076 |     ).not.toBe("");
  1077 |     return state as "rows" | "no_funds" | "rate_unavailable";
  1078 |   }
  1079 |
  1080 |   /**
  1081 |    * Verify the USDT network picker screen is rendered.
  1082 |    * Appears when the user navigates to `?currency=USDT` without a `network`
  1083 |    * param. Lists only on-chain `USDT_<Network>` wallet variants — the USD
  1084 |    * Wallet is excluded (commit 273afa036 / issue #<redacted-phone> |    */
  1086 |   async verifyUsdtNetworkPickerVisible(): Promise<void> {
  1087 |     await expect(
  1088 |       this.depositUsdtNetworkTitle,
  1089 |       "USDT network picker title should be visible"
  1090 |     ).toBeVisible({ timeout: 15_000 });
  1091 |
  1092 |     await expect(
  1093 |       this.depositUsdtNetworkPicker,
  1094 |       "USDT network picker container should be visible"
  1095 |     ).toBeVisible();
  1096 |   }
  1097 |
  1098 |   /**
  1099 |    * Verify the deposit form is rendered with the amount input and percentage chips.
  1100 |    */
  1101 |   async verifyDepositFormVisible(): Promise<void> {
  1102 |     await expect(
  1103 |       this.depositFormAmountInput,
  1104 |       "Deposit amount input should be visible in the form"
  1105 |     ).toBeVisible({ timeout: 20_000 });
  1106 |
  1107 |     await expect(
  1108 |       this.depositFormChip50,
  1109 |       '"50%" percentage chip should be visible in the deposit form'
  1110 |     ).toBeVisible();
  1111 |   }
  1112 |
  1113 |   /**
  1114 |    * Verify the deposit review modal is shown with the confirm button.
  1115 |    */
  1116 |   async verifyDepositReviewModalVisible(): Promise<void> {
  1117 |     await expect(
  1118 |       this.depositReviewModal,
  1119 |       "Deposit review modal should be visible after submitting the form"
  1120 |     ).toBeVisible({ timeout: 15_000 });
  1121 |
  1122 |     await expect(
  1123 |       this.depositReviewConfirmButton,
  1124 |       '"Confirm" button should be visible in the deposit review modal'
  1125 |     ).toBeVisible();
  1126 |   }
  1127 |
  1128 |   /**
  1129 |    * Verify the deposit success screen is shown with all key elements.
  1130 |    *
  1131 |    * NOTE: The standalone deposit-success screen has been removed from the app —
  1132 |    * a successful deposit now shows a transient bubble/toast and returns the user
  1133 |    * to the Crypto Exchange landing. Prefer {@link verifyDepositCompletedReturnsToLanding}.
  1134 |    * This method is retained only for environments that still render the legacy
  1135 |    * success screen.
  1136 |    */
  1137 |   async verifyDepositSuccessVisible(): Promise<void> {
```
