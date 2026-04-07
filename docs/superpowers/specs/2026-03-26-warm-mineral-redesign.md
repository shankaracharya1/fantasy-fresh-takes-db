# Fresh Takes Dashboard — Warm Mineral v2 Redesign

**Date:** 2026-03-26
**Goal:** Complete visual refresh of the Fresh Takes dashboard. New design system, layout, typography, and color palette while preserving all existing data and functionality.
**Audience:** Entire content ops team — must look impressive when shared, not just functional for power users.

---

## 1. Design System Tokens

### Typography

| Token | Value | Usage |
|---|---|---|
| `--font-display` | `Fraunces` (variable, opsz 9–144, wt 400–700) | Headings, metric values, section titles, rank numbers |
| `--font-body` | `DM Sans` (wt 400–700) | Body text, labels, table content, buttons, nav links |

Loaded via `next/font/google` in `layout.jsx`, replacing Outfit + Work Sans.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#f4f0ea` | Page background |
| `--surface` | `#ece7de` | Recessed areas, full-bleed section backgrounds |
| `--card` | `#fffdf9` | Card and panel surfaces |
| `--card-alt` | `#f9f5ee` | Table headers, secondary card surfaces |
| `--border` | `#ddd6c9` | Default borders |
| `--border-strong` | `#c9c0b0` | Hover/emphasized borders |
| `--ink` | `#1c1917` | Primary text |
| `--ink-secondary` | `#44403c` | Secondary text, table body |
| `--muted` | `#a39e93` | Hint text, labels, placeholders |
| `--accent` | `#9f4e2e` | Primary accent (sidebar active, kickers) |
| `--accent-light` | `rgba(159,78,46,0.08)` | Accent tinted backgrounds |
| `--forest` | `#2d5a3d` | Positive/on-track, primary chart color |
| `--forest-light` | `rgba(45,90,61,0.08)` | Positive backgrounds |
| `--terracotta` | `#c2703e` | Warning, secondary chart color |
| `--terracotta-light` | `rgba(194,112,62,0.08)` | Warning backgrounds |
| `--navy` | `#2e3a5c` | Neutral accent, tertiary chart color |
| `--navy-light` | `rgba(46,58,92,0.08)` | Neutral tinted backgrounds |
| `--green` | `#2d5a3d` | Semantic positive (aliases --forest) |
| `--green-bg` | `rgba(45,90,61,0.1)` | Positive badge/status backgrounds |
| `--amber` | `#9f6b15` | Semantic caution/below-target |
| `--amber-bg` | `rgba(159,107,21,0.1)` | Caution badge/status backgrounds |
| `--red` | `#9f2e2e` | Semantic danger/at-risk |
| `--red-bg` | `rgba(159,46,46,0.1)` | Danger badge/status backgrounds |
| `--gold` | `#d4a017` | Low-severity adherence border |

### Spacing & Radius

| Token | Value |
|---|---|
| `--radius-sm` | `8px` |
| `--radius-btn` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-full` | `999px` |

### Shadows

Minimal shadow system:
- **Cards (default):** none
- **Cards (hover):** `0 1px 3px rgba(0,0,0,0.06)` + `translateY(-1px)`
- **Week switcher active:** `0 1px 3px rgba(0,0,0,0.06)`
- **Sidebar:** none (dark background provides contrast)

---

## 2. Layout Structure

### Current → New

| Aspect | Current | New |
|---|---|---|
| Navigation | Horizontal tab bar (pills) | Sticky dark sidebar (240px) |
| Page width | Single column, max 1320px centered | Fluid main area beside sidebar |
| Sections | Stacked white cards with uniform padding | Mix of card grids, full-bleed bands, and standard sections |
| Hero | Top panel with gradient overlay | Page header (kicker + Fraunces title + subtitle) |

### Sidebar (`240px`, sticky, `--ink` background)

```
┌─────────────────────┐
│ Fresh Takes          │  ← Brand block (Fraunces 22px)
│ Pocket FM Content Ops│  ← Subtitle (11px, 40% white)
├─────────────────────┤
│ VIEWS                │  ← Section label (10px uppercase, 30% white)
│ ● Editorial Funnel   │  ← Nav links (14px DM Sans, 55% white)
│ ● POD Wise           │     Active: --accent background, white text
│ ● Planner            │
│ ● Analytics          │
│ ● Production         │
├─────────────────────┤
│ TOOLS                │
│ ● Script Changes     │
│ ● Adherence          │
├─────────────────────┤
│                      │
│ Week 13              │  ← Footer (pinned to bottom)
│ Mar 24 — Mar 30      │
└─────────────────────┘
```

### Main Content Area

- Padding: `36px 40px 64px`
- Page header at top of each view
- Week switcher: segmented pill control (`--surface` background, active tab gets `--card` background + shadow)
- Content sections stack vertically with `32px` gaps

---

## 3. Component Specifications

### 3.1 Metric Cards (Bento Grid)

- **Grid:** 4-column, cards can span 2 columns for charts/breakdowns
- **Card surface:** `--card` background, `1px solid --border`, `--radius-md`
- **Top accent bar:** 3px colored stripe (forest/terracotta/navy/amber) per card category
- **Label:** DM Sans 11px, weight 600, uppercase, `0.06em` letter-spacing, `--muted` color
- **Value:** Fraunces 36px, weight 600, `-0.03em` letter-spacing
- **Value color:** maps to accent (forest for positive, terracotta for warning, etc.) or `--ink` for neutral
- **Delta badge:** pill (`--radius-full`), 12px weight 600, colored background + text (green-bg/green, red-bg/red, surface/muted)
- **Hint:** 12px DM Sans, `--muted`
- **Hover:** `translateY(-1px)`, border → `--border-strong`
- **Wide cards (span-2):** Used for sparkline mini-charts and stage flow breakdowns

### 3.2 Tables

- **Container:** `--radius-md`, `1px solid --border`, `--card` background, overflow hidden
- **Header row:** `--card-alt` background, DM Sans 10px uppercase, weight 600, `0.08em` spacing, `--muted` color, `1px solid --border` bottom
- **Body cells:** 14px DM Sans, `--ink-secondary` color, `14px 18px` padding
- **First column:** weight 600, `--ink` color (POD lead names, identifiers)
- **Row hover:** background → `--card-alt`
- **Row borders:** `1px solid rgba(221,214,201,0.5)` between rows, none on last row
- **Status badges:** pill shape (`--radius-full`), 12px weight 600, dot + text (green/amber/red variants using semantic bg/color tokens)

### 3.3 POD Rank Cards

- **Grid:** 2-column
- **Card:** `--card` background, `1px solid --border`, `--radius-md`
- **Left border:** 4px solid `--forest`
- **Layout:** `grid-template-columns: 56px 1fr`, 20px padding
- **Rank number:** Fraunces 28px, weight 700, `--forest` color
- **Rank label:** 9px uppercase, weight 600, `--muted`
- **Name:** DM Sans 15px, weight 600, `--ink`
- **Stat line:** 13px, `--muted`, strong elements in `--ink-secondary`
- **Hover:** same as metric cards

### 3.4 Buttons

| Variant | Background | Border | Text | Hover |
|---|---|---|---|---|
| Ghost | `--card` | `1px solid --border` | `--ink-secondary` | border → `--border-strong`, bg → `--card-alt` |
| Week switcher (inactive) | transparent | none | `--muted` | text → `--ink-secondary` |
| Week switcher (active) | `--card` | none | `--ink` | — |
| Sidebar link (inactive) | transparent | none | 55% white | bg → 6% white, text → 85% white |
| Sidebar link (active) | `--accent` | none | white | — |

All buttons: `--radius-btn` (10px), DM Sans, weight 500, 13px.

### 3.5 Charts (Recharts)

- **Bar colors:** `--forest` (positive), `--terracotta` (warning), `--navy` (neutral)
- **Bar top radius:** 3px
- **Tooltip:** `--card` background, `1px solid --border`, `--radius-md`, 14px padding
- **Grid lines:** `--border` color
- **Axis text:** DM Sans 10px, `--muted`
- **Constants to update in UnifiedOpsApp.jsx:**
  - `CHART_TONE_POSITIVE` → `#2d5a3d`
  - `CHART_TONE_WARNING` → `#c2703e`
  - `CHART_TONE_DANGER` → `#9f2e2e`

### 3.6 Full-Bleed Sections

- Break out of main content padding: `margin: 0 -40px; padding: 32px 40px`
- Background: `--surface`
- Top + bottom: `1px solid --border`
- Used for: POD rankings, summary grids, any section needing visual rhythm break

### 3.7 Floating Notices / Toasts

- `--radius-md`, `1px solid --border`, `--card` background
- Success: `--green-bg` background, `--green` text, border `rgba(45,90,61,0.2)`
- Error: `--red-bg` background, `--red` text, border `rgba(159,46,46,0.2)`
- Slide-up animation preserved

### 3.8 Analytics-Specific

- Row tone backgrounds updated to new palette:
  - Gen AI: `rgba(45,90,61,0.18)` (forest-tinted)
  - Rework P1: `rgba(159,107,21,0.16)` (amber-tinted)
  - Rework P2: `rgba(194,112,62,0.12)` (terracotta-tinted)
  - Testing/Drop: `rgba(163,155,141,0.08)` (warm neutral)
- Metric miss highlight: `rgba(159,107,21,0.28)`
- Next-step badges, way-forward badges: use new semantic tone tokens
- Legend chips: `--card` background, `--border`, DM Sans 13px
- Asset links: `--accent` color with underline offset

### 3.9 Adherence

- Severity pills: same pill treatment, using `--red`/`--amber` + light bg variants
- Row left-border accents: 3px solid `--red`/`--amber`/`#d4a017` (low — add as `--gold` token: `#d4a017`)
- Asset links: `--accent` color

### 3.10 Warning Notes

- `--radius-md`, border `rgba(159,107,21,0.18)`
- Background: `#fff8ed` (kept warm)
- Text: `--amber`

### 3.11 Capture/Share Panels

- Same off-screen rendering approach
- Updated to use `--bg` background so screenshots match new design

---

## 4. GanttTracker.jsx — Full Re-skin

This is the highest-risk, highest-effort piece. The component has **3,056 lines** and **113 inline style blocks** with hardcoded values. Every single one must be converted.

### 4.1 Token Mapping for Inline Styles

| Hardcoded value | New token |
|---|---|
| `#64748b` (slate-500) | `var(--muted)` |
| `#94a3b8` (slate-400) | `var(--muted)` |
| `#1e293b` (slate-800) | `var(--ink)` |
| `#475569` (slate-600) | `var(--ink-secondary)` |
| `#e2e8f0` (slate-200) | `var(--border)` |
| `#f8fafc` (slate-50) | `var(--card-alt)` |
| `#fff` / `#ffffff` | `var(--card)` |
| `"var(--bg-surface, #F5F5F5)"` | `var(--surface)` |
| `"var(--panel, #fff)"` | `var(--card)` |
| `"var(--line, #E0E0E0)"` | `var(--border)` |
| `"var(--ink, #111)"` | `var(--ink)` |
| `"var(--subtle, #999)"` | `var(--muted)` |
| `"var(--bg-deep, #FAFAFA)"` | `var(--bg)` |

| Hardcoded radius | New token |
|---|---|
| `borderRadius: 12` | `var(--radius-md)` (14) |
| `borderRadius: 10` | `var(--radius-md)` (14) |
| `borderRadius: 8` | `var(--radius-sm)` (8) |
| `borderRadius: 7` | `var(--radius-sm)` (8) |
| `borderRadius: 6` | `var(--radius-sm)` (8) |
| `borderRadius: 4` | `4px` (keep for tiny buttons) |
| `borderRadius: 0` (nav buttons) | `var(--radius-sm)` (8) |

| Hardcoded font | New token |
|---|---|
| `BODY_FONT` (`"var(--font-body), sans-serif"`) | `var(--font-body)` |
| `DISPLAY_FONT` (`"var(--font-display), sans-serif"`) | `var(--font-display)` |
| `MONO_FONT` (monospace stack) | Keep for data cells, but consider `var(--font-display)` for metric values |

### 4.2 Specific Component Restyling

**Summary Chips** (line ~196–241)
- Background: `var(--card)` → matches metric card treatment
- Border: `var(--border)`
- Border-radius: `var(--radius-md)`
- Value font: `var(--font-display)`, weight 700
- Label color: `var(--muted)`
- Chip colors: map `#1e40af` → `var(--navy)`, production/live → `var(--forest)`, OOO → `var(--terracotta)`

**Stage Brush Palette** (line ~2800–2850)
- Button background (inactive): `var(--surface)`
- Button background (active): uses existing `stage.bg` — keep, but update border to 2px solid stage color
- Border-radius: `var(--radius-sm)`
- Font: `var(--font-body)`
- Divider: `var(--border)` instead of `#e2e8f0`
- Eraser button: active border `var(--red)`, background `var(--red-bg)`, color `var(--red)`

**Grid Header Cells** (`hdrCell` constant, line ~2943)
- Background: `var(--card-alt)`
- Font: `var(--font-body)`
- Color: `var(--muted)`
- Border-right: `1px solid var(--border)`

**Nav Buttons** (`navBtn` constant, line ~2928)
- Background: `var(--bg)`
- Border: `1px solid var(--border)`
- Color: `var(--ink)`
- Border-radius: `var(--radius-sm)`

**Input & Text Styles** (lines ~2957–2988)
- `inputStyle`: font → `var(--font-body)`, color → `var(--ink)`
- `textStyle`: font → `var(--font-body)`, color → `var(--ink)`
- `subtleTextStyle`: font → `var(--font-body)`, color → `var(--muted)`

**Beat Field / Picker** (lines ~2990–3055)
- `beatFieldButtonStyle`: border → `var(--border)`, background → `var(--card)`, radius → `var(--radius-sm)`
- `clearFieldBtnStyle`: background → `var(--card)`, border → `var(--border)`
- `tinyBtn`: background → `var(--card)`, border → `var(--border)`, color → `var(--muted)`
- `pickerMessageStyle`: color → `var(--muted)`
- `pickerOptionStyle`: font → `var(--font-body)`, border-bottom → `var(--card-alt)`

**Toast** (line ~143–175)
- Success: background `var(--green-bg)`, border `var(--forest)`, color `var(--forest)`
- Error: background `var(--red-bg)`, border `var(--red)`, color `var(--red)`
- Border-radius: `var(--radius-md)`

**StatusBanner** (line ~177–194)
- Background: `var(--red-bg)`
- Color: `var(--red)`
- Border: `1px solid rgba(159,46,46,0.2)`
- Border-radius: `var(--radius-md)`

**StageBar** (line ~97–141)
- Keep existing `stage.color` for fills (these are data-driven)
- Border-radius: keep at 0 for continuous Gantt bars
- Font-size label: keep at 8px

**Status text / footer** (line ~2888)
- Font-size: 10px → `11px`
- Color: `var(--muted)`

### 4.3 Verification Checklist

After conversion, grep GanttTracker.jsx for:
- Any remaining `#` hex color that isn't inside a stage/data constant
- Any `borderRadius:` not using a `var(--radius-*)` token (except StageBar and tiny 4px cases)
- Any `fontFamily:` not using `var(--font-body)` or `var(--font-display)`
- Any hardcoded `fontSize` — verify each is intentional

---

## 5. File-by-File Change Summary

| File | Lines | Change Type | Effort |
|---|---|---|---|
| `app/layout.jsx` | 30 | Swap fonts (Fraunces + DM Sans via next/font/google) | Low |
| `app/globals.css` | ~1600 | Rewrite `:root` variables, update all component classes | High |
| `components/UnifiedOpsApp.jsx` | 2359 | Update 26 inline styles, chart constants, restructure to sidebar layout | Medium |
| `components/GanttTracker.jsx` | 3056 | Replace all 113 inline style blocks with CSS variable tokens | High |

### Files NOT changed
- `app/page.jsx` — just renders `<UnifiedOpsApp />`, no changes needed
- `lib/*` — data logic, no visual code
- `api/*` — backend, no visual code
- `app/pod-lead-script-changes/*` — separate page, out of scope unless requested

---

## 6. Constraints

- **No functionality changes.** All data fetching, state management, calculations, and interactions remain identical.
- **No new dependencies.** Fraunces and DM Sans are loaded via the existing `next/font/google` mechanism.
- **No layout changes to the Gantt grid itself.** The 7-day column structure, stage painting, beat picker, and roster manager keep their current layout. Only the skin changes.
- **Responsive behavior:** Sidebar collapses or overlays on narrow viewports (implementation detail for plan phase).
