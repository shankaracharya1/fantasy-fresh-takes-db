import { NextResponse } from "next/server";
import { fetchAnalyticsLiveTabRows, isTatEligibleProductionType } from "../../../../lib/live-tab.js";
import { generateWeekKeysSince } from "../../../../lib/tracker-data.js";
import { shiftYmd, formatWeekRangeLabel } from "../../../../lib/week-view.js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const LIFETIME_SINCE = "2026-03-16";

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Merge partial names into full names: "Aakash" → "Aakash Ahuja", "Berman" → "Jacob Berman"
function buildPodNameCanonicalMap(rawNames) {
  const unique = [...new Set(rawNames.filter(Boolean))];
  // Sort: longer names (more words) first so they become canonical
  unique.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || a.localeCompare(b));
  const canonicals = [];
  const map = new Map();
  for (const name of unique) {
    const parts = name.toLowerCase().split(/\s+/);
    const parent = canonicals.find((c) => {
      const cp = c.toLowerCase().split(/\s+/);
      return cp.length > parts.length && parts.every((p) => cp.includes(p));
    });
    if (parent) {
      map.set(name, parent);
    } else {
      map.set(name, name);
      canonicals.push(name);
    }
  }
  return map;
}

// Reuse same hit-rate classification logic as competition route
function classifyRows(analyticsRows, weekStart, weekEnd, podNameMap) {
  const resolvePod = (raw) => {
    const name = String(raw || "").trim();
    return podNameMap.get(name) || name;
  };

  const validRows = (Array.isArray(analyticsRows) ? analyticsRows : []).filter((row) => {
    const liveDate = String(row?.liveDate || "").trim();
    if (!liveDate || liveDate < weekStart || liveDate > weekEnd) return false;
    if (!isTatEligibleProductionType(row?.productionType)) return false;
    const assetCode = String(row?.assetCode || "").trim();
    return Boolean(assetCode);
  });

  // Dedupe per pod+assetCode — keep best row
  const podAssetMap = new Map();
  for (const row of validRows) {
    const podName = resolvePod(row?.podLeadName);
    if (!podName) continue;
    const key = `${podName}|${String(row?.assetCode || "").trim().toLowerCase()}`;
    if (!podAssetMap.has(key)) {
      podAssetMap.set(key, { row, podName });
    } else {
      const existing = podAssetMap.get(key);
      const next = Number(row?.metricsCompletenessScore || 0);
      const prev = Number(existing.row?.metricsCompletenessScore || 0);
      if (next > prev || (next === prev && Number(row?.amountSpentUsd || 0) > Number(existing.row?.amountSpentUsd || 0))) {
        podAssetMap.set(key, { row, podName });
      }
    }
  }

  const podStats = new Map();
  for (const { row, podName } of podAssetMap.values()) {
    if (!podName) continue;
    if (!podStats.has(podName)) podStats.set(podName, { totalLive: 0, hits: 0 });
    const stats = podStats.get(podName);
    stats.totalLive += 1;
    const amountSpent = toFiniteNumber(row?.amountSpentUsd);
    if (!Number.isFinite(amountSpent) || amountSpent < 100) continue;
    const cpiValue = toFiniteNumber(row?.cpiUsd);
    const ctiValue = toFiniteNumber(row?.clickToInstall);
    const cpiPass = Number.isFinite(cpiValue) && cpiValue < 10;
    if (cpiPass) { stats.hits += 1; }
    else if (Number.isFinite(ctiValue) && ctiValue >= 12) { stats.hits += 1; }
  }
  return podStats;
}

export async function GET() {
  try {
    const { rows: analyticsRows } = await fetchAnalyticsLiveTabRows();

    // Build canonical pod name map (merges partials: "Aakash" → "Aakash Ahuja")
    const rawPodNames = (Array.isArray(analyticsRows) ? analyticsRows : [])
      .map((r) => String(r?.podLeadName || "").trim())
      .filter(Boolean);
    const podNameMap = buildPodNameCanonicalMap(rawPodNames);

    const weekKeys = generateWeekKeysSince(LIFETIME_SINCE);

    // Collect canonical pod names
    const allPodNames = new Set(rawPodNames.map((n) => podNameMap.get(n) || n));

    // Build weekly data points
    const weeks = weekKeys.map((weekKey) => {
      const weekEnd = shiftYmd(weekKey, 6);
      const podStats = classifyRows(analyticsRows, weekKey, weekEnd, podNameMap);
      const pods = {};
      for (const podName of allPodNames) {
        const stats = podStats.get(podName);
        if (stats && stats.totalLive > 0) {
          pods[podName] = {
            hitRate: Math.round((stats.hits / stats.totalLive) * 100),
            totalLive: stats.totalLive,
            hits: stats.hits,
          };
        }
      }
      return {
        weekKey,
        weekLabel: formatWeekRangeLabel(weekKey, weekEnd),
        shortLabel: weekKey.slice(5), // "MM-DD"
        pods,
      };
    });

    // Build monthly data — group weeks by YYYY-MM of weekKey
    const monthMap = new Map();
    for (const week of weeks) {
      const monthKey = week.weekKey.slice(0, 7); // "YYYY-MM"
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { weekKey: monthKey, podAccum: new Map() });
      const entry = monthMap.get(monthKey);
      for (const [podName, stats] of Object.entries(week.pods)) {
        if (!entry.podAccum.has(podName)) entry.podAccum.set(podName, { totalLive: 0, hits: 0 });
        const acc = entry.podAccum.get(podName);
        acc.totalLive += stats.totalLive;
        acc.hits += stats.hits;
      }
    }

    const months = Array.from(monthMap.entries()).map(([monthKey, entry]) => {
      const pods = {};
      for (const [podName, acc] of entry.podAccum.entries()) {
        if (acc.totalLive > 0) {
          pods[podName] = {
            hitRate: Math.round((acc.hits / acc.totalLive) * 100),
            totalLive: acc.totalLive,
            hits: acc.hits,
          };
        }
      }
      const [year, month] = monthKey.split("-");
      const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
      return { monthKey, monthLabel, pods };
    });

    // Only include pods that have data in at least one period
    const activePods = [...allPodNames].filter((pod) =>
      weeks.some((w) => pod in w.pods) || months.some((m) => pod in m.pods)
    ).sort();

    return NextResponse.json({ ok: true, weeks, months, podNames: activePods });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message, weeks: [], months: [], podNames: [] });
  }
}
