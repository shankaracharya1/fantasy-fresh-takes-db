import { evictInMemorySheetCache, expireSupabaseSheetCache, IDEATION_TAB_NAME, EDITORIAL_TAB_NAME, READY_FOR_PRODUCTION_TAB_NAME, PRODUCTION_TAB_NAME, LIVE_TAB_NAME } from "../../../../lib/live-tab.js";

const ALL_SHEET_NAMES = [
  IDEATION_TAB_NAME,
  EDITORIAL_TAB_NAME,
  READY_FOR_PRODUCTION_TAB_NAME,
  PRODUCTION_TAB_NAME,
  LIVE_TAB_NAME,
];

export async function POST() {
  try {
    // Evict all in-memory caches (instant)
    evictInMemorySheetCache();

    // Expire all Supabase caches (writes cachedAt=0 so the TTL check fails on next read)
    await Promise.allSettled(ALL_SHEET_NAMES.map((name) => expireSupabaseSheetCache(name)));

    return Response.json({ ok: true, message: "Cache cleared. Next request will fetch fresh data from Google Sheets." });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Failed to clear cache." }, { status: 500 });
  }
}
