import { NextResponse } from "next/server";
import {
  POD_LEAD_ORDER,
  fetchEditorialTabRows,
} from "../../../../lib/live-tab.js";
import { getWeekSelection } from "../../../../lib/week-view.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

export async function GET() {
  try {
    const { rows: editorialRows } = await fetchEditorialTabRows();
    const nextWeek = getWeekSelection("next");

    const pods = POD_LEAD_ORDER.map((podName) => {
      const podKey = normalizeKey(podName);
      const podRows = (editorialRows || []).filter(
        (row) => normalizeKey(row.podLeadName) === podKey
      );

      // Beats pending vs approved for next week
      const nextWeekRows = podRows.filter((row) => {
        const date = row.submittedDate || "";
        return date >= nextWeek.weekStart && date <= nextWeek.weekEnd;
      });
      const approvedBeats = nextWeekRows.filter(
        (row) => normalizeKey(row.status) === "approved for production by cl"
      ).length;
      const pendingBeats = nextWeekRows.length - approvedBeats;

      // Scripts to review (status = "Completed by writer")
      const scriptsToReview = podRows.filter(
        (row) => normalizeKey(row.status) === "completed by writer"
      ).length;

      return {
        podLeadName: podName,
        pendingBeats,
        approvedBeats,
        scriptsToReview,
      };
    });

    return NextResponse.json({ ok: true, pods });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Unable to load POD tasks." },
      { status: error.statusCode || 500 }
    );
  }
}
