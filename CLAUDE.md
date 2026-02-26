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
| PDF Export  | jsPDF + jspdf-autotable            |
| Linting     | ESLint 9 with react-hooks & react-refresh plugins |
| Styling     | Inline styles + one CSS reset file (`index.css`) |
| Deployment  | Vercel (via `vercel.json` config)  |

## Repository Structure

```
anthicity-portfolio/
├── CLAUDE.md               ← This file
├── README.md               ← Project readme / deploy guide
├── index.html              ← Vite HTML entry point
├── package.json            ← npm scripts & dependencies
├── vite.config.js          ← Vite config (React plugin)
├── vercel.json             ← Vercel deployment config
├── eslint.config.js        ← ESLint flat config
├── public/
│   └── bloom-logo.svg      ← Favicon / brand mark SVG
└── src/
    ├── main.jsx            ← React DOM entry point
    ├── index.css           ← Global CSS reset & scrollbar styles
    ├── App.jsx             ← Thin wrapper — renders <CEBMDashboard />
    └── CEBM_Dashboard.jsx  ← Core component (single file, all features)
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
- **Zoho integration** — `fetchZohoData()` connects to Zoho Creator REST API (OAuth) to import school data directly from Zoho databases without manual Excel upload
- **`computeSchoolAnalysis()`** — deep analysis helper: pillar vs system comparison, KPI-level breakdown, district benchmarking, strengths/weaknesses identification
- **PDF generators** — 4 branded report functions:
  - `generateDashboardPDF()` — system overview with summary stats, status distribution, top 10, bottom 10
  - `generateRankingsPDF()` — full rankings table for all schools
  - `generateSchoolPDF()` — individual school report card with pillar breakdown and visual score bars
  - `generateAnalysisPDF()` — comprehensive integration analysis report with pillar vs system, district comparison, strengths/weaknesses, and KPI-level breakdown
- **4 views:**
  1. **Dashboard** — system overview gauges, status pie chart, pillar bar chart, top/bottom 10 tables
  2. **Rankings** — full sortable table of all schools with per-row "Analyse" button
  3. **School View** — individual scorecard with radar chart
  4. **Analysis View** — deep integration analysis: school vs system bar chart, pillar detail table, strengths/weaknesses cards, district comparison, KPI-level breakdowns per pillar, dual-overlay radar chart
- **Sub-components:** `Footer`, `StatusBadge`, `MetaChip`, `SchoolMiniTable`

### Data Flow

```
User uploads .xlsx  → FileReader → XLSX.read() → parseWorkbook()
  — OR —
User connects Zoho  → fetchZohoData() → builds XLSX workbook in memory → parseWorkbook()
  → maps each school's 4 pillar averages + KPI-level detail → computes overall score
  → assigns status (Excellent ≥80, Good ≥60, Developing ≥40, Needs Support <40)
  → sorts by overall score descending → renders charts/tables
```

### PDF Export Flow

```
User clicks "Export PDF" → generateXxxPDF(data)
  → jsPDF creates document → pdfHeader() draws branded green header band
  → autoTable() renders data tables with BLOOM styling
  → pdfFooter() adds branded footer with page numbers → doc.save()
```

All PDF reports include:
- Green gradient header with BLOOM brand name
- Date stamp and report title
- `jspdf-autotable` tables with green header / sage-light alternating rows
- Branded footer with "ANTHICITY — Learning for Life", copyright, page numbers

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
- PDFs: `helvetica` (built-in jsPDF font)

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
- `parseWorkbook()` now also extracts KPI-level detail (`kpiDetail`) per school for the analysis view
- All parsing is client-side — no server upload

### Zoho Integration
- Client-side REST calls to Zoho Creator API v2 (`https://{domain}/api/v2/{appName}/report/{reportName}`)
- OAuth token passed via `Authorization: Zoho-oauthtoken {token}` header
- Supports 4 Zoho data centres: US, EU, India, AU (selectable via domain dropdown)
- Fetches 5 reports (one per sheet): `{prefix}_School_Register`, `{prefix}_AE_Input`, etc.
- Response rows are converted into an in-memory XLSX workbook and parsed identically to file uploads
- Required OAuth scope: `ZohoCreator.report.READ`
- Token is never persisted — entered per session

### PDF Generation
- Import `jsPDF` from `"jspdf"` and `"jspdf-autotable"` (side-effect import)
- Use `pdfHeader()` and `pdfFooter()` helpers for consistent branded layout across all reports
- Header colors use RGB arrays matching `T` tokens: `[58,125,92]` for green1, `[27,67,50]` for green2
- Tables use `doc.autoTable()` with theme `"grid"`, green head styles, sage-light alternating rows

### Naming
- Component files: `PascalCase.jsx` (exception: `CEBM_Dashboard.jsx` uses underscore per project convention)
- Exported component functions: `PascalCase`
- Constants / tokens: `UPPER_CASE` or single-letter `T` for tokens
- CSS classes (when used): `kebab-case` with `cebm-` prefix

## Deployment

The app builds to a static `dist/` folder deployable anywhere.

### Vercel (primary)

A `vercel.json` config is included. To deploy:

1. **Via GitHub integration (recommended):** Connect the repo at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects Vite and deploys on push.
2. **Via CLI:** `npx vercel --prod` (requires `vercel login` first).

### Other hosts

- **Netlify:** drag `dist/` folder to Netlify deploy UI
- **GitHub Pages / any static host:** serve `dist/` contents

No environment variables or server config required.

## Adding Features — Guidance

1. **New chart type:** Add to the existing `CEBM_Dashboard.jsx` in the appropriate view section. Import from `recharts`. Use `T` tokens for colors.
2. **New KPI pillar:** Add key to `PILLAR_KEYS`, name to `PILLAR_NAMES`, add sheet name in `parseWorkbook()`, and extend the `pillars` object. Update the overall average calculation divisor.
3. **New view/tab:** Add to the nav button array, add a `view === "newview"` conditional render block in the main return.
4. **New PDF report:** Create a `generateXxxPDF()` function following the same pattern: use `pdfHeader()`, `doc.autoTable()`, and `pdfFooter()`.
5. **Externalizing styles:** If the single-file grows too large, extract a `CEBM_Dashboard.css` and replace inline `style` attributes with className references. Maintain the `cebm-` prefix convention.

## Important Notes

- The copyright footer must read: **© 2026 W. Gopaul**
- The BLOOM cross logo SVG must appear in the header, upload screen, and footer
- All green gradients must flow from `#3A7D5C` → `#1B4332`
- Gold (`#C8973E`) is reserved for CTAs, active nav tabs, and accent highlights
- Do not add a backend — this is a purely client-side application (Zoho calls are client-side CORS requests)
