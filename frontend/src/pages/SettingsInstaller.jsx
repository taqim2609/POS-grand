import { Download, Monitor, Cpu, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  INSTALL_WINDOWS_BAT, INSTALL_PI_SH, UPDATE_WINDOWS_BAT, UPDATE_PI_SH, downloadText,
} from "@/lib/installers";

const dl = (name, text) => { downloadText(name, text); toast.success(`Skrip ${name} diunduh`); };

const DlCard = ({ icon: Icon, title, subtitle, file, text, testid }) => (
  <button
    data-testid={testid} onClick={() => dl(file, text)}
    className="tap text-left rounded-2xl border border-[#E4E4E7] bg-white p-5 hover:border-[#E63946]"
  >
    <div className="flex items-center gap-2 font-extrabold"><Icon size={18} className="text-[#E63946]" /> {title}</div>
    <p className="text-xs text-[#52525B] mt-1">{subtitle}</p>
    <p className="text-[11px] text-[#a1a1aa] mt-0.5 font-mono">{file}</p>
    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#E63946]"><Download size={15} /> Unduh</span>
  </button>
);

export default function SettingsInstaller() {
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-installer">
      <div className="max-w-2xl space-y-8">
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <b>Penting:</b> jadikan <b>SATU</b> mesin sebagai server (Desktop <i>atau</i> Raspberry Pi).
          Perangkat lain (POS komputer & Android) cukup menjadi klien yang mengakses IP server.
          Prasyarat: <b>Docker</b> sudah terpasang di mesin server.
        </div>

        {/* 1. INSTALL */}
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-extrabold">1. Instal Server (pertama kali)</h2>
            <p className="text-[#52525B] text-sm mt-1">Pilih lokasi server, unduh skripnya, taruh di folder proyek di mesin itu, lalu jalankan.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-windows-installer" icon={Monitor} title="Komputer Desktop (Windows)"
              subtitle="Dobel-klik untuk memasang server di PC Windows." file="install-windows.bat" text={INSTALL_WINDOWS_BAT} />
            <DlCard testid="download-pi-installer" icon={Cpu} title="Raspberry Pi (headless)"
              subtitle="Jalankan lewat SSH; editor config terbuka otomatis." file="install-pi.sh" text={INSTALL_PI_SH} />
          </div>
        </div>

        {/* 2. UPDATE */}
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2"><RefreshCw size={18} className="text-[#E63946]" /> 2. Perbarui Server (update)</h2>
            <p className="text-[#52525B] text-sm mt-1">Saat ada versi baru, jalankan skrip ini <b>di mesin server</b>. Data Anda tetap aman (tersimpan di volume Docker).</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-update-windows" icon={Monitor} title="Update di Desktop (Windows)"
              subtitle="Tarik versi baru lalu bangun ulang otomatis." file="update-windows.bat" text={UPDATE_WINDOWS_BAT} />
            <DlCard testid="download-update-pi" icon={Cpu} title="Update di Raspberry Pi"
              subtitle="Jalankan via SSH: ./update-pi.sh" file="update-pi.sh" text={UPDATE_PI_SH} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <div className="font-extrabold mb-2">Langkah singkat</div>
          <ol className="space-y-2 text-sm text-[#3f3f46]">
            {[
              "Salin folder proyek ke mesin server (Desktop atau Pi), taruh skrip di dalamnya.",
              "Instal: Windows dobel-klik .bat • Pi via SSH: chmod +x install-pi.sh && ./install-pi.sh",
              "Isi backend/.env.docker saat diminta (di Pi, nano terbuka otomatis), simpan.",
              "Akses http://IP-server di POS komputer / atur di APK Android.",
              "Update nanti: cukup jalankan update-windows.bat / update-pi.sh di mesin server.",
            ].map((s, i) => (
              <li key={i} className="flex gap-2"><CheckCircle2 size={16} className="text-[#10B981] mt-0.5 shrink-0" /> <span>{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
