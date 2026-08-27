import { useEffect, useState } from "react";
import { Smartphone, Package, CloudDownload, RefreshCw, Globe, Server, Box, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { collectVersions, APK_VERSION } from "@/lib/versions";
import { checkOtaUpdate } from "@/lib/ota";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F4F5F7] last:border-0">
      <div className="flex items-center gap-2 text-sm text-[#52525B] font-semibold">
        <Icon size={15} className="text-[#E63946]" /> {label}
      </div>
      <div className="font-mono text-sm font-bold text-[#0A0A0A]">{value || "-"}</div>
    </div>
  );
}

export default function AppVersi() {
  const [v, setV] = useState(null);
  const [checking, setChecking] = useState(false);

  const refresh = () => {
    let stop = false;
    collectVersions().then((r) => { if (!stop) setV(r); });
    return () => { stop = true; };
  };

  useEffect(refresh, []);

  const doOta = async () => {
    setChecking(true);
    try {
      const r = await checkOtaUpdate({ silent: true });
      if (r.status === "not-native") toast.error("Update OTA hanya untuk APK Android (bukan web)");
      else if (r.status === "no-server") toast.error("URL server belum diatur — isi di Pengaturan Server saat login");
      else if (r.status === "error") toast.error(`Gagal cek/unduh: ${r.reason || "unknown"}`);
      else if (r.status === "up-to-date") toast.info(`Sudah terbaru: OTA ${r.installedVersion}`, { duration: 6000 });
      else if (r.status === "updated") toast.success("Update OTA diterapkan — aplikasi dimuat ulang");
      refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-versi">
      <div className="max-w-xl space-y-4">
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5">
          <div className="flex items-center gap-2 font-extrabold text-[#0A0A0A]"><Box size={18} className="text-[#E63946]" /> Versi Aplikasi</div>
          <p className="text-sm text-[#52525B] mt-1">Info versi APK, bundle frontend, dan update OTA. Dipakai juga untuk laporan Diagnostik.</p>
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden px-5 py-3">
          <Row icon={Smartphone} label="Platform" value={v ? (v.native ? `APK (Capacitor) v${v.apk}` : "Web (browser)") : "..."} />
          {v?.native && (
            <>
              <Row icon={Package} label="Versi APK (versionName)" value={APK_VERSION} />
              <Row icon={CloudDownload} label="OTA terpasang (APK)" value={v.otaInstalled} />
            </>
          )}
          <Row icon={Globe} label="Bundle frontend" value={v?.bundle} />
          <Row icon={Server} label="Versi server (vibecoder)" value={v?.serverVersion} />
          {v?.serverVersion && v.latestVersion && (
            <Row icon={RefreshCw} label="Versi terbaru tersedia" value={v.latestVersion} />
          )}
          {v?.native && <Row icon={CloudDownload} label="OTA server (bundle terbaru)" value={v.otaServer} />}
          <Row icon={Globe} label="URL server" value={v?.serverUrl} />
        </div>

        {v?.native && (
          <div className="rounded-2xl border-2 border-[#4F46E5] bg-[#EEF2FF] p-4 flex flex-wrap items-center gap-3" data-testid="ota-manual-box">
            <CloudDownload size={20} className="text-[#4F46E5]" />
            <div className="flex-1 min-w-[180px]">
              <div className="font-extrabold text-[#0A0A0A] text-sm">Update OTA Manual</div>
              <div className="text-xs text-[#52525B]">Periksa bundle terbaru dari server lalu pasang sekarang.</div>
            </div>
            <button data-testid="ota-update-btn" onClick={doOta} disabled={checking}
              className="tap h-10 px-5 rounded-xl bg-[#4F46E5] text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
              {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {checking ? "Memeriksa..." : "Periksa & Update OTA"}
            </button>
          </div>
        )}

        <p className="text-[11px] text-[#8b87a8]">
          OTA terpasang diisi saat APK menerima update dari server; bila kosong berarti APK memakai bundle bawaan.
          {v?.native && v.otaServer && v.otaInstalled && v.otaServer <= v.otaInstalled && (
            <span className="block mt-1">ℹ️ Server masih menyajikan OTA yang sama/lebih lama dari APK — pastikan server Pi sudah di-update (<code>bash update-vibecoder-pi.sh</code>) agar OTA baru tersedia.</span>
          )}
        </p>
      </div>
    </div>
  );
}
