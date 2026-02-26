# CLAUDE.md — CEBM School Dashboard

## Project Overview

**CEBM School Dashboard** is a BLOOM-branded Balanced Scorecard (BSC) web application for 100 Catholic schools in Trinidad & Tobago. It is a fully client-side React + Vite single-page application — no backend or API required. Users upload an Excel workbook and the app parses, scores, and visualizes school performance data across four pillars.

**Owner:** W. Gopaul — © 2026
**Brand:** BLOOM (Anthicity — Learning for Life)

## Tech Stack

| Layer       | Technology                         |
|-------------|------------------------------------|
| Framework   | React 19 (JSX, no TypeScript)      |
| Bundler     | Vite 7                             |
| Charts      | Recharts 3                         |
| Excel I/O   | SheetJS (`xlsx` npm package)       |
| Linting     | ESLint 9 with react-hooks & react-refresh plugins |
| Styling     | Inline styles + one CSS reset file (`index.css`) |

## Repository Structure

```
anthicity-portfolio/
├── CLAUDE.md               ← This file
├── README.md               ← Project readme / deploy guide
├── index.html              ← Vite HTML entry point
├── package.json            ← npm scripts & dependencies
├── vite.config.js          ← Vite config (React plugin)
├── eslint.config.js        ← ESLint flat config
├── public/
│   └── bloom-logo.svg      ← Favicon / brand mark SVG
└── src/
    ├── main.jsx            ← React DOM entry point
    ├── index.css           ← Global CSS reset & scrollbar styles
    ├── App.jsx             ← Thin wrapper — renders <CEBMDashboard />
    └── CEBM_Dashboard.jsx  ← Core component (~500 lines, single file)
```

## Key File: `src/CEBM_Dashboard.jsx`

This single-file component contains **everything**:

- **Design tokens** — `T` object with brand colors
- **`BloomCross`** — inline SVG logo component
- **`ScoreGauge`** — circular SVG gauge ring
- **`parseWorkbook(wb)`** — reads 5 Excel sheets:
  - `"School Register"` — school metadata (ID, name, district, type)
  - `"AE Input"` — Academic Excellence KPI scores
  - `"SD Input"` — Student Development KPI scores
  - `"TL Input"` — Teaching & Learning KPI scores
  - `"CS Input"` — Catholic School Identity KPI scores
- **3 views:**
  1. **Dashboard** — system overview gauges, status pie chart, pillar bar chart, top/bottom 10 tables
  2. **Rankings** — full sortable table of all schools
  3. **School View** — individual scorecard with radar chart
- **Sub-components:** `Footer`, `StatusBadge`, `MetaChip`, `SchoolMiniTable`

### Data Flow

```
User uploads .xlsx → FileReader → XLSX.read() → parseWorkbook()
  → maps each school's 4 pillar averages → computes overall score
  → assigns status (Excellent ≥80, Good ≥60, Developing ≥40, Needs Support <40)
  → sorts by overall score descending → renders charts/tables
```

## Brand Design Tokens

| Token         | Value     | Usage                              |
|---------------|-----------|------------------------------------|
| Forest green  | `#3A7D5C` | Primary, gradient start            |
| Dark green    | `#1B4332` | Gradient end, deep backgrounds     |
| Gold          | `#C8973E` | Buttons, accents, highlights       |
| Cream         | `#F5EFE0` | Text on green backgrounds          |
| Sage          | `#8FAE8B` | Borders, secondary backgrounds     |
| Sage light    | `#EDF4EB` | Table alternates, scrollbar track  |

**Fonts:**
- Headings: `EB Garamond` (Google Fonts), fallback `Georgia`, `Palatino Linotype`, `Palatino`, `serif`
- Body: `Segoe UI`, `system-ui`, `-apple-system`, `sans-serif`

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite HMR)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

## Development Conventions

### Code Style
- **No TypeScript** — plain JSX throughout
- **Single-file component** pattern: `CEBM_Dashboard.jsx` is intentionally monolithic to simplify deployment and maintenance
- **Inline styles** using JS objects for component-level styling; only `index.css` provides global resets
- **No CSS-in-JS library** — keep it dependency-light
- Use `const S = { ... }` style objects pattern inside components
- Color values always reference the `T` design token object — never hardcode hex outside of `T`

### React Patterns
- Functional components only, hooks for state
- `useMemo` for derived/computed data (stats, chart data)
- `useCallback` for event handlers passed as props
- No external state management (no Redux/Zustand) — local `useState` is sufficient
- `<ResponsiveContainer>` wraps all Recharts charts

### Excel Parsing
- The npm package is `xlsx` (import as `import * as XLSX from "xlsx"`) — **never** `"sheetjs"`
- Column names are flexibly matched: the parser checks for `"School ID"`, `"SchoolID"`, and `"school_id"` variants
- All parsing is client-side — no server upload

### Naming
- Component files: `PascalCase.jsx` (exception: `CEBM_Dashboard.jsx` uses underscore per project convention)
- Exported component functions: `PascalCase`
- Constants / tokens: `UPPER_CASE` or single-letter `T` for tokens
- CSS classes (when used): `kebab-case` with `cebm-` prefix

## Deployment

The app builds to a static `dist/` folder deployable anywhere:

- **Vercel:** `npx vercel --prod`
- **Netlify:** drag `dist/` folder to Netlify deploy UI
- **GitHub Pages / any static host:** serve `dist/` contents

No environment variables or server config required.

## Adding Features — Guidance

1. **New chart type:** Add to the existing `CEBM_Dashboard.jsx` in the appropriate view section. Import from `recharts`. Use `T` tokens for colors.
2. **New KPI pillar:** Add key to `PILLAR_KEYS`, name to `PILLAR_NAMES`, add sheet name in `parseWorkbook()`, and extend the `pillars` object. Update the overall average calculation divisor.
3. **New view/tab:** Add to the nav button array, add a `view === "newview"` conditional render block in the main return.
4. **Externalizing styles:** If the single-file grows too large, extract a `CEBM_Dashboard.css` and replace inline `style` attributes with className references. Maintain the `cebm-` prefix convention.

## Important Notes

- The copyright footer must read: **© 2026 W. Gopaul**
- The BLOOM cross logo SVG must appear in the header, upload screen, and footer
- All green gradients must flow from `#3A7D5C` → `#1B4332`
- Gold (`#C8973E`) is reserved for CTAs, active nav tabs, and accent highlights
- Do not add a backend — this is a purely client-side application
