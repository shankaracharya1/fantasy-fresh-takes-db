import { NextResponse } from "next/server";
import { readJsonObject, writeJsonObject } from "../../../../lib/storage.js";
import { readInMemResponseCache, writeInMemResponseCache } from "../../../../lib/response-cache.js";
import {
  POD_LEAD_ORDER,
  fetchLiveTabRows,
  fetchLiveWorkflowRows,
  fetchEditorialTabRows,
  fetchProductionTabRows,
  buildLifetimeScriptsPerPod,
  buildLwEditorialOutputPerPod,
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
const RESPONSE_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const INVALIDATION_TOKEN_PATH = "response-cache/__invalidated-at.json";
let _invalidationTs = 0;
let _invalidationCheckedAt = 0;
const INVALIDATION_MEMORY_TTL = 60 * 1000;

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function makePlannerWeekPath(weekKey) {
  return `weeks/${weekKey}.json`;
}

async function getInvalidationTs() {
  if (Date.now() - _invalidationCheckedAt < INVALIDATION_MEMORY_TTL) return _invalidationTs;
  try {
    const d = await readJsonObject(INVALIDATION_TOKEN_PATH);
    _invalidationTs = Number(d?.invalidatedAt || 0);
  } catch {
    _invalidationTs = 0;
  }
  _invalidationCheckedAt = Date.now();
  return _invalidationTs;
}

function responseCacheKey({ mode, scope, period, startDate, endDate }) {
  const key = `${mode || ""}__${scope || ""}__${period || ""}__${startDate || ""}__${endDate || ""}`;
  return `response-cache/competition__${key.replace(/[^a-z0-9_]/gi, "_")}.json`;
}

async function readResponseCache(path) {
  try {
    const data = await readJsonObject(path);
    if (!data?.cachedAt || !data?.payload) return null;
    if (Date.now() - Number(data.cachedAt) > RESPONSE_CACHE_TTL_MS) return null;
    const invalidatedAt = await getInvalidationTs();
    if (Number(data.cachedAt) < invalidatedAt) return null;
    return data.payload;
  } catch {
    return null;
  }
}

async function writeResponseCache(path, payload) {
  try {
    await writeJsonObject(path, { cachedAt: Date.now(), payload });
  } catch {}
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
  cpi: (value) => value < 8,
  absoluteCompletion: (value) => value > 1.8,
  ctr: (value) => value > 1.8,
  q1ToImpressions: (value) => value > 4,
  thruPlay3s: (value) => value > 20,
  amountSpent: (value) => value > 100,
};

function countBenchmarkMisses(metricMap, keys) {
  return keys.reduce((sum, key) => sum + (metricMap?.[key]?.meetsBenchmark ? 0 : 1), 0);
}

// Same success definition as Detailed POD Overview (isFunnelSuccess in leadership-overview/route.js)
function isFunnelSuccess(row) {
  const cpi = toFiniteNumber(row?.cpiUsd);
  const completion = toFiniteNumber(row?.absoluteCompletionPct);
  const ctr = toFiniteNumber(row?.ctrPct);
  const q1Impressions = toFiniteNumber(row?.q1ToImpressions);
  const thruPlay3s = toFiniteNumber(row?.thruPlayTo3sRatio);
  const amountSpent = toFiniteNumber(row?.amountSpentUsd);
  return (
    Number.isFinite(cpi) && cpi < 8 &&
    Number.isFinite(completion) && completion > 1.8 &&
    Number.isFinite(ctr) && ctr > 1.8 &&
    Number.isFinite(thruPlay3s) && thruPlay3s > 20 &&
    Number.isFinite(amountSpent) && amountSpent > 100 &&
    (!Number.isFinite(q1Impressions) || q1Impressions > 4)
  );
}

// Core hit-rate logic matching Detailed POD Overview:
// - Source: Live tab rows (GA/GI asset codes only), date-filtered by finalUploadDate
// - Metrics: joined from Analytics sheet by assetCode
// - Success: isFunnelSuccess (same as leadership-overview)
function computeHitRatePerPodFromLive(liveWorkflowRows, sinceDate, untilDate) {
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
    if (isFunnelSuccess(row)) stats.hits += 1;
  }
  return podStats;
}

function computeHitRatePerPod(liveWorkflowRows, sinceDate) {
  return computeHitRatePerPodFromLive(liveWorkflowRows, sinceDate, null);
}

function computeHitRatePerPodForWeek(liveWorkflowRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");
  if (!weekStart || !weekEnd) return new Map();
  return computeHitRatePerPodFromLive(liveWorkflowRows, weekStart, weekEnd);
}

// Build per-POD script detail rows for the detail drawer (Show, Angle, Code, CPI, True Comp, CTR, CTI)
function buildPodScriptDetailRows(workflowRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");

  const byPod = {};
  const seenCodes = new Set();
  for (const row of Array.isArray(workflowRows) ? workflowRows : []) {
    const assetCode = String(row?.assetCode || "").trim();
    const assetKey = assetCode.toUpperCase();
    if (!assetKey || seenCodes.has(assetKey)) continue;
    seenCodes.add(assetKey);

    const liveDate = String(row?.liveDate || row?.finalUploadDate || "").trim();
    if (!liveDate) continue;
    if (weekStart && liveDate < weekStart) continue;
    if (weekEnd && liveDate > weekEnd) continue;

    const pod = normalizePodLeadName(String(row?.podLeadName || "").trim());
    if (!pod) continue;

    if (!byPod[pod]) byPod[pod] = [];
    byPod[pod].push({
      showName: row.showName || "",
      beatName: row.beatName || "",
      assetCode,
      cpi: toFiniteNumber(row?.cpiUsd),
      trueComp: toFiniteNumber(row?.absoluteCompletionPct),
      ctr: toFiniteNumber(row?.ctrPct),
      cti: toFiniteNumber(row?.clickToInstall),
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

function buildScriptsPerPodForWeekFromWorkflowRows(liveWorkflowRows, weekSelection) {
  const weekStart = String(weekSelection?.weekStart || "");
  const weekEnd = String(weekSelection?.weekEnd || "");
  if (!weekStart || !weekEnd) return new Map();

  const podAssets = new Map();
  for (const row of Array.isArray(liveWorkflowRows) ? liveWorkflowRows : []) {
    const liveDate = String(row?.liveDate || row?.finalUploadDate || "").trim();
    if (!liveDate || liveDate < weekStart || liveDate > weekEnd) continue;

    const podName = normalizePodLeadName(String(row?.podLeadName || "").trim());
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

  const [weekDataEntries, liveResult, liveWorkflowResult, editorialResult, productionResult] = await Promise.all([
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
    fetchEditorialTabRows(),
    fetchProductionTabRows(),
  ]);

  const weekDataMap = Object.fromEntries(weekDataEntries.filter(([, data]) => data !== null));
  const lifetimeBeatsMap = buildLifetimeBeatsPerPod(weekDataMap);
  const lifetimeScriptsMap = buildLifetimeScriptsPerPod(liveResult.rows, LIFETIME_SINCE);
  const hitRateMap = computeHitRatePerPod(liveWorkflowResult.rows, LIFETIME_SINCE);
  const lwEditorialMap = buildLwEditorialOutputPerPod(editorialResult.rows, productionResult.rows, lastWeekSelection);

  return buildPodRowsFromMaps(rosterMeta.podOrder, rosterMeta, lifetimeBeatsMap, lifetimeScriptsMap, hitRateMap).map((row) => ({
    ...row,
    lwEditorialOutput: lwEditorialMap.get(row.podLeadName) || 0,
  }));
}

async function loadWeeklyCompetitionData(rosterMeta, period) {
  const weekSelection = getWeekSelection(period);
  const [liveWorkflowResult, editorialResult, productionResult] = await Promise.all([
    fetchLiveWorkflowRows(),
    fetchEditorialTabRows(),
    fetchProductionTabRows(),
  ]);

  const scriptsMap = buildScriptsPerPodForWeekFromWorkflowRows(liveWorkflowResult.rows, weekSelection);
  const hitRateMap = computeHitRatePerPodForWeek(liveWorkflowResult.rows, weekSelection);
  const beatsMap = buildLwEditorialOutputPerPod(editorialResult.rows, productionResult.rows, weekSelection);

  const podRows = buildPodRowsFromMaps(rosterMeta.podOrder, rosterMeta, beatsMap, scriptsMap, hitRateMap).map((row) => ({
    ...row,
    lwEditorialOutput: beatsMap.get(row.podLeadName) || 0,
  }));

  return {
    podRows,
    scriptRowsByPod: buildPodScriptDetailRows(liveWorkflowResult.rows, weekSelection),
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
  const cachePath = responseCacheKey({
    mode,
    scope,
    period,
    startDate,
    endDate,
  });
  const memCached = readInMemResponseCache(cachePath);
  if (memCached) return NextResponse.json(memCached);
  const cached = await readResponseCache(cachePath);
  if (cached) {
    writeInMemResponseCache(cachePath, cached);
    return NextResponse.json(cached);
  }

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
      const payload = {
        ok: true,
        podRows,
        period: "lifetime",
        weekKey: LIFETIME_SINCE,
        weekLabel: `Lifetime (${LIFETIME_SINCE}+)`,
        selectionMode: "lifetime",
        scope,
      };
      writeInMemResponseCache(cachePath, payload);
      await writeResponseCache(cachePath, payload);
      return NextResponse.json(payload);
    }

    if (hasPeriodFilter || hasDateRangeFilter) {
      const selection = hasDateRangeFilter ? buildDateRangeSelection({ startDate, endDate, period }) : null;
      const periodToLoad = hasDateRangeFilter ? selection.period : period;
      const weekly = await loadWeeklyCompetitionData(scopedRosterMeta, periodToLoad);
      const payload = {
        ok: true,
        podRows: weekly.podRows,
        scriptRowsByPod: weekly.scriptRowsByPod,
        period: hasDateRangeFilter ? "range" : weekly.period,
        weekKey: hasDateRangeFilter ? selection.weekKey : weekly.weekKey,
        weekLabel: hasDateRangeFilter
          ? formatWeekRangeLabel(selection.weekStart, selection.weekEnd)
          : weekly.weekLabel,
        selectionMode: hasDateRangeFilter ? "date-range" : "week",
        scope,
      };
      writeInMemResponseCache(cachePath, payload);
      await writeResponseCache(cachePath, payload);
      return NextResponse.json(payload);
    }

    const podRows = await loadLifetimeCompetitionData(scopedRosterMeta);
    const payload = { ok: true, podRows, selectionMode: "lifetime", scope };
    writeInMemResponseCache(cachePath, payload);
    await writeResponseCache(cachePath, payload);
    return NextResponse.json(payload);
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
