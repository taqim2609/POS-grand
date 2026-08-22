import { useEffect, useState } from "react";
import { Loader2, DownloadCloud } from "lucide-react";

// Indikator kecil saat APK sedang menarik update tampilan (OTA) dari server LAN.
export default function OtaIndicator() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e) => setShow(!!e.detail?.show);
    window.addEventListener("gak-ota-status", handler);
    return () => window.removeEventListener("gak-ota-status", handler);
  }, []);

  if (!show) return null;

  return (
    <div
      data-testid="ota-indicator"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 rounded-full bg-[#0A0A0A]/90 backdrop-blur px-4 py-2.5 shadow-lg border border-white/10 animate-in fade-in slide-in-from-bottom-2"
    >
      <DownloadCloud size={16} className="text-[#25D366]" />
      <span className="text-sm font-bold text-white">Menghubungkan ke server…</span>
      <Loader2 size={15} className="text-white/70 animate-spin" />
    </div>
  );
}
