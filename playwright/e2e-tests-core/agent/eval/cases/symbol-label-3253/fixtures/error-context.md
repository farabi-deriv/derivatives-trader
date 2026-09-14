# Page snapshot

```yaml
- document:
  - banner:
    - button "Back"
    - heading "Trade" [level=2]
    - button "Account balance 10,000.00 USD"
  - main:
    - region "Market tabs":
      - button "Change market and trade type: Volatility 100 (1s) Index, Rise/Fall":
        - paragraph: Volatility 100 (1s) Index
        - paragraph: Rise/Fall
      - button "Volatility 50 Index Rise/Fall Remove market":
        - paragraph: Volatility 50 Index
        - paragraph: Rise/Fall
        - button "Remove market"
      - button "Add market"
    - region "Chart":
      - img "Price chart"
    - region "Trade parameters":
      - button "Rise/Fall"
      - spinbutton "Duration"
      - spinbutton "Stake"
    - button "Rise"
    - button "Fall"
  - navigation:
    - link "Trade"
    - link "Positions"
```
