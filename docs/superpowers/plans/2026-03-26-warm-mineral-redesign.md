# Warm Mineral v2 Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete visual refresh of the Fresh Takes dashboard — new design system, sidebar layout, typography, and color palette while preserving all data and functionality.

**Architecture:** Pure CSS/styling changes across 4 files. No new components, no data changes. Swap fonts in layout.jsx, rewrite CSS variables and classes in globals.css, restructure UnifiedOpsApp.jsx for sidebar nav, and re-skin all hardcoded inline styles in GanttTracker.jsx to use CSS variable tokens.

**Tech Stack:** Next.js 16, React 19, Recharts, vanilla CSS, next/font/google

**Spec:** `docs/superpowers/specs/2026-03-26-warm-mineral-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/layout.jsx` | Modify | Swap Outfit+Work Sans → Fraunces+DM Sans |
| `app/globals.css` | Modify | Rewrite `:root` tokens, all component classes |
| `components/UnifiedOpsApp.jsx` | Modify | Sidebar layout, chart constants, inline style updates |
| `components/GanttTracker.jsx` | Modify | Replace all 113 inline style blocks with CSS variable tokens |

---

### Task 1: Swap fonts in layout.jsx

**Files:**
- Modify: `app/layout.jsx`

- [ ] **Step 1: Replace font imports and variables**

Replace the entire file content with:

```jsx
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata = {
  title: "Fresh Takes — Pocket FM",
  description: "Weekly releases, POD output, and production at a glance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the dev server starts without errors**

Run: `cd /Users/yadhu.gopal/Documents/old-mac-backup/yadhugopalg/Desktop/Codex/fresh-take-gantt && npm run dev`

Expected: Server starts on localhost:3000. Page loads (fonts won't apply yet since globals.css still references old variable names).

- [ ] **Step 3: Commit**

```bash
git add app/layout.jsx
git commit -m "chore: swap Outfit+Work Sans for Fraunces+DM Sans"
```

---

### Task 2: Rewrite CSS design tokens in globals.css

**Files:**
- Modify: `app/globals.css` (lines 1–48, the `:root` block and body styles)

- [ ] **Step 1: Replace the `:root` block and base styles**

Replace everything from line 1 through the closing `}` of the `body` rule (line 48) with:

```css
:root {
  --font-body: var(--font-dm-sans), "DM Sans", system-ui, sans-serif;
  --font-display: var(--font-fraunces), "Fraunces", Georgia, serif;

  --bg: #f4f0ea;
  --bg-deep: #f4f0ea;
  --surface: #ece7de;
  --bg-surface: #ece7de;
  --panel: #fffdf9;
  --panel-hover: #fffdf9;
  --card: #fffdf9;
  --card-alt: #f9f5ee;
  --line: #ddd6c9;
  --line-hover: #c9c0b0;
  --border: #ddd6c9;
  --border-strong: #c9c0b0;

  --ink: #1c1917;
  --ink-bright: #1c1917;
  --ink-secondary: #44403c;
  --subtle: #a39e93;
  --muted: #a39e93;

  --accent: #9f4e2e;
  --accent-light: rgba(159, 78, 46, 0.08);
  --teal: #9f4e2e;
  --teal-glow: rgba(159, 78, 46, 0.08);
  --teal-soft: rgba(159, 78, 46, 0.05);
  --teal-dark: #7a3a1f;
  --teal-bg: rgba(159, 78, 46, 0.04);

  --forest: #2d5a3d;
  --forest-light: rgba(45, 90, 61, 0.08);
  --terracotta: #c2703e;
  --terracotta-light: rgba(194, 112, 62, 0.08);
  --navy: #2e3a5c;
  --navy-light: rgba(46, 58, 92, 0.08);

  --green: #2d5a3d;
  --green-bg: rgba(45, 90, 61, 0.1);
  --amber: #9f6b15;
  --amber-bg: rgba(159, 107, 21, 0.1);
  --red: #9f2e2e;
  --red-bg: rgba(159, 46, 46, 0.1);
  --gold: #d4a017;

  --indigo: #2e3a5c;
  --indigo-glow: rgba(46, 58, 92, 0.08);
  --gold-glow: rgba(159, 107, 21, 0.08);
  --red-glow: rgba(159, 46, 46, 0.08);

  --gray-bg: #f4f0ea;
  --gray-neutral: #c9c0b0;

  --radius-sm: 8px;
  --radius-btn: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-full: 999px;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select {
  font: inherit;
}
```

Note: We keep backward-compatible aliases (`--bg-deep`, `--bg-surface`, `--panel`, `--line`, `--teal`, `--subtle`, `--gray-bg`, etc.) so that any CSS classes we haven't updated yet still render correctly. The old variable names now point to new values.

- [ ] **Step 2: Verify the page loads with new colors and fonts**

Run: `npm run dev` and open localhost:3000.

Expected: Background changes to warm `#f4f0ea`, fonts switch to Fraunces/DM Sans, accent colors shift to terracotta/forest tones. Layout structure is still the old horizontal tabs (sidebar comes in Task 4).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "chore: rewrite CSS design tokens for Warm Mineral v2 palette"
```

---

### Task 3: Update globals.css component classes

**Files:**
- Modify: `app/globals.css` (lines 61 onwards — all component classes)

This is the largest CSS task. Update every class to use the new design language. The changes fall into these categories:

- [ ] **Step 1: Update page shell and hero**

Replace `.ops-page` through `.hero-copy p` (the page shell and hero sections) with:

```css
/* ─── App shell (sidebar + main) ─── */

.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

/* ─── Sidebar ─── */

.sidebar {
  background: var(--ink);
  color: #fff;
  padding: 28px 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-brand {
  padding: 0 24px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
}

.sidebar-brand-name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #fff;
}

.sidebar-brand-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  font-weight: 500;
}

.sidebar-section-label {
  padding: 20px 24px 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
}

.sidebar-nav {
  display: grid;
  gap: 2px;
  padding: 0 12px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: all 150ms;
  cursor: pointer;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  font-family: var(--font-body);
}

.sidebar-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.sidebar-link.active {
  background: var(--accent);
  color: #fff;
}

.sidebar-footer {
  margin-top: auto;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-week {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.sidebar-week strong {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}

/* ─── Main content ─── */

.ops-main {
  padding: 36px 40px 64px;
  overflow-x: hidden;
}

/* ─── Page header ─── */

.page-header {
  margin-bottom: 32px;
}

.page-header-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 8px;
}

.page-header-title {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin: 0;
}

.page-header-sub {
  font-size: 14px;
  color: var(--muted);
  margin-top: 6px;
}

/* Keep old classes as aliases for backward compat during migration */
.ops-page {
  min-height: 100vh;
}

.ops-shell {
  width: 100%;
  display: grid;
  gap: 20px;
}

.ops-hero {
  display: none;
}
```

- [ ] **Step 2: Update navigation and buttons**

Replace the `.ops-nav`, `.ghost-button`, `.primary-button`, `.week-toggle-group`, and button styles with:

```css
/* ─── Navigation (old horizontal — hidden, replaced by sidebar) ─── */

.ops-nav {
  display: none;
}

/* ─── Buttons ─── */

.ghost-button,
.primary-button,
.as-link,
.share-button {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--card);
  color: var(--ink-secondary);
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  font-family: var(--font-body);
  transition: all 150ms ease;
}

.ghost-button:hover,
.primary-button:hover,
.as-link:hover,
.share-button:hover {
  border-color: var(--border-strong);
  background: var(--card-alt);
}

.primary-button {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.primary-button:hover {
  background: #7a3a1f;
  border-color: #7a3a1f;
}

.week-toggle-group {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.week-toggle-group button {
  padding: 8px 18px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 150ms;
  font-family: var(--font-body);
}

.week-toggle-group button:hover {
  color: var(--ink-secondary);
}

.week-toggle-group button.is-active {
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.primary-button:disabled,
.ghost-button:disabled,
.share-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  transform: none;
  box-shadow: none;
}

.details-button {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--card);
  color: var(--ink-secondary);
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  font-family: var(--font-body);
  transition: all 150ms ease;
}

.details-button:hover,
.details-button.is-active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
```

- [ ] **Step 3: Update section shells and kickers**

Replace `.section-shell` through `.section-actions-left` with:

```css
/* ─── Section shells ─── */

.section-shell {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.section-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.02em;
}

.section-subtitle {
  color: var(--muted);
  margin-top: 6px;
  font-size: 13px;
}

.hero-kicker,
.section-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.section-actions-left {
  justify-content: flex-start;
}
```

- [ ] **Step 4: Update metric cards**

Replace the metric card classes (`.metric-card` through `.metric-hint`) with:

```css
/* ─── Metric cards ─── */

.metric-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.metric-grid.two-up {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.metric-grid.three-col {
  grid-template-columns: repeat(3, 1fr);
}

.metric-grid.two-col {
  grid-template-columns: repeat(2, 1fr);
}

.metric-card {
  padding: 22px;
  border-radius: var(--radius-md);
  background: var(--card);
  border: 1px solid var(--border);
  transition: border-color 200ms, transform 200ms;
  position: relative;
  overflow: hidden;
}

.metric-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.metric-card-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}

.metric-card-value {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.03em;
  line-height: 1;
}

.metric-hint {
  font-size: 12px;
  color: var(--muted);
  margin-top: 8px;
}

.metric-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
  margin-left: 2px;
}

/* Tone variants */
.metric-card.tone-positive,
.metric-card.tone-positive-strong {
  border-left: 3px solid var(--forest);
}

.metric-card.tone-warning {
  border-left: 3px solid var(--terracotta);
}

.metric-card.tone-danger,
.metric-card.tone-danger-strong {
  border-left: 3px solid var(--red);
}

.metric-card.tone-positive .metric-card-value,
.metric-card.tone-positive-strong .metric-card-value {
  color: var(--forest);
}

.metric-card.tone-warning .metric-card-value {
  color: var(--terracotta);
}

.metric-card.tone-danger .metric-card-value,
.metric-card.tone-danger-strong .metric-card-value {
  color: var(--red);
}
```

- [ ] **Step 5: Update tables**

Replace the `.table-wrap` and `.ops-table` classes with:

```css
/* ─── Tables ─── */

.table-wrap {
  overflow-x: auto;
  overflow-y: visible;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-top: 14px;
  background: var(--card);
}

.ops-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}

.ops-table th,
.ops-table td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid rgba(221, 214, 201, 0.5);
  font-size: 14px;
}

.ops-table th {
  background: var(--card-alt);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}

.ops-table tbody tr {
  transition: background 150ms ease;
}

.ops-table tbody tr:hover {
  background: var(--card-alt);
}

.ops-table tbody tr:last-child td {
  border-bottom: none;
}

.ops-table td:first-child {
  font-weight: 600;
  color: var(--ink);
}
```

- [ ] **Step 6: Update analytics table, adherence, warnings, floating notices, and remaining classes**

This step updates all remaining component classes in globals.css. For each class group, replace hardcoded colors with the new tokens:

**Analytics table:** Replace all `rgba(12, 73, 44, ...)` with forest-based values, `rgba(229, 199, 90, ...)` with amber-based values, `rgba(229, 146, 64, ...)` with terracotta-based values, `rgba(123, 135, 148, ...)` with warm neutral values. Update `.analytics-next-step` and `.analytics-wayforward-badge` tone classes similarly.

**Key replacements across all remaining classes:**
- `#0c492c` → `var(--forest)`
- `#0F6E56` / `#0b6b67` → `var(--accent)`
- `#7a5a06` / `#8b6a08` / `#8b5e17` → `var(--amber)`
- `rgba(12, 73, 44, ...)` → `rgba(45, 90, 61, ...)`
- `rgba(229, 199, 90, ...)` → `rgba(159, 107, 21, ...)`
- `rgba(229, 146, 64, ...)` → `rgba(194, 112, 62, ...)`
- `rgba(123, 135, 148, ...)` → `rgba(163, 155, 141, ...)`
- `#FFF8ED` → keep (warm warning bg)
- `#FFF2F2` → `var(--red-bg)`
- `#FFF3F3` → `rgba(159, 46, 46, 0.06)`
- `#FFFBEA` → `rgba(212, 160, 23, 0.06)`
- `rgba(133, 79, 11, ...)` → `rgba(159, 107, 21, ...)`
- `rgba(163, 45, 45, ...)` → `rgba(159, 46, 46, ...)`
- `border-radius: 10px` → `border-radius: var(--radius-btn)`
- `border-radius: 14px` → `border-radius: var(--radius-md)`
- `border-radius: 18px` / `16px` / `20px` → `border-radius: var(--radius-lg)`
- `border-radius: 999px` → `border-radius: var(--radius-full)`
- `font-family: var(--font-display)` stays as-is (already token-based)
- `#fffdfa` / `#fffdf9` → `var(--card)`
- `rgba(11, 107, 103, ...)` → `rgba(159, 78, 46, ...)` (accent-based)

**Floating notices:** Update `.floating-notice` to use `var(--radius-md)`, `.tone-error` to use `var(--red-bg)` / `var(--red)`, `.tone-success` to use `var(--green-bg)` / `var(--forest)`.

**Warning note:** Update border to `rgba(159, 107, 21, 0.18)`, text to `var(--amber)`.

**Capture panel:** Update `.capture-panel` background to `var(--bg)`.

**POD section:** Update `.pod-rank-card` border-left to `3px solid var(--forest)`, rank number color to `var(--forest)`.

**Details panel:** Update all `rgba(11, 107, 103, ...)` backgrounds to `rgba(159, 78, 46, ...)`, legend swatch colors to new palette equivalents.

- [ ] **Step 7: Verify page renders with updated classes**

Run: `npm run dev` and check each tab in the browser.

Expected: All sections use the warm mineral palette. Metric cards, tables, badges, and warnings show correct colors. No visual artifacts.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css
git commit -m "feat: update all CSS component classes to Warm Mineral v2 design"
```

---

### Task 4: Restructure UnifiedOpsApp.jsx for sidebar layout

**Files:**
- Modify: `components/UnifiedOpsApp.jsx`

- [ ] **Step 1: Update chart tone constants**

Replace lines 38–40:

```jsx
const CHART_TONE_POSITIVE = "#2d5a3d";
const CHART_TONE_WARNING = "#c2703e";
const CHART_TONE_DANGER = "#9f2e2e";
```

- [ ] **Step 2: Replace the JSX return block with sidebar layout**

Replace the return block (starting at `return (` around line 2200 through line 2358) with the sidebar layout structure:

```jsx
  return (
    <>
      <div className="app-shell">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-name">Fresh Takes</div>
            <div className="sidebar-brand-sub">Pocket FM Content Ops</div>
          </div>

          <div className="sidebar-section-label">Views</div>
          <div className="sidebar-nav">
            {[
              ["overview", "Editorial Funnel"],
              ["pod-wise", "POD Wise"],
              ["planner", "Planner"],
              ["analytics", "Analytics"],
              ["production", "Production"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`sidebar-link${activeView === id ? " active" : ""}`}
                onClick={() => setActiveView(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="sidebar-section-label">More</div>
          <div className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-link${activeView === "details" ? " active" : ""}`}
              onClick={() => setActiveView("details")}
            >
              Details
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-week">
              <strong>Current Week</strong>
            </div>
          </div>
        </nav>

        <main className="ops-main">
          <div className="ops-shell">

            {activeView === "overview" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">This Week's Pipeline</div>
                  <h1 className="page-header-title">Editorial Funnel</h1>
                  <p className="page-header-sub">Scripts moving through review, testing, and production this week</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", userSelect: "none", color: "var(--ink)" }}>
                    <input
                      type="checkbox"
                      checked={includeNewShowsPod}
                      onChange={(e) => setIncludeNewShowsPod(e.target.checked)}
                      style={{ accentColor: "var(--forest)" }}
                    />
                    Include new shows POD
                  </label>
                  <div className="week-toggle-group">
                    {[
                      { id: "last", label: "Last week" },
                      { id: "current", label: "This week" },
                      { id: "next", label: "Next week" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={editorialPeriod === opt.id ? "is-active" : ""}
                        onClick={() => setEditorialPeriod(opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <OverviewContent
                  overviewDataByPeriod={effectiveOverviewDataByPeriod}
                  overviewLoadingByPeriod={effectiveOverviewLoadingByPeriod}
                  overviewErrorByPeriod={effectiveOverviewErrorByPeriod}
                  productionDataByPeriod={productionDataByPeriod}
                  productionLoadingByPeriod={productionLoadingByPeriod}
                  productionErrorByPeriod={productionErrorByPeriod}
                  onShare={copySection}
                  copyingSection={copyingSection}
                  editorialPeriod={editorialPeriod}
                  includeNewShowsPod={includeNewShowsPod}
                  onIncludeNewShowsPodChange={setIncludeNewShowsPod}
                />
              </>
            ) : null}

            {activeView === "pod-wise" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">Team Performance</div>
                  <h1 className="page-header-title">POD Wise</h1>
                  <p className="page-header-sub">Conversion rates and output by POD lead</p>
                </div>
                <PodWiseContent
                  competitionPodRows={competitionData?.podRows}
                  competitionLoading={competitionLoading}
                  onShare={copySection}
                  copyingSection={copyingSection}
                />
              </>
            ) : null}

            {activeView === "planner" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">Weekly Planning</div>
                  <h1 className="page-header-title">Planner</h1>
                  <p className="page-header-sub">Beat assignments and stage tracking across PODs</p>
                </div>
                <PlannerErrorBoundary>
                  <GanttTracker onPlannerSnapshotChange={setPlannerBoardSnapshot} />
                </PlannerErrorBoundary>
              </>
            ) : null}

            {activeView === "analytics" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">Script Performance</div>
                  <h1 className="page-header-title">Analytics</h1>
                  <p className="page-header-sub">{analyticsSubtitle || "Week-on-week script test results from the Live tab."}</p>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="toolbar-select">
                    <span>Week</span>
                    <select
                      value={selectedAnalyticsWeekKey}
                      onChange={(event) => setSelectedAnalyticsWeekKey(event.target.value)}
                      disabled={analyticsLoading && !analyticsData}
                    >
                      {(Array.isArray(analyticsData?.weekOptions) ? analyticsData.weekOptions : []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <AnalyticsContent
                  analyticsData={analyticsData}
                  analyticsLoading={analyticsLoading}
                  analyticsError={analyticsError}
                  onShare={copySection}
                  copyingSection={copyingSection}
                  onToggleActioned={updateAnalyticsActioned}
                  actionedBusyKey={analyticsActionedBusyKey}
                />
              </>
            ) : null}

            {activeView === "production" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">Output Tracking</div>
                  <h1 className="page-header-title">Production</h1>
                  <p className="page-header-sub">{productionSubtitle || "ACD metrics and production output."}</p>
                </div>
                <ProductionContent
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                  acdMetricsError={acdMetricsError}
                  acdTimeView={acdTimeView}
                  onTimeViewChange={setAcdTimeView}
                  acdViewType={acdViewType}
                  onViewTypeChange={setAcdViewType}
                  onRunSync={runAcdSync}
                  busyAction={busyAction}
                  onShare={copySection}
                  copyingSection={copyingSection}
                />
              </>
            ) : null}

            {activeView === "details" ? (
              <>
                <div className="page-header">
                  <div className="page-header-kicker">Configuration</div>
                  <h1 className="page-header-title">Details</h1>
                  <p className="page-header-sub">Tracked teams, sync scope, and Analytics next-step logic.</p>
                </div>
                <DetailsContent
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                  acdMetricsError={acdMetricsError}
                  analyticsData={analyticsData}
                />
              </>
            ) : null}

          </div>
        </main>
      </div>

      <Notice notice={notice} />
    </>
  );
```

- [ ] **Step 3: Update remaining inline styles in UnifiedOpsApp.jsx**

Search for any remaining hardcoded colors in inline styles:
- `accentColor: "#0F6E56"` → `accentColor: "var(--forest)"`
- Any `#0b6b67` → `var(--accent)`
- Any `color: "var(--teal)"` is fine (--teal now aliases --accent)

- [ ] **Step 4: Verify sidebar layout and all views**

Run: `npm run dev` and click through every sidebar link.

Expected: Dark sidebar on the left, page header with Fraunces title on each view, content renders correctly. Week toggles work. Planner loads.

- [ ] **Step 5: Commit**

```bash
git add components/UnifiedOpsApp.jsx
git commit -m "feat: restructure to sidebar layout with page headers per view"
```

---

### Task 5: Re-skin GanttTracker.jsx inline styles

**Files:**
- Modify: `components/GanttTracker.jsx`

This is the critical task. Every inline style must be converted to CSS variable tokens.

- [ ] **Step 1: Update font constants at the top of the file**

Replace lines 27–30:

```jsx
const BODY_FONT = "var(--font-body)";
const DISPLAY_FONT = "var(--font-display)";
const MONO_FONT = "var(--font-display)";
```

Note: `MONO_FONT` now uses display font (Fraunces) for metric values instead of monospace.

- [ ] **Step 2: Update Toast component (lines ~143–175)**

Replace the palette object and styles:

```jsx
function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  const palette =
    toast.tone === "success"
      ? { background: "var(--green-bg)", border: "var(--forest)", color: "var(--forest)" }
      : { background: "var(--red-bg)", border: "var(--red)", color: "var(--red)" };

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 1200,
        minWidth: 260,
        maxWidth: 360,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {toast.text}
    </div>
  );
}
```

- [ ] **Step 3: Update StatusBanner component (lines ~177–194)**

```jsx
function StatusBanner({ children }) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--red-bg)",
        color: "var(--red)",
        border: "1px solid rgba(159, 46, 46, 0.2)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Update SummaryChips component (lines ~196–241)**

Replace the chip colors and styles:

```jsx
function SummaryChips({ summary, notStarted, totalBeats }) {
  const safeSummary = summary && typeof summary === "object" ? summary : EMPTY_STAGE_SUMMARY;
  const beats = Number(totalBeats || 0);
  const production = Number(safeSummary.production || 0) + Number(safeSummary.live_on_meta || 0);
  const live = Number(safeSummary.live_on_meta || 0);
  const ooo = Number(safeSummary.writer_ooo || 0);

  const chips = [
    { value: beats, label: "Beats this week", color: "var(--navy)" },
    { value: production, label: "Expected in Production", color: "var(--forest)" },
    { value: live, label: "Expected Live", color: "var(--forest)" },
    { value: ooo, label: "Writer OOO", color: "var(--terracotta)" },
  ];

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {chips.map((chip) => (
        <div
          key={chip.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: "var(--card)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 20px rgba(20, 28, 30, 0.05)",
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: MONO_FONT,
              color: chip.color,
            }}
          >
            {chip.value}
          </span>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>{chip.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Update BeatDocPicker inline styles**

In the BeatDocPicker component (around line ~417–560), replace:
- `color: "#0b6b67"` → `color: "var(--accent)"`
- `color: "#0f172a"` → `color: "var(--ink)"`
- `color: "#94a3b8"` → `color: "var(--muted)"`

- [ ] **Step 6: Update all style constants at the bottom of the file (lines ~2928–3055)**

Replace the entire block of style constants:

```jsx
const navBtn = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  width: 34,
  height: 34,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const hdrCell = {
  padding: "10px 10px",
  fontSize: 10,
  fontFamily: BODY_FONT,
  fontWeight: 600,
  color: "var(--muted)",
  background: "var(--card-alt)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "flex",
  alignItems: "center",
  borderRight: "1px solid var(--border)",
};

const inputStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  fontSize: 11,
  fontFamily: BODY_FONT,
  color: "var(--ink)",
  outline: "none",
  padding: "2px 0",
};

const textStyle = {
  width: "100%",
  fontSize: 11,
  fontFamily: BODY_FONT,
  color: "var(--ink)",
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subtleTextStyle = {
  width: "100%",
  fontSize: 10,
  fontFamily: BODY_FONT,
  color: "var(--muted)",
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const beatFieldButtonStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  background: "var(--card)",
  borderRadius: "var(--radius-sm)",
  padding: "5px 8px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  minHeight: 28,
};

const clearFieldBtnStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 18,
  height: 18,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
};

const tinyBtn = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  width: 16,
  height: 16,
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
};

const pickerMessageStyle = {
  padding: "16px 12px",
  fontSize: 11,
  color: "var(--muted)",
  textAlign: "center",
};

const pickerOptionStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "9px 12px",
  border: "none",
  borderBottom: "1px solid var(--card-alt)",
  background: "transparent",
  cursor: "pointer",
  fontFamily: BODY_FONT,
};
```

- [ ] **Step 7: Sweep remaining inline styles in GanttTracker.jsx**

Search and replace all remaining hardcoded values throughout the file. Key patterns:

- `"#64748b"` → `"var(--muted)"`
- `"#94a3b8"` → `"var(--muted)"`
- `"#1e293b"` → `"var(--ink)"`
- `"#475569"` → `"var(--ink-secondary)"`
- `"#e2e8f0"` → `"var(--border)"`
- `"#f8fafc"` → `"var(--card-alt)"`
- `"#fff"` (in style objects, not stage colors) → `"var(--card)"`
- `"var(--bg-surface, #F5F5F5)"` → `"var(--surface)"`
- `"var(--panel, #fff)"` → `"var(--card)"`
- `"var(--line, #E0E0E0)"` → `"var(--border)"`
- `"var(--ink, #111)"` → `"var(--ink)"`
- `"var(--subtle, #999)"` → `"var(--muted)"`
- `"var(--bg-deep, #FAFAFA)"` → `"var(--bg)"`
- `borderRadius: 12` → `borderRadius: "var(--radius-md)"`
- `borderRadius: 10` → `borderRadius: "var(--radius-md)"`
- `borderRadius: 8` → `borderRadius: "var(--radius-sm)"`
- `borderRadius: 7` → `borderRadius: "var(--radius-sm)"`

**Do NOT change:**
- Stage colors (`stage.color`, `stage.bg`, `stage.text`) — these are data-driven
- Colors inside `STAGE_MAP` references
- The `StageBar` component's `borderRadius: 0`
- Pod `color` property usage

**Stage brush palette** (around line ~2800): Update the divider from `"#e2e8f0"` to `"var(--border)"`. Update eraser active colors: `"#ef4444"` → `"var(--red)"`, `"#fee2e2"` → `"var(--red-bg)"`, `"#991b1b"` → `"var(--red)"`.

**Footer status text** (around line ~2888): Change `color: "#94a3b8"` to `color: "var(--muted)"`, and `fontSize: 10` to `fontSize: 11`.

- [ ] **Step 8: Run verification grep**

Run these commands to check for remaining hardcoded values:

```bash
cd /Users/yadhu.gopal/Documents/old-mac-backup/yadhugopalg/Desktop/Codex/fresh-take-gantt
# Find remaining hex colors (should only be stage/data colors)
grep -n '"#[0-9a-fA-F]' components/GanttTracker.jsx | grep -v 'stage\|Stage\|STAGE\|pod\|chip\.\|palette\.'
```

Expected: No results, or only stage-related color references.

- [ ] **Step 9: Verify Planner tab renders correctly**

Run: `npm run dev`, navigate to the Planner tab.

Expected: Gantt grid uses warm mineral colors. Summary chips show forest/navy/terracotta. Stage brush buttons match new palette. Week nav buttons use rounded corners. All text uses DM Sans. Metric values use Fraunces. No visual remnants of old blue/slate colors.

- [ ] **Step 10: Commit**

```bash
git add components/GanttTracker.jsx
git commit -m "feat: re-skin GanttTracker with CSS variable tokens, zero hardcoded colors"
```

---

### Task 6: Final verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full visual walkthrough**

Open every tab (Editorial Funnel, POD Wise, Planner, Analytics, Production, Details) and verify:
- Fonts: Fraunces for headings/values, DM Sans for body
- Colors: Forest/terracotta/navy palette, no blue/teal remnants
- Sidebar: Dark with accent-highlighted active link
- Metric cards: Colored left borders, correct tone values
- Tables: Card-alt headers, proper hover states
- Gantt: All elements use CSS variables, no old slate/blue colors
- Charts: Forest/terracotta bars (not green/amber)
- Toasts/notices: New semantic colors
- Analytics: Row tones use new warm palette

- [ ] **Step 2: Check for build errors**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup after Warm Mineral v2 redesign"
```
