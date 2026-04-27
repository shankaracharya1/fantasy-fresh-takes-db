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

  return function resolveWriterName(rawValue) {
    const cleaned = normalizeText(rawValue);
    if (!cleaned) return "Unknown Writer";
    const aliased = normalizeWriterName(cleaned);
    const aliasedKey = normalizeKey(aliased);
    if (exactMap.has(aliasedKey)) return exactMap.get(aliasedKey);

    const key = normalizeKey(aliased);
    if (exactMap.has(key)) return exactMap.get(key);

    const prefixMatches = prefixCandidates.filter((candidate) => candidate.key.startsWith(key));
    if (prefixMatches.length === 1) return prefixMatches[0].displayName;

    const firstWordMatches = prefixCandidates.filter((candidate) => {
      if (candidate.displayName.includes(",")) return false;
      return candidate.key.split(" ")[0] === key;
    });
    if (firstWordMatches.length === 1) return firstWordMatches[0].displayName;

    const tokenMatches = tokenMap.get(key);
    if (tokenMatches && tokenMatches.size === 1) {
      return Array.from(tokenMatches)[0];
    }

    return aliased;
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
      writerName: normalizeText(row?.writerName),
      statusLabel: normalizeText(row?.status || row?.beatsStatus),
      statusCategory: categorizeIdeationStatus(row?.status || row?.beatsStatus),
      scriptStatus: normalizeText(row?.scriptStatus || ""),
        beatsAssignedDate: parsedBeatsAssignedDate,
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

function findWorkflowMatches(ideationRow, workflowRows) {
  const beatCode = normalizeKey(ideationRow?.beatCode);
  const showKey = normalizeKey(ideationRow?.showName);
  const beatName = normalizeText(ideationRow?.beatName);

  if (beatCode) {
    const exactCodeMatches = workflowRows.filter(
      (row) => normalizeKey(row?.scriptCode) === beatCode || normalizeKey(row?.assetCode) === beatCode
    );
    if (exactCodeMatches.length > 0) return exactCodeMatches;
  }

  const sameShowRows = workflowRows.filter((row) => normalizeKey(row?.showName) === showKey);
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
  return beatRows
    .filter((row) => row.statusCategory === "approved")
    .map((row, index) => {
      const bestMatch = getBestWorkflowMatch(findWorkflowMatches(row, workflowRows));
      return {
        id: `approved-match-${index + 1}`,
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

// Build Full Gen AI detail rows using the EXACT same filter logic as POD Throughput.
// Each row = one script entry (no deduplication), so counts match POD Throughput exactly.
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

  // Same filter as buildPodThroughputRowsForRange: FT → strictLeadSubmittedDate, RW → etaToStartProd
  const filtered = (Array.isArray(workflowRows) ? workflowRows : []).filter((row) => {
    const source = String(row?.source || "");
    if (!["editorial", "ready_for_production", "production", "live"].includes(source)) return false;
    if (!isFullGenAiAssetCode(row?.assetCode)) return false;
    const isFt = classifyFtRw(row?.reworkType) === "ft";
    if (isFt) {
      const d = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
      return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
    } else {
      if (!["ready_for_production", "production", "live"].includes(source)) return false;
      const d = String(row?.etaToStartProd || "").slice(0, 10);
      return d && (!startDate || d >= startDate) && (!endDate || d <= endDate);
    }
  });

  return filtered.map((row, index) => {
    const code = normalizeText(row?.assetCode || "").toUpperCase();
    const aRow = analyticsMap.get(code) || {};
    const hasAnalytics = Object.keys(aRow).length > 0;
    const isFt = classifyFtRw(row?.reworkType) === "ft";
    const dateForBucket = isFt
      ? String(row?.strictLeadSubmittedDate || "").slice(0, 10)
      : String(row?.etaToStartProd || "").slice(0, 10);
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

  for (const beat of beatRows.filter((row) => isDateWithinWeek(row.completedDate, weekSelection))) {
    const bestMatch = getBestWorkflowMatch(findWorkflowMatches(beat, workflowRows));
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
  const filtered = (Array.isArray(workflowRows) ? workflowRows : []).filter((row) => {
    const source = String(row?.source || "");
    if (!["editorial", "ready_for_production", "production", "live"].includes(source)) return false;
    const isFt = classifyFtRw(row?.reworkType) === "ft";
    if (isFt) {
      // Fresh Take: strict Date submitted by Lead across all 4 sheets (no fallbacks)
      const d = String(row?.strictLeadSubmittedDate || "").slice(0, 10);
      return d && d >= startDate && d <= endDate;
    } else {
      // Rework: Production, Ready for Production, and Live sheets — Date approved for prod (etaToStartProd)
      if (!["ready_for_production", "production", "live"].includes(source)) return false;
      const d = String(row?.etaToStartProd || "").slice(0, 10);
      return d && d >= startDate && d <= endDate;
    }
  });

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
      pod.writers.set(writer, { writerName: writer, totalScripts: 0, ftCount: 0, rwCount: 0 });
    }
    return pod.writers.get(writer);
  };

  for (const row of filtered) {
    const pod = ensurePod(normalizePodLeadName(row?.podLeadName || row?.podLeadRaw) || row?.podLeadName || row?.podLeadRaw);
    pod.totalScripts += 1;
    const writer = ensureWriter(pod, resolveWriterName(row?.writerName));
    writer.totalScripts += 1;

    const scriptType = classifyFtRw(row?.reworkType);
    if (scriptType === "ft") {
      pod.ftCount += 1;
      writer.ftCount += 1;
    } else {
      pod.rwCount += 1;
      writer.rwCount += 1;
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
            });
          }
          const target = acc.get(key);
          target.totalScripts += Number(writer.totalScripts || 0);
          target.ftCount += Number(writer.ftCount || 0);
          target.rwCount += Number(writer.rwCount || 0);
          return acc;
        }, new Map()).values()
      );

      const mergedByPodLocalAlias = collapsedByResolvedName.reduce((acc, row) => {
        const current = {
          writerName: row.writerName,
          totalScripts: Number(row.totalScripts || 0),
          ftCount: Number(row.ftCount || 0),
          rwCount: Number(row.rwCount || 0),
        };
        const tokens = normalizeKey(current.writerName).split(" ").filter(Boolean);
        const isSingleToken = tokens.length === 1;

        if (isSingleToken) {
          const [token] = tokens;
          const fullNameCandidates = Array.from(acc.values()).filter((candidate) => {
            const candidateTokens = normalizeKey(candidate.writerName).split(" ").filter(Boolean);
            return candidateTokens.length > 1 && candidateTokens[0] === token;
          });
          if (fullNameCandidates.length > 0) {
            const target = fullNameCandidates.sort(
              (a, b) => b.totalScripts - a.totalScripts || a.writerName.localeCompare(b.writerName)
            )[0];
            target.totalScripts += current.totalScripts;
            target.ftCount += current.ftCount;
            target.rwCount += current.rwCount;
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
        return acc;
      }, new Map());

      return {
        podLeadName: pod.podLeadName,
        totalScripts: pod.totalScripts,
        ftCount: pod.ftCount,
        rwCount: pod.rwCount,
        writerRows: Array.from(mergedByPodLocalAlias.values()).sort(
          (a, b) => b.totalScripts - a.totalScripts || a.writerName.localeCompare(b.writerName)
        ),
      };
    });
}

export async function GET(request) {
  const url = new URL(request.url);
  const period = normalizeWeekView(url.searchParams.get("period") || "current");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const includeGuAssets = String(url.searchParams.get("includeGuAssets") || "").toLowerCase() === "true";
  const weekSelection = startDate || endDate ? buildDateRangeSelection({ startDate, endDate, period }) : getWeekSelection(period);

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

    return NextResponse.json({
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
    });
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
