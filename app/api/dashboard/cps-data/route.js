import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SHEET_ID = "1FbP_aQMe37UzHrvPPQSDu3qJoGHzzPENWV66GkzPRZw";
const GID = "580169117";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// Parse a single CSV line respecting quoted fields
function parseLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const found = headers.find((h) => h.trim().toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  // Partial match fallback
  for (const c of candidates) {
    const found = headers.find((h) => h.trim().toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return null;
}

// Strip leading $ and parse as number string, e.g. "$21.2" → "21.2"
function parseCpsValue(raw) {
  return (raw || "").replace(/^\$/, "").trim();
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/);

    // The sheet has 2 preamble rows before the real header.
    // Find the header row by looking for "Tracker Code" in the first 10 lines.
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      if (lines[i].toLowerCase().includes("tracker code")) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return NextResponse.json({ ok: false, error: "Header row with 'Tracker Code' not found", rows: [] });
    }

    const headers = parseLine(lines[headerIdx]);
    const trackerCodeCol = findCol(headers, ["Tracker Code", "Tracker code", "tracker code", "Ad Code", "Asset Code"]);
    const cpsCol = findCol(headers, ["CPI on CPS", "Cpi on Cps", "cpi on cps"]);

    if (!trackerCodeCol || !cpsCol) {
      return NextResponse.json({ ok: false, error: `Columns not found — trackerCode: ${trackerCodeCol}, cps: ${cpsCol}`, rows: [] });
    }

    const trackerIdx = headers.indexOf(trackerCodeCol);
    const cpsIdx = headers.indexOf(cpsCol);
    const rows = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseLine(line);
      const trackerCode = (values[trackerIdx] || "").trim().toUpperCase();
      const cpsValue = parseCpsValue(values[cpsIdx] || "");
      if (trackerCode) rows.push({ trackerCode, cpsValue });
    }

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err), rows: [] }, { status: 500 });
  }
}
