import { Download, Monitor, Cpu, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { INSTALL_WINDOWS_BAT, INSTALL_PI_SH, downloadText } from "@/lib/installers";

export default function SettingsInstaller() {
  const dl = (name, text) => {
    downloadText(name, text);
    toast.success(`Skrip ${name} diunduh`);
  };
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-installer">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-extrabold">Pemasangan Server Lokal (1-Klik)</h2>
          <p className="text-[#52525B] text-sm mt-1">
            Unduh skrip installer, letakkan di dalam folder proyek (yang berisi <code>docker-compose.yml</code>)
            di komputer server, lalu jalankan dengan dobel-klik. Skrip akan otomatis menyiapkan konfigurasi,
            membangun, dan menjalankan aplikasi.
          </p>
        </div>

        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <b>Prasyarat:</b> Docker sudah terpasang di komputer server
          (Windows: Docker Desktop • Raspberry Pi/Linux: Docker Engine).
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            data-testid="download-windows-installer" onClick={() => dl("install-windows.bat", INSTALL_WINDOWS_BAT)}
            className="tap text-left rounded-2xl border border-[#E4E4E7] bg-white p-5 hover:border-[#E63946]"
          >
            <div className="flex items-center gap-2 font-extrabold"><Monitor size={18} className="text-[#E63946]" /> Windows</div>
            <p className="text-xs text-[#52525B] mt-1">install-windows.bat</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#E63946]"><Download size={15} /> Unduh</span>
          </button>

          <button
            data-testid="download-pi-installer" onClick={() => dl("install-pi.sh", INSTALL_PI_SH)}
            className="tap text-left rounded-2xl border border-[#E4E4E7] bg-white p-5 hover:border-[#E63946]"
          >
            <div className="flex items-center gap-2 font-extrabold"><Cpu size={18} className="text-[#E63946]" /> Raspberry Pi / Linux</div>
            <p className="text-xs text-[#52525B] mt-1">install-pi.sh</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#E63946]"><Download size={15} /> Unduh</span>
          </button>
        </div>

        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <div className="font-extrabold mb-2">Langkah singkat</div>
          <ol className="space-y-2 text-sm text-[#3f3f46]">
            {[
              "Salin folder proyek ke komputer server, taruh skrip installer di dalamnya.",
              "Windows: dobel-klik install-windows.bat. Pi/Linux: chmod +x install-pi.sh lalu ./install-pi.sh",
              "Saat diminta, isi backend/.env.docker (password admin & kunci AI), simpan, jalankan lagi.",
              "Setelah selesai, buka http://IP-komputer-server di browser POS / atur di APK Android.",
            ].map((s, i) => (
              <li key={i} className="flex gap-2"><CheckCircle2 size={16} className="text-[#10B981] mt-0.5 shrink-0" /> <span>{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
