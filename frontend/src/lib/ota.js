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

// OTA update via server Pi (LAN). Hanya berjalan di APK (native), diabaikan di web/PWA.
// Cek /ota/version.json di server; jika versi beda, unduh bundle dari Pi & pasang live.
export async function checkOtaUpdate() {
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
    if (!Capacitor?.isNativePlatform?.()) return;
    ({ CapacitorUpdater } = await import("@capgo/capacitor-updater"));
    await CapacitorUpdater.notifyAppReady();
  } catch {
    return; // bukan native / plugin tak tersedia
  }
  try {
    const base = getServerUrl();
    if (!base) return;
    const res = await fetch(`${base}/ota/version.json`, { cache: "no-store" });
    if (!res.ok) return;
    const { version, url } = await res.json();
    if (!version) return;
    let current = localStorage.getItem("gak_ota_version") || "";
    if (!current) current = await localBundleVersion(); // seed dari versi bundle bawaan APK
    // Hanya update bila server BENAR-BENAR lebih baru. Mencegah APK baru menarik
    // bundle LAMA dari Pi (yang belum di-update) yang menyebabkan layar blank.
    if (current && version <= current) {
      if (!localStorage.getItem("gak_ota_version")) localStorage.setItem("gak_ota_version", current);
      return;
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
    await CapacitorUpdater.set(bundle); // beralih ke bundle baru & reload
  } catch {
    emitOta(false); // sembunyikan indikator bila gagal/offline
    // gagal (server tak ada/offline) — biarkan pakai bundle sekarang
  }
}
