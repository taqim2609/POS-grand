import axios from "axios";
import { getServerUrl } from "./api";
import { getBundleVersion } from "./versions";

// ============================================================
// Diagnostik & Lapor Bug — menangkap error global + menyusun
// laporan teknis yang bisa ditempel ke chat VibeCoder.
// ============================================================

const MAX = 25;
export const errorLog = [];

function push(entry) {
  errorLog.push(entry);
  if (errorLog.length > MAX) errorLog.shift();
}

let installed = false;
export function installDiag() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    push({
      t: new Date().toISOString(), type: "error",
      msg: e.message || String(e.error || ""),
      file: e.filename || "", line: e.lineno || 0, col: e.colno || 0,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    let msg = "";
    try { msg = r && r.message ? r.message : String(r); } catch (_) { msg = "unknown"; }
    push({ t: new Date().toISOString(), type: "promise", msg });
  });

  try {
    axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const cfg = err.config || {};
        const status = err.response ? err.response.status : 0;
        let detail = err.message || "";
        try {
          const d = err.response && err.response.data && err.response.data.detail;
          if (d) detail = typeof d === "string" ? d : JSON.stringify(d);
        } catch (_) {}
        push({
          t: new Date().toISOString(), type: "api",
          method: (cfg.method || "GET").toUpperCase(),
          url: cfg.url || "", status, msg: detail,
        });
        return Promise.reject(err);
      }
    );
  } catch (_) {}
}

export async function buildDiagReport() {
  const out = [];
  const ts = new Date();
  out.push("=== LAPORAN DIAGNOSTIK Grand Aceh Kuliner POS ===");
  out.push(`Waktu: ${ts.toLocaleString("id-ID")} (${ts.toISOString()})`);
  out.push(`Bundle frontend: ${getBundleVersion()}`);
  try {
    const j = await (await fetch("ota/version.json", { cache: "no-store" })).json();
    out.push(`OTA version (server): ${j.version || "-"}`);
  } catch (_) { out.push("OTA version (server): (tidak terbaca)"); }
  try { out.push(`OTA terpasang (APK): ${localStorage.getItem("gak_ota_version") || "-"}`); } catch (_) {}
  out.push(`URL server: ${getServerUrl() || "(kosong - pakai origin web)"}`);

  let isNative = false;
  try { isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (_) {}
  out.push(`Platform: ${isNative ? "APK (Capacitor)" : "Web"}`);
  out.push(`User-Agent: ${navigator.userAgent || "-"}`);
  out.push(`Layar: ${(window.screen && window.screen.width) || "-"}x${(window.screen && window.screen.height) || "-"} (dpr ${window.devicePixelRatio || 1})`);
  out.push(`Bahasa: ${navigator.language || "-"} | Online: ${navigator.onLine ? "ya" : "tidak"}`);

  // Kesehatan server
  try {
    const base = getServerUrl();
    const url = base ? `${base}/api/health` : "/api/health";
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    const j = await r.json().catch(() => ({}));
    out.push(`Server /api/health: HTTP ${r.status} (${ms}ms) -> ${JSON.stringify(j)}`);
  } catch (e) {
    out.push(`Server /api/health: GAGAL -> ${(e && e.message) || e}`);
  }

  // Versi server / update center
  try {
    const r = await axios.get("/api/update/check", { timeout: 12000 });
    const d = r.data || {};
    out.push(`Server mode: ${d.enabled ? "vibecoder" : "belum vibecoder"}`);
    out.push(`Versi server: ${d.current || "-"} | terbaru: ${d.latest || "-"}${d.updateAvailable ? " (UPDATE TERSEDIA)" : ""} | update center: ${d.updateCenterReachable ? "dijangkau" : "tidak dijangkau"}`);
  } catch (e) {
    const status = e.response && e.response.status;
    out.push(`Cek versi server: ${status === 401 ? "sesi login tidak aktif (401) — login ulang untuk melihat versi" : `gagal (${status || e.message})`}`);
  }

  out.push("");
  out.push("=== Error terakhir yang tertangkap ===");
  if (!errorLog.length) out.push("(tidak ada error tercatat)");
  errorLog.slice(-10).forEach((e) => {
    const where = e.line ? ` @${e.file}:${e.line}:${e.col}` : "";
    out.push(`[${e.t}] ${e.type.toUpperCase()} ${e.method || ""} ${e.url || ""} ${e.status || ""} -> ${e.msg}${where}`);
  });
  return out.join("\n");
}
