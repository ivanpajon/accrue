# Accrue

Accrue is a responsive compound-interest calculator built with React 19, TypeScript, shadcn/ui, and Recharts. The application uses the Vinext/Vite React framework.

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nosy_anita_blake.sql
npm run dev
```

Open the localhost URL printed by the development server (normally http://localhost:5173) and choose Sign in with ChatGPT. The starter simulates a development account on loopback only; production uses Sites-managed sign-in. Apply the initial SQL file only once per local database. Local development data is separate from hosted data.

## Build and verify

```sh
npm run build
npx tsc --noEmit
node --test lib/compound.test.ts lib/preferences.test.ts lib/configurations.test.ts lib/phase-range.test.ts
```

The calculation tests run directly with Node.js 22.18+ or 24+ (database tests use the built-in `node:sqlite` module).

## Features

- Initial investment, nominal annual interest rate, investment period of 1–50 years.
- Daily, monthly, quarterly, half-yearly, or yearly interest compounding.
- Independent contribution phases with editable amounts, recurrence, and inclusive start/end years. Gaps and stopping contributions before the investment ends are supported. Overlapping phases add their contributions together.
- Weekly, every-two-weeks, monthly, quarterly, half-yearly, or yearly deposits.
- Beginning- or end-of-period deposits, zero-contribution pauses, and negative-rate scenarios.
- Interactive chart with total balance, contributions, and interest; composition chart; contribution timeline.
- Annual table with exact cents, high-resolution PNG chart downloads, and PDF reports with the complete configuration, chart, contribution phases, and yearly results.
- USD and EUR formatting (no exchange-rate conversion).
- English and Spanish translations, including number formatting, charts, help, accessibility labels, and image/PDF exports. English is the default.
- Default shadcn neutral theme in light and dark mode, with shared color/radius tokens and the standard shadcn chart palette. System appearance is the default and follows live OS changes.
- Named investment configurations: Save the current investment and contribution plan, load one from the folder button beside Save, explicitly replace an existing name, or delete a saved configuration.
- A persistent context strip identifies the active saved configuration and whether it has unsaved changes. Save changes updates it directly; the adjacent menu offers Save as copy, Revert to saved, and New configuration. Reverting or starting over asks before discarding edits, and the example reset is hidden while editing a saved configuration.
- Language, currency, theme, and chart preferences save to the signed-in account in Sites D1. Zustand holds the current in-memory UI state. Calculator drafts persist only when explicitly saved.
- Compact icon-only language, appearance, and currency menus in the header; Save and saved configurations beside the page title.
- Joined annual-rate/compounding and contribution amount/frequency controls and accessible year-range sliders, with an exact-year popover for precise editing. Phase dates and slider bounds adjust together when the investment horizon is shortened. Typed period edits commit on blur or Enter.
- Exact-year edits automatically round and fit within the current investment period on blur or Apply. Editing an endpoint past the other moves both to the same year. Cancel discards the draft; opening the editor does not change existing phases.
- Lucide icons throughout.
- Accessible shadcn controls, validation, and responsive layout.

## Accounts and database

- Sites handles ChatGPT sign-in and sign-out. The page requires sign-in; `/api/account` returns 401 to unauthenticated requests.
- Every database query uses the stable user ID provided by Sites. Clients cannot select a different owner.
- `account_preferences` stores UI settings; `configurations` stores named investment snapshots. Draft edits stay in memory until explicitly saved.
- Preference updates patch only changed fields. Plan updates and deletes check revisions to prevent overwriting another device’s changes.
- The API validates payloads, checks same-origin JSON writes, and prevents caching of account data. Network failures keep the working draft available with a retry message.
- There is no browser-storage persistence or legacy-data import.
- `.openai/hosting.json` declares the native `DB` binding. Sites provisions the database and applies the checked-in Drizzle schema on publication. For later schema edits run `npm run db:generate`, inspect the generated SQL, and apply only new migrations locally.

## Calculation model

The input interest rate is nominal annual interest. For m compounding periods per year, each cash flow grows by `(1 + annualRate / m) ^ (m * elapsedYears)` until the next event. Fractional periods use this equivalent rate. This interpolates growth between compounding dates; it does not simulate a bank's particular interest posting rules.

A financial year contains 12 months, 52 weeks, or 26 two-week periods. Deposits recur from each phase's start. End-of-period deposits fall on period ends; beginning-of-period deposits fall on period starts. Beginning deposits on annual boundaries belong to the following year's table row. Deposits beyond the horizon are excluded. Calculations keep full floating-point precision and round only for display and exported reports.

Returns are constant hypothetical assumptions. Taxes, fees, inflation, and variable returns are not modeled. Named configurations and preferences are saved in the signed-in account’s database records and are available across devices. Reload starts with the example draft; choose a saved configuration to load it. Unsaved edits do not change saved snapshots. Language, currency, and appearance are independent preferences and remain unchanged when loading a plan. Reset restores the example plan while keeping saved configurations and preferences.

## Main files

- `app/page.tsx`: server-side sign-in boundary.
- `components/calculator.tsx`: calculator interface.
- `components/account-controls.tsx`: sign-in screen, account menu, and sync status.
- `app/api/account/route.ts`, `db/repository.ts`, and `db/schema.ts`: authenticated D1 storage and database schema.
- `app/globals.css` and `app/preferences.css`: responsive styling and theme tokens.
- `lib/brand.ts`: shared Accrue name and filename prefix.
- `lib/i18n.ts`: typed English and Spanish dictionaries.
- `components/projection-exports.tsx` and `lib/export-projection.ts`: image downloads and paginated PDF reports.
- `components/saved-configurations.tsx`: Save dialog and saved configuration picker.
- `lib/store.ts`, `lib/configurations.ts`, and `lib/preferences.ts`: transient draft state, asynchronous account storage, saved snapshots, validation, and system theme initialization before paint.
- `lib/compound.ts`: independent cash-flow calculation engine.
- `lib/compound.test.ts`, `lib/preferences.test.ts`, and `lib/configurations.test.ts`: tests covering formulas, phase windows, gaps, timing, recurrence, SQLite ownership and concurrency, asynchronous save behavior, and translation parity.
