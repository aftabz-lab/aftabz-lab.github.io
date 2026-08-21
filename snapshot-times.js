const SUPABASE_URL = "https://wstxgbzmsbosinmhhjbl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MCw_J7uorsKtmmokW1OpCg_Ej5DURhw";
const SNAPSHOT_TABLE = "dashboard_snapshots";
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
    hour12: true,
    timeZone: "Asia/Dhaka",
  });
}

async function readCloudSnapshotTime(snapshotKey) {
  const query = new URL(`${SUPABASE_URL}/rest/v1/${SNAPSHOT_TABLE}`);
  query.searchParams.set("select", "updated_at");
  query.searchParams.set("snapshot_key", `eq.${snapshotKey}`);
  query.searchParams.set("limit", "1");
  const response = await fetch(query, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Snapshot time unavailable (${response.status})`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0].updated_at : null;
}

async function readStaticSnapshotTime(snapshotKey) {
  const fallback = STATIC_FALLBACKS[snapshotKey];
  if (!fallback) return null;
  const response = await fetch(`${fallback.url}?_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  return fallback.time(await response.json()) || null;
}

async function readSnapshotTime(snapshotKey) {
  try {
    const cloudTime = await readCloudSnapshotTime(snapshotKey);
    if (cloudTime) return cloudTime;
  } catch {}
  return readStaticSnapshotTime(snapshotKey);
}

async function loadSnapshotTimes() {
  const nodes = [...document.querySelectorAll("[data-snapshot-key]")];
  await Promise.all(nodes.map(async node => {
    try {
      node.textContent = formatSnapshotTime(await readSnapshotTime(node.dataset.snapshotKey));
    } catch {
      node.textContent = "Temporarily unavailable";
    }
  }));
}

loadSnapshotTimes();
