import { NextResponse } from "next/server";
import {
  fetchAnalyticsLiveTabRows,
  fetchEditorialWorkflowRows,
  fetchIdeationTabRows,
  fetchLiveTabRows,
  fetchLiveWorkflowRows,
  parseLiveDate,
  fetchProductionWorkflowRows,
  fetchReadyForProductionWorkflowRows,
  isAnalyticsEligibleProductionType,
  isFreshTakesLabel,
  normalizePodLeadName,
} from "../../../../lib/live-tab.js";
import { matchAngleName } from "../../../../lib/fuzzy-match.js";
import { buildDateRangeSelection, formatWeekRangeLabel, getWeekSelection, normalizeWeekView } from "../../../../lib/week-view.js";
import { readJsonObject, writeJsonObject } from "../../../../lib/storage.js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const BASELINE_THRESHOLD_CHECKS = {
  threeSecPlays: (value) => value >= 35,
  thruplaysTo3s: (value) => value >= 40,
  q1Completion: (value) => value > 10,
  cpi: (value) => value < 10,
  absoluteCompletion: (value) => value > 1.5,
  cti: (value) => value >= 12,
  amountSpent: (value) => value > 100,
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value) {
  return normalizeText(value).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeWriterAliasKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const GLOBAL_WRITER_ALIASES = new Map([
  ["jacob", "Jacob Berman"],
  ["berman", "Jacob Berman"],
  ["jacob berman", "Jacob Berman"],
]);

function normalizeWriterName(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) return "";
  return GLOBAL_WRITER_ALIASES.get(normalizeWriterAliasKey(cleaned)) || cleaned;
}

function buildWriterNameResolver(rows) {
  const exactMap = new Map();
  const prefixCandidates = [];
  const tokenMap = new Map();

  function register(value) {
    const displayName = normalizeWriterName(value);
    const key = normalizeKey(displayName);
    if (!displayName || !key || exactMap.has(key)) return;

    exactMap.set(key, displayName);
    prefixCandidates.push({ key, displayName });

    for (const token of key.split(" ").filter(Boolean)) {
      if (!tokenMap.has(token)) tokenMap.set(token, new Set());
      tokenMap.get(token).add(displayName);
    }
  }

  function registerPossibleWriters(value) {
    const cleaned = normalizeWriterName(value);
    if (!cleaned) return;
    for (const part of cleaned.split(",").map(normalizeText).filter(Boolean)) {
      register(part);
    }
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    const writerName = normalizeText(row?.writerName);
    if (writerName.includes(" ")) registerPossibleWriters(writerName);
  }

  const resolveCache = new Map();
  return function resolveWriterName(rawValue) {
    if (resolveCache.has(rawValue)) return resolveCache.get(rawValue);
    const cleaned = normalizeText(rawValue);
    if (!cleaned) { resolveCache.set(rawValue, "Unknown Writer"); return "Unknown Writer"; }
    const aliased = normalizeWriterName(cleaned);
    const aliasedKey = normalizeKey(aliased);
    let result = aliased;
    if (exactMap.has(aliasedKey)) {
      result = exactMap.get(aliasedKey);
    } else {
      const key = normalizeKey(aliased);
      if (exactMap.has(key)) {
        result = exactMap.get(key);
      } else {
        const prefixMatches = prefixCandidates.filter((candidate) => candidate.key.startsWith(key));
        if (prefixMatches.length === 1) {
          result = prefixMatches[0].displayName;
        } else {
          const firstWordMatches = prefixCandidates.filter((candidate) => {
            if (candidate.displayName.includes(",")) return false;
            return candidate.key.split(" ")[0] === key;
          });
          if (firstWordMatches.length === 1) {
            result = firstWordMatches[0].displayName;
          } else {
            const tokenMatches = tokenMap.get(key);
            if (tokenMatches && tokenMatches.size === 1) result = Array.from(tokenMatches)[0];
          }
        }
      }
    }
    resolveCache.set(rawValue, result);
    return result;
  };
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTH_NAME_TO_NUM = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// Parses text like "Mar week 3", "April week 2", "Apr Wk 4" into {monthKey, weekInMonth, monthLabel}
function parseBeatsWeekLabel(rawValue) {
  const normalized = normalizeText(rawValue || "").toLowerCase();
  const match = normalized.match(/([a-z]+)\s+(?:week|wk)\s*([1-4])/);
  if (!match) return null;
  const monthNum = MONTH_NAME_TO_NUM[match[1]];
  const weekInMonth = Number(match[2]);
  if (!monthNum || !weekInMonth) return null;
  // If the label month is more than 6 months ahead of today, treat it as last year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const year = monthNum > currentMonth + 6 ? currentYear - 1 : currentYear;
  const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;
  return { monthKey, weekInMonth, monthLabel: getMonthLabel(monthKey) };
}

function getMonthLabel(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return "";
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}

function getWeekInMonthFromDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const day = Number(String(value).slice(-2));
  if (!Number.isFinite(day) || day <= 0) return null;
  return Math.min(4, Math.floor((day - 1) / 7) + 1);
}

function getTimeParts(dateValue) {
  const primaryDate = normalizeText(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primaryDate)) {
    return {
      primaryDate: "",
      monthKey: "",
      monthLabel: "",
      weekInMonth: null,
    };
  }

  const monthKey = primaryDate.slice(0, 7);
  const weekInMonth = getWeekInMonthFromDate(primaryDate);
  return {
    primaryDate,
    monthKey,
    monthLabel: getMonthLabel(monthKey),
    weekInMonth,
  };
}

function isDateWithinWeek(dateValue, weekSelection) {
  const primaryDate = normalizeText(dateValue);
  if (!primaryDate) return false;
  return primaryDate >= weekSelection.weekStart && primaryDate <= weekSelection.weekEnd;
}

// Check if an ideation row falls in the selected date range.
// Primary: use ISO primaryDate. Fallback: derive the Sun–Sat bucket from monthKey+weekInMonth
// and check for overlap. This handles rows whose date was stored as a label (e.g. "Apr Week 3").
function isBeatRowInRange(row, weekSelection) {
  if (row.primaryDate) {
    return row.primaryDate >= weekSelection.weekStart && row.primaryDate <= weekSelection.weekEnd;
  }
  if (!row.monthKey || !row.weekInMonth) return false;
  const [y, m] = String(row.monthKey).split("-").map(Number);
  const anchorDay = (Number(row.weekInMonth) - 1) * 7 + 1;
  const anchorDate = new Date(Date.UTC(y, m - 1, anchorDay, 12));
  const weekday = anchorDate.getUTCDay(); // 0=Sun
  const sunDate = new Date(Date.UTC(y, m - 1, anchorDay - weekday, 12));
  const satDate = new Date(Date.UTC(y, m - 1, anchorDay - weekday + 6, 12));
  const fmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  const bucketStart = fmt(sunDate);
  const bucketEnd = fmt(satDate);
  // Overlap: bucket overlaps selection if not entirely before or after
  return bucketStart <= weekSelection.weekEnd && bucketEnd >= weekSelection.weekStart;
}

function categorizeIdeationStatus(statusLabel) {
  const normalized = normalizeKey(statusLabel);
  if (!normalized) return "to_be_ideated";
  if (normalized.includes("abandon")) return "abandoned";
  if (normalized === "gtg" || normalized === "gtg - minor changes" || normalized === "approved") return "approved";
  if (normalized.includes("review") && normalized.includes("pend")) return "review_pending";
  if (normalized.includes("iterate")) return "iterate";
  return "to_be_ideated";
}

function makeBeatKey(showName, beatName) {
  const showKey = normalizeKey(showName);
  const beatKey = normalizeKey(beatName);
  return showKey && beatKey ? `${showKey}|${beatKey}` : "";
}

function formatStageLabel(stageKey) {
  switch (stageKey) {
    case "live":
      return "Live";
    case "production":
      return "Production";
    case "ready_for_production":
      return "Ready for Production";
    case "editorial_review":
      return "Editorial Review";
    case "editorial":
      return "Editorial";
    default:
      return "Not mapped";
  }
}

function getStagePriority(stageKey) {
  switch (stageKey) {
    case "live":
      return 5;
    case "production":
      return 4;
    case "ready_for_production":
      return 3;
    case "editorial_review":
      return 2;
    case "editorial":
      return 1;
    default:
      return 0;
  }
}

function buildFilterOptions(beatRows) {
  const map = new Map();

  for (const row of beatRows) {
    if (!row?.monthKey || !row?.weekInMonth) continue;
    const id = `${row.monthKey}::${row.weekInMonth}`;
    if (!map.has(id)) {
      map.set(id, {
        id,
        monthKey: row.monthKey,
        weekInMonth: Number(row.weekInMonth),
        label: `${row.monthLabel} Wk${row.weekInMonth}`,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
    return a.weekInMonth - b.weekInMonth;
  });
}

function buildBeatRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const parsedAssignedDate = parseLiveDate(row?.assignedDate);
      const parsedCompletedDate = parseLiveDate(row?.completedDate);
      // Use ONLY "Beats completed" date for filtering. "Beats week" column is ignored entirely.
      const primaryDate = parsedCompletedDate || parsedAssignedDate || "";
      const timeParts = getTimeParts(primaryDate);
      return {
        id: `beat-row-${index + 1}`,
        beatCode: normalizeText(row?.beatCode),
      podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName),
      showName: normalizeText(row?.showName),
      beatName: normalizeText(row?.beatName),
      writerName: normalizeText(row?.writerName) || normalizeText(row?.beatsOwner) || "",
      statusLabel: normalizeText(row?.status || row?.beatsStatus),
      statusCategory: categorizeIdeationStatus(row?.status || row?.beatsStatus),
      scriptCode: normalizeText(row?.scriptCode || ""),
      scriptStatus: normalizeText(row?.scriptStatus || ""),
        beatsAssignedDate: parsedAssignedDate,
        assignedDate: parsedAssignedDate,
        completedDate: parsedCompletedDate,
        ...timeParts,
      };
    })
    .filter((row) => row.podLeadName && row.showName && row.beatName && row.monthKey && row.weekInMonth);
}

function buildWorkflowRows({ editorialRows, readyRows, productionRows, liveRows }) {
  const rows = [];

  for (const row of editorialRows) {
    const stageDate = normalizeText(row?.dateSubmittedByLead || row?.dateAssigned);
    const leadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const strictLeadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    rows.push({
      source: "editorial",
      stageKey: row?.dateSubmittedByLead ? "editorial_review" : "editorial",
      stageLabel: formatStageLabel(row?.dateSubmittedByLead ? "editorial_review" : "editorial"),
      stagePriority: getStagePriority(row?.dateSubmittedByLead ? "editorial_review" : "editorial"),
      stageDate,
      assetCode: normalizeText(row?.assetCode),
      scriptCode: normalizeText(row?.scriptCode),
      podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName),
      writerName: normalizeText(row?.writerName),
      showName: normalizeText(row?.showName),
      beatName: normalizeText(row?.beatName),
      reworkType: normalizeText(row?.reworkType),
      productionType: normalizeText(row?.productionType),
      scriptStatus: normalizeText(row?.scriptStatus),
      status: normalizeText(row?.status),
      etaToStartProd: normalizeText(row?.etaToStartProd),
      etaPromoCompletion: normalizeText(row?.etaPromoCompletion),
      finalUploadDate: normalizeText(row?.finalUploadDate),
      cdName: normalizeText(row?.cd),
      acdNames: [],
      leadSubmittedDate,
      strictLeadSubmittedDate,
      writerSubmittedDate: normalizeText(row?.dateSubmittedByWriter || row?.dateSubmittedByLead || row?.dateAssigned),
      ...getTimeParts(stageDate),
    });
  }

  for (const row of readyRows) {
    const stageDate = normalizeText(row?.etaToStartProd || row?.dateSubmittedByLead);
    const leadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const strictLeadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    rows.push({
      source: "ready_for_production",
      stageKey: "ready_for_production",
      stageLabel: formatStageLabel("ready_for_production"),
      stagePriority: getStagePriority("ready_for_production"),
      stageDate,
      assetCode: normalizeText(row?.assetCode),
      scriptCode: normalizeText(row?.scriptCode),
      podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName),
      writerName: normalizeText(row?.writerName),
      showName: normalizeText(row?.showName),
      beatName: normalizeText(row?.beatName),
      reworkType: normalizeText(row?.reworkType),
      productionType: normalizeText(row?.productionType),
      scriptStatus: normalizeText(row?.scriptStatus),
      status: normalizeText(row?.status),
      etaToStartProd: normalizeText(row?.etaToStartProd),
      etaPromoCompletion: normalizeText(row?.etaPromoCompletion),
      finalUploadDate: normalizeText(row?.finalUploadDate),
      cdName: normalizeText(row?.cd),
      acdNames: [],
      leadSubmittedDate,
      strictLeadSubmittedDate,
      writerSubmittedDate: normalizeText(row?.dateSubmittedByWriter || row?.dateSubmittedByLead || row?.etaToStartProd),
      ...getTimeParts(stageDate),
    });
  }

  for (const row of productionRows) {
    const stageDate = normalizeText(row?.etaPromoCompletion || row?.etaToStartProd);
    const leadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const strictLeadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const acdNames = [
      ...String(row?.acd1WorkedOnWorldSettings || "").split(/[,/]/).map(normalizeText).filter(Boolean),
      ...String(row?.acdMultipleSelections || "").split(/[,/]/).map(normalizeText).filter(Boolean),
    ];
    rows.push({
      source: "production",
      stageKey: "production",
      stageLabel: formatStageLabel("production"),
      stagePriority: getStagePriority("production"),
      stageDate,
      assetCode: normalizeText(row?.assetCode),
      scriptCode: normalizeText(row?.scriptCode),
      podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName),
      writerName: normalizeText(row?.writerName),
      cdName: normalizeText(row?.cd),
      showName: normalizeText(row?.showName),
      beatName: normalizeText(row?.beatName),
      reworkType: normalizeText(row?.reworkType),
      productionType: normalizeText(row?.productionType),
      scriptStatus: normalizeText(row?.scriptStatus || row?.status),
      status: normalizeText(row?.status),
      etaToStartProd: normalizeText(row?.etaToStartProd),
      etaPromoCompletion: normalizeText(row?.etaPromoCompletion),
      finalUploadDate: normalizeText(row?.finalUploadDate),
      acdNames: acdNames.length ? acdNames : ["Unassigned"],
      leadSubmittedDate,
      strictLeadSubmittedDate,
      writerSubmittedDate: normalizeText(row?.dateSubmittedByWriter || row?.dateSubmittedByLead || row?.etaPromoCompletion || row?.etaToStartProd),
      ...getTimeParts(stageDate),
    });
  }

  for (const row of liveRows) {
    const stageDate = normalizeText(row?.finalUploadDate);
    const leadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const strictLeadSubmittedDate = normalizeText(row?.dateSubmittedByLead);
    const acdNames = [
      ...String(row?.acd1WorkedOnWorldSettings || "").split(/[,/]/).map(normalizeText).filter(Boolean),
      ...String(row?.acdMultipleSelections || "").split(/[,/]/).map(normalizeText).filter(Boolean),
    ];
    rows.push({
      source: "live",
      stageKey: "live",
      stageLabel: formatStageLabel("live"),
      stagePriority: getStagePriority("live"),
      stageDate,
      assetCode: normalizeText(row?.assetCode),
      scriptCode: normalizeText(row?.scriptCode),
      podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName),
      writerName: normalizeText(row?.writerName),
      cdName: normalizeText(row?.cd),
      showName: normalizeText(row?.showName),
      beatName: normalizeText(row?.beatName),
      reworkType: normalizeText(row?.reworkType),
      productionType: normalizeText(row?.productionType),
      scriptStatus: normalizeText(row?.scriptStatus || row?.status),
      status: normalizeText(row?.status),
      etaToStartProd: normalizeText(row?.etaToStartProd),
      etaPromoCompletion: normalizeText(row?.etaPromoCompletion),
      finalUploadDate: normalizeText(row?.finalUploadDate),
      reworkGaCode: normalizeText(row?.reworkGaCode),
      cpiUsd: row?.cpiUsd,
      threeSecPlayPct: row?.threeSecPlayPct,
      thruPlaysPct: row?.thruPlaysPct,
      q1ToThruplays: row?.q1ToThruplays,
      video0To25Pct: row?.video0To25Pct,
      q1: row?.q1,
      video25To50Pct: row?.video25To50Pct,
      video50To75Pct: row?.video50To75Pct,
      video75To95Pct: row?.video75To95Pct,
      video0To95Pct: row?.video0To95Pct,
      thruPlayTo3sRatio: row?.thruPlayTo3sRatio,
      absoluteCompletionPct: row?.absoluteCompletionPct,
      q4ToQ1: row?.q4ToQ1,
      cpmUsd: row?.cpmUsd,
      ctrPct: row?.ctrPct,
      amountSpentUsd: row?.amountSpentUsd,
      outboundClicksToCompletionPct: row?.outboundClicksToCompletionPct,
      reach: row?.reach,
      impressions: row?.impressions,
      clickToInstall: row?.clickToInstall,
      ctrTimesCti: row?.ctrTimesCti,
      appInstalls: row?.appInstalls,
      acdNames: acdNames.length ? acdNames : ["Unassigned"],
      leadSubmittedDate,
      strictLeadSubmittedDate,
      writerSubmittedDate: normalizeText(
        row?.dateSubmittedByWriter || row?.dateSubmittedByLead || row?.etaPromoCompletion || row?.finalUploadDate
      ),
      ...getTimeParts(stageDate),
    });
  }

  return rows.filter((row) => {
    if (!row.podLeadName) return false;
    // Exclude GU (GenAI-Cinematic-Still / Full GenAI) assets
    const code = String(row.assetCode || "").trim().toUpperCase();
    if (code.startsWith("GU")) return false;
    return true;
  });
}

function buildFallbackWorkflowFromLiveRows(liveRows) {
  const safeRows = Array.isArray(liveRows) ? liveRows : [];

  const editorialRows = safeRows
    .filter((row) => normalizeText(row?.dateSubmittedByLead || row?.dateAssigned))
    .map((row) => ({
      ...row,
      source: "editorial",
      stageDate: normalizeText(row?.dateSubmittedByLead || row?.dateAssigned),
    }));

  const readyRows = safeRows
    .filter((row) => normalizeText(row?.etaToStartProd || row?.dateSubmittedByLead))
    .map((row) => ({
      ...row,
      source: "ready_for_production",
      stageDate: normalizeText(row?.etaToStartProd || row?.dateSubmittedByLead),
    }));

  const productionRows = safeRows
    .filter((row) => normalizeText(row?.etaPromoCompletion || row?.etaToStartProd))
    .map((row) => ({
      ...row,
      source: "production",
      stageDate: normalizeText(row?.etaPromoCompletion || row?.etaToStartProd),
    }));

  return { editorialRows, readyRows, productionRows };
}

// Build O(1) lookup indices over workflowRows so findWorkflowMatchesFast avoids O(n) scans per beat.
function buildWorkflowIndex(workflowRows) {
  const byCode = new Map();   // normalizedCode → row[]
  const byShow = new Map();   // normalizedShowName → row[]
  for (const row of Array.isArray(workflowRows) ? workflowRows : []) {
    const addToMap = (m, k, row) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(row); };
    addToMap(byCode, normalizeKey(row?.scriptCode), row);
    addToMap(byCode, normalizeKey(row?.assetCode), row);
    addToMap(byShow, normalizeKey(row?.showName), row);
  }
  return { byCode, byShow };
}

function findWorkflowMatches(ideationRow, workflowRows, index) {
  // Accept pre-built index when available; build on demand as fallback (preserves backward compatibility).
  const idx = index || buildWorkflowIndex(workflowRows);
  const beatCode = normalizeKey(ideationRow?.beatCode);
  const showKey = normalizeKey(ideationRow?.showName);
  const beatName = normalizeText(ideationRow?.beatName);

  if (beatCode) {
    const exactCodeMatches = idx.byCode.get(beatCode) || [];
    if (exactCodeMatches.length > 0) return exactCodeMatches;
  }

  const sameShowRows = idx.byShow.get(showKey) || [];
  if (sameShowRows.length === 0) return [];

  const matchedAngle = matchAngleName(beatName, sameShowRows.map((row) => row?.beatName).filter(Boolean));
  if (!matchedAngle) return [];

  return sameShowRows.filter((row) => normalizeKey(row?.beatName) === normalizeKey(matchedAngle));
}

function getBestWorkflowMatch(matches) {
  return [...matches].sort((a, b) => {
    const byStage = Number(b?.stagePriority || 0) - Number(a?.stagePriority || 0);
    if (byStage !== 0) return byStage;
    return String(b?.stageDate || "").localeCompare(String(a?.stageDate || ""));
  })[0] || null;
}

function buildApprovedMatchedRows(beatRows, workflowRows) {
  const index = buildWorkflowIndex(workflowRows);
  return beatRows
    .filter((row) => row.statusCategory === "approved")
    .map((row, i) => {
      const bestMatch = getBestWorkflowMatch(findWorkflowMatches(row, workflowRows, index));
      return {
        id: `approved-match-${i + 1}`,
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        weekInMonth: row.weekInMonth,
        beatCode: row.beatCode,
        showName: row.showName,
        beatName: row.beatName,
        podLeadName: normalizeText(bestMatch?.podLeadName || row.podLeadName),
        writerName: normalizeText(bestMatch?.writerName || ""),
        stageKey: bestMatch?.stageKey || "not_mapped",
        stageLabel: bestMatch?.stageLabel || "Not mapped",
        reworkType: normalizeText(bestMatch?.reworkType || ""),
        scriptStatus: normalizeText(bestMatch?.scriptStatus || ""),
      };
    });
}

function isFullGenAiAssetCode(value) {
  const code = normalizeText(value).toUpperCase();
  return code.startsWith("GA") || code.startsWith("GI");
}

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

// Build Full Gen AI detail rows — LIVE TAB ONLY.
// Only scripts that have reached the Live tab are shown here, filtered by finalUploadDate.
// This ensures counts match what users see in the Live tab view.
// Success/hit-rate metrics are joined from the analytics sheet by asset code.
function buildFullGenAiRows(workflowRows, analyticsRows, startDate, endDate) {
  // Analytics lookup by asset code — for success metrics only
  const analyticsMap = new Map();
  for (const row of (Array.isArray(analyticsRows) ? analyticsRows : [])) {
    const code = normalizeText(row?.assetCode || "").toUpperCase();
    if (code && !analyticsMap.has(code)) {
      analyticsMap.set(code, row);
    }
  }

  // Only include scripts from the Live tab, deduplicated by assetCode.
  // Date is filtered by finalUploadDate (= stageDate for live rows) so the count
  // matches exactly what is visible in the Live tab for the selected date range.
  const seenCodes = new Set();
  const filtered = (Array.isArray(workflowRows) ? workflowRows : []).filter((row) => {
    if (String(row?.source || "") !== "live") return false;
    if (!isFullGenAiAssetCode(row?.assetCode)) return false;
    // Deduplicate by assetCode
    const code = String(row?.assetCode || "").trim().toLowerCase();
    if (code) {
      if (seenCodes.has(code)) return false;
      seenCodes.add(code);
    }
    // Filter by strictLeadSubmittedDate — same field the Live tab filters by ("Date submitted by Lead")
    // This ensures the count matches what users see in the Live tab for the selected date range.
    const d = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
    return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
  });

  return filtered.map((row, index) => {
    const code = normalizeText(row?.assetCode || "").toUpperCase();
    const aRow = analyticsMap.get(code) || {};
    const hasAnalytics = Object.keys(aRow).length > 0;
    const isFt = classifyFtRw(row?.reworkType) === "ft";
    const dateForBucket = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
    const timeParts = getTimeParts(dateForBucket);
    return {
      id: `full-gen-ai-${index + 1}`,
      assetCode: normalizeText(row.assetCode),
      showName: toTitleCase(row.showName || ""),
      beatName: toTitleCase(row.beatName || ""),
      podLeadName: toTitleCase(row.podLeadName || ""),
      writerName: toTitleCase(row.writerName || ""),
      scriptType: isFt ? "ft" : "rw",
      productionType: normalizeText(row.productionType),
      source: String(row.source || ""),
      // Success/hit-rate from analytics only
      success: hasAnalytics ? isFunnelSuccess(aRow) : false,
      hasAnalytics,
      amountSpentUsd: toFiniteNumber(aRow?.amountSpentUsd),
      q1CompletionPct: toFiniteNumber(aRow?.video0To25Pct),
      cpiUsd: toFiniteNumber(aRow?.cpiUsd),
      absoluteCompletionPct: toFiniteNumber(aRow?.absoluteCompletionPct),
      ctrPct: toFiniteNumber(aRow?.ctrPct),
      clickToInstall: toFiniteNumber(aRow?.clickToInstall),
      ...timeParts,
    };
  });
}

function buildCurrentWeekUpdateRows(beatRows, workflowRows, weekSelection) {
  const grouped = new Map();

  const ensureRow = (podLeadName, writerName) => {
    const pod = normalizeText(podLeadName || "Unassigned");
    const writer = normalizeText(writerName || "Unassigned");
    const key = `${normalizeKey(pod)}|${normalizeKey(writer)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        podLeadName: pod,
        writerName: writer,
        beats: 0,
        editorial: 0,
        readyForProduction: 0,
        production: 0,
        live: 0,
      });
    }
    return grouped.get(key);
  };

  const workflowIndex = buildWorkflowIndex(workflowRows);
  for (const beat of beatRows.filter((row) => isDateWithinWeek(row.completedDate, weekSelection))) {
    const bestMatch = getBestWorkflowMatch(findWorkflowMatches(beat, workflowRows, workflowIndex));
    ensureRow(bestMatch?.podLeadName || beat.podLeadName, bestMatch?.writerName || beat.writerName).beats += 1;
  }

  for (const workflow of workflowRows.filter((row) => isDateWithinWeek(row.leadSubmittedDate || row.writerSubmittedDate || row.stageDate, weekSelection))) {
    const entry = ensureRow(workflow.podLeadName, workflow.writerName);
    if (workflow.stageKey === "editorial" || workflow.stageKey === "editorial_review") entry.editorial += 1;
    if (workflow.stageKey === "ready_for_production") entry.readyForProduction += 1;
    if (workflow.stageKey === "production") entry.production += 1;
    if (workflow.stageKey === "live") entry.live += 1;
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.beats - a.beats || a.podLeadName.localeCompare(b.podLeadName) || a.writerName.localeCompare(b.writerName)
  );
}

function classifyFtRw(reworkType) {
  const rt = String(reworkType || "").trim().toLowerCase();
  if (!rt) return null;
  if (rt.startsWith("fresh take ")) return null; // "Fresh Take PS" etc — excluded from both FT and RW
  if (isFreshTakesLabel(rt) || rt === "new q1" || rt.startsWith("new q1 ")) return "ft";
  return "rw";
}

function isIncludedWorkflowAssetCode(assetCode, includeGuAssets = false) {
  const code = normalizeText(assetCode).toUpperCase();
  if (!code) return false;
  if (code.startsWith("GA") || code.startsWith("GI")) return true;
  if (includeGuAssets && code.startsWith("GU")) return true;
  return false;
}

function buildPodThroughputRowsForRange(workflowRows, startDate, endDate) {
  const resolveWriterName = buildWriterNameResolver(workflowRows);

  // First pass: filter rows that fall within the date range.
  // Uses ONLY "Date submitted by Lead" (strictLeadSubmittedDate) — no fallbacks.
  // Throughput = when the CL actually reviewed and submitted the script, not when
  // production was scheduled. Scripts without a lead submission date are excluded.
  const candidateRows = (Array.isArray(workflowRows) ? workflowRows : []).filter((row) => {
    const source = String(row?.source || "");
    if (!["editorial", "ready_for_production", "production", "live"].includes(source)) return false;
    const sld = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
    return Boolean(sld) && sld >= startDate && sld <= endDate;
  });

  // Deduplicate by assetCode — a script that hasn't been removed from an earlier tab after
  // advancing will otherwise be counted multiple times. Keep the most-advanced stage
  // (higher stagePriority wins).
  const dedupMap = new Map();
  const noCodeRows = [];
  for (const row of candidateRows) {
    const code = String(row?.assetCode || "").trim().toLowerCase();
    if (!code) { noCodeRows.push(row); continue; }
    if (!dedupMap.has(code) || Number(row?.stagePriority || 0) > Number(dedupMap.get(code)?.stagePriority || 0)) {
      dedupMap.set(code, row);
    }
  }
  const filtered = [...Array.from(dedupMap.values()), ...noCodeRows];

  const podMap = new Map();
  const ensurePod = (name) => {
    const pod = normalizeText(name) || "Unknown POD";
    if (!podMap.has(pod)) {
      podMap.set(pod, { podLeadName: pod, totalScripts: 0, ftCount: 0, rwCount: 0, writers: new Map() });
    }
    return podMap.get(pod);
  };
  const ensureWriter = (pod, name) => {
    const writer = normalizeText(name) || "Unknown Writer";
    if (!pod.writers.has(writer)) {
      pod.writers.set(writer, { writerName: writer, totalScripts: 0, ftCount: 0, rwCount: 0, scripts: [] });
    }
    return pod.writers.get(writer);
  };

  for (const row of filtered) {
    const pod = ensurePod(normalizePodLeadName(row?.podLeadName || row?.podLeadRaw) || row?.podLeadName || row?.podLeadRaw);
    pod.totalScripts += 1;
    const writer = ensureWriter(pod, resolveWriterName(row?.writerName));
    writer.totalScripts += 1;

    const scriptType = classifyFtRw(row?.reworkType);
    const isFt = scriptType === "ft";
    const dateUsed = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
    writer.scripts.push({
      assetCode: normalizeText(row?.assetCode) || "",
      showName: normalizeText(row?.showName) || "",
      beatName: normalizeText(row?.beatName) || "",
      type: isFt ? "ft" : "rw",
      date: dateUsed,
      source: normalizeText(row?.source),
      scriptStatus: normalizeText(row?.scriptStatus || row?.status) || "",
    });

    if (isFt) {
      pod.ftCount += 1;
      writer.ftCount += 1;
    } else {
      pod.rwCount += 1;
      writer.rwCount += 1;
    }
  }

  // Separate live pass: count ALL live-tab rows by stageDate (finalUploadDate fallback),
  // not just those with strictLeadSubmittedDate. This catches scripts uploaded without a lead date.
  const liveCountMap = new Map(); // key: "pod::writer" → { assetCodes: Set, scripts: [] }
  for (const row of Array.isArray(workflowRows) ? workflowRows : []) {
    if (String(row?.source || "") !== "live") continue;
    const uploadDate = String(row?.stageDate || row?.finalUploadDate || row?.strictLeadSubmittedDate || "").slice(0, 10);
    if (!uploadDate || uploadDate < startDate || uploadDate > endDate) continue;
    const podKey = normalizeText(normalizePodLeadName(row?.podLeadName || row?.podLeadRaw) || row?.podLeadName || row?.podLeadRaw) || "Unknown POD";
    const writerKey = normalizeText(resolveWriterName(row?.writerName)) || "Unknown Writer";
    const mapKey = `${podKey}::${writerKey}`;
    if (!liveCountMap.has(mapKey)) liveCountMap.set(mapKey, { podKey, writerKey, assetCodes: new Set(), scripts: [] });
    const entry = liveCountMap.get(mapKey);
    const code = String(row?.assetCode || "").trim();
    if (code && !entry.assetCodes.has(code.toLowerCase())) {
      entry.assetCodes.add(code.toLowerCase());
      entry.scripts.push({
        assetCode: normalizeText(row?.assetCode) || "",
        beatName: normalizeText(row?.beatName) || "",
        scriptStatus: normalizeText(row?.scriptStatus || row?.status) || "Uploaded",
        type: classifyFtRw(row?.reworkType) === "ft" ? "ft" : "rw",
        date: uploadDate,
        source: "live",
      });
    }
  }

  return Array.from(podMap.values())
    .sort((a, b) => b.totalScripts - a.totalScripts || a.podLeadName.localeCompare(b.podLeadName))
    .map((pod) => {
      const collapsedByResolvedName = Array.from(
        Array.from(pod.writers.values()).reduce((acc, writer) => {
          const resolvedName = resolveWriterName(writer.writerName);
          const key = normalizeKey(resolvedName);
          if (!acc.has(key)) {
            acc.set(key, {
              writerName: resolvedName,
              totalScripts: 0,
              ftCount: 0,
              rwCount: 0,
              scripts: [],
            });
          }
          const target = acc.get(key);
          target.totalScripts += Number(writer.totalScripts || 0);
          target.ftCount += Number(writer.ftCount || 0);
          target.rwCount += Number(writer.rwCount || 0);
          target.scripts = target.scripts.concat(writer.scripts || []);
          return acc;
        }, new Map()).values()
      );

      const mergedByPodLocalAlias = collapsedByResolvedName.reduce((acc, row) => {
        const current = {
          writerName: row.writerName,
          totalScripts: Number(row.totalScripts || 0),
          ftCount: Number(row.ftCount || 0),
          rwCount: Number(row.rwCount || 0),
          scripts: row.scripts || [],
        };
        const tokens = normalizeKey(current.writerName).split(" ").filter(Boolean);
        const isSingleToken = tokens.length === 1;

        if (isSingleToken) {
          const [token] = tokens;
          // First try: first-token match (e.g. "Paul" → "Paul Lee")
          const firstTokenCandidates = Array.from(acc.values()).filter((candidate) => {
            const candidateTokens = normalizeKey(candidate.writerName).split(" ").filter(Boolean);
            return candidateTokens.length > 1 && candidateTokens[0] === token;
          });
          // Fallback: any-token match (e.g. "Lee" → "Paul Lee") — only if exactly one candidate to avoid ambiguity
          const anyTokenCandidates = firstTokenCandidates.length === 0
            ? Array.from(acc.values()).filter((candidate) => {
                const candidateTokens = normalizeKey(candidate.writerName).split(" ").filter(Boolean);
                return candidateTokens.length > 1 && candidateTokens.includes(token);
              })
            : [];
          const mergeCandidates = firstTokenCandidates.length > 0 ? firstTokenCandidates : (anyTokenCandidates.length === 1 ? anyTokenCandidates : []);
          if (mergeCandidates.length > 0) {
            const target = mergeCandidates.sort(
              (a, b) => b.totalScripts - a.totalScripts || a.writerName.localeCompare(b.writerName)
            )[0];
            target.totalScripts += current.totalScripts;
            target.ftCount += current.ftCount;
            target.rwCount += current.rwCount;
            target.scripts = (target.scripts || []).concat(current.scripts);
            return acc;
          }
        }

        const key = normalizeKey(current.writerName);
        if (!acc.has(key)) {
          const currentTokens = key.split(" ").filter(Boolean);
          if (currentTokens.length > 1) {
            const singleTokenKey = currentTokens[0];
            if (singleTokenKey && acc.has(singleTokenKey)) {
              const singleEntry = acc.get(singleTokenKey);
              current.totalScripts += Number(singleEntry.totalScripts || 0);
              current.ftCount += Number(singleEntry.ftCount || 0);
              current.rwCount += Number(singleEntry.rwCount || 0);
              current.scripts = current.scripts.concat(singleEntry.scripts || []);
              acc.delete(singleTokenKey);
            }
          }
          acc.set(key, current);
          return acc;
        }

        const target = acc.get(key);
        target.totalScripts += current.totalScripts;
        target.ftCount += current.ftCount;
        target.rwCount += current.rwCount;
        target.scripts = (target.scripts || []).concat(current.scripts);
        return acc;
      }, new Map());

      const writerRows = Array.from(mergedByPodLocalAlias.values())
        .filter((w) => normalizePodLeadName(w.writerName) !== pod.podLeadName)
        .sort((a, b) => b.totalScripts - a.totalScripts || a.writerName.localeCompare(b.writerName))
        .map((w) => {
          const scripts = (w.scripts || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.assetCode || "").localeCompare(b.assetCode || ""));
          const liveEntry = liveCountMap.get(`${pod.podLeadName}::${w.writerName}`);
          const liveScripts = liveEntry ? liveEntry.scripts : [];
          return { ...w, scripts, liveScripts, liveCount: liveScripts.length };
        });

      return {
        podLeadName: pod.podLeadName,
        totalScripts: pod.totalScripts,
        ftCount: pod.ftCount,
        rwCount: pod.rwCount,
        liveCount: writerRows.reduce((sum, w) => sum + (w.liveCount || 0), 0),
        writerRows,
      };
    });
}

// ─── Response-level cache ────────────────────────────────────────────────────
// Caches the fully-processed API response in Supabase for RESPONSE_CACHE_TTL_MS.
// On a cache hit the function returns immediately — zero build* functions run.
// Sync (/api/dashboard/refresh-cache) writes an invalidation token so the next
// request always re-computes fresh data regardless of the TTL.
const RESPONSE_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — hard cache, evicted only by Sync
const INVALIDATION_TOKEN_PATH = "response-cache/__invalidated-at.json";

// In-memory copy of the invalidation timestamp (avoids Supabase read on every hit).
let _invalidationTs = 0;
let _invalidationCheckedAt = 0;
const INVALIDATION_MEMORY_TTL = 60 * 1000; // re-read Supabase at most once per minute

async function getInvalidationTs() {
  if (Date.now() - _invalidationCheckedAt < INVALIDATION_MEMORY_TTL) return _invalidationTs;
  try {
    const d = await readJsonObject(INVALIDATION_TOKEN_PATH);
    _invalidationTs = Number(d?.invalidatedAt || 0);
  } catch { _invalidationTs = 0; }
  _invalidationCheckedAt = Date.now();
  return _invalidationTs;
}

function responseCacheKey(weekStart, weekEnd, yearsParam, includeGuAssets) {
  const key = `${weekStart}__${weekEnd}__${yearsParam}__${includeGuAssets ? "gu1" : "gu0"}`;
  return `response-cache/leadership-overview__${key.replace(/[^a-z0-9_]/gi, "_")}.json`;
}

async function readResponseCache(path) {
  try {
    const data = await readJsonObject(path);
    if (!data || !data.cachedAt || !data.payload) return null;
    if (Date.now() - Number(data.cachedAt) > RESPONSE_CACHE_TTL_MS) return null;
    const invalidatedAt = await getInvalidationTs();
    if (Number(data.cachedAt) < invalidatedAt) return null; // Sync was pressed after this was cached
    return data.payload;
  } catch { return null; }
}

async function writeResponseCache(path, payload) {
  try { await writeJsonObject(path, { cachedAt: Date.now(), payload }); } catch {}
}

export { INVALIDATION_TOKEN_PATH };

export async function GET(request) {
  const url = new URL(request.url);
  const period = normalizeWeekView(url.searchParams.get("period") || "current");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const includeGuAssets = String(url.searchParams.get("includeGuAssets") || "").toLowerCase() === "true";
  const weekSelection = startDate || endDate ? buildDateRangeSelection({ startDate, endDate, period }) : getWeekSelection(period);

  // Year filter: default 2026 only; UI can pass e.g. years=2025,2026
  const yearsParam = url.searchParams.get("years") || "2026";
  const selectedYears = yearsParam.split(",").map((y) => y.trim()).filter(Boolean);

  // ── Response cache check (skip ALL computation on hit) ───────────────────
  const cachePath = responseCacheKey(weekSelection.weekStart, weekSelection.weekEnd, yearsParam, includeGuAssets);
  const cached = await readResponseCache(cachePath);
  if (cached) return NextResponse.json(cached);
  const liveRowMatchesYear = (row) => {
    const d = normalizeText(row?.finalUploadDate || "");
    if (!d) return true; // keep in-progress rows with no date
    return selectedYears.some((y) => d.startsWith(y));
  };

  try {
    const [ideationResult, editorialResult, readyResult, productionResult, liveResult, analyticsResult] = await Promise.all([
      fetchIdeationTabRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({
          rows: [],
          error:
            error?.message || "The Ideation tracker tab is not accessible. Check the sheet sharing settings.",
        })),
      fetchEditorialWorkflowRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({ rows: [], error: error?.message || "Editorial source unavailable." })),
      fetchReadyForProductionWorkflowRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({ rows: [], error: error?.message || "Ready for Production source unavailable." })),
      fetchProductionWorkflowRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({ rows: [], error: error?.message || "Production source unavailable." })),
      fetchLiveWorkflowRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({ rows: [], error: error?.message || "Live source unavailable." })),
      fetchAnalyticsLiveTabRows()
        .then((value) => ({ rows: value?.rows || [], error: "" }))
        .catch((error) => ({ rows: [], error: error?.message || "Analytics source unavailable for Full Gen AI." })),
    ]);

    // Apply year filter to live rows (by Final Upload Date)
    if (liveResult?.rows) liveResult.rows = liveResult.rows.filter(liveRowMatchesYear);
    if (analyticsResult?.rows) analyticsResult.rows = analyticsResult.rows.filter((row) => {
      const d = normalizeText(row?.liveDate || row?.finalUploadDate || "");
      return !d || selectedYears.some((y) => d.startsWith(y));
    });

    const fallbackFromLive = buildFallbackWorkflowFromLiveRows(liveResult?.rows || []);
    const workflowEditorialRows =
      Array.isArray(editorialResult?.rows) && editorialResult.rows.length > 0
        ? editorialResult.rows
        : fallbackFromLive.editorialRows;
    const workflowReadyRows =
      Array.isArray(readyResult?.rows) && readyResult.rows.length > 0
        ? readyResult.rows
        : fallbackFromLive.readyRows;
    const workflowProductionRows =
      Array.isArray(productionResult?.rows) && productionResult.rows.length > 0
        ? productionResult.rows
        : fallbackFromLive.productionRows;

    const beatRows = buildBeatRows(ideationResult?.rows || []);
    const workflowRows = buildWorkflowRows({
      editorialRows: workflowEditorialRows,
      readyRows: workflowReadyRows,
      productionRows: workflowProductionRows,
      liveRows: liveResult?.rows || [],
    });
    const filteredWorkflowRows = workflowRows.filter((row) => isIncludedWorkflowAssetCode(row?.assetCode, includeGuAssets));
    const scopedBeatRows = beatRows.filter((row) => isBeatRowInRange(row, weekSelection));
    const scopedWorkflowRows = filteredWorkflowRows.filter((row) => isDateWithinWeek(row.stageDate, weekSelection));
    const approvedMatchedRows = buildApprovedMatchedRows(scopedBeatRows, filteredWorkflowRows);

    // Pre-compute beat counts server-side (unique by beatCode or show|beat)
    const totalBeatsCount = (() => {
      const seen = new Set();
      for (const row of scopedBeatRows) {
        const key = normalizeKey(row.beatCode) || `${normalizeKey(row.showName)}|${normalizeKey(row.beatName)}`;
        if (key) seen.add(key);
      }
      return seen.size;
    })();
    const approvedBeatsCount = (() => {
      const seen = new Set();
      for (const row of scopedBeatRows) {
        if (row.statusCategory !== "approved") continue;
        const key = normalizeKey(row.beatCode) || `${normalizeKey(row.showName)}|${normalizeKey(row.beatName)}`;
        if (key) seen.add(key);
      }
      return seen.size;
    })();
    const fullGenAiRows = buildFullGenAiRows(
      filteredWorkflowRows,
      analyticsResult?.rows || [],
      weekSelection.weekStart,
      weekSelection.weekEnd
    );
    const currentWeekUpdateRows = buildCurrentWeekUpdateRows(beatRows, filteredWorkflowRows, weekSelection);
    const podThroughputRows = buildPodThroughputRowsForRange(filteredWorkflowRows, weekSelection.weekStart, weekSelection.weekEnd);

    // Build GU rework map from raw live rows (before asset-code filtering, so GU codes are included)
    // Maps: original GA/GI/GU code → GU code it was reworked into (covers GA→GU, GI→GU, GU→GU chains)
    const liveReworkMap = {};
    for (const row of liveResult?.rows || []) {
      const reworkCode = normalizeText(row?.reworkGaCode || "").toUpperCase();
      const assetCode = normalizeText(row?.assetCode || "").toUpperCase();
      if (reworkCode && assetCode.startsWith("GU")) {
        liveReworkMap[reworkCode] = assetCode;
      }
    }

    // Collect GU rows with full field data for CPI×CPS table
    // Raw live rows use dateSubmittedByLead (not strictLeadSubmittedDate which is only on processed workflow rows)
    const liveGuRows = (liveResult?.rows || [])
      .filter((row) => normalizeText(row?.assetCode || "").toUpperCase().startsWith("GU"))
      .map((row) => ({
        assetCode: normalizeText(row?.assetCode || "").toUpperCase(),
        showName: normalizeText(row?.showName || ""),
        beatName: normalizeText(row?.beatName || ""),
        cpiUsd: row?.cpiUsd ?? null,
        strictLeadSubmittedDate: normalizeText(row?.dateSubmittedByLead || ""),
        finalUploadDate: normalizeText(row?.finalUploadDate || row?.liveDate || ""),
        reworkGaCode: normalizeText(row?.reworkGaCode || "").toUpperCase(),
        podLeadName: normalizeText(row?.podLeadRaw || row?.podLeadName || ""),
        writerName: normalizeText(row?.writerName || ""),
      }));

    const responsePayload = {
      ok: true,
      period: startDate || endDate ? "range" : period,
      selectedWeekKey: weekSelection.weekKey,
      selectedWeekRangeLabel: formatWeekRangeLabel(weekSelection.weekStart, weekSelection.weekEnd),
      weekStart: weekSelection.weekStart,
      weekEnd: weekSelection.weekEnd,
      confidenceNote: "",
      filters: buildFilterOptions(scopedBeatRows),
      totalBeatsCount,
      approvedBeatsCount,
      beatRows: scopedBeatRows,
      allBeatRows: beatRows,
      workflowRows: scopedWorkflowRows,
      allWorkflowRows: filteredWorkflowRows,
      approvedMatchedRows,
      fullGenAiRows,
      allAnalyticsRows: Array.isArray(analyticsResult?.rows) ? analyticsResult.rows : [],
      fullGenAiSourceError: analyticsResult?.error || "",
      ideationSourceError: ideationResult?.error || "",
      editorialSourceError: editorialResult?.error || "",
      readyForProductionSourceError: readyResult?.error || "",
      productionSourceError: productionResult?.error || "",
      liveSourceError: liveResult?.error || "",
      currentWeekUpdateRows,
      podThroughputRows,
      liveReworkMap,
      liveGuRows,
    };
    // Await the cache write — "void" doesn't work in serverless because the
    // function terminates after return before the async write can complete.
    await writeResponseCache(cachePath, responsePayload);
    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json({
      ok: true,
      error: error.message || "Unable to load leadership overview.",
      period: startDate || endDate ? "range" : period,
      selectedWeekKey: weekSelection.weekKey,
      selectedWeekRangeLabel: formatWeekRangeLabel(weekSelection.weekStart, weekSelection.weekEnd),
      confidenceNote: "",
      filters: [],
      beatRows: [],
      allBeatRows: [],
      workflowRows: [],
      allWorkflowRows: [],
      approvedMatchedRows: [],
      fullGenAiRows: [],
      allAnalyticsRows: [],
      fullGenAiSourceError: "Analytics source unavailable.",
      ideationSourceError: "Ideation source unavailable.",
      currentWeekUpdateRows: [],
    });
  }
}
