(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const Drive = window.ShwapnoDrive;
  const SNAPSHOT_WORKER_REFRESH_MS = 1000;
  const SNAPSHOT_WORKERS = Object.freeze([
    ["zone-distribution", "/zone-distribution-dashboard/?snapshot-worker=1"],
    ["zreport", "/zreport-dual-dashboard/?snapshot-worker=1"],
    ["visit", "/visit-compliance-dashboard/?snapshot-worker=1"],
    ["audit", "/visit-compliance-dashboard/audit.html?snapshot-worker=1"],
  ]);
  let snapshotWorkerHost = null;

  function snapshotWorkerReady() {
    return Boolean(window.DashboardDriveOwner?.isOwner?.() && Drive.getFolder() && Drive.cachedToken());
  }

  function stopSnapshotWorkers() {
    snapshotWorkerHost?.remove();
    snapshotWorkerHost = null;
  }

  function updateSnapshotWorkers() {
    if (!snapshotWorkerReady()) return stopSnapshotWorkers();
    if (snapshotWorkerHost) return;
    const host = document.createElement("div");
    host.id = "snapshot-worker-host";
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      left: "-10000px",
      top: "0",
      overflow: "hidden",
      pointerEvents: "none",
      opacity: "0",
    });
    for (const [name, src] of SNAPSHOT_WORKERS) {
      const frame = document.createElement("iframe");
      frame.src = src;
      frame.name = `snapshot-worker-${name}`;
      frame.title = `${name} snapshot monitor`;
      frame.tabIndex = -1;
      frame.loading = "eager";
      host.append(frame);
    }
    document.body.append(host);
    snapshotWorkerHost = host;
  }

  function setStatus(kind, label, detail) {
    const badge = $("drive-status");
    badge.dataset.kind = kind;
    badge.textContent = label;
    $("drive-detail").textContent = detail;
  }

  function refreshView(note = "") {
    const info = Drive.describe();
    $("drive-connect").hidden = !info.folder;
    $("drive-change").textContent = info.folder ? "Change folder" : "Set up Drive";
    if (info.folder && info.authorized) {
      setStatus("live", "CONNECTED", note || `Shared folder: ${info.folder.name}. New dashboard tabs will reuse it automatically.`);
    } else if (info.folder) {
      setStatus("ready", "FOLDER SAVED", note || `Shared folder: ${info.folder.name}. Click Connect saved folder once to authorize this browser session.`);
    } else if (info.configReady) {
      setStatus("idle", "SELECT FOLDER", note || "Google Cloud setup is saved, but no shared Drive folder is selected yet.");
    } else {
      setStatus("idle", "SETUP REQUIRED", note || "Use Drive setup once. The same folder will be used by all supported dashboards except Feasibility.");
    }
  }

  function openModal() {
    const config = Drive.getConfig();
    $("google-client-id").value = config.clientId;
    $("google-api-key").value = config.apiKey;
    $("google-app-id").value = config.appId;
    $("drive-modal").hidden = false;
  }

  function closeModal() { $("drive-modal").hidden = true; }

  async function connectSaved() {
    if (!Drive.configReady()) return openModal();
    if (!Drive.getFolder()) return connectAndPick();
    try {
      setStatus("reading", "CONNECTING", "Authorizing Google Drive read-only access…");
      const result = await Drive.connect({ pickFolder: false });
      if (result) refreshView(`Connected to “${result.folder.name}”. Open any supported dashboard; it will use this same folder.`);
    } catch (error) {
      if (error?.name === "AbortError") return refreshView("Google Drive sign-in was cancelled.");
      setStatus("error", "CONNECTION ERROR", error?.message || "Google Drive connection failed.");
    }
  }

  async function connectAndPick() {
    if (!Drive.configReady()) return openModal();
    try {
      setStatus("reading", "CONNECTING", "Authorizing Google Drive and opening the folder picker…");
      const result = await Drive.connect({ pickFolder: true, title: "Select shared Shwapno dashboard data folder" });
      if (result) refreshView(`Shared folder changed to “${result.folder.name}”. Zone Distribution, Z-Report, Visit Compliance and Audit will reuse it.`);
      else refreshView("Folder selection was cancelled; the previous folder was kept.");
    } catch (error) {
      if (error?.name === "AbortError") return refreshView("Google Drive sign-in was cancelled.");
      setStatus("error", "CONNECTION ERROR", error?.message || "Google Drive connection failed.");
    }
  }

  $("drive-setup").addEventListener("click", openModal);
  $("drive-change").addEventListener("click", () => Drive.configReady() ? connectAndPick() : openModal());
  $("drive-connect").addEventListener("click", connectSaved);
  $("drive-modal-close").addEventListener("click", closeModal);
  $("drive-modal").addEventListener("click", event => { if (event.target === $("drive-modal")) closeModal(); });
  $("drive-save").addEventListener("click", () => {
    try {
      Drive.saveConfig({
        clientId: $("google-client-id").value,
        apiKey: $("google-api-key").value,
        appId: $("google-app-id").value,
      });
      closeModal();
      setTimeout(connectAndPick, 0);
    } catch (error) { alert(error.message); }
  });
  $("drive-clear").addEventListener("click", () => {
    if (!confirm("Clear the shared Google Drive setup for all supported dashboards on this browser?")) return;
    Drive.clearSetup();
    closeModal();
    refreshView("Shared Google Drive setup was cleared.");
  });

  window.addEventListener("storage", event => {
    if (Object.values(Drive.KEYS).includes(event.key)) {
      refreshView();
      updateSnapshotWorkers();
    }
  });
  window.addEventListener("drive-owner-mode-change", updateSnapshotWorkers);
  refreshView();
  window.DashboardDriveOwner?.ready?.then(updateSnapshotWorkers);
  updateSnapshotWorkers();
  setInterval(updateSnapshotWorkers, SNAPSHOT_WORKER_REFRESH_MS);
})();
