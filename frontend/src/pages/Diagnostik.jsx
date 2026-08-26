import { useEffect, useState } from "react";
import { Bug, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { buildDiagReport, installDiag } from "@/lib/diag";
import { copyText } from "@/lib/utils";

export default function Diagnostik() {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const r = await buildDiagReport();
      setReport(r);
      if (!silent) toast.success("Informasi dimuat ulang");
    } catch (e) {
      toast.error("Gagal membuat laporan: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { installDiag(); refresh(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const copy = async () => {
    if (!report) return toast.error("Belum ada laporan");
    const ok = await copyText(report);
    if (ok) toast.success("Laporan disalin — tempelkan ke chat VibeCoder");
    else toast.error("Gagal menyalin otomatis — blok teks & salin manual");
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-diagnostik">
      <div className="max-w-3xl space-y-4">
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5">
          <div className="flex items-center gap-2 font-extrabold text-[#0A0A0A]"><Bug size={18} className="text-[#E63946]" /> Diagnostik &amp; Lapor Bug</div>
          <p className="text-sm text-[#52525B] mt-1">Kumpulkan info teknis (versi, server, error terakhir) lalu tempel laporannya ke chat VibeCoder untuk analisa &amp; perbaikan.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button data-testid="diag-copy" onClick={copy} disabled={!report}
              className="tap h-10 px-4 rounded-lg bg-[#E63946] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
              <Copy size={15} /> Salin Laporan
            </button>
            <button data-testid="diag-refresh" onClick={() => refresh(false)} disabled={loading}
              className="tap h-10 px-4 rounded-lg bg-white border font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Perbarui Info
            </button>
          </div>
        </div>
        <pre data-testid="diag-report" className="bg-[#0A0A0A] text-[#E4E4E7] text-xs rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap max-h-[62vh]">
          {report || "Mengumpulkan informasi..."}
        </pre>
      </div>
    </div>
  );
}
