import { createServer } from "node:http";
import { createSign } from "node:crypto";
import { access, appendFile, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS = path.join(HERE, "repos");
const SUPABASE_URL = "https://wstxgbzmsbosinmhhjbl.supabase.co";
const SUPABASE_KEY = "sb_publishable_MCw_J7uorsKtmmokW1OpCg_Ej5DURhw";
const SESSION_KEY = "visit_compliance_supabase_publisher_session_v1";
const SYNC_KEY = "visit_compliance_supabase_sync_status_v1";
const DRIVE_TOKEN_KEY = "shwapno-gdrive-access-token-v1";
const DRIVE_EXPIRY_KEY = "shwapno-gdrive-access-token-expiry-v1";
const FOLDER_ID_KEY = "zone-gdrive-folder-id";
const FOLDER_NAME_KEY = "zone-gdrive-folder-name";
const OWNER_KEY = "shwapno-drive-owner-device-v1";
const DEFAULT_TIMEOUT_MS = 35 * 60 * 1000;
const ZONE_SNAPSHOT_KEY = "zone-distribution";
const ZONE_SCHEMA_FORMAT = "zone-required-headers-v1";
const VISIT_DRIVE_FOLDER_ID = "16HTr8nfPz4P2PMr4QB0bjgwiD110Qd-0";

const MIME = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

const ROUTES = Object.freeze([
  { prefix: "/zone-distribution-dashboard", root: path.join(REPOS, "zone", "web") },
  { prefix: "/zreport-dual-dashboard", root: path.join(REPOS, "zreport", "web") },
  { prefix: "/visit-compliance-dashboard", root: path.join(REPOS, "visit", "web") },
]);

function clean(value) {
  return String(value ?? "").trim();
}

export function visitSnapshotUsesDriveOnly(payload, folderId = VISIT_DRIVE_FOLDER_ID) {
  const data = payload?.data || payload?.visitDashboard || null;
  const metadata = data?.metadata || null;
  return Boolean(
    metadata
      && metadata.localSource === true
      && clean(metadata.driveFolderId) === clean(folderId)
      && clean(metadata.scheduleSource) === "selected Google Drive folder"
      && clean(metadata.responseFile)
      && clean(metadata.scheduleFile)
  );
}

export function classifyFile(name) {
  const value = clean(name);
  if (!/\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(value) || /^~\$/.test(value)) return [];
  const categories = [];
  if (/zone.*distribution|distribution.*location/i.test(value)) categories.push("zone");
  if (/z[\s_-]*report|category.*wise.*sales|sales.*ff.*outlet/i.test(value)) categories.push("zreport");
  if (/store.*operations.*compliance.*audit.*responses|audit.*responses|compliance.*responses|survey.*response/i.test(value)) categories.push("response");
  if (/visit.*schedule|compiled.*visit|master.*visit/i.test(value)) categories.push("schedule");
  if (/attendance/i.test(value)) categories.push("attendance");
  if (/product.*crit|criteria.*availability|avaiablity|product criteria/i.test(value)) categories.push("criteria");
  if (/stock.*extraction.*report/i.test(value)) categories.push("stock");
  return [...new Set(categories)].sort();
}

function parseChangePayload() {
  let payload = {};
  try { payload = JSON.parse(process.env.DRIVE_CHANGE_PAYLOAD || "{}"); }
  catch { payload = {}; }
  const files = Array.isArray(payload?.changed_files) ? payload.changed_files.map(clean).filter(Boolean) : [];
  const suppliedCategories = Array.isArray(payload?.changed_categories)
    ? payload.changed_categories.map(clean).filter(Boolean)
    : [];
  const inferredCategories = files.flatMap(classifyFile);
  return {
    ...payload,
    changed_files: files,
    changed_categories: [...new Set([...suppliedCategories, ...inferredCategories])].sort(),
  };
}

function targetsForChange(
  change,
  manual = clean(process.env.GITHUB_EVENT_NAME) === "workflow_dispatch",
  eventName = clean(process.env.GITHUB_EVENT_NAME),
) {
  const categories = new Set(change.changed_categories || []);
  if (eventName === "push" && categories.size === 0) return ["zone", "visit"];
  const all = manual || categories.size === 0;
  const targets = [];
  if (all || categories.has("zone")) targets.push("zone");
  if (all || categories.has("zreport")) targets.push("zreport");
  if (all || ["response", "schedule", "attendance"].some(item => categories.has(item))) targets.push("visit");
  if (all || ["response", "zone", "attendance", "criteria", "stock"].some(item => categories.has(item))) targets.push("audit");
  return targets;
}

function requireEnvironment() {
  const required = [
    "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    "GOOGLE_DRIVE_FOLDER_ID",
    "SUPABASE_PUBLISHER_EMAIL",
    "SUPABASE_PUBLISHER_PASSWORD",
  ];
  const missing = required.filter(key => !clean(process.env[key]));
  if (missing.length) throw new Error(`Missing GitHub Actions secrets: ${missing.join(", ")}`);
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function serviceAccountDriveToken() {
  let account;
  try { account = JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
  if (!account?.client_email || !account?.private_key) {
    throw new Error("The service-account JSON must contain client_email and private_key.");
  }
  const tokenUri = clean(account.token_uri) || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google service-account authorization failed (${response.status}): ${clean(payload?.error_description || payload?.error || text).slice(0, 300)}`);
  }
  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 3600)) * 1000,
    clientEmail: account.client_email,
  };
}

async function publisherSession() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SUPABASE_PUBLISHER_EMAIL,
      password: process.env.SUPABASE_PUBLISHER_PASSWORD,
    }),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    throw new Error(`Supabase publisher sign-in failed (${response.status}): ${clean(payload?.msg || payload?.message || payload?.error_description || payload?.error || text).slice(0, 300)}`);
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || "bearer",
    expires_in: Number(payload.expires_in || 3600),
    expires_at: Date.now() + Math.max(300, Number(payload.expires_in || 3600)) * 1000,
    user: payload.user || null,
  };
}

function normalizedHeader(value) {
  return clean(value).replace(/\s+/g, " ").toLocaleLowerCase();
}

function isoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)
      || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function zoneDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const text = clean(value);
  if (!text) return "";
  const number = typeof value === "number" ? value : Number(text);
  if (Number.isFinite(number)) {
    const parsed = XLSX.SSF.parse_date_code(number);
    if (parsed?.y) return isoDate(parsed.y, parsed.m, parsed.d) || text;
  }
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return isoDate(match[1], match[2], match[3]) || text;
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    return isoDate(match[3], match[2], match[1])
      || isoDate(match[3], match[1], match[2])
      || text;
  }
  match = text.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})$/);
  if (match) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(match[2].slice(0, 3).toLocaleLowerCase()) + 1;
    if (month) return isoDate(match[3], month, match[1]) || text;
  }
  return text;
}

function zoneNumberValue(value) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

export function parseZoneWorkbook(buffer, schema, fileName = "Zone Distribution workbook") {
  const required = Array.isArray(schema?.requiredHeaders) ? schema.requiredHeaders.map(clean).filter(Boolean) : [];
  if (!required.length) throw new Error("Zone Distribution schema has no required headers.");
  const requiredNormalized = required.map(normalizedHeader);
  const scanRows = Math.max(1, Number(schema?.headerScanRows || 20));
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellStyles: false });
  const matches = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: false });
    for (let headerIndex = 0; headerIndex < Math.min(scanRows, grid.length); headerIndex += 1) {
      const headerMap = new Map();
      (grid[headerIndex] || []).forEach((value, index) => {
        const key = normalizedHeader(value);
        if (key && !headerMap.has(key)) headerMap.set(key, index);
      });
      if (requiredNormalized.every(header => headerMap.has(header))) {
        matches.push({ sheetName, grid, headerIndex, headerMap });
      }
    }
  }

  if (!matches.length) {
    const error = new Error(`${fileName}: no worksheet matches all ${required.length} required Zone Distribution headers.`);
    error.code = "ZONE_SCHEMA_NO_MATCH";
    throw error;
  }
  if (matches.length > 1) {
    const locations = matches.map(match => `'${match.sheetName}' row ${match.headerIndex + 1}`).join(", ");
    const error = new Error(`${fileName}: more than one valid Zone Distribution table was found (${locations}).`);
    error.code = "ZONE_SCHEMA_AMBIGUOUS";
    throw error;
  }

  const match = matches[0];
  const numericColumns = new Set(Array.isArray(schema?.numericColumns) ? schema.numericColumns : []);
  const dateColumns = new Set(Array.isArray(schema?.dateColumns) ? schema.dateColumns : []);
  const rows = [];
  for (const sourceRow of match.grid.slice(match.headerIndex + 1)) {
    const row = {};
    let anyValue = false;
    for (let index = 0; index < required.length; index += 1) {
      const header = required[index];
      const value = sourceRow?.[match.headerMap.get(requiredNormalized[index])] ?? "";
      if (clean(value)) anyValue = true;
      if (numericColumns.has(header)) row[header] = zoneNumberValue(value);
      else if (dateColumns.has(header)) row[header] = zoneDateValue(value);
      else row[header] = clean(value);
    }
    if (anyValue) rows.push(row);
  }
  if (!rows.length) throw new Error(`${fileName}: the schema-matched table contains no data rows.`);

  const uniqueKey = clean(schema?.uniqueKey) || "CODE";
  const codes = rows.map(row => clean(row[uniqueKey]));
  const nonblankCodes = codes.filter(Boolean);
  return {
    rows,
    sheetName: match.sheetName,
    headerRow: match.headerIndex + 1,
    columns: required.map((label, index) => ({ index, label })),
    diagnostics: {
      blankCodes: codes.length - nonblankCodes.length,
      duplicateCodes: nonblankCodes.length - new Set(nonblankCodes).size,
    },
  };
}

function zoneFileScore(name) {
  const value = clean(name).toLocaleLowerCase();
  if (/^~\$/.test(value) || !/\.xlsx$/i.test(value)) return 99;
  if (/zone[ _-]*distribution.*location[ _-]*type/i.test(value)) return 0;
  if (/zone.*distribution|distribution.*location/i.test(value)) return 1;
  return 2;
}

async function listDriveFolderFiles(accessToken, folderId) {
  const escapedId = String(folderId).replace(/'/g, "\\'");
  const query = `'${escapedId}' in parents and trashed = false`;
  const files = [];
  let pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", query);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "modifiedTime desc,name");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,modifiedTime,size,capabilities(canDownload),driveId)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Could not list the Google Drive raw-data folder (${response.status}).`);
    const payload = await response.json();
    files.push(...(payload?.files || []));
    pageToken = payload?.nextPageToken || "";
  } while (pageToken);
  return files;
}

async function downloadDriveFile(accessToken, meta) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Could not download ${meta.name} from Google Drive (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function discoverZoneWorkbook(accessToken, folderId) {
  const schemaPath = path.join(REPOS, "zone", "config", "schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const files = (await listDriveFolderFiles(accessToken, folderId))
    .filter(meta => zoneFileScore(meta.name) < 99 && meta?.capabilities?.canDownload !== false)
    .sort((a, b) => zoneFileScore(a.name) - zoneFileScore(b.name)
      || Date.parse(b.modifiedTime || "") - Date.parse(a.modifiedTime || "")
      || clean(a.name).localeCompare(clean(b.name)));
  if (!files.length) throw new Error("No .xlsx workbook is available in the Google Drive raw-data folder.");

  const namedFiles = files.filter(meta => zoneFileScore(meta.name) < 2);
  const candidates = namedFiles.length ? [namedFiles[0]] : files;
  const diagnostics = [];
  for (const meta of candidates) {
    try {
      const buffer = await downloadDriveFile(accessToken, meta);
      const parsed = parseZoneWorkbook(buffer, schema, meta.name);
      return { meta, parsed, schema };
    } catch (error) {
      diagnostics.push(error?.message || String(error));
      // A specifically named current Zone file must never be replaced by an
      // older or unrelated workbook when its validation fails.
      if (namedFiles.length || error?.code === "ZONE_SCHEMA_AMBIGUOUS") throw error;
    }
  }
  throw new Error(`No .xlsx workbook matches the Zone Distribution schema. ${diagnostics.slice(0, 3).join(" ")}`);
}

async function readSnapshotRow(snapshotKey) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/dashboard_snapshots`);
  url.searchParams.set("select", "snapshot_key,payload,updated_at");
  url.searchParams.set("snapshot_key", `eq.${snapshotKey}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: { apikey: SUPABASE_KEY }, cache: "no-store" });
  if (!response.ok) throw new Error(`Could not read cloud snapshot ${snapshotKey} (${response.status}).`);
  const rows = await response.json();
  return rows?.[0] || null;
}

async function publishSnapshotRow(snapshotKey, payload, session) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_snapshots?on_conflict=snapshot_key`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ snapshot_key: snapshotKey, payload, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    const detail = clean(await response.text()).slice(0, 400);
    throw new Error(`Cloud snapshot publish failed for ${snapshotKey} (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

export async function runZoneSnapshot(initialTime, auth) {
  console.log("\n[zone] Reading the schema-matched Zone Distribution workbook directly from Google Drive.");
  const { meta, parsed, schema } = await discoverZoneWorkbook(auth.drive.accessToken, process.env.GOOGLE_DRIVE_FOLDER_ID);
  const fileSignature = [meta.id || "", meta.name || "", meta.size || "", meta.modifiedTime || ""].join("|");
  const current = await readSnapshotRow(ZONE_SNAPSHOT_KEY);
  if (current?.payload?.schemaFormat === ZONE_SCHEMA_FORMAT
      && current?.payload?.fileSignature === fileSignature
      && Array.isArray(current?.payload?.snapshot?.rows)
      && current.payload.snapshot.rows.length) {
    console.log(`[zone] ${meta.name} is already the published snapshot (${parsed.rows.length.toLocaleString()} rows).`);
    return { name: "zone", status: `Google Drive live · ${meta.name}`, changedKeys: [] };
  }

  const savedAt = new Date().toISOString();
  const snapshot = {
    version: 6,
    schemaFormat: ZONE_SCHEMA_FORMAT,
    sourceKind: "shared-cloud",
    fileName: meta.name,
    fileSignature,
    sheetName: parsed.sheetName,
    columns: parsed.columns,
    rows: parsed.rows,
    savedAt,
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    driveFileId: meta.id || "",
    diagnostics: parsed.diagnostics,
    schema: {
      requiredHeaders: schema.requiredHeaders,
      numericColumns: schema.numericColumns || [],
      dateColumns: schema.dateColumns || [],
      uniqueKey: schema.uniqueKey || "CODE",
    },
  };
  await publishSnapshotRow(ZONE_SNAPSHOT_KEY, {
    version: 1,
    format: "zone-snapshot-v1",
    schemaFormat: ZONE_SCHEMA_FORMAT,
    generatedAt: savedAt,
    fileSignature,
    snapshot,
  }, auth.session);

  const currentTimes = await snapshotTimes([ZONE_SNAPSHOT_KEY]);
  if (!currentTimes[ZONE_SNAPSHOT_KEY] || currentTimes[ZONE_SNAPSHOT_KEY] === initialTime) {
    throw new Error("Zone Distribution snapshot was published but its cloud timestamp did not advance.");
  }
  console.log(`[zone] Published ${meta.name} / ${parsed.sheetName} (${parsed.rows.length.toLocaleString()} rows).`);
  return { name: "zone", status: `Google Drive live · ${meta.name}`, changedKeys: [ZONE_SNAPSHOT_KEY] };
}

async function snapshotTimes(keys) {
  const output = {};
  await Promise.all(keys.map(async key => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/dashboard_snapshots`);
    url.searchParams.set("select", "snapshot_key,updated_at");
    url.searchParams.set("snapshot_key", `eq.${key}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers: { apikey: SUPABASE_KEY }, cache: "no-store" });
    if (!response.ok) throw new Error(`Could not read cloud snapshot ${key} (${response.status}).`);
    const rows = await response.json();
    output[key] = rows?.[0]?.updated_at || null;
  }));
  return output;
}

async function resolveRequestPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split("?")[0]); }
  catch { return null; }
  for (const route of ROUTES) {
    if (decoded !== route.prefix && !decoded.startsWith(`${route.prefix}/`)) continue;
    let relative = decoded.slice(route.prefix.length).replace(/^\/+/, "");
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const filePath = path.resolve(route.root, relative);
    const root = path.resolve(route.root);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;
    try {
      const details = await stat(filePath);
      if (details.isDirectory()) return path.join(filePath, "index.html");
      return details.isFile() ? filePath : null;
    } catch { return null; }
  }
  return null;
}

async function startStaticServer() {
  for (const route of ROUTES) {
    await access(route.root).catch(() => {
      throw new Error(`Dashboard checkout missing: ${route.root}`);
    });
  }
  const server = createServer(async (request, response) => {
    try {
      const filePath = await resolveRequestPath(request.url || "/");
      if (!filePath) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
      console.error(`Static server error: ${error.message}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

const PAGE_DEFINITIONS = Object.freeze({
  zone: {
    path: "/zone-distribution-dashboard/",
    keys: ["zone-distribution"],
    probe: () => {
      const badge = document.getElementById("zone-drive-live");
      const status = document.getElementById("zone-drive-status");
      return { kind: badge?.classList?.contains("is-live") ? "live" : "", text: `${status?.textContent || ""} ${badge?.textContent || ""}`.trim() };
    },
  },
  zreport: {
    path: "/zreport-dual-dashboard/",
    keys: ["zreport"],
    probe: () => {
      const badge = document.getElementById("drive-source-status");
      return { kind: badge?.dataset?.kind || "", text: `${badge?.textContent || ""} ${document.getElementById("drive-source-note")?.textContent || ""}`.trim() };
    },
  },
  visit: {
    path: "/visit-compliance-dashboard/",
    keys: ["visit"],
    probe: () => {
      const badge = document.getElementById("data-source-badge");
      return { kind: /live/i.test(badge?.textContent || "") ? "live" : "", text: `${badge?.textContent || ""} ${document.getElementById("data-source-note")?.textContent || ""}`.trim() };
    },
  },
  audit: {
    path: "/visit-compliance-dashboard/audit.html",
    keys: ["audit", "availability"],
    probe: () => {
      const text = document.getElementById("src-state")?.textContent || "";
      return { kind: /google drive live/i.test(text) ? "live" : "", text: text.trim() };
    },
  },
});

function isErrorStatus(status) {
  const text = clean(status?.text).toLowerCase();
  return status?.kind === "error"
    || /drive error|source error|no workbook|no current workbook|no match|authorization expired|publisher login required/.test(text);
}

async function runPage(browser, baseUrl, name, initialTimes, auth) {
  const definition = PAGE_DEFINITIONS[name];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  await context.addInitScript(({ folderId, driveToken, driveExpiresAt, session, keys, enforceVisitDriveOnly }) => {
    localStorage.setItem(keys.folderId, folderId);
    localStorage.setItem(keys.folderName, "Automated raw-data folder");
    localStorage.setItem(keys.driveToken, driveToken);
    localStorage.setItem(keys.driveExpiry, String(driveExpiresAt));
    localStorage.setItem(keys.session, JSON.stringify(session));
    localStorage.setItem(keys.owner, "enabled");
    localStorage.removeItem(keys.sync);

    // The unattended Visit publisher must never create a fresh cloud snapshot
    // with a visit plan inherited from repository-built dashboard data.  Let
    // the page keep its last good snapshot, but reject the cloud write unless
    // both response and schedule metadata confirm the requested Drive folder.
    if (enforceVisitDriveOnly) {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : String(input?.url || "");
        const method = String(init?.method || input?.method || "GET").toUpperCase();
        if (method === "POST" && /\/rest\/v1\/dashboard_snapshots(?:\?|$)/.test(url)) {
          let record = null;
          try { record = typeof init?.body === "string" ? JSON.parse(init.body) : null; }
          catch { record = null; }
          if (record?.snapshot_key === "visit") {
            const data = record?.payload?.data || record?.payload?.visitDashboard || null;
            const metadata = data?.metadata || null;
            const driveOnly = Boolean(
              metadata
                && metadata.localSource === true
                && String(metadata.driveFolderId || "").trim() === folderId
                && String(metadata.scheduleSource || "").trim() === "selected Google Drive folder"
                && String(metadata.responseFile || "").trim()
                && String(metadata.scheduleFile || "").trim()
            );
            if (!driveOnly) {
              throw new Error(`Drive source error: Visit snapshot rejected. Both the response export and Zonal/RHO visit plan must come from Google Drive folder ${folderId}; repository data is not accepted.`);
            }
          }
        }
        return nativeFetch(input, init);
      };
    }
  }, {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    driveToken: auth.drive.accessToken,
    driveExpiresAt: auth.drive.expiresAt,
    session: auth.session,
    keys: {
      folderId: FOLDER_ID_KEY,
      folderName: FOLDER_NAME_KEY,
      driveToken: DRIVE_TOKEN_KEY,
      driveExpiry: DRIVE_EXPIRY_KEY,
      session: SESSION_KEY,
      sync: SYNC_KEY,
      owner: OWNER_KEY,
    },
    enforceVisitDriveOnly: name === "visit",
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(clean(error?.message).slice(0, 500)));
  page.on("console", message => {
    if (message.type() === "error") pageErrors.push(clean(message.text()).slice(0, 500));
  });
  console.log(`\n[${name}] Opening ${definition.path}`);
  await page.goto(`${baseUrl}${definition.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });

  const started = Date.now();
  let lastLog = 0;
  let lastStatus = { kind: "", text: "" };
  let changedKeys = [];
  while (Date.now() - started < DEFAULT_TIMEOUT_MS) {
    try { lastStatus = await page.evaluate(definition.probe); }
    catch { lastStatus = { kind: "", text: "Page is still starting" }; }

    if (Date.now() - lastLog > 30000) {
      console.log(`[${name}] ${lastStatus.kind || "working"}: ${clean(lastStatus.text).slice(0, 220)}`);
      lastLog = Date.now();
    }
    if (isErrorStatus(lastStatus)) {
      throw new Error(`${name} parser reported: ${clean(lastStatus.text).slice(0, 600)}`);
    }

    const failedSyncMessage = await page.evaluate(key => {
      try {
        const statuses = JSON.parse(localStorage.getItem(key) || "{}");
        return Object.entries(statuses || {})
          .filter(([, value]) => value?.ok === false)
          .map(([snapshotKey, value]) => `${snapshotKey}: ${value.reason || "publish-failed"}`)
          .join("; ");
      } catch { return ""; }
    }, SYNC_KEY);
    if (failedSyncMessage) throw new Error(`${name} cloud publish failed: ${failedSyncMessage}`);

    const currentTimes = await snapshotTimes(definition.keys);
    changedKeys = definition.keys.filter(key => currentTimes[key] && currentTimes[key] !== initialTimes[key]);
    if (lastStatus.kind === "live" && changedKeys.length) break;

    // A clean runner normally republishes. If a parser deliberately reports an
    // unchanged source, accept its live state after a short settling window.
    if (lastStatus.kind === "live" && Date.now() - started > 120000) break;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (lastStatus.kind !== "live") {
    const relevantErrors = pageErrors.filter(message => !/favicon|Failed to load resource.*404/i.test(message));
    throw new Error(`${name} did not reach Google Drive live before timeout. Status: ${clean(lastStatus.text).slice(0, 500)}${relevantErrors.length ? `; browser errors: ${relevantErrors.slice(-3).join(" | ")}` : ""}`);
  }

  const syncStatus = await page.evaluate(key => {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }, SYNC_KEY);
  const failedSync = Object.entries(syncStatus || {}).filter(([, value]) => value?.ok === false);
  if (failedSync.length) {
    throw new Error(`${name} cloud publish failed: ${failedSync.map(([key, value]) => `${key}: ${value.reason}`).join("; ")}`);
  }

  console.log(`[${name}] Complete. Updated cloud key(s): ${changedKeys.join(", ") || "already current"}.`);
  await context.close();
  return { name, status: lastStatus.text, changedKeys };
}

async function writeSummary(change, auth, results) {
  const lines = [
    "## Automatic Drive snapshot",
    "",
    `- Drive service account: \`${auth.drive.clientEmail}\``,
    `- Detected: ${clean(change.detected_at) || "manual run"}`,
    `- Changed files: ${(change.changed_files || []).map(name => `\`${name}\``).join(", ") || "manual/all"}`,
    `- Categories: ${(change.changed_categories || []).join(", ") || "all"}`,
    "",
    "| Dashboard | Result | Cloud keys updated |",
    "|---|---|---|",
    ...results.map(result => `| ${result.name} | Google Drive live | ${result.changedKeys.join(", ") || "already current"} |`),
    "",
  ];
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
}

async function selfTest() {
  const cases = [
    ["Zone Distribution Aug 2026 w location type.xlsx", ["zone"]],
    ["Zone Distribution Sep 2026 w location type.xlsx", ["zone"]],
    ["Z-REPORT CATEGORY WISE SALES FF OUTLET WISE JAN 21- JUL 26.xlsx", ["zreport"]],
    ["Store_Operations_Compliance_Audit_responses_2026-08-22.xlsx", ["response"]],
    ["Master_Github_Compiled Visit Schedule_August 2026_Both.xlsx", ["schedule"]],
    ["Test_attendance_2026-08-01_to_2026-08-31.csv", ["attendance"]],
    ["Product_Critaria_Wise_Avaiablity_Report.xlsx", ["criteria"]],
    ["stock_extraction_report_1787142288.csv", ["stock"]],
    ["FS1.xlsx", []],
  ];
  for (const [file, expected] of cases) {
    const actual = classifyFile(file);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Classification failed for ${file}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  }
  // Keep this routing assertion independent of the workflow event that happens
  // to be running the self-test. A manual workflow run intentionally targets
  // every dashboard, while this assertion checks category-only routing.
  const targets = targetsForChange(
    { changed_categories: ["response", "attendance"] },
    false,
    "repository_dispatch",
  );
  if (JSON.stringify(targets) !== JSON.stringify(["visit", "audit"])) {
    throw new Error(`Target selection failed: ${JSON.stringify(targets)}`);
  }
  const pushTargets = targetsForChange({ changed_categories: [] }, false, "push");
  if (JSON.stringify(pushTargets) !== JSON.stringify(["zone", "visit"])) {
    throw new Error(`Push target selection failed: ${JSON.stringify(pushTargets)}`);
  }

  const driveOnlyVisit = {
    data: {
      metadata: {
        localSource: true,
        driveFolderId: VISIT_DRIVE_FOLDER_ID,
        scheduleSource: "selected Google Drive folder",
        responseFile: "Store_Operations_Compliance_Audit_responses_2026-09-01.xlsx",
        scheduleFile: "Master_Github_Compiled Visit Schedule_September 2026_Both.xlsx",
      },
    },
  };
  if (!visitSnapshotUsesDriveOnly(driveOnlyVisit)
      || visitSnapshotUsesDriveOnly({ data: { metadata: { ...driveOnlyVisit.data.metadata, scheduleSource: "dashboard visit-plan snapshot" } } })) {
    throw new Error("Visit Drive-only snapshot validation failed.");
  }

  const schemaPath = path.join(REPOS, "zone", "config", "schema.json");
  const dataPath = path.join(REPOS, "zone", "data");
  const fixtureAvailable = await access(schemaPath).then(() => true).catch(() => false);
  if (fixtureAvailable) {
    const workbookNames = (await readdir(dataPath)).filter(name => /\.xlsx$/i.test(name) && !/^~\$/.test(name));
    if (workbookNames.length) {
      const schema = JSON.parse(await readFile(schemaPath, "utf8"));
      const fixture = path.join(dataPath, workbookNames[0]);
      const parsed = parseZoneWorkbook(await readFile(fixture), schema, workbookNames[0]);
      if (!parsed.rows.length || parsed.columns.length !== schema.requiredHeaders.length) {
        throw new Error(`Zone parser self-test returned an invalid result for ${workbookNames[0]}.`);
      }
      console.log(`Zone schema parser passed: ${workbookNames[0]} / ${parsed.sheetName} (${parsed.rows.length.toLocaleString()} rows).`);
    } else {
      console.log("Zone repository has no raw workbook fixture; live Drive schema validation will run during the snapshot step.");
    }
  }
  console.log(`Self-test passed (${cases.length} filename cases). Feasibility/FS1 is excluded.`);
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  requireEnvironment();
  const change = parseChangePayload();
  const targets = targetsForChange(change);
  if (!targets.length) {
    console.log("No supported dashboard category changed; nothing to do.");
    return;
  }
  if (targets.includes("visit") && clean(process.env.GOOGLE_DRIVE_FOLDER_ID) !== VISIT_DRIVE_FOLDER_ID) {
    throw new Error(`Drive source error: GOOGLE_DRIVE_FOLDER_ID must be ${VISIT_DRIVE_FOLDER_ID} for Visit Compliance snapshots.`);
  }
  console.log(`Affected dashboards: ${targets.join(", ")}`);
  console.log(`Changed files: ${change.changed_files.join(", ") || "manual/all"}`);

  const keys = [...new Set(targets.flatMap(name => PAGE_DEFINITIONS[name].keys))];
  const [drive, session, initialTimes] = await Promise.all([
    serviceAccountDriveToken(),
    publisherSession(),
    snapshotTimes(keys),
  ]);
  console.log(`Google Drive authorization ready for ${drive.clientEmail}.`);

  const results = [];
  if (targets.includes("zone")) {
    results.push(await runZoneSnapshot(initialTimes[ZONE_SNAPSHOT_KEY], { drive, session }));
  }

  const pageTargets = targets.filter(name => name !== "zone");
  if (pageTargets.length) {
    const { server, baseUrl } = await startStaticServer();
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      // Run sequentially to keep memory stable when the Z-Report and stock CSV
      // are both large. These pages continue to use their exact deployed parsers.
      for (const name of pageTargets) {
        results.push(await runPage(browser, baseUrl, name, initialTimes, { drive, session }));
      }
    } finally {
      await browser.close().catch(() => {});
      await new Promise(resolve => server.close(resolve));
    }
  }
  await writeSummary(change, { drive, session }, results);
  console.log("\nAll affected dashboard snapshots completed.");
}

main().catch(error => {
  console.error(`Snapshot worker failed: ${error?.stack || error}`);
  process.exitCode = 1;
});
