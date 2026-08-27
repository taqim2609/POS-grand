import { toast } from "sonner";
import { getServerUrl } from "./api";

// Kirim status OTA ke UI (komponen OtaIndicator mendengarkan event ini).
function emitOta(show, percent) {
  try { window.dispatchEvent(new CustomEvent("gak-ota-status", { detail: { show, percent } })); } catch (e) {}
}

// Versi yang tertanam di bundle APK saat ini (dilayani lokal di ./ota/version.json).
async function localBundleVersion() {
  try {
    const r = await fetch("ota/version.json", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); return j.version || ""; }
  } catch (e) {}
  return "";
}

/**
 * OTA update via server Pi (LAN). Hanya berjalan di APK (native), diabaikan di web/PWA.
 * Cek /ota/version.json di server; jika versi lebih baru, unduh bundle dari Pi & pasang live.
 * Mengembalikan hasil {status, reason, serverVersion, installedVersion} untuk ditampilkan di UI.
 * status: "updated" | "up-to-date" | "error" | "not-native" | "no-server" | "no-update"
 */
export async function checkOtaUpdate({ silent = false } = {}) {
  // Tampilkan notifikasi sekali setelah aplikasi reload akibat OTA berhasil.
  try {
    if (localStorage.getItem("gak_ota_just_updated")) {
      localStorage.removeItem("gak_ota_just_updated");
      toast.success("Tampilan diperbarui ke versi terbaru", { duration: 5000 });
    }
  } catch (e) {}

  let Capacitor, CapacitorUpdater;
  try {
    ({ Capacitor } = await import("@capacitor/core"));
    if (!Capacitor?.isNativePlatform?.()) return { status: "not-native" };
    ({ CapacitorUpdater } = await import("@capgo/capacitor-updater"));
    await CapacitorUpdater.notifyAppReady();
  } catch {
    return { status: "not-native" }; // bukan native / plugin tak tersedia
  }
  try {
    const base = getServerUrl();
    if (!base) return { status: "no-server" };
    // Cek versi lewat API dulu (jalur /api CORS sudah pasti bekerja di APK),
    // fallback ke /ota/version.json (nginx) untuk kompatibilitas.
    let res = null;
    try {
      res = await fetch(`${base}/api/ota/version`, { cache: "no-store" });
    } catch (_) {}
    if (!res || !res.ok) {
      res = await fetch(`${base}/ota/version.json`, { cache: "no-store" });
    }
    if (!res.ok) return { status: "error", reason: `Server balas HTTP ${res.status}` };
    const { version, url } = await res.json();
    if (!version) return { status: "error", reason: "version server kosong" };
    // Versi bundle yang BENAR-BENAR aktif: dari plugin Capgo (paling akurat).
    let current = "";
    try {
      const cur = await CapacitorUpdater.current();
      current = (cur && cur.version) || "";
    } catch (_) {}
    if (!current) current = localStorage.getItem("gak_ota_version") || "";
    if (!current) current = await localBundleVersion(); // seed dari versi bundle bawaan APK
    // Hanya update bila server BENAR-BENAR lebih baru. Mencegah APK baru menarik
    // bundle LAMA dari Pi (yang belum di-update) yang menyebabkan layar blank.
    if (current && version <= current) {
      if (!localStorage.getItem("gak_ota_version")) localStorage.setItem("gak_ota_version", current);
      if (!silent) toast.info(`Sudah versi terbaru (OTA ${current})`, { duration: 5000 });
      return { status: "up-to-date", serverVersion: version, installedVersion: current };
    }
    const full = url?.startsWith("http") ? url : `${base}${url || "/ota/bundle.zip"}`;
    emitOta(true, 0); // tampilkan indikator + progres
    let dlListener;
    try {
      dlListener = await CapacitorUpdater.addListener("download", (s) => emitOta(true, Math.round(s?.percent || 0)));
    } catch (e) {}
    const bundle = await CapacitorUpdater.download({ url: full, version });
    try { if (dlListener) dlListener.remove(); } catch (e) {}
    emitOta(true, 100);
    localStorage.setItem("gak_ota_version", version);
    // Tandai agar setelah reload muncul toast "Tampilan diperbarui".
    try { localStorage.setItem("gak_ota_just_updated", version); } catch (e) {}
    if (!silent) toast.success(`Update OTA ${version} diunduh — menerapkan...`, { duration: 5000 });
    await CapacitorUpdater.set(bundle); // beralih ke bundle baru & reload
    return { status: "updated", serverVersion: version, installedVersion: current };
  } catch (e) {
    emitOta(false); // sembunyikan indikator bila gagal/offline
    if (!silent) toast.error(`Update OTA gagal: ${(e && e.message) || e}`, { duration: 6000 });
    return { status: "error", reason: (e && e.message) || String(e) };
  }
}
