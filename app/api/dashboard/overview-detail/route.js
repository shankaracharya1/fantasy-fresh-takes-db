import { NextResponse } from "next/server";
import {
  fetchEditorialWorkflowRows,
  fetchReadyForProductionWorkflowRows,
  fetchProductionWorkflowRows,
  fetchLiveWorkflowRows,
  normalizePodLeadName,
} from "../../../../lib/live-tab.js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SOURCE_LABEL = {
  editorial: "Editorial",
  ready_for_prod: "Ready for Prod",
  production: "Production",
  live: "Live",
};

function normalizeRow(row, source) {
  const podLeadName = normalizePodLeadName(row.podLeadName || row.podLeadRaw || "") || row.podLeadName || "";
  return {
    podLeadName,
    writerName: row.writerName || "",
    showName: row.showName || "",
    beatName: row.beatName || "",
    reworkType: row.reworkType || row.productionType || "",
    dateSubmittedByLead: row.dateSubmittedByLead || null,
    source,
    sourceLabel: SOURCE_LABEL[source] || source,
    assetCode: (row.assetCode || "").toUpperCase(),
    reworkGaCode: (row.reworkGaCode || "").toUpperCase(),
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";

    const [editorialResult, readyResult, productionResult, liveResult] = await Promise.all([
      fetchEditorialWorkflowRows(),
      fetchReadyForProductionWorkflowRows(),
      fetchProductionWorkflowRows(),
      fetchLiveWorkflowRows(),
    ]);

    const combined = [
      ...(editorialResult.rows || []).map((r) => normalizeRow(r, "editorial")),
      ...(readyResult.rows || []).map((r) => normalizeRow(r, "ready_for_prod")),
      ...(productionResult.rows || []).map((r) => normalizeRow(r, "production")),
      ...(liveResult.rows || []).map((r) => normalizeRow(r, "live")),
    ];

    const filtered = combined.filter((row) => {
      if (!row.dateSubmittedByLead) return false;
      if (!row.podLeadName && !row.writerName) return false;
      if (startDate && row.dateSubmittedByLead < startDate) return false;
      if (endDate && row.dateSubmittedByLead > endDate) return false;
      return true;
    });

    // Stable sort: by POD → writer → dateSubmittedByLead
    filtered.sort((a, b) => {
      const podCmp = (a.podLeadName || "").localeCompare(b.podLeadName || "");
      if (podCmp !== 0) return podCmp;
      const writerCmp = (a.writerName || "").localeCompare(b.writerName || "");
      if (writerCmp !== 0) return writerCmp;
      return (a.dateSubmittedByLead || "").localeCompare(b.dateSubmittedByLead || "");
    });

    return NextResponse.json({ ok: true, rows: filtered, total: filtered.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message, rows: [], total: 0 });
  }
}
