import { evictInMemorySheetCache, expireSupabaseSheetCache, IDEATION_TAB_NAME, EDITORIAL_TAB_NAME, READY_FOR_PRODUCTION_TAB_NAME, PRODUCTION_TAB_NAME, LIVE_TAB_NAME } from "../../../../lib/live-tab.js";
import { writeJsonObject } from "../../../../lib/storage.js";

const ALL_SHEET_NAMES = [
  IDEATION_TAB_NAME,
  EDITORIAL_TAB_NAME,
  READY_FOR_PRODUCTION_TAB_NAME,
  PRODUCTION_TAB_NAME,
  LIVE_TAB_NAME,
];

// Write an invalidation token so all response-level caches treat themselves as stale.
// Any cached response whose cachedAt is older than this token will be ignored.
async function clearResponseCaches() {
  try {
    await writeJsonObject("response-cache/__invalidated-at.json", { invalidatedAt: Date.now() });
  } catch {
    // Non-fatal — response cache will expire naturally after TTL
  }
}

export async function POST() {
  try {
    // Evict all in-memory caches (instant)
    evictInMemorySheetCache();

    // Expire all Supabase sheet caches + invalidate response-level caches in parallel
    await Promise.allSettled([
      ...ALL_SHEET_NAMES.map((name) => expireSupabaseSheetCache(name)),
      clearResponseCaches(),
    ]);

    return Response.json({ ok: true, message: "Cache cleared. Next request will fetch fresh data from Google Sheets." });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Failed to clear cache." }, { status: 500 });
  }
}
