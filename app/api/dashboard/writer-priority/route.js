import { NextResponse } from "next/server";
import {
  fetchEditorialWorkflowRows,
  fetchLiveWorkflowRows,
  fetchProductionWorkflowRows,
  fetchReadyForProductionTabRows,
  fetchReadyForProductionWorkflowRows,
} from "../../../../lib/live-tab.js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const STATUS_HOLD = "HOLD";
const STATUS_WIP_WITH_WRITER = "WIP WITH WRITER";
const STATUS_FEEDBACK = "FEEDBACK - NEED REVISION";
const STATUS_COMPLETED = "COMPLETED BY WRITER";
const STATUS_APPROVED_FOR_PRODUCTION = "APPROVED FOR PRODUCTION BY CL";

const SOURCE_PRIORITY = {
  ready_for_production: 4,
  editorial: 3,
  production: 2,
  live: 1,
};

const POD_ROSTER = [
  {
    podLeadName: "Woodward",
    writers: ["Michael Ouzas", "Jasper Chen", "Krystle Drew", "Amitabh Klenn"],
  },
  {
    podLeadName: "Roth",
    writers: ["Joe Osborn", "Ari Jacobson", "Micah McFarland"],
  },
  {
    podLeadName: "Gilatar",
    writers: ["Carolina Munhoz", "Cory Crouser", "William Heus"],
  },
  {
    podLeadName: "Lee",
    writers: ["Jonathan Hernandez", "Miguel Silan", "Nandita Seshadri", "Will Morgan", "Minoti Vaishnav"],
  },
  {
    podLeadName: "Berman",
    writers: ["Dylan Owens", "Beau Rawlins", "Doris McGill", "Jake Wells", "Daniel Jackson"],
  },
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value) {
  return normalizeText(value).toUpperCase();
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function pickFirstIsoDate(...values) {
  for (const value of values) {
    if (isIsoDate(value)) return value;
  }
  return "";
}

function chooseEarlierDate(currentValue, nextValue) {
  const current = isIsoDate(currentValue) ? currentValue : "";
  const next = isIsoDate(nextValue) ? nextValue : "";
  if (!next) return current;
  if (!current) return next;
  return next < current ? next : current;
}

function chooseText(currentValue, nextValue) {
  return normalizeText(currentValue) || normalizeText(nextValue) || "";
}

function getExplicitWriterDate(row) {
  return pickFirstIsoDate(row?.wipDate, row?.dateAssigned, row?.writerSubmittedDate, row?.dateSubmittedByWriter);
}

function getExplicitLeadDate(row) {
  // In this workflow, Review Pending starts when the writer submits the script.
  return pickFirstIsoDate(
    row?.reviewPendingDate,
    row?.dateSubmittedByWriter,
    row?.strictLeadSubmittedDate,
    row?.leadSubmittedDate,
    row?.dateSubmittedByLead
  );
}

function getApprovedForProductionDate(source, row) {
  if (source === "production" || source === "live") {
    return "";
  }

  const status = normalizeStatus(row?.scriptStatus || row?.status);
  return pickFirstIsoDate(
    row?.approvedForProdDate,
    row?.etaToStartProd,
    isStatusApprovedForProduction(status) ? row?.dateSubmittedByLead : "",
    isStatusApprovedForProduction(status) ? row?.leadSubmittedDate : "",
    isStatusApprovedForProduction(status) ? row?.strictLeadSubmittedDate : ""
  );
}

function makeRecordKey(row) {
  const assetCode = normalizeText(row?.assetCode);
  if (assetCode) return `asset:${assetCode.toUpperCase()}`;

  const scriptCode = normalizeText(row?.scriptCode);
  if (scriptCode) return `script:${scriptCode.toUpperCase()}`;

  const writer = normalizeKey(row?.writerName);
  const show = normalizeKey(row?.showName);
  const beat = normalizeKey(row?.beatName);
  if (writer || show || beat) {
    return `fallback:${writer}|${show}|${beat}`;
  }

  return "";
}

function isPriorityAsset(assetCode) {
  const code = normalizeText(assetCode).toUpperCase();
  return Boolean(code) && (code.startsWith("GA") || code.startsWith("GI"));
}

function abbreviateShowName(showName) {
  return normalizeText(showName)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

function buildDisplayLabel(record) {
  const assetCode = normalizeText(record?.assetCode);
  const showAbbr = abbreviateShowName(record?.showName);
  const beatName = normalizeText(record?.beatName);
  return [assetCode, showAbbr, beatName].filter(Boolean).join(" ");
}

function buildWriterSummaryLabel(record, options = {}) {
  const writerName = normalizeText(record?.writerName);
  const displayLabel = buildDisplayLabel(record);
  const parts = [writerName, displayLabel].filter(Boolean);

  if (options.includeAssignedDate) {
    const assignedDate = formatDisplayDate(record?.assignedDate);
    if (assignedDate) {
      parts.push(assignedDate);
    }
  }

  return parts.join(" - ");
}

function buildDateList(startDate, endDate) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    return [];
  }

  const dates = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const finish = new Date(`${endDate}T12:00:00Z`);

  while (cursor <= finish) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function formatDisplayDate(value) {
  if (!isIsoDate(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function diffDays(startDate, endDate) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return null;
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function displayPodLeadName(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) return "Unknown";
  const parts = cleaned.split(" ");
  return parts[parts.length - 1] || cleaned;
}

function matchesName(left, right) {
  return normalizeKey(left) === normalizeKey(right);
}

function getHoldEndDate(record) {
  return (
    (isIsoDate(record?.approvedForProdDate) && record.approvedForProdDate) ||
    (isIsoDate(record?.leadSubmittedDate) && record.leadSubmittedDate) ||
    (isIsoDate(record?.writerSubmittedDate) && record.writerSubmittedDate) ||
    ""
  );
}

function isStatusHold(status) {
  return status === STATUS_HOLD;
}

function isStatusWip(status) {
  return status === STATUS_WIP_WITH_WRITER;
}

function isStatusFeedback(status) {
  return status === STATUS_FEEDBACK;
}

function isStatusCompleted(status) {
  return status === STATUS_COMPLETED;
}

function isStatusApprovedForProduction(status) {
  return status === STATUS_APPROVED_FOR_PRODUCTION;
}

function isWriterVisibleOnDate(record, targetDate, writerName) {
  if (!matchesName(record?.writerName, writerName)) return false;
  if (!isPriorityAsset(record?.assetCode)) return false;

  const writerStartDate = isIsoDate(record?.writerSubmittedDate) ? record.writerSubmittedDate : "";
  const reviewPendingDate = isIsoDate(record?.leadSubmittedDate) ? record.leadSubmittedDate : "";
  const approvedForProdDate = isIsoDate(record?.approvedForProdDate) ? record.approvedForProdDate : "";
  const holdEnd = getHoldEndDate(record);
  const status = normalizeStatus(record?.scriptStatus);
  const isWorkflowRecord = Boolean(record?.hasEditorial || record?.hasReadyForProduction);

  if (!isWorkflowRecord || !writerStartDate || !status) return false;

  if (isStatusHold(status)) {
    if (approvedForProdDate) {
      return (
        (targetDate >= writerStartDate && (!reviewPendingDate || targetDate <= reviewPendingDate)) ||
        targetDate === approvedForProdDate
      );
    }
    if (reviewPendingDate) {
      return targetDate >= writerStartDate && targetDate <= reviewPendingDate;
    }
    return Boolean(holdEnd) && targetDate >= writerStartDate && targetDate <= holdEnd;
  }

  if (isStatusWip(status)) {
    return targetDate >= writerStartDate;
  }

  if (isStatusFeedback(status)) {
    const start = reviewPendingDate || writerStartDate;
    return targetDate >= start && (!approvedForProdDate || targetDate <= approvedForProdDate);
  }

  if (isStatusCompleted(status)) {
    return writerStartDate === reviewPendingDate && targetDate === reviewPendingDate;
  }

  if (isStatusApprovedForProduction(status)) {
    return (
      writerStartDate === reviewPendingDate &&
      reviewPendingDate === approvedForProdDate &&
      targetDate === approvedForProdDate
    );
  }

  return false;
}

function isReviewPendingOnDate(record, targetDate, podLeadName) {
  if (!matchesName(displayPodLeadName(record?.podLeadName), podLeadName)) return false;
  if (!isPriorityAsset(record?.assetCode)) return false;
  if (record?.hasProduction || record?.hasLive) return false;

  const reviewPendingDate = isIsoDate(record?.leadSubmittedDate) ? record.leadSubmittedDate : "";
  const approvedForProdDate = isIsoDate(record?.approvedForProdDate) ? record.approvedForProdDate : "";
  const holdEnd = getHoldEndDate(record);
  const status = normalizeStatus(record?.scriptStatus);

  if (!reviewPendingDate || !status) return false;

  if (isStatusHold(status)) {
    if (approvedForProdDate) {
      return targetDate >= reviewPendingDate && targetDate < approvedForProdDate;
    }
    return Boolean(holdEnd) && targetDate >= reviewPendingDate && targetDate <= holdEnd;
  }

  if (isStatusWip(status) || isStatusFeedback(status)) {
    return false;
  }

  if (isStatusCompleted(status) || isStatusApprovedForProduction(status)) {
    if (!approvedForProdDate) {
      return targetDate >= reviewPendingDate;
    }
    return targetDate >= reviewPendingDate && targetDate < approvedForProdDate;
  }

  return false;
}

function isApprovedForProductionOnDate(record, targetDate, podLeadName) {
  if (!matchesName(displayPodLeadName(record?.podLeadName), podLeadName)) return false;
  if (!isPriorityAsset(record?.assetCode)) return false;
  if (record?.hasProduction || record?.hasLive) return false;

  const approvedForProdDate = isIsoDate(record?.approvedForProdDate) ? record.approvedForProdDate : "";
  const status = normalizeStatus(record?.scriptStatus);
  if (!approvedForProdDate || !status) return false;
  if (!isStatusApprovedForProduction(status)) return false;
  if (isStatusHold(status)) {
    return targetDate === approvedForProdDate;
  }

  return targetDate === approvedForProdDate;
}

function uniqueSortedLabels(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function buildPodCellText(reviewItems, approvedItems) {
  const review = uniqueSortedLabels(reviewItems);
  const approved = uniqueSortedLabels(approvedItems);

  return [
    `Review Pending (${review.length})`,
    review.length > 0 ? `- ${review.join("\n- ")}` : "0",
    "",
    `Approved for Production (${approved.length})`,
    approved.length > 0 ? `- ${approved.join("\n- ")}` : "0",
  ].join("\n");
}

function buildWriterCellText(items) {
  return uniqueSortedLabels(items).join("\n");
}

function buildSummaryRows(records, startDate, endDate) {
  const dates = buildDateList(startDate, endDate);
  return POD_ROSTER.map((podConfig) => {
    const podRecords = records.filter((record) => matchesName(displayPodLeadName(record.podLeadName), podConfig.podLeadName));

    const approvedItems = uniqueSortedLabels(
      podRecords
        .filter((record) => {
          const approvedForProdDate = isIsoDate(record?.approvedForProdDate) ? record.approvedForProdDate : "";
          return (
            isPriorityAsset(record?.assetCode) &&
            approvedForProdDate &&
            approvedForProdDate >= startDate &&
            approvedForProdDate <= endDate
          );
        })
        .map((record) => buildWriterSummaryLabel(record))
    );

    const reviewPendingAgedItems = uniqueSortedLabels(
      podRecords
        .filter((record) => {
          const reviewPendingDate = isIsoDate(record?.leadSubmittedDate) ? record.leadSubmittedDate : "";
          if (!reviewPendingDate) return false;
          if (!isReviewPendingOnDate(record, endDate, podConfig.podLeadName)) return false;
          const ageInDays = diffDays(reviewPendingDate, endDate);
          return ageInDays !== null && ageInDays > 3;
        })
        .map((record) => buildWriterSummaryLabel(record))
    );

    const wipWithWritersItems = uniqueSortedLabels(
      podRecords
        .filter((record) => {
          const status = normalizeStatus(record?.scriptStatus);
          if (!isStatusWip(status)) return false;
          const writerName = normalizeText(record?.writerName);
          if (!writerName) return false;
          return dates.some((date) => isWriterVisibleOnDate(record, date, writerName));
        })
        .map((record) => buildWriterSummaryLabel(record, { includeAssignedDate: true }))
    );

    return {
      podLeadName: podConfig.podLeadName,
      wipWithWriters: {
        count: wipWithWritersItems.length,
        items: wipWithWritersItems,
      },
      approvedAssets: {
        count: approvedItems.length,
        items: approvedItems,
      },
      reviewPendingMoreThan3Days: {
        count: reviewPendingAgedItems.length,
        items: reviewPendingAgedItems,
      },
    };
  });
}

function mergeWorkflowRows(rowsBySource) {
  const merged = new Map();

  for (const { source, rows } of rowsBySource) {
    const priority = SOURCE_PRIORITY[source] || 0;

    for (const row of Array.isArray(rows) ? rows : []) {
      const key = makeRecordKey(row);
      if (!key) continue;

      const existing = merged.get(key) || {
        key,
        assetCode: "",
        scriptCode: "",
        podLeadName: "",
        writerName: "",
        showName: "",
        beatName: "",
        scriptStatus: "",
        statusPriority: -1,
        assignedDate: "",
        writerSubmittedDate: "",
        leadSubmittedDate: "",
        approvedForProdDate: "",
        productionDate: "",
        liveDate: "",
        hasEditorial: false,
        hasReadyForProduction: false,
        hasProduction: false,
        hasLive: false,
        rowOrder: merged.size,
      };

      existing.assetCode = chooseText(existing.assetCode, row?.assetCode);
      existing.scriptCode = chooseText(existing.scriptCode, row?.scriptCode);
      existing.podLeadName = chooseText(existing.podLeadName, row?.podLeadName);
      existing.writerName = chooseText(existing.writerName, row?.writerName);
      existing.showName = chooseText(existing.showName, row?.showName);
      existing.beatName = chooseText(existing.beatName, row?.beatName);

      const nextStatus = normalizeText(row?.scriptStatus || row?.status);
      if (nextStatus && priority > existing.statusPriority) {
        existing.scriptStatus = nextStatus;
        existing.statusPriority = priority;
      }

      const explicitWriterDate = getExplicitWriterDate(row);
      const explicitLeadDate = getExplicitLeadDate(row);
      const approvedForProdDate = getApprovedForProductionDate(source, row);
      const assignedDate = pickFirstIsoDate(row?.dateAssigned, row?.wipDate);

      existing.assignedDate = chooseEarlierDate(existing.assignedDate, assignedDate);
      existing.writerSubmittedDate = chooseEarlierDate(
        existing.writerSubmittedDate,
        explicitWriterDate
      );
      existing.leadSubmittedDate = chooseEarlierDate(existing.leadSubmittedDate, explicitLeadDate);
      existing.approvedForProdDate = chooseEarlierDate(existing.approvedForProdDate, approvedForProdDate);
      if (source === "production") {
        existing.productionDate = chooseEarlierDate(existing.productionDate, row?.etaToStartProd);
      }
      if (source === "live") {
        existing.liveDate = chooseEarlierDate(existing.liveDate, row?.finalUploadDate);
      }
      existing.hasEditorial = existing.hasEditorial || source === "editorial";
      existing.hasReadyForProduction = existing.hasReadyForProduction || source === "ready_for_production";
      existing.hasProduction = existing.hasProduction || source === "production";
      existing.hasLive = existing.hasLive || source === "live";

      merged.set(key, existing);
    }
  }

  return [...merged.values()].map((record) => ({
    ...record,
    podLeadName: displayPodLeadName(record.podLeadName),
    displayLabel: buildDisplayLabel(record),
  }));
}

function buildWriterPriorityRows(records, dates) {
  return POD_ROSTER.map((podConfig, podIndex) => {
      const podEntryRecords = records.filter((record) =>
        matchesName(displayPodLeadName(record.podLeadName), podConfig.podLeadName)
      );
      const podCells = {};

      for (const date of dates) {
        const reviewItems = podEntryRecords
          .filter((record) => isReviewPendingOnDate(record, date, podConfig.podLeadName))
          .map((record) => record.displayLabel);
        const approvedItems = podEntryRecords
          .filter(
            (record) =>
              isApprovedForProductionOnDate(record, date, podConfig.podLeadName) &&
              (record.hasEditorial || record.hasReadyForProduction) &&
              !record.hasProduction &&
              !record.hasLive
          )
          .map((record) => record.displayLabel);
        const liveItems = podEntryRecords
          .filter(
            (record) =>
              isPriorityAsset(record?.assetCode) &&
              record.hasLive &&
              isIsoDate(record.liveDate) &&
              record.liveDate === date
          )
          .map((record) => record.displayLabel);

        podCells[date] = {
          reviewItems: uniqueSortedLabels(reviewItems),
          approvedItems: uniqueSortedLabels(approvedItems),
          liveItems: uniqueSortedLabels(liveItems),
        };
      }

      const writers = podConfig.writers.map((writerName, writerIndex) => {
          const writerRecords = podEntryRecords.filter((record) => matchesName(record.writerName, writerName));
          const cells = {};

          for (const date of dates) {
            const items = writerRecords
              .filter((record) => isWriterVisibleOnDate(record, date, writerName))
              .map((record) => record.displayLabel);
            const text = buildWriterCellText(items);
            cells[date] = text;
          }

          return {
            writerName,
            rowOrder: writerIndex,
            cells,
          };
        })
        .sort((left, right) => left.rowOrder - right.rowOrder);

      return {
        podLeadName: podConfig.podLeadName,
        rowOrder: podIndex,
        podCells,
        writers,
      };
    })
    .sort((left, right) => left.rowOrder - right.rowOrder);
}

export async function GET(request) {
  const url = new URL(request.url);
  const startDate = normalizeText(url.searchParams.get("startDate"));
  const endDate = normalizeText(url.searchParams.get("endDate"));
  const dates = buildDateList(startDate, endDate);

  if (dates.length === 0) {
    return NextResponse.json({ error: "Valid startDate and endDate query parameters are required." }, { status: 400 });
  }

  try {
    const [editorialResult, readyResult, readyTabResult, productionResult, liveResult] = await Promise.all([
      fetchEditorialWorkflowRows(),
      fetchReadyForProductionWorkflowRows(),
      fetchReadyForProductionTabRows(),
      fetchProductionWorkflowRows(),
      fetchLiveWorkflowRows(),
    ]);

    const readyApprovedDateByAsset = new Map(
      (Array.isArray(readyTabResult?.rows) ? readyTabResult.rows : [])
        .filter((row) => normalizeText(row?.assetCode) && isIsoDate(row?.approvedForProdDate))
        .map((row) => [normalizeText(row.assetCode).toUpperCase(), row.approvedForProdDate])
    );

    const readyRows = (Array.isArray(readyResult?.rows) ? readyResult.rows : []).map((row) => {
      const assetCodeKey = normalizeText(row?.assetCode).toUpperCase();
      const approvedForProdDate = readyApprovedDateByAsset.get(assetCodeKey) || "";
      return {
        ...row,
        approvedForProdDate,
        etaToStartProd: row?.etaToStartProd || approvedForProdDate,
      };
    });

    const records = mergeWorkflowRows([
      { source: "editorial", rows: editorialResult?.rows || [] },
      { source: "ready_for_production", rows: readyRows },
      { source: "production", rows: productionResult?.rows || [] },
      { source: "live", rows: liveResult?.rows || [] },
    ]);

    return NextResponse.json({
      startDate,
      endDate,
      dates: dates.map((date) => ({ key: date, label: formatDisplayDate(date) })),
      summaries: buildSummaryRows(records, startDate, endDate),
      pods: buildWriterPriorityRows(records, dates),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to load Writer's Priority." },
      { status: 500 }
    );
  }
}
