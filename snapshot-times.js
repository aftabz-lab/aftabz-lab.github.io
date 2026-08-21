const SUPABASE_URL = "https://wstxgbzmsbosinmhhjbl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MCw_J7uorsKtmmokW1OpCg_Ej5DURhw";
const SNAPSHOT_TABLE = "dashboard_snapshots";
const SNAPSHOT_TIME_REFRESH_MS = 1000;
const staticFallbackCache = new Map();
let loadPromise = null;
const STATIC_FALLBACKS = Object.freeze({
  zreport: {
    url: "/zreport-dual-dashboard/data/index.json",
    time: payload => payload?.meta?.generatedAt,
  },
  "zone-distribution": {
    url: "/zone-distribution-dashboard/data/dashboard_data.json",
    time: payload => payload?.meta?.generatedAt,
  },
  visit: {
    url: "/visit-compliance-dashboard/data/dashboard_data.json",
    time: payload => payload?.metadata?.snapshotTakenAt || payload?.metadata?.generatedAt,
  },
  audit: {
    url: "/visit-compliance-dashboard/data/shared_snapshot.json",
    time: payload => payload?.audit?.metadata?.generatedAt || payload?.generatedAt,
  },
});

function formatSnapshotTime(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Not published yet";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  });
}

async function readCloudSnapshotTimes(snapshotKeys) {
  const query = new URL(`${SUPABASE_URL}/rest/v1/${SNAPSHOT_TABLE}`);
  query.searchParams.set("select", "snapshot_key,updated_at");
  query.searchParams.set("snapshot_key", `in.(${snapshotKeys.map(key => `"${key}"`).join(",")})`);
  const response = await fetch(query, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Snapshot time unavailable (${response.status})`);
  const rows = await response.json();
  return new Map((Array.isArray(rows) ? rows : []).map(row => [row.snapshot_key, row.updated_at]));
}

async function readStaticSnapshotTime(snapshotKey) {
  const fallback = STATIC_FALLBACKS[snapshotKey];
  if (!fallback) return null;
  if (!staticFallbackCache.has(snapshotKey)) {
    staticFallbackCache.set(snapshotKey, (async () => {
      const response = await fetch(fallback.url, { cache: "no-store" });
      if (!response.ok) return null;
      return fallback.time(await response.json()) || null;
    })().catch(() => null));
  }
  return staticFallbackCache.get(snapshotKey);
}

async function loadSnapshotTimes() {
  if (loadPromise) return loadPromise;
  const run = loadSnapshotTimesNow();
  loadPromise = run;
  try { return await run; }
  finally { if (loadPromise === run) loadPromise = null; }
}

async function loadSnapshotTimesNow() {
  const nodes = [...document.querySelectorAll("[data-snapshot-key]")];
  const keys = [...new Set(nodes.map(node => node.dataset.snapshotKey).filter(Boolean))];
  let cloudTimes = new Map();
  try { cloudTimes = await readCloudSnapshotTimes(keys); }
  catch { /* Each card falls back to its last static build timestamp. */ }
  await Promise.all(nodes.map(async node => {
    try {
      const key = node.dataset.snapshotKey;
      const value = cloudTimes.get(key) || await readStaticSnapshotTime(key);
      node.textContent = formatSnapshotTime(value);
    } catch {
      node.textContent = "Temporarily unavailable";
    }
  }));
}

loadSnapshotTimes();
setInterval(loadSnapshotTimes, SNAPSHOT_TIME_REFRESH_MS);
