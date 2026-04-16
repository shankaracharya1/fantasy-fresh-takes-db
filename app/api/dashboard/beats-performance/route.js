import { NextResponse } from "next/server";
import { getBeatsPerformancePayload } from "../../../../lib/beats-performance.js";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  try {
    const payload = await getBeatsPerformancePayload({ force });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: true,
        error: error.message || "Unable to load beats performance dashboard.",
        warnings: ["Ideation tracker data is unavailable right now."],
        benchmark: {
          beatsPerPodPerWeek: 2,
          freshTakesPerPodPerWeek: 1,
        },
        filters: { months: [], pods: [] },
        rows: [],
        freshTakeRows: [],
        productionTimeline: {
          editorial: [],
          readyForProduction: [],
          production: [],
          live: [],
        },
        workflowTables: {
          editorial: [],
          readyForProduction: [],
          production: [],
          live: [],
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
