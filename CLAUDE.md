# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page lottery promotion site for 毓秀堂 (a Japanese lifestyle-goods wholesaler): members who spend enough on a qualifying order get lottery draws from a fixed-size prize pool. Static frontend (no build step) + Google Apps Script backend + Google Sheets as the database. See `DEPLOY.md` for the full deployment walkthrough and `docs/superpowers/specs/2026-07-14-summer-lottery-design.md` (in the parent directory) for the original design spec.

## Commands

No package manager, no build step — this is vanilla HTML/CSS/JS served as static files, plus a `.gs` backend deployed through the Apps Script editor (not a CLI).

**Run the GAS pure-logic test suite** (Node's built-in test runner; `Code.gs` is loaded via `new Function()` since it's plain ES2015+ JS):
```bash
node --test tests/gas-logic.test.js
```
Note: `node --test tests/` (pointing at the directory) does not reliably resolve on this checkout — always target the file explicitly.

**Syntax-check a JS file without running it:**
```bash
node --check js/ui.js
```

**Local preview** (no bundler — just serves the static files):
```bash
python -m http.server 8788
```
When working from the parent `ict商品行銷規劃/` directory in Claude Code, `.claude/launch.json` already defines this as the `summer-lottery` preview target.

There is no lint config and no CI in this repo.

## Architecture

### Split deployment, three independently-deployed pieces

- **Frontend** (`index.html`, `css/`, `js/`) → GitHub Pages, static.
- **Backend** (`gas/Code.gs`) → Google Apps Script, deployed as a Web App. Editing `Code.gs` and saving in the Apps Script editor does **not** update the live `/exec` endpoint — every change requires **Deploy → Manage deployments → Edit → New version** to actually go live.
- **Database** → a Google Sheet with three tabs, read/written directly by `Code.gs` via `SpreadsheetApp`.

Because the frontend and backend deploy independently, `js/config.js`'s `CONFIG.API_URL` and `gas/Code.gs`'s `PRIZES_META`/prize names are the only coupling between them — there's no shared build or type system enforcing consistency. When changing prize names/content, update in lockstep:
- `js/config.js` → `PRIZES` (drives card rendering, emoji, type styling)
- `gas/Code.gs` → `PRIZES_META` (drives what gets written to the 抽獎紀錄 sheet and returned to the client)
- The Google Sheet's 獎池庫存 tab, column A (must match these names byte-for-byte, emoji included)

### Request flow and the CORS workaround

All three backend actions (`pool`, `query`, `draw`) go through a single `doPost(e)` in `Code.gs`, dispatched on `req.action`. The frontend (`js/api.js`) always POSTs with `Content-Type: text/plain;charset=utf-8` and a JSON string body — this keeps every request a Fetch "simple request" so no CORS preflight is triggered, since Apps Script Web Apps can't set custom CORS headers. Don't change this to `application/json`; it will break cross-origin calls from GitHub Pages.

### GAS module layout (`gas/Code.gs`, single file)

Bottom-up, in the order the file is written:
1. **Constants** — sheet tab names, `DRAW_THRESHOLD`, `ACTIVITY_START`/`ACTIVITY_END`, `PRIZES_META`.
2. **Pure functions** (`calcTotalDraws`, `pickPrize`, `normalizeId`, `formatMoney`, `checkActivityPeriod`) — no Sheets/GAS API calls, fully covered by `tests/gas-logic.test.js`. Keep new business logic here when possible so it stays testable.
3. **HTTP entry** (`doPost`, `doGet`, `jsonOutput`, `errorResponse`).
4. **Sheets access** (`getSheet`, `findOrder`, `countUsedDraws`, `readPool`, `poolData`).
5. **`validateOrder`** — the single gate both `query` and `draw` go through: activity-period check → required fields → order lookup → customer-id match → threshold check → draw-count math. Returns `{ error }` or the validated order context.
6. **Handlers** (`handlePool`, `handleQuery`, `handleDraw`) — `handleDraw` wraps everything in `LockService.getScriptLock()` so concurrent draws can't over-allocate the same prize.

Money is never formatted with `Number.prototype.toLocaleString()` on the GAS side — the Apps Script V8 runtime's ICU/Intl data is unreliable and can silently drop thousands separators. Use `formatMoney()` instead. The frontend (real browsers) does use `toLocaleString()` safely.

### Prize draw mechanics

Draws are weighted by each prize's *remaining* count (`pickPrize` in `Code.gs`), not a fixed probability table — a prize with more stock left is proportionally more likely to be drawn, and every draw always returns a prize (no "no win" outcome). The pool is exhausted, not reset, over the campaign.

### Activity period gate

`validateOrder` checks `checkActivityPeriod()` against `ACTIVITY_START`/`ACTIVITY_END` before anything else, so both `query` and `draw` are refused outside the campaign window even if prize stock remains. `TESTING_SKIP_DATE_CHECK` (top of `Code.gs`) bypasses this for pre-launch testing — it must be flipped back to `false` before go-live, and doing so requires a new GAS deployment version (see above).

`ACTIVITY_END` is the draw/redemption deadline, not necessarily the spending deadline — the two can diverge (e.g. spending qualifies through 8/14 but draws stay open through 8/31) because there's no code path that checks an order's own date, only "now" against `ACTIVITY_START`/`ACTIVITY_END`. Enforcing an earlier spending cutoff is a manual process: staff simply stop adding new rows to the 訂單資料 sheet after that date. Keep this in mind before assuming `ACTIVITY_END` alone tells you when qualifying purchases stop.

### Frontend structure (`index.html` + `js/`)

Single page, four script tags in dependency order: `config.js` (constants/data) → `api.js` (`callApi`/`api.pool/query/draw`) → `gacha.js` (self-contained `gacha` module: spin/drop/reset/confetti animation state machine, driven by CSS classes `is-spinning`/`is-dropping`/`is-open`) → `ui.js` (IIFE wiring DOM events to `api` + `gacha`, the only place that touches `document` directly).

`css/style.css`: the day/night gradient sky lives on `.sky` (a `position: fixed`, viewport-sized layer), not on `body`. Putting a tall gradient directly on `body` with `background-attachment: fixed` causes it to tile every viewport-height on scroll (a real bug hit during development) — keep long decorative gradients on a fixed full-viewport element, not on scrolling containers.

Total remaining prize count is intentionally never surfaced to the visitor (no "X / 167" or grand-total copy) — this is a deliberate marketing choice to avoid implying low participation. Individual per-prize remaining counts on each card are fine to show.

### `design-mockups/`

Three standalone HTML files (`a-summer-sky-pop.html`, `b-lemon-soda.html`, `c-ryoka-poster.html`) are early visual-direction drafts, not the live site — `index.html` is the only page that actually ships. They still contain stale copy (old dates, old spending threshold) from before later revisions; don't assume they're in sync with `index.html`, and don't update them as a side effect of changing campaign copy unless specifically asked to.
