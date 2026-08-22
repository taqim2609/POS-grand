import { toast } from "sonner";
import { getServerUrl } from "./api";

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
    const current = localStorage.getItem("gak_ota_version") || "";
    if (version === current) return;
    const full = url?.startsWith("http") ? url : `${base}${url || "/ota/bundle.zip"}`;
    const bundle = await CapacitorUpdater.download({ url: full, version });
    localStorage.setItem("gak_ota_version", version);
    // Tandai agar setelah reload muncul toast "Tampilan diperbarui".
    try { localStorage.setItem("gak_ota_just_updated", version); } catch (e) {}
    await CapacitorUpdater.set(bundle); // beralih ke bundle baru & reload
  } catch {
    // gagal (server tak ada/offline) — biarkan pakai bundle sekarang
  }
}
