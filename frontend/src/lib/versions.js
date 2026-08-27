// Informasi versi aplikasi (APK / OTA / bundle) — dipakai halaman "Versi" di Pengaturan.
import { getServerUrl } from "./api";

// Wajib sinkron dengan android/app/build.gradle (versionName) setiap kali rebuild APK.
export const APK_VERSION = "1.2";

export function isNativeApp() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
}

export function getBundleVersion() {
  try {
    const s = (document.querySelector('script[src*="main."]') || {}).src || "";
    const m = s.match(/main\.[\w-]+\.js/);
    return m ? m[0] : "?";
  } catch (_) { return "?"; }
}

export async function collectVersions() {
  const native = isNativeApp();
  let otaServer = "";
  try {
    const j = await (await fetch("ota/version.json", { cache: "no-store" })).json();
    otaServer = j.version || "";
  } catch (_) {}
  let otaInstalled = "";
  try { otaInstalled = localStorage.getItem("gak_ota_version") || ""; } catch (_) {}
  let serverVersion = "";
  let latestVersion = "";
  let authError = false;
  try {
    const r = await fetch(`${getServerUrl() || ""}/api/update/check`, { headers: { Authorization: `Bearer ${localStorage.getItem("gak_token") || ""}` } });
    if (r.status === 401) { authError = true; }
    else if (r.ok) {
      const j = await r.json();
      serverVersion = j.current || "";
      latestVersion = j.latest || "";
    }
  } catch (_) {}
  return {
    native,
    apk: native ? APK_VERSION : null,
    bundle: getBundleVersion(),
    otaInstalled,
    otaServer,
    serverVersion,
    latestVersion,
    authError,
    serverUrl: getServerUrl() || "(web - same origin)",
  };
}
