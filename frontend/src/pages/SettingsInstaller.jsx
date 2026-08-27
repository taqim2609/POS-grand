import { useRef, useState, useEffect } from "react";
import { Download, Monitor, Cpu, CheckCircle2, RefreshCw, DatabaseBackup, Globe, CloudUpload, Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { BOOTSTRAP_PI_SH, BOOTSTRAP_WINDOWS_BAT, downloadText } from "@/lib/installers";

const VIBE_URL = "https://taqim258.vibecoder.co.id/pos-grand-update";
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
  const [phase, setPhase] = useState("");
  const [log, setLog] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    api.get("/admin/update/status")
      .then((r) => setUpdateEnabled(!!r.data?.enabled))
      .catch(() => setUpdateEnabled(false));
    return () => { clearInterval(pollRef.current); clearInterval(tickRef.current); };
  }, []);

  const finishUpdate = (ok) => {
    clearInterval(pollRef.current); clearInterval(tickRef.current);
    if (ok) {
      setPhase("Selesai! Memuat ulang halaman...");
      setTimeout(() => window.location.reload(), 2500);
    } else {
      setUpdating(false); setPhase("");
    }
  };

  const startPolling = () => {
    let sawRunning = false, sawDown = false;
    const started = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) { finishUpdate(true); return; }
      try {
        const r = await api.get("/admin/update/status");
        if (r.data?.log) setLog(r.data.log);
        if (r.data?.running) {
          sawRunning = true;
          setPhase("Membangun ulang aplikasi di server...");
        } else if (sawRunning || sawDown) {
          finishUpdate(true);
        } else {
          setPhase("Menyiapkan update...");
        }
      } catch (e) {
        sawDown = true;
        setPhase("Server sedang restart (membangun ulang)...");
      }
    }, 4000);
  };

  const updateNow = async () => {
    if (!window.confirm("Unduh versi terbaru dari vibecoder.co.id & bangun ulang sekarang? Aplikasi akan restart beberapa menit.")) return;
    setUpdating(true); setLog(""); setPhase("Memulai update...");
    const t = toast.loading("Memulai update...");
    try {
      const r = await api.post("/admin/update");
      toast.success(r.data?.message || "Update dimulai.", { id: t, duration: 8000 });
      startPolling();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memulai update", { id: t, duration: 10000 });
      setUpdating(false); setPhase("");
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

  const backupToVibe = async () => {
    if (!window.confirm("Buat backup database di server lalu kirim salinannya ke vibecoder.co.id? Backup lokal tetap dibuat di folder backups/.")) return;
    const t = toast.loading("Membuat & mengirim backup ke vibecoder.co.id...");
    try {
      const r = await api.post("/backup/send-to-vibecoder");
      toast.success(r.data?.message || "Backup sedang dibuat & dikirim di server", { id: t, duration: 9000 });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal memulai backup (periksa internet server)", { id: t, duration: 10000 });
    }
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
        {/* HEADER VIBECODER */}
        <div className="rounded-2xl border-2 border-[#E63946] bg-[#FEF2F2] p-5" data-testid="vibecoder-repo-box">
          <div className="flex items-center gap-2 font-extrabold text-[#0A0A0A]"><Globe size={20} className="text-[#E63946]" /> Pusat Update vibecoder.co.id</div>
          <p className="text-sm text-[#52525B] mt-1">Seluruh kode &amp; update server diunduh dari pusat ini — tanpa GitHub. Versi dicek otomatis dari <code className="font-mono text-xs">version.json</code>.</p>
          <div className="mt-2 text-xs font-bold text-[#52525B]">Alamat pusat update:</div>
          <Code>{VIBE_URL}</Code>
        </div>

        {/* INSTALL */}
        <Section n="1" title="Instal Server (pertama kali)" icon={Globe} desc="Unduh kode dari vibecoder.co.id, lalu jalankan. Sekali perintah untuk Raspberry Pi.">
          <div className="rounded-xl border-2 border-[#E63946] bg-[#FEF2F2] p-4 space-y-2">
            <div className="flex items-center gap-2 font-extrabold"><Cpu size={18} className="text-[#E63946]" /> Raspberry Pi (headless) — 1 perintah via SSH</div>
            <p className="text-xs text-[#52525B]">Memasang <b>Docker</b>, meng-<b>unduh kode</b> dari vibecoder.co.id ke <code>{APP_DIR}</code>, lalu menjalankan installer (editor konfigurasi terbuka otomatis).</p>
            <Code>{`bash <(curl -fsSL ${VIBE_URL}/bootstrap-pi.sh)`}</Code>
            <button data-testid="download-bootstrap-pi" onClick={() => { downloadText("bootstrap-pi.sh", BOOTSTRAP_PI_SH); toast.success("bootstrap-pi.sh diunduh"); }}
              className="tap mt-1 h-9 px-3 rounded-lg bg-white border border-[#E63946] text-[#E63946] font-bold text-xs inline-flex items-center gap-1.5">
              <Download size={13} /> Unduh bootstrap-pi.sh (cadangan)
            </button>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 space-y-2 text-sm text-[#3f3f46]">
            <div className="font-bold flex items-center gap-1.5"><Monitor size={14} /> Komputer Windows</div>
            <p className="text-xs text-[#52525B]">Pastikan <b>Docker Desktop</b> terpasang. Cara termudah: unduh skrip bootstrap lalu <b>dobel-klik</b> — otomatis unduh dari vibecoder.co.id + install.</p>
            <button data-testid="download-bootstrap-windows" onClick={() => { downloadText("bootstrap-windows.bat", BOOTSTRAP_WINDOWS_BAT); toast.success("bootstrap-windows.bat diunduh"); }}
              className="tap h-9 px-3 rounded-lg bg-white border border-[#0A0A0A] text-[#0A0A0A] font-bold text-xs inline-flex items-center gap-1.5">
              <Download size={13} /> Unduh bootstrap-windows.bat
            </button>
            <div className="text-[11px] text-[#52525B] mt-1">Atau manual di PowerShell:</div>
            <Code>{`mkdir grand-aceh-pos && cd grand-aceh-pos
curl -fsSL ${VIBE_URL}/pos-grand.tar.gz -o pos-grand.tar.gz
tar xzf pos-grand.tar.gz
install-windows.bat`}</Code>
          </div>
        </Section>

        {/* UPDATE */}
        <Section n="2" title="Perbarui Server" icon={RefreshCw} desc="Ambil versi terbaru dari vibecoder.co.id. Data Anda tetap aman.">
          <div className="rounded-xl border-2 border-[#E63946] bg-[#FEF2F2] p-4 space-y-2" data-testid="update-oneclick-box">
            <div className="flex items-center gap-2 font-extrabold"><RefreshCw size={18} className="text-[#E63946]" /> Update 1-Klik</div>
            <p className="text-xs text-[#52525B]">Unduh versi terbaru dari vibecoder.co.id &amp; bangun ulang otomatis di server — tanpa SSH. Tunggu 2–10 menit lalu muat ulang halaman.</p>
            <button data-testid="inapp-update-btn" disabled={updating} onClick={updateNow}
              className="tap h-11 px-5 rounded-xl bg-[#E63946] text-white font-bold inline-flex items-center gap-2 disabled:opacity-60">
              <RefreshCw size={16} className={updating ? "animate-spin" : ""} /> {updating ? "Sedang update..." : "Update Sekarang"}
            </button>
            {updating && (
              <div className="mt-2 rounded-lg border border-[#E4E4E7] bg-white p-3 space-y-2" data-testid="update-progress">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0A0A0A]">
                  <RefreshCw size={14} className="animate-spin text-[#E63946]" />
                  <span data-testid="update-phase">{phase || "Memproses..."}</span>
                  <span className="ml-auto text-xs text-[#52525B] font-mono">{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>
                </div>
                {log ? <pre className="bg-[#0A0A0A] text-[#E4E4E7] text-[10px] rounded p-2 max-h-32 overflow-auto font-mono whitespace-pre-wrap" data-testid="update-log">{log}</pre> : null}
                <p className="text-[11px] text-[#52525B]">Jangan tutup halaman ini. Akan dimuat ulang otomatis saat selesai.</p>
              </div>
            )}
            {!updating && updateEnabled === false && (
              <p className="text-[11px] text-[#B91C1C]" data-testid="update-inactive-note">Fitur 1-klik belum aktif. Jalankan update manual <b>sekali</b> (perintah di bawah) untuk mengaktifkannya.</p>
            )}
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 space-y-3 text-sm text-[#3f3f46]">
            <div className="font-bold text-xs text-[#52525B]">Alternatif via SSH (dipakai untuk mengaktifkan tombol 1-klik pertama kali):</div>
            <div>
              <div className="font-bold flex items-center gap-1.5 mb-1"><Cpu size={14} /> Raspberry Pi (SSH)</div>
              <Code>{`cd ${APP_DIR} && bash update-vibecoder-pi.sh`}</Code>
              <div className="text-[11px] text-[#52525B] mt-1">Cek versi di vibecoder.co.id → unduh → ekstrak → build &amp; restart otomatis.</div>
            </div>
          </div>
        </Section>

        {/* BACKUP */}
        <Section n="3" title="Backup & Restore Data" icon={DatabaseBackup} desc="Simpan salinan seluruh data. Sangat disarankan rutin.">
          <div className="rounded-xl border-2 border-[#10B981] bg-[#F0FDF4] p-4 space-y-2">
            <div className="font-bold text-sm">Cara cepat (langsung dari aplikasi)</div>
            <div className="flex flex-wrap gap-2">
              <button data-testid="inapp-backup" onClick={backupNow} className="tap h-10 px-4 rounded-lg bg-[#10B981] text-white font-bold text-sm inline-flex items-center gap-2"><DatabaseBackup size={15} /> Backup Sekarang</button>
              <button data-testid="inapp-backup-vibecoder" onClick={backupToVibe} className="tap h-10 px-4 rounded-lg bg-[#4F46E5] text-white font-bold text-sm inline-flex items-center gap-2"><CloudUpload size={15} /> Kirim Backup ke Vibecoder</button>
              <button data-testid="inapp-restore" onClick={() => fileRef.current?.click()} className="tap h-10 px-4 rounded-lg bg-white border font-bold text-sm">Restore dari File...</button>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={restoreFile} data-testid="inapp-restore-input" />
            </div>
            <p className="text-[11px] text-[#52525B]"><b>Backup Sekarang</b> mengunduh data ke file .zip. <b>Kirim ke Vibecoder</b> membuat backup di server lalu mengirim salinannya ke vibecoder.co.id (cadangan tambahan).</p>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46] space-y-2">
            <div className="font-bold">Atau lewat skrip di dalam folder proyek:</div>
            <Code>{`cd ${APP_DIR}
./backup-pi.sh                       # backup lokal -> backups/
./backup-to-vibecoder.sh             # backup lokal + kirim salinan ke vibecoder.co.id
./restore-pi.sh backups/namafile.gz  # pulihkan (ketik YA saat konfirmasi)`}</Code>
            <div className="text-[#B91C1C]"><b>Perhatian:</b> restore MENIMPA seluruh data. Salin backup ke flashdisk/cloud agar aman.</div>
          </div>
        </Section>

        {/* DIAGNOSTIK */}
        <Section n="4" title="Diagnostik & Lapor Bug" icon={Bug} desc="Kirim info teknis ke VibeCoder untuk analisis.">
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 text-sm text-[#3f3f46]">
            <p className="text-[#52525B] text-xs mb-2">Laporan dikirim langsung ke vibecoder.co.id (internet), tanpa lewat server Pi — bisa dilakukan meski koneksi server bermasalah.</p>
            <button data-testid="goto-diagnostik" onClick={() => { try { window.location.hash = "/settings?tab=diagnostik"; } catch (_) {} }}
              className="tap h-10 px-4 rounded-lg bg-[#4F46E5] text-white font-bold text-sm inline-flex items-center gap-2">
              <Bug size={15} /> Buka Diagnostik
            </button>
          </div>
        </Section>

        {/* STEPS */}
        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <div className="font-extrabold mb-2 flex items-center gap-2"><CheckCircle2 size={16} className="text-[#10B981]" /> Ringkasan alur</div>
          <ol className="space-y-2 text-sm text-[#3f3f46]">
            {[
              "Di Raspberry Pi via SSH, jalankan 1 perintah bootstrap (pasang Docker, unduh kode dari vibecoder.co.id, install).",
              "Isi backend/.env.docker saat editor terbuka (JWT_SECRET, email/password admin), simpan.",
              "Akses http://IP-server di POS komputer / atur di APK Android.",
              "Update: cd ~/grand-aceh-pos && bash update-vibecoder-pi.sh (otomatis dari vibecoder.co.id).",
              "Backup rutin: tombol di atas atau backup-pi.sh. Lapor bug: Diagnostik.",
            ].map((s, i) => (
              <li key={s} className="flex gap-2"><span className="font-bold text-[#E63946]">{i + 1}.</span><span>{s}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
