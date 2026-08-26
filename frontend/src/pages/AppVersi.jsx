import { useEffect, useState } from "react";
import { Smartphone, Package, CloudDownload, RefreshCw, Globe, Server, Box } from "lucide-react";
import { collectVersions, APK_VERSION } from "@/lib/versions";

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

  useEffect(() => {
    let stop = false;
    collectVersions().then((r) => { if (!stop) setV(r); });
    return () => { stop = true; };
  }, []);

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

        <p className="text-[11px] text-[#8b87a8]">
          OTA terpasang diisi saat APK menerima update dari server; bila kosong berarti APK memakai bundle bawaan.
        </p>
      </div>
    </div>
  );
}
