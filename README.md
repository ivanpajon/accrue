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
node --test lib/compound.test.ts lib/preferences.test.ts lib/configurations.test.ts
```

The calculation tests run directly with Node.js 22.18+ or 24+.

## Features

- Initial investment, nominal annual interest rate, investment period of 1–50 years.
- Daily, monthly, quarterly, half-yearly, or yearly interest compounding.
- Independent contribution phases with editable amounts, recurrence, and inclusive start/end years. Gaps and stopping contributions before the investment ends are supported. Overlapping phases add their contributions together.
- Weekly, every-two-weeks, monthly, quarterly, half-yearly, or yearly deposits.
- Beginning- or end-of-period deposits, zero-contribution pauses, and negative-rate scenarios.
- Interactive chart with total balance, contributions, and interest; composition chart; contribution timeline.
- Annual table with exact cents and CSV export.
- USD and EUR formatting (no exchange-rate conversion).
- English and Spanish translations, including number formatting, charts, help, accessibility labels, and CSV exports. English is the default.
- Light, stone-grey dark, and system appearance. System is the default and follows live OS changes.
- Named investment configurations: Save the current investment and contribution plan, load one from the folder button beside Save, explicitly replace an existing name, or delete a saved configuration.
- Zustand automatically persists language, currency, theme, and chart preferences. Calculator drafts persist only when explicitly saved.
- Compact icon-only language, appearance, and currency menus in the header; Save and saved configurations beside the page title.
- Joined contribution amount/frequency controls and accessible year-range sliders, with an exact-year popover for precise editing. Phase dates remain intact when the investment horizon changes.
- Lucide icons throughout.
- Accessible shadcn controls, validation, and responsive layout.

## Calculation model

The input interest rate is nominal annual interest. For m compounding periods per year, each cash flow grows by `(1 + annualRate / m) ^ (m * elapsedYears)` until the next event. Fractional periods use this equivalent rate. This interpolates growth between compounding dates; it does not simulate a bank's particular interest posting rules.

A financial year contains 12 months, 52 weeks, or 26 two-week periods. Deposits recur from each phase's start. End-of-period deposits fall on period ends; beginning-of-period deposits fall on period starts. Beginning deposits on annual boundaries belong to the following year's table row. Deposits beyond the horizon are excluded. Calculations keep full floating-point precision and round only for display and CSV output.

Returns are constant hypothetical assumptions. Taxes, fees, inflation, and variable returns are not modeled. Named configurations and preferences are stored only in this browser's localStorage under `compound-planner-v1` (schema version 2); they are not sent to a server or synced across devices. Reload starts with the example draft; choose a saved configuration to load it. Unsaved edits do not change saved snapshots. Language, currency, and appearance are independent preferences and remain unchanged when loading a plan. Reset restores the example plan while keeping saved configurations and preferences. A customized legacy autosave is migrated once into “Previous configuration” / “Configuración anterior.” The calculator remains usable when storage is unavailable, and explicit saves report storage failures.

## Main files

- `app/page.tsx`: calculator interface.
- `app/globals.css` and `app/preferences.css`: responsive styling and theme tokens.
- `lib/i18n.ts`: typed English and Spanish dictionaries.
- `components/saved-configurations.tsx`: Save dialog and saved configuration picker.
- `lib/store.ts`, `lib/configurations.ts`, and `lib/preferences.ts`: draft state, saved snapshots, storage migration, validation, and theme initialization before paint.
- `lib/compound.ts`: independent cash-flow calculation engine.
- `lib/compound.test.ts`, `lib/preferences.test.ts`, and `lib/configurations.test.ts`: tests covering formulas, phase windows, gaps, timing, recurrence, persistence, translation parity, and edge cases.
