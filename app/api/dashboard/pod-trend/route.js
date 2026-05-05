import { NextResponse } from "next/server";
import { fetchLiveWorkflowRows, normalizePodLeadName } from "../../../../lib/live-tab.js";
import { generateWeekKeysSince } from "../../../../lib/tracker-data.js";
import { shiftYmd, formatWeekRangeLabel } from "../../../../lib/week-view.js";
import { readJsonObject, writeJsonObject } from "../../../../lib/storage.js";
import { readInMemResponseCache, writeInMemResponseCache } from "../../../../lib/response-cache.js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const LIFETIME_SINCE = "2026-03-16";
const RESPONSE_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const INVALIDATION_TOKEN_PATH = "response-cache/__invalidated-at.json";
const CACHE_PATH = "response-cache/pod-trend.json";
let _invalidationTs = 0;
let _invalidationCheckedAt = 0;
const INVALIDATION_MEMORY_TTL = 60 * 1000;

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

// Matches Detailed POD Overview: Live tab rows (GA/GI), date by finalUploadDate, metrics from the same live workflow rows
function classifyRows(liveWorkflowRows, weekStart, weekEnd) {
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
    if (isFunnelSuccess(row)) stats.hits += 1;
  }
  return podStats;
}

export async function GET() {
  const memCached = readInMemResponseCache(CACHE_PATH);
  if (memCached) return NextResponse.json(memCached);
  const cached = await readResponseCache(CACHE_PATH);
  if (cached) {
    writeInMemResponseCache(CACHE_PATH, cached);
    return NextResponse.json(cached);
  }

  try {
    const { rows: liveWorkflowRows } = await fetchLiveWorkflowRows();

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
      const podStats = classifyRows(liveWorkflowRows, weekKey, weekEnd);
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

    const payload = { ok: true, weeks, months, podNames: activePods };
    writeInMemResponseCache(CACHE_PATH, payload);
    await writeResponseCache(CACHE_PATH, payload);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message, weeks: [], months: [], podNames: [] });
  }
}
