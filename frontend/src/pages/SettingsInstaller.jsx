import { useRef, useState, useEffect } from "react";
import { Download, Monitor, Cpu, CheckCircle2, RefreshCw, DatabaseBackup, ListChecks, Github } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { BOOTSTRAP_PI_SH, downloadText } from "@/lib/installers";

const REPO_URL = "https://github.com/taqim2609/POS-grand.git";
const RAW_BOOTSTRAP = "https://raw.githubusercontent.com/taqim2609/POS-grand/main/bootstrap-pi.sh";
const APP_DIR = "~/grand-aceh-pos";

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
  <pre className="bg-[#0A0A0A] text-[#E4E4E7] text-xs rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap select-all">{children}</pre>
);

export default function SettingsInstaller() {
  const fileRef = useRef(null);
  const [updating, setUpdating] = useState(false);
  const [updateEnabled, setUpdateEnabled] = useState(null);

  useEffect(() => {
    api.get("/admin/update/status")
      .then((r) => setUpdateEnabled(!!r.data?.enabled))
      .catch(() => setUpdateEnabled(false));
  }, []);

  const updateNow = async () => {
    if (!window.confirm("Tarik versi terbaru dari GitHub & bangun ulang sekarang? Aplikasi akan restart beberapa menit.")) return;
    setUpdating(true);
    const t = toast.loading("Memulai update...");
    try {
      const r = await api.post("/admin/update");
      toast.success(r.data?.message || "Update dimulai.", { id: t, duration: 9000 });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memulai update", { id: t, duration: 10000 });
      setUpdating(false);
    }
  };

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

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8" data-testid="settings-installer">
      <div className="max-w-2xl space-y-8">
        {/* HEADER GITHUB */}
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5" data-testid="github-repo-box">
          <div className="flex items-center gap-2 font-extrabold text-[#0A0A0A]"><Github size={20} className="text-[#E63946]" /> Instalasi &amp; Update via GitHub</div>
          <p className="text-sm text-[#52525B] mt-1">Semua kode aplikasi diambil dari repository GitHub Anda. Install dan update cukup dari sini — tanpa pindah file manual.</p>
          <div className="mt-2 text-xs font-bold text-[#52525B]">Repository:</div>
          <Code>{REPO_URL}</Code>
        </div>

        {/* PRASYARAT */}
        <Section title="Prasyarat" icon={ListChecks} desc="Yang perlu disiapkan sebelum memasang server.">
          <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 space-y-3 text-sm text-[#3f3f46]">
            <div><b>Repo GitHub</b> — pastikan repo <code>POS-grand</code> sudah berisi kode terbaru (pakai tombol <b>Save to Github</b>) dan berstatus <b>publik</b> agar bisa di-clone tanpa login.</div>
            <div><b>Satu mesin server</b> — pilih Raspberry Pi (OS 64-bit) <i>atau</i> komputer Windows. Perangkat lain (POS/Android) cukup mengakses IP server.</div>
            <div><b>Jaringan</b> — semua perangkat di <b>WiFi yang sama</b>. Disarankan set <b>IP statis</b> untuk server di router.</div>
            <div className="text-[#52525B]">Docker &amp; git akan dipasang otomatis oleh skrip bootstrap (Pi). Di Windows, pasang <b>Docker Desktop</b> + <b>Git for Windows</b> lebih dulu.</div>
          </div>
        </Section>

        {/* INSTALL */}
        <Section n="1" title="Instal Server (pertama kali)" icon={Github} desc="Ambil kode dari GitHub, lalu jalankan. Sekali perintah untuk Raspberry Pi.">
          <div className="rounded-xl border-2 border-[#E63946] bg-[#FEF2F2] p-4 space-y-2">
            <div className="flex items-center gap-2 font-extrabold"><Cpu size={18} className="text-[#E63946]" /> Raspberry Pi (headless) — 1 perintah via SSH</div>
            <p className="text-xs text-[#52525B]">Memasang <b>git + Docker</b>, meng-<b>clone</b> repo GitHub ke <code>{APP_DIR}</code>, lalu menjalankan installer (editor konfigurasi terbuka otomatis).</p>
            <Code>{`bash <(curl -fsSL ${RAW_BOOTSTRAP})`}</Code>
            <button data-testid="download-bootstrap-pi" onClick={() => { downloadText("bootstrap-pi.sh", BOOTSTRAP_PI_SH); toast.success("bootstrap-pi.sh diunduh"); }}
              className="tap mt-1 h-9 px-3 rounded-lg bg-white border border-[#E63946] text-[#E63946] font-bold text-xs inline-flex items-center gap-1.5">
              <Download size={13} /> Unduh bootstrap-pi.sh (cadangan)
            </button>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 space-y-2 text-sm text-[#3f3f46]">
            <div className="font-bold flex items-center gap-1.5"><Monitor size={14} /> Komputer Windows</div>
            <p className="text-xs text-[#52525B]">Pastikan Docker Desktop &amp; Git terpasang, lalu di PowerShell:</p>
            <Code>{`git clone ${REPO_URL} grand-aceh-pos
cd grand-aceh-pos
install-windows.bat`}</Code>
          </div>
        </Section>

        {/* UPDATE */}
        <Section n="2" title="Perbarui Server (update dari GitHub)" icon={RefreshCw} desc="Saat ada versi baru di GitHub, jalankan di mesin server. Data Anda tetap aman.">
          <div className="rounded-xl border-2 border-[#E63946] bg-[#FEF2F2] p-4 space-y-2" data-testid="update-oneclick-box">
            <div className="flex items-center gap-2 font-extrabold"><RefreshCw size={18} className="text-[#E63946]" /> Update 1-Klik</div>
            <p className="text-xs text-[#52525B]">Tarik versi terbaru dari GitHub &amp; bangun ulang otomatis di server — tanpa SSH. Setelah ditekan, tunggu 2–10 menit lalu muat ulang halaman ini.</p>
            <button data-testid="inapp-update-btn" disabled={updating} onClick={updateNow}
              className="tap h-11 px-5 rounded-xl bg-[#E63946] text-white font-bold inline-flex items-center gap-2 disabled:opacity-60">
              <RefreshCw size={16} className={updating ? "animate-spin" : ""} /> {updating ? "Sedang update..." : "Update Sekarang"}
            </button>
            {updateEnabled === false && (
              <p className="text-[11px] text-[#B91C1C]" data-testid="update-inactive-note">Fitur 1-klik belum aktif. Jalankan update manual <b>sekali</b> (perintah di bawah) untuk mengaktifkannya; setelah itu cukup tombol.</p>
            )}
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 space-y-3 text-sm text-[#3f3f46]">
            <div className="font-bold text-xs text-[#52525B]">Alternatif via SSH (juga dipakai untuk mengaktifkan tombol 1-klik pertama kali):</div>
            <div>
              <div className="font-bold flex items-center gap-1.5 mb-1"><Cpu size={14} /> Raspberry Pi (SSH)</div>
              <Code>{`cd ${APP_DIR} && ./update-pi.sh`}</Code>
              <div className="text-[11px] text-[#52525B] mt-1">Otomatis <code>git pull</code> + bangun ulang + restart.</div>
            </div>
            <div>
              <div className="font-bold flex items-center gap-1.5 mb-1"><Monitor size={14} /> Windows</div>
              <Code>{`cd grand-aceh-pos
update-windows.bat`}</Code>
            </div>
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
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46] space-y-2">
            <div className="font-bold">Atau lewat skrip di dalam folder proyek (hasil clone):</div>
            <Code>{`cd ${APP_DIR}
./backup-pi.sh                       # buat backup -> folder backups/
./restore-pi.sh backups/namafile.gz  # pulihkan (ketik YA saat konfirmasi)
./setup-autobackup-pi.sh             # backup otomatis tiap malam 23:00`}</Code>
            <div className="text-[#B91C1C]"><b>Perhatian:</b> restore MENIMPA seluruh data saat ini. Salin file backup ke flashdisk/cloud agar aman.</div>
          </div>
        </Section>

        {/* RESTART */}
        <Section n="4" title="Restart Server" icon={RefreshCw} desc="Jalankan di dalam folder proyek bila perlu memuat ulang aplikasi.">
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46]">
            <Code>{`cd ${APP_DIR} && ./restart-pi.sh`}</Code>
            <div className="mt-1 text-[11px] text-[#52525B]">Windows: dobel-klik <code>restart-windows.bat</code> di dalam folder proyek.</div>
          </div>
        </Section>

        {/* STEPS */}
        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <div className="font-extrabold mb-2 flex items-center gap-2"><CheckCircle2 size={16} className="text-[#10B981]" /> Ringkasan alur (GitHub)</div>
          <ol className="space-y-2 text-sm text-[#3f3f46]">
            {[
              "Push kode ke GitHub (tombol Save to Github) — pastikan repo publik.",
              "Di Raspberry Pi via SSH, jalankan 1 perintah bootstrap di atas (pasang git+Docker, clone repo, install).",
              "Isi backend/.env.docker saat editor terbuka (JWT_SECRET, email/password admin, kunci AI), simpan.",
              "Reboot Pi sekali (sudo reboot) agar Docker jalan tanpa sudo.",
              "Akses http://IP-server di POS komputer / atur di APK Android.",
              "Update: cd ~/grand-aceh-pos && ./update-pi.sh. Backup rutin dari tombol di atas.",
            ].map((s, i) => (
              <li key={s} className="flex gap-2"><span className="font-bold text-[#E63946]">{i + 1}.</span><span>{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
