# Compound

A responsive compound-interest calculator built with React 19, TypeScript, shadcn/ui, and Recharts. The application uses the Vinext/Vite React framework.

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by the development server (normally http://localhost:5173).

## Build and verify

```sh
npm run build
npx tsc --noEmit
node --test lib/compound.test.ts
```

The calculation tests run directly with Node.js 22.18+ or 24+.

## Features

- Initial investment, nominal annual interest rate, investment period of 1–50 years.
- Daily, monthly, quarterly, half-yearly, or yearly interest compounding.
- Sequential contribution phases with editable amounts, recurrence, and whole-year duration. The last phase fills the remaining period.
- Weekly, every-two-weeks, monthly, quarterly, half-yearly, or yearly deposits.
- Beginning- or end-of-period deposits, zero-contribution pauses, and negative-rate scenarios.
- Interactive chart with total balance, contributions, and interest; composition chart; contribution timeline.
- Annual table with exact cents and CSV export.
- USD, EUR, GBP, and CAD formatting (no exchange-rate conversion).
- Accessible shadcn controls, validation, and responsive layout.

## Calculation model

The input interest rate is nominal annual interest. For m compounding periods per year, each cash flow grows by `(1 + annualRate / m) ^ (m * elapsedYears)` until the next event. Fractional periods use this equivalent rate. This interpolates growth between compounding dates; it does not simulate a bank's particular interest posting rules.

A financial year contains 12 months, 52 weeks, or 26 two-week periods. Deposits recur from each phase's start. End-of-period deposits fall on period ends; beginning-of-period deposits fall on period starts. Beginning deposits on annual boundaries belong to the following year's table row. Deposits beyond the horizon are excluded. Calculations keep full floating-point precision and round only for display and CSV output.

Returns are constant hypothetical assumptions. Taxes, fees, inflation, and variable returns are not modeled. Inputs remain in the current page session; no financial data is sent to a server or stored.

## Main files

- `app/page.tsx`: calculator interface and state.
- `app/globals.css`: responsive styling and theme.
- `lib/compound.ts`: independent cash-flow calculation engine.
- `lib/compound.test.ts`: six tests covering formulas, phases, timing, recurrence, and edge cases.
