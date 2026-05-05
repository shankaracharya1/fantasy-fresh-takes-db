import { NextResponse } from "next/server";
import { readJsonObject } from "../../../../lib/storage.js";
import {
  POD_LEAD_ORDER,
  fetchLiveTabRows,
  fetchLiveWorkflowRows,
  fetchAnalyticsLiveTabRows,
  fetchEditorialTabRows,
  fetchProductionTabRows,
  buildLifetimeScriptsPerPod,
  buildLwEditorialOutputPerPod,
  isAnalyticsEligibleProductionType,
  isTatEligibleProductionType,
  normalizePodLeadName,
} from "../../../../lib/live-tab.js";
import {
  buildLifetimeBeatsPerPod,
  buildPodsModel,
  createDefaultWriterConfig,
  generateWeekKeysSince,
  getCurrentWeekKey,
  isNonBauPodLeadName,
  isVisiblePlannerPodLeadName,
  mergeWeekData,
  mergeWriterConfig,
} from "../../../../lib/tracker-data.js";
import { buildDateRangeSelection, formatWeekRangeLabel, getWeekSelection, normalizeWeekView } from "../../../../lib/week-view.js";

const CONFIG_PATH = "config/writer-config.json";
const LIFETIME_SINCE = "2026-03-16";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function makePlannerWeekPath(weekKey) {
  return `weeks/${weekKey}.json`;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMetricCell(value, benchmarkCheck) {
  const numericValue = toFiniteNumber(value);
  return {
    value: numericValue,
    meetsBenchmark: numericValue !== null && Number.isFinite(numericValue) && benchmarkCheck(numericValue),
  };
}

const BASELINE_THRESHOLD_CHECKS = {
  threeSecPlays: (value) => value >= 35,
  thruplaysTo3s: (value) => value >= 40,
  q1Completion: (value) => value > 10,
  cpi: (value) => value < 10,
  absoluteCompletion: (value) => value > 1.5,
  cti: (value) => value >= 12,
  amountSpent: (value) => value > 100,
};

function countBenchmarkMisses(metricMap, keys) {
  return keys.reduce((sum, key) => sum + (metricMap?.[key]?.meetsBenchmark ? 0 : 1), 0);
}

// Same success definition as Detailed POD Overview (isFunnelSuccess in leadership-overview/route.js)
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

// Core hit-rate logic matching Detailed POD Overview:
// - Source: Live tab rows (GA/GI asset codes only), date-filtered by finalUploadDate
// - Metrics: joined from Analytics sheet by assetCode
// - Success: isFunnelSuccess (same as leadership-overview)
function computeHitRatePerPodFromLive(liveWorkflowRows, analyticsRows, sinceDate, untilDate) {
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
    if (!d) return false;
    if (sinceDate && d < sinceDate) return false;
    if (untilDate && d > untilDate) return false;
    return true;
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

function computeHitRatePerPod(liveWorkflowRows, analyticsRows, sinceDate) {
  return computeHitRatePerPodFromLive(liveWorkflowRows, analyticsRows, sinceDate, null);
}

function computeHitRatePerPodForWeek(liveWorkflowRows, analyticsRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");
  if (!weekStart || !weekEnd) return new Map();
  return computeHitRatePerPodFromLive(liveWorkflowRows, analyticsRows, weekStart, weekEnd);
}

// Build per-POD script detail rows for the detail drawer (Show, Angle, Code, CPI, True Comp, CTR, CTI)
function buildPodScriptDetailRows(analyticsRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");

  const byPod = {};
  for (const row of Array.isArray(analyticsRows) ? analyticsRows : []) {
    const liveDate = String(row?.liveDate || "").trim();
    if (!liveDate) continue;
    if (weekStart && liveDate < weekStart) continue;
    if (weekEnd && liveDate > weekEnd) continue;

    const pod = String(row?.podLeadName || "").trim();
    if (!pod) continue;

    if (!byPod[pod]) byPod[pod] = [];
    byPod[pod].push({
      showName: row.showName || "",
      beatName: row.beatName || "",
      assetCode: row.assetCode || "",
      cpi: row.cpiUsd != null ? row.cpiUsd : null,
      trueComp: row.absoluteCompletionPct != null ? row.absoluteCompletionPct : null,
      ctr: row.ctrPct != null ? row.ctrPct : null,
      cti: row.clickToInstall != null ? row.clickToInstall : null,
      liveDate,
    });
  }
  return byPod;
}

function buildScriptsPerPodForWeek(liveRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");
  if (!weekStart || !weekEnd) return new Map();

  const podAssets = new Map();
  for (const row of Array.isArray(liveRows) ? liveRows : []) {
    const liveDate = String(row?.liveDate || "").trim();
    if (!liveDate || liveDate < weekStart || liveDate > weekEnd) continue;

    const podName = String(row?.podLeadName || "").trim();
    if (!podName) continue;
    const assetCode = String(row?.assetCode || "").trim();
    if (!assetCode) continue;

    if (!podAssets.has(podName)) {
      podAssets.set(podName, new Set());
    }
    podAssets.get(podName).add(assetCode);
  }

  const result = new Map();
  for (const [podName, assetSet] of podAssets) {
    result.set(podName, assetSet.size);
  }
  return result;
}

function buildPodRosterMeta(pods) {
  const podOrder = POD_LEAD_ORDER.filter((podLeadName) => isVisiblePlannerPodLeadName(podLeadName));
  const podWriterCounts = Object.fromEntries(podOrder.map((podLeadName) => [podLeadName, 0]));

  for (const pod of Array.isArray(pods) ? pods : []) {
    if (!Object.prototype.hasOwnProperty.call(podWriterCounts, pod?.cl)) continue;
    podWriterCounts[pod.cl] = (Array.isArray(pod?.writers) ? pod.writers : []).filter(
      (writer) => writer?.active !== false
    ).length;
  }

  return { podOrder, podWriterCounts };
}

function filterPodOrderByScope(podOrder, scope = "bau") {
  const safeOrder = Array.isArray(podOrder) ? podOrder : [];
  if (String(scope || "").toLowerCase() === "bau-lt") {
    return safeOrder;
  }
  return safeOrder.filter((podLeadName) => !isNonBauPodLeadName(podLeadName));
}

function buildPodRowsFromMaps(podOrder, rosterMeta, beatsMap, scriptsMap, hitRateMap) {
  // Start with the configured pod order, then append any data-driven pods from the
  // Live tab that aren't already in the list (e.g. Yadhu, or leads added outside the roster)
  const knownNames = new Set(podOrder);
  const extraPodNames = [...hitRateMap.keys()].filter((name) => !knownNames.has(name)).sort();
  const fullOrder = [...podOrder, ...extraPodNames];

  return fullOrder.map((podLeadName) => {
    const hitStats = hitRateMap.get(podLeadName) || { totalLive: 0, hits: 0 };
    const successfulBeats = Number(hitStats.hits || 0);
    return {
      podLeadName,
      lifetimeBeats: beatsMap.get(podLeadName) || 0,
      lifetimeScripts: scriptsMap.get(podLeadName) || 0,
      hitRateNumerator: successfulBeats,
      hitRateDenominator: hitStats.totalLive,
      hitRate: hitStats.totalLive > 0 ? Number(((successfulBeats / hitStats.totalLive) * 100).toFixed(1)) : null,
      successfulBeats,
      throughputScore: successfulBeats,
      lwEditorialOutput: beatsMap.get(podLeadName) || 0,
      writerCount: Number(rosterMeta.podWriterCounts[podLeadName] || 0),
    };
  });
}

async function loadLifetimeCompetitionData(rosterMeta) {
  const weekKeys = generateWeekKeysSince(LIFETIME_SINCE);
  const lastWeekSelection = getWeekSelection("last");

  const [weekDataEntries, liveResult, liveWorkflowResult, analyticsResult, editorialResult, productionResult] = await Promise.all([
    Promise.all(
      weekKeys.map(async (key) => {
        try {
          const data = await readJsonObject(makePlannerWeekPath(key));
          return [key, data];
        } catch {
          return [key, null]; // Supabase unavailable — treat week as empty
        }
      })
    ),
    fetchLiveTabRows(),
    fetchLiveWorkflowRows(),
    fetchAnalyticsLiveTabRows(),
    fetchEditorialTabRows(),
    fetchProductionTabRows(),
  ]);

  const weekDataMap = Object.fromEntries(weekDataEntries.filter(([, data]) => data !== null));
  const lifetimeBeatsMap = buildLifetimeBeatsPerPod(weekDataMap);
  const lifetimeScriptsMap = buildLifetimeScriptsPerPod(liveResult.rows, LIFETIME_SINCE);
  const hitRateMap = computeHitRatePerPod(liveWorkflowResult.rows, analyticsResult.rows, LIFETIME_SINCE);
  const lwEditorialMap = buildLwEditorialOutputPerPod(editorialResult.rows, productionResult.rows, lastWeekSelection);

  return buildPodRowsFromMaps(rosterMeta.podOrder, rosterMeta, lifetimeBeatsMap, lifetimeScriptsMap, hitRateMap).map((row) => ({
    ...row,
    lwEditorialOutput: lwEditorialMap.get(row.podLeadName) || 0,
  }));
}

async function loadWeeklyCompetitionData(rosterMeta, period) {
  const weekSelection = getWeekSelection(period);
  const [liveResult, liveWorkflowResult, analyticsResult, editorialResult, productionResult] = await Promise.all([
    fetchLiveTabRows(),
    fetchLiveWorkflowRows(),
    fetchAnalyticsLiveTabRows(),
    fetchEditorialTabRows(),
    fetchProductionTabRows(),
  ]);

  const scriptsMap = buildScriptsPerPodForWeek(liveResult.rows, weekSelection);
  const hitRateMap = computeHitRatePerPodForWeek(liveWorkflowResult.rows, analyticsResult.rows, weekSelection);
  const beatsMap = buildLwEditorialOutputPerPod(editorialResult.rows, productionResult.rows, weekSelection);

  const podRows = buildPodRowsFromMaps(rosterMeta.podOrder, rosterMeta, beatsMap, scriptsMap, hitRateMap).map((row) => ({
    ...row,
    lwEditorialOutput: beatsMap.get(row.podLeadName) || 0,
  }));

  return {
    podRows,
    period,
    weekKey: weekSelection.weekKey,
    weekLabel: formatWeekRangeLabel(weekSelection.weekStart, weekSelection.weekEnd),
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const rawPeriod = String(url.searchParams.get("period") || "").trim().toLowerCase();
  const mode = String(url.searchParams.get("mode") || "").trim().toLowerCase();
  const scope = String(url.searchParams.get("scope") || "bau").trim().toLowerCase();
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const hasPeriodFilter = rawPeriod === "last" || rawPeriod === "current" || rawPeriod === "next";
  const hasDateRangeFilter = Boolean(startDate || endDate);
  const period = normalizeWeekView(rawPeriod || "current");

  try {
    // Supabase (planner config + week data) is optional — fall back to defaults if unavailable
    let storedConfig = null;
    let storedWeek = null;
    const currentWeekKey = getCurrentWeekKey();
    try {
      [storedConfig, storedWeek] = await Promise.all([
        readJsonObject(CONFIG_PATH),
        readJsonObject(makePlannerWeekPath(currentWeekKey)),
      ]);
    } catch {
      // Supabase unavailable — roster uses POD_LEAD_ORDER defaults, no planner week data
    }
    const currentConfig = mergeWriterConfig(storedConfig || createDefaultWriterConfig());
    const weekData = mergeWeekData(currentConfig, storedWeek, currentWeekKey);
    const pods = buildPodsModel(currentConfig, weekData).filter((pod) => isVisiblePlannerPodLeadName(pod?.cl));
    const rosterMeta = buildPodRosterMeta(pods);
    const scopedPodOrder = filterPodOrderByScope(rosterMeta.podOrder, scope);
    const scopedRosterMeta = { ...rosterMeta, podOrder: scopedPodOrder };

    if (mode === "lifetime") {
      const podRows = await loadLifetimeCompetitionData(scopedRosterMeta);
      return NextResponse.json({
        ok: true,
        podRows,
        period: "lifetime",
        weekKey: LIFETIME_SINCE,
        weekLabel: `Lifetime (${LIFETIME_SINCE}+)`,
        selectionMode: "lifetime",
        scope,
      });
    }

    if (hasPeriodFilter || hasDateRangeFilter) {
      const selection = hasDateRangeFilter ? buildDateRangeSelection({ startDate, endDate, period }) : null;
      const weekly = await loadWeeklyCompetitionData(scopedRosterMeta, hasDateRangeFilter ? selection.period : period);
      const effectiveWeekSelection = hasDateRangeFilter ? selection : getWeekSelection(weekly.period);
      const [liveResult, liveWorkflowResult, analyticsResult, editorialResult, productionResult] = await Promise.all([
        fetchLiveTabRows(),
        fetchLiveWorkflowRows(),
        fetchAnalyticsLiveTabRows(),
        fetchEditorialTabRows(),
        fetchProductionTabRows(),
      ]);
      const scriptsMap = buildScriptsPerPodForWeek(liveResult.rows, effectiveWeekSelection);
      const hitRateMap = computeHitRatePerPodForWeek(liveWorkflowResult.rows, analyticsResult.rows, effectiveWeekSelection);
      const beatsMap = buildLwEditorialOutputPerPod(editorialResult.rows, productionResult.rows, effectiveWeekSelection);
      const podRows = buildPodRowsFromMaps(scopedPodOrder, scopedRosterMeta, beatsMap, scriptsMap, hitRateMap).map((row) => ({
        ...row,
        lwEditorialOutput: beatsMap.get(row.podLeadName) || 0,
      }));
      const scriptRowsByPod = buildPodScriptDetailRows(analyticsResult.rows, effectiveWeekSelection);

      return NextResponse.json({
        ok: true,
        podRows,
        scriptRowsByPod,
        period: hasDateRangeFilter ? "range" : weekly.period,
        weekKey: effectiveWeekSelection.weekKey,
        weekLabel: formatWeekRangeLabel(effectiveWeekSelection.weekStart, effectiveWeekSelection.weekEnd),
        selectionMode: hasDateRangeFilter ? "date-range" : "week",
        scope,
      });
    }

    const podRows = await loadLifetimeCompetitionData(scopedRosterMeta);

    return NextResponse.json({ ok: true, podRows, selectionMode: "lifetime", scope });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      error: error.message || "Unable to load competition data.",
      podRows: [],
      selectionMode: "lifetime",
      weekKey: "",
      weekLabel: "",
      scope,
    });
  }
}
