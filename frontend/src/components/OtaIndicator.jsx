import { useEffect, useState } from "react";
import { Loader2, DownloadCloud } from "lucide-react";

// Indikator + progres saat APK menarik update tampilan (OTA) dari server LAN.
export default function OtaIndicator() {
  const [show, setShow] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      setShow(!!e.detail?.show);
      if (typeof e.detail?.percent === "number") setPercent(e.detail.percent);
    };
    window.addEventListener("gak-ota-status", handler);
    return () => window.removeEventListener("gak-ota-status", handler);
  }, []);

  if (!show) return null;

  const label =
    percent >= 100 ? "Menerapkan pembaruan…"
    : percent > 0 ? `Mengunduh pembaruan… ${percent}%`
    : "Menghubungkan ke server…";

  return (
    <div
      data-testid="ota-indicator"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(90vw,320px)] rounded-2xl bg-[#0A0A0A]/92 backdrop-blur px-4 py-3 shadow-lg border border-white/10 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center gap-2.5">
        <DownloadCloud size={16} className="text-[#25D366] shrink-0" />
        <span className="text-sm font-bold text-white flex-1" data-testid="ota-label">{label}</span>
        <Loader2 size={15} className="text-white/70 animate-spin shrink-0" />
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/15 overflow-hidden" data-testid="ota-progress-track">
        <div
          data-testid="ota-progress-bar"
          className={`h-full bg-[#25D366] transition-all duration-200 ${percent === 0 ? "animate-pulse w-1/3" : ""}`}
          style={percent > 0 ? { width: `${Math.min(percent, 100)}%` } : undefined}
        />
      </div>
    </div>
  );
}
