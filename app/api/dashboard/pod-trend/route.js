import { NextResponse } from "next/server";
import { fetchAnalyticsLiveTabRows, fetchLiveWorkflowRows, normalizePodLeadName } from "../../../../lib/live-tab.js";
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

// Same success definition as Detailed POD Overview
function isFunnelSuccess(row) {
  const amountSpent = toFiniteNumber(row?.amountSpentUsd);
  const q1Completion = toFiniteNumber(row?.video0To25Pct);
  const cti = toFiniteNumber(row?.clickToInstall);
  const absoluteCompletion = toFiniteNumber(row?.absoluteCompletionPct);
  const cpi = toFiniteNumber(row?.cpiUsd);
  const passesAllThresholds = (
    Number.isFinite(amountSpent) && amountSpent >= 100 &&
    Number.isFinite(q1Completion) && q1Completion > 10 &&
    Number.isFinite(cti) && cti >= 12 &&
    Number.isFinite(absoluteCompletion) && absoluteCompletion >= 1.8 &&
    Number.isFinite(cpi) && cpi <= 12
  );
  const passesCpiOnly = Number.isFinite(cpi) && cpi < 6;
  return passesAllThresholds || passesCpiOnly;
}

// Matches Detailed POD Overview: Live tab rows (GA/GI), date by finalUploadDate, metrics from Analytics
function classifyRows(liveWorkflowRows, analyticsRows, weekStart, weekEnd) {
  const analyticsMap = new Map();
  for (const row of (Array.isArray(analyticsRows) ? analyticsRows : [])) {
    const code = String(row?.assetCode || "").trim().toUpperCase();
    if (code && !analyticsMap.has(code)) analyticsMap.set(code, row);
  }

  const seenCodes = new Set();
  const validRows = (Array.isArray(liveWorkflowRows) ? liveWorkflowRows : []).filter((row) => {
    const code = String(row?.assetCode || "").trim().toUpperCase();
    if (!code.startsWith("GA") && !code.startsWith("GI")) return false;
    if (seenCodes.has(code)) return false;
    seenCodes.add(code);
    const d = String(row?.finalUploadDate || "").slice(0, 10);
    return d && d >= weekStart && d <= weekEnd;
  });

  const podStats = new Map();
  for (const row of validRows) {
    const podName = normalizePodLeadName(String(row?.podLeadName || "").trim());
    if (!podName) continue;
    if (!podStats.has(podName)) podStats.set(podName, { totalLive: 0, hits: 0 });
    const stats = podStats.get(podName);
    stats.totalLive += 1;
    const code = String(row?.assetCode || "").trim().toUpperCase();
    const aRow = analyticsMap.get(code);
    if (aRow && isFunnelSuccess(aRow)) stats.hits += 1;
  }
  return podStats;
}

export async function GET() {
  try {
    const [{ rows: liveWorkflowRows }, { rows: analyticsRows }] = await Promise.all([
      fetchLiveWorkflowRows(),
      fetchAnalyticsLiveTabRows(),
    ]);

    const weekKeys = generateWeekKeysSince(LIFETIME_SINCE);

    // Collect all POD names from Live tab rows (normalized)
    const allPodNames = new Set(
      (Array.isArray(liveWorkflowRows) ? liveWorkflowRows : [])
        .map((r) => normalizePodLeadName(String(r?.podLeadName || "").trim()))
        .filter(Boolean)
    );

    // Build weekly data points
    const weeks = weekKeys.map((weekKey) => {
      const weekEnd = shiftYmd(weekKey, 6);
      const podStats = classifyRows(liveWorkflowRows, analyticsRows, weekKey, weekEnd);
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
