import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SHEET_ID = "1FbP_aQMe37UzHrvPPQSDu3qJoGHzzPENWV66GkzPRZw";
const GID = "580169117";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting quoted fields
  const parseLine = (line) => {
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
  };

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (values[idx] || "").trim(); });
    rows.push(obj);
  }

  return rows;
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

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    const rawRows = parseCSV(text);

    if (!rawRows.length) {
      return NextResponse.json({ ok: true, rows: [] });
    }

    const headers = Object.keys(rawRows[0]);
    const trackerCodeCol = findCol(headers, ["Tracker Code", "Tracker code", "tracker code", "Ad Code", "Asset Code"]);
    const cpsCol = findCol(headers, ["CPI on CPS", "Cpi on Cps", "cpi on cps"]);

    const rows = rawRows
      .map((row) => ({
        trackerCode: trackerCodeCol ? (row[trackerCodeCol] || "").trim().toUpperCase() : "",
        cpsValue: cpsCol ? (row[cpsCol] || "").trim() : "",
      }))
      .filter((r) => r.trackerCode);

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err), rows: [] }, { status: 500 });
  }
}
