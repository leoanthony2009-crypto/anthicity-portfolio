# CEBM School Dashboard

**BLOOM-branded Balanced Scorecard Dashboard** for 100 Catholic schools in Trinidad & Tobago.

Built with React + Vite, Recharts, and SheetJS (xlsx).

## Quick Start

```bash
npm install
npm run dev
```

## How It Works

1. Open the app — see the BLOOM-branded upload screen
2. Upload the **CEBM_BSC_100_Schools.xlsx** workbook
3. The app parses all 5 sheets (School Register + 4 KPI Input sheets: AE, SD, TL, CS)
4. Dashboard populates with:
   - System overview gauges
   - Status distribution pie chart
   - Pillar performance bar chart
   - Top 10 / Bottom 10 schools
   - Full rankings table
   - Individual school scorecards with radar charts

No backend needed — everything runs client-side in the browser.

## Build & Deploy

```bash
npm run build
```

The `dist` folder is ready for deployment to Vercel, Netlify, or any static host.

```bash
# Vercel
npx vercel --prod

# Netlify
# Drag the dist folder to Netlify deploy
```

## Design

- **BLOOM** cross logo (SVG brand mark)
- Forest green gradient: `#3A7D5C` → `#1B4332`
- Gold accent: `#C8973E`
- Cream typography: `#F5EFE0`
- Sage borders/backgrounds: `#8FAE8B`
- EB Garamond / Georgia serif headings, Segoe UI body

---

&copy; 2026 W. Gopaul. All rights reserved.
