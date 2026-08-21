import { useRef } from "react";
import { Download, Monitor, Cpu, CheckCircle2, RefreshCw, DatabaseBackup, ListChecks, FolderDown } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  INSTALL_WINDOWS_BAT, INSTALL_PI_SH, UPDATE_WINDOWS_BAT, UPDATE_PI_SH,
  BACKUP_WINDOWS_BAT, BACKUP_PI_SH, RESTORE_WINDOWS_BAT, RESTORE_PI_SH,
  RESTART_WINDOWS_BAT, RESTART_PI_SH, SETUP_AUTOBACKUP_PI_SH, BOOTSTRAP_PI_SH, downloadText,
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

const Section = ({ n, title, icon: Icon, desc, children }) => (
  <div className="space-y-3">
    <div>
      <h2 className="text-xl font-extrabold flex items-center gap-2">
        {Icon ? <Icon size={18} className="text-[#E63946]" /> : null}{n ? `${n}. ` : ""}{title}
      </h2>
      {desc ? <p className="text-[#52525B] text-sm mt-1">{desc}</p> : null}
    </div>
    {children}
  </div>
);

const Code = ({ children }) => (
  <pre className="bg-[#0A0A0A] text-[#E4E4E7] text-xs rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">{children}</pre>
);

export default function SettingsInstaller() {
  const fileRef = useRef(null);
  const backupNow = async () => {
    const t = toast.loading("Membuat backup...");
    try {
      const res = await api.get("/backup/export", {
        responseType: "blob",
        onDownloadProgress: (e) => {
          const mb = (e.loaded / 1048576).toFixed(1);
          toast.loading(`Mengunduh backup... ${mb} MB`, { id: t });
        },
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `gak-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Backup terunduh", { id: t });
    } catch (e) { toast.error("Gagal membuat backup", { id: t }); }
  };
  const restoreFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!window.confirm("Restore akan MENIMPA SEMUA data saat ini dengan isi file. Lanjutkan?")) { e.target.value = ""; return; }
    const t = toast.loading("Memulihkan data...");
    try {
      const fd = new FormData(); fd.append("file", f);
      await api.post("/backup/import", fd);
      toast.success("Data dipulihkan. Memuat ulang...", { id: t });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) { toast.error("Gagal memulihkan data", { id: t }); }
    finally { e.target.value = ""; }
  };
  const dlProject = async () => {
    const t = toast.loading("Menyiapkan folder proyek (.zip)...");
    try {
      const res = await api.get("/installers/project-zip", {
        responseType: "blob",
        onDownloadProgress: (e) => {
          const mb = (e.loaded / 1048576).toFixed(1);
          const pct = e.total ? ` (${Math.round((e.loaded / e.total) * 100)}%)` : "";
          toast.loading(`Mengunduh folder proyek... ${mb} MB${pct}`, { id: t });
        },
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "grand-aceh-pos.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Folder proyek terunduh", { id: t });
    } catch (e) {
      toast.error("Gagal mengunduh folder proyek", { id: t });
    }
  };
  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-installer">
      <div className="max-w-2xl space-y-8">
        {/* DOWNLOAD PROYEK */}
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5">
          <div className="flex items-center gap-2 font-extrabold text-[#0A0A0A]"><FolderDown size={20} className="text-[#E63946]" /> Unduh Folder Proyek</div>
          <p className="text-sm text-[#52525B] mt-1">Unduh seluruh berkas aplikasi (tanpa file rahasia) sebagai satu <b>.zip</b>. Ekstrak di komputer server, lalu jalankan skrip installer dari dalamnya.</p>
          <button data-testid="download-project-zip" onClick={dlProject}
            className="tap mt-3 h-11 px-5 rounded-xl bg-[#E63946] text-white font-bold inline-flex items-center gap-2">
            <FolderDown size={16} /> Unduh grand-aceh-pos.zip
          </button>
        </div>

        {/* PRASYARAT */}
        <Section title="Prasyarat" icon={ListChecks} desc="Yang perlu disiapkan sebelum memasang server.">
          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 space-y-3 text-sm text-[#3f3f46]">
            <div><b>1. Folder proyek</b> — berisi <code>docker-compose.yml</code>, folder <code>backend/</code>, <code>frontend/</code>, <code>whatsapp-service/</code> (dari GitHub atau salinan yang saya berikan).</div>
            <div><b>2. Docker</b> terpasang di mesin server:</div>
            <div className="pl-3">
              <div className="font-bold flex items-center gap-1.5"><Monitor size={14} /> Windows</div>
              <div className="text-[#52525B]">Pasang <b>Docker Desktop</b> → aktifkan WSL2 → restart. Unduh: docker.com/products/docker-desktop</div>
            </div>
            <div className="pl-3">
              <div className="font-bold flex items-center gap-1.5"><Cpu size={14} /> Raspberry Pi (OS 64-bit) / Linux</div>
              <Code>{`curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker`}</Code>
            </div>
            <div><b>3. Jaringan</b> — semua perangkat (server + POS + Android) di <b>WiFi yang sama</b>. Disarankan set <b>IP statis</b> untuk server di router.</div>
          </div>
        </Section>

        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <b>Penting:</b> jadikan <b>SATU</b> mesin sebagai server (Desktop <i>atau</i> Raspberry Pi). Perangkat lain cukup mengakses IP server.
        </div>

        {/* INSTALL */}
        <Section n="1" title="Instal Server (pertama kali)" desc="Pilih lokasi server, unduh skripnya, taruh di dalam folder proyek di mesin itu, lalu jalankan.">
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-windows-installer" icon={Monitor} title="Komputer Desktop (Windows)"
              subtitle="Dobel-klik untuk memasang." file="install-windows.bat" text={INSTALL_WINDOWS_BAT} />
            <DlCard testid="download-pi-installer" icon={Cpu} title="Raspberry Pi (headless)"
              subtitle="Via SSH; editor config terbuka otomatis." file="install-pi.sh" text={INSTALL_PI_SH} />
          </div>
          <div className="rounded-xl border-2 border-[#E63946] bg-[#FEF2F2] p-4">
            <div className="flex items-center gap-2 font-extrabold"><Cpu size={18} className="text-[#E63946]" /> Pi baru (belum ada Docker)? Pakai Bootstrap</div>
            <p className="text-xs text-[#52525B] mt-1">Skrip ini memasang Docker DAN menjalankan installer sekaligus — cocok untuk Raspberry Pi baru (headless). Jalankan via SSH: <code>chmod +x bootstrap-pi.sh &amp;&amp; ./bootstrap-pi.sh</code></p>
            <button data-testid="download-bootstrap-pi" onClick={() => dl("bootstrap-pi.sh", BOOTSTRAP_PI_SH)} className="tap mt-2 h-10 px-4 rounded-lg bg-[#E63946] text-white font-bold text-sm inline-flex items-center gap-2"><Download size={15} /> Unduh bootstrap-pi.sh</button>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46]">
            <div className="font-bold mb-1">Menjalankan di Raspberry Pi (SSH):</div>
            <Code>{`chmod +x install-pi.sh
./install-pi.sh`}</Code>
            <div className="mt-2 text-[#52525B]">Windows: cukup <b>dobel-klik</b> <code>install-windows.bat</code>.</div>
          </div>
        </Section>

        {/* UPDATE */}
        <Section n="2" title="Perbarui Server (update)" icon={RefreshCw} desc="Saat ada versi baru, jalankan di mesin server. Data Anda tetap aman.">
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-update-windows" icon={Monitor} title="Update di Desktop (Windows)"
              subtitle="Tarik versi baru & bangun ulang." file="update-windows.bat" text={UPDATE_WINDOWS_BAT} />
            <DlCard testid="download-update-pi" icon={Cpu} title="Update di Raspberry Pi"
              subtitle="Via SSH: ./update-pi.sh" file="update-pi.sh" text={UPDATE_PI_SH} />
          </div>
        </Section>

        {/* BACKUP */}
        <Section n="3" title="Backup & Restore Data" icon={DatabaseBackup} desc="Simpan salinan seluruh data. Sangat disarankan rutin, terutama di Raspberry Pi (kartu SD bisa rusak).">
          <div className="rounded-xl border-2 border-[#10B981] bg-[#F0FDF4] p-4 space-y-2">
            <div className="font-bold text-sm">Cara cepat (langsung dari aplikasi)</div>
            <div className="flex flex-wrap gap-2">
              <button data-testid="inapp-backup" onClick={backupNow} className="tap h-10 px-4 rounded-lg bg-[#10B981] text-white font-bold text-sm inline-flex items-center gap-2"><DatabaseBackup size={15} /> Backup Sekarang</button>
              <button data-testid="inapp-restore" onClick={() => fileRef.current?.click()} className="tap h-10 px-4 rounded-lg bg-white border font-bold text-sm">Restore dari File...</button>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={restoreFile} data-testid="inapp-restore-input" />
            </div>
            <p className="text-[11px] text-[#52525B]">Backup mengunduh seluruh data ke satu file <b>.zip</b>. Restore menimpa data saat ini dengan isi file.</p>
          </div>
          <div className="text-xs font-bold text-[#52525B] mt-3">Atau lewat skrip di mesin server:</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-backup-windows" icon={Monitor} title="Backup (Windows)"
              subtitle="Simpan ke folder backups\\ bertanggal." file="backup-windows.bat" text={BACKUP_WINDOWS_BAT} />
            <DlCard testid="download-backup-pi" icon={Cpu} title="Backup (Pi/Linux)"
              subtitle="./backup-pi.sh — auto hapus >30 hari." file="backup-pi.sh" text={BACKUP_PI_SH} />
            <DlCard testid="download-restore-windows" icon={Monitor} title="Restore (Windows)"
              subtitle="Seret file .gz ke atas skrip ini." file="restore-windows.bat" text={RESTORE_WINDOWS_BAT} />
            <DlCard testid="download-restore-pi" icon={Cpu} title="Restore (Pi/Linux)"
              subtitle="./restore-pi.sh backups/xxx.gz" file="restore-pi.sh" text={RESTORE_PI_SH} />
          </div>
          <div className="mt-2">
            <DlCard testid="download-autobackup-pi" icon={Cpu} title="Backup Otomatis Harian (Raspberry Pi)"
              subtitle="Pasang sekali via SSH: ./setup-autobackup-pi.sh — backup tiap malam 23:00 tanpa perlu diingat."
              file="setup-autobackup-pi.sh" text={SETUP_AUTOBACKUP_PI_SH} />
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46] space-y-2">
            <div><b>Backup</b> — jalankan skrip; file tersimpan di folder <code>backups/</code> (mis. <code>gak-backup-20260621-0930.gz</code>). Salin file ini ke flashdisk/cloud untuk aman.</div>
            <div><b>Restore</b> (memulihkan) — Pi: <code>./restore-pi.sh backups/namafile.gz</code>. Windows: seret file <code>.gz</code> ke atas <code>restore-windows.bat</code>. Ketik <b>YA</b> saat konfirmasi.</div>
            <div className="text-[#B91C1C]"><b>Perhatian:</b> restore akan MENIMPA seluruh data saat ini dengan isi backup.</div>
          </div>
        </Section>

        {/* RESTART */}
        <Section n="4" title="Restart Server" icon={RefreshCw} desc="Jalankan di mesin server bila perlu memuat ulang aplikasi.">
          <div className="grid sm:grid-cols-2 gap-4">
            <DlCard testid="download-restart-windows" icon={Monitor} title="Restart (Windows)" subtitle="Dobel-klik restart-windows.bat" file="restart-windows.bat" text={RESTART_WINDOWS_BAT} />
            <DlCard testid="download-restart-pi" icon={Cpu} title="Restart (Pi/Linux)" subtitle="./restart-pi.sh" file="restart-pi.sh" text={RESTART_PI_SH} />
          </div>
        </Section>

        {/* STEPS */}
        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <div className="font-extrabold mb-2 flex items-center gap-2"><CheckCircle2 size={16} className="text-[#10B981]" /> Ringkasan alur</div>
          <ol className="space-y-2 text-sm text-[#3f3f46]">
            {[
              "Pasang Docker di mesin server (lihat Prasyarat).",
              "Salin folder proyek ke mesin server, taruh skrip di dalamnya.",
              "Instal: Windows dobel-klik install-windows.bat • Pi via SSH ./install-pi.sh.",
              "Isi backend/.env.docker saat diminta (di Pi, editor terbuka otomatis), simpan.",
              "Akses http://IP-server di POS komputer / atur di APK Android.",
              "Rutin backup (backup-*.sh/.bat) & update saat ada versi baru (update-*.sh/.bat).",
            ].map((s, i) => (
              <li key={s} className="flex gap-2"><span className="font-bold text-[#E63946]">{i + 1}.</span><span>{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
