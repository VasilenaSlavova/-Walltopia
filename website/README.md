# Walltopia Preliminary Loads — Applicability Check

A web reproduction of the `Walltopia_Preliminary_Loads_2026` Excel workbook. Clients pick
their parameters and instantly read the preliminary loads their existing structure must
carry — the same lookup the Excel does with its slicers, plus an optional pass/fail check.

## Run it

**Calculator + manuals only** — no build, no server: **open `index.html` in any browser**.
All load data is bundled in `data.js` (a plain script), so it works from `file://`. Or serve
statically: `cd website && python -m http.server 8777`.

**With accounts, saved projects & the dashboard** — run the Node server in [`../server`](../server),
which serves this frontend *and* the API on one origin:

```
cd server && npm install && cp .env.example .env   # fill in .env
npm start                                           # http://localhost:8787
```

Then use **http://localhost:8787**. The calculator, manuals and attachment details stay usable
without an account; logging in unlocks saving/organising projects and asking questions. See
[../server/README.md](../server/README.md) for `.env` and MongoDB Atlas setup.

## Accounts, projects & dashboard

- **Log in / Register** (email · name · password) from the header on any page.
- On the calculator, **Save as project** stores the current inputs with a name, **tags**, and
  **custom properties**; the URL becomes `?project=<id>` so it's shareable/reopenable.
- **My Projects** (`dashboard.html`) lists your saved designs with **search, tag filter and sort**;
  open one to load its inputs back into the calculator and tweak, **Save changes** or **Save as new**.
- **Ask Walltopia about this project** — a saved project can carry questions (requires an account).
- Client files: `api.js` (API client), `auth-ui.js` (login/register modal + header account area),
  `dashboard.js` (dashboard). All account calls hit the same-origin `/api`, so they only work when
  served by the Node server.

## How to use (mirrors the manual)

1. **Units** — Metric (kN·m, EN 12572, ×1.35 DL / ×1.50 LL) or Imperial (lb·ft, CWA 2009, ×1.20 / ×1.60).
2. **Structure type** — Climbing wall (with protection points) or Boulder wall (without).
3. **Climbing-surface height** — and, where more than one exists, the **attachment scheme**
   (number of attachment levels by height).
4. **Column span A** and **Overhang X**.
5. **Force level** — which attachment level is taken at its maximum live load; other levels
   show their concurrent values (per the standard, climbers cannot fall simultaneously).
6. Read the loads: **R** = load on one ACS axis (base / single-axis points), **L** = load on
   a building column/frame (span-adjusted). **DL** = dead load, **LL** = live load.

### Optional applicability check

Enter the horizontal load one existing column/frame can carry. The tool computes the
**governing factored column load** (worst case across every force level) and shows
**Applicable / Exceeds capacity**. Tick *Show factored design values* to see every cell
multiplied by the code factors.

## Pages

The site has three linked pages (top-nav on every page):

| Page | What it is |
|------|-----------|
| `index.html` | **Load Calculator** — the interactive lookup + applicability check. |
| `manual.html` | **Application Manual** — the *Manual for applying Walltopia preliminary loads* PDF, converted to a paged HTML reader with a page-text transcript under each page. |
| `attachment-details.html` | **Attachment Details** — the *Standard attachment details* CAD sheet as a zoom/pan viewer. |

Each is a standalone, shareable page — host the folder and share the URL of whichever page you want.

## Files

| File | Purpose |
|------|---------|
| `index.html` / `manual.html` / `attachment-details.html` | The three pages above |
| `styles.css` | Shared styling |
| `app.js` | Calculator logic + rendering (reads `window.WALLTOPIA_LOADS`) |
| `data.js` | All wall + boulder load tables (EU + US), extracted verbatim from the xlsm |
| `manuals/manual/page-NN.png` | Manual pages rendered from the PDF (144 dpi) |
| `manuals/manual/transcript.js` | Per-page text of the manual (search / accessibility) |
| `manuals/attachment/sheet.png` | The attachment-details CAD sheet (high-res render) |
| `assets/walltopia-logo*.svg` | Walltopia wordmark (colour + white variant for the dark header) |

## Branding

Styled 1-to-1 to [walltopia.com](https://walltopia.com/): red `#EC1C24`, ink `#16181F`,
dark-navy `#212331`, white / light-grey surfaces, square corners, **Montserrat** (900, tight
tracking) display type over **Open Sans** body. Fonts load from Google Fonts with a system
sans-serif fallback, so the pages still work offline (with fallback fonts). The `?v=` query on
the stylesheet link is a cache-buster — bump it when you change `styles.css`.

The PDFs were converted by rendering each page to an image with PyMuPDF (faithful to the
dimensioned drawings and Excel screenshots) and pairing the manual pages with their extracted
text. Regenerate with the scripts noted in the project scratchpad if the source PDFs change.

## Data provenance & caveats

- Values are extracted from `DataBase(stena)` (walls) and `Database (bouldyr)` (boulders)
  in the source workbook and verified cell-for-cell against it.
- **Preliminary loads — not for construction.** Characteristic values that MUST be factored
  per the acting national standard. The manual for use is an inseparable part of these tables.

### Two source bugs corrected in the US tables

The US tables are a pure unit conversion of the EU tables (characteristic force values,
kN → lbf, factor **225**). Two US columns in the workbook reference the wrong EU cell via a
copy-paste formula error, so each held a copy of a neighbouring component. Both are whole-column
(verified against every row); every other US cell already equals `EU × 225` exactly. This site
recomputes the two columns from their correct EU source:

| Table | US column | Workbook formula (wrong) | Corrected to |
|-------|-----------|--------------------------|--------------|
| `Database (bouldyr)` | `RZ0LL` (P2:P71) | `= [RX1LL] × 225` | `= [RZ0LL] × 225` |
| `W_12_3` (12 m, 3 levels) | `LX3DL` (AP263:AP367) | `= [LX2DL] × 225` | `= [LX3DL] × 225` |

Example: boulder `RZ0LL` at X=1 was `63 lbf`, now `-445.5 lbf`; `W_12_3` `LX3DL` at row 263 was
`315 lbf`, now `252 lbf`. The metric (EU) tables were already correct and are unchanged. These
errors are worth reporting back to Walltopia so the source workbook can be fixed.
