import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError, getServerUrl, setServerUrl, discoverServer } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Server, Radar, Download, Globe, Smartphone, Bug } from "lucide-react";
import { collectVersions } from "@/lib/versions";

const TAILSCALE_FUNNEL_URL = "https://grandpos.tailf3a839.ts.net";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSrv, setShowSrv] = useState(false);
  const [srv, setSrv] = useState(getServerUrl());
  const [showTs, setShowTs] = useState(false);
  const [tsUrl, setTsUrl] = useState(() => {
    const cur = getServerUrl();
    return cur && cur.includes(".ts.net") ? cur : TAILSCALE_FUNNEL_URL;
  });
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [version, setVersion] = useState(null);
  const [loginDiagSending, setLoginDiagSending] = useState(false);

  useEffect(() => {
    let stop = false;
    collectVersions().then((v) => { if (!stop) setVersion(v); }).catch(() => {});
    return () => { stop = true; };
  }, []);

  // Kirim laporan diagnostik TANPA login — langsung ke vibecoder.co.id (penerima rpt.php).
  const sendLoginDiag = async () => {
    setLoginDiagSending(true);
    const t = toast.loading("Mengirim laporan diagnostik...");
    try {
      const v = await collectVersions();
      const parts = [
        "=== LAPORAN DIAGNOSTIK (dari layar login) ===",
        `Waktu: ${new Date().toLocaleString("id-ID")}`,
        `Bundle frontend: ${v.bundle}`,
        `Platform: ${v.native ? `APK (Capacitor) v${v.apk}` : "Web"}`,
        `URL server: ${v.serverUrl}`,
        `OTA server: ${v.otaServer || "-"} | OTA lokal: ${v.otaLocal || "-"} | OTA terpasang: ${v.otaInstalled || "-"}`,
        `User-Agent: ${navigator.userAgent || "-"}`,
        `Layar: ${window.screen?.width || "-"}x${window.screen?.height || "-"} (dpr ${window.devicePixelRatio || 1})`,
        `Online: ${navigator.onLine ? "ya" : "tidak"}`,
      ];
      // Probe koneksi ke server (biar laporan mencerminkan kondisi nyata)
      const base = v.serverUrl;
      if (base && base.startsWith("http")) {
        try {
          const r = await fetch(`${base}/api/health`, { cache: "no-store" });
          const j = await r.json().catch(() => ({}));
          parts.push(`Server /api/health: HTTP ${r.status} -> ${JSON.stringify(j)}`);
        } catch (e) {
          parts.push(`Server /api/health: GAGAL -> ${(e && e.message) || e}`);
        }
      }
      const report = parts.join("\n");
      const res = await fetch("https://taqim258.vibecoder.co.id/pos-grand-update/rpt.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gak-Token": "gak_rpt_7f3c9e1b" },
        body: JSON.stringify({ ts: new Date().toISOString(), report }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Laporan terkirim — sebutkan di chat bahwa Anda mengirimnya", { id: t, duration: 8000 });
    } catch (e) {
      toast.error(`Gagal mengirim: ${(e && e.message) || e}. Butuh internet server untuk mengirim.`, { id: t, duration: 9000 });
    } finally {
      setLoginDiagSending(false);
    }
  };

  const testConn = async () => {
    const base = (srv || getServerUrl()).replace(/\/+$/, "");
    if (!base) { toast.error("Isi alamat server dulu"); return; }
    setTesting(true);
    const t = toast.loading(`Menghubungi ${base} ...`);
    try {
      const res = await fetch(`${base}/api/health`);
      const txt = await res.text();
      if (res.ok && txt.includes("gak-pos")) toast.success("Server terhubung! ✅ Silakan login.", { id: t, duration: 6000 });
      else toast.error(`Server menjawab tapi tidak dikenal (HTTP ${res.status}). Cek alamat server.`, { id: t, duration: 8000 });
    } catch (e) {
      toast.error(`Gagal menghubungi server: ${e.message}. Cek IP & koneksi, pastikan diawali http://`, { id: t, duration: 9000 });
    } finally { setTesting(false); }
  };

  const saveSrv = () => {
    setServerUrl(srv);
    toast.success("Alamat server disimpan. Memuat ulang...");
    setTimeout(() => window.location.reload(), 700);
  };

  const saveTs = () => {
    const url = (tsUrl || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/.+/.test(url)) {
      toast.error("Alamat Tailscale harus diawali https:// (mis. https://grandpos.tailf3a839.ts.net)");
      return;
    }
    setServerUrl(url);
    setSrv(url);
    toast.success("Terhubung via Tailscale. Memuat ulang...");
    setTimeout(() => window.location.reload(), 700);
  };

  const testTs = async () => {
    const base = (tsUrl || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/.+/.test(base)) { toast.error("Isi alamat Tailscale yang benar dulu (https://...)"); return; }
    setTesting(true);
    const t = toast.loading(`Menghubungi ${base} ...`);
    try {
      const res = await fetch(`${base}/api/health`);
      const txt = await res.text();
      if (res.ok && txt.includes("gak-pos")) toast.success("Server Tailscale terhubung! ✅ Silakan login.", { id: t, duration: 6000 });
      else toast.error(`Server menjawab tapi tidak dikenal (HTTP ${res.status}).`, { id: t, duration: 8000 });
    } catch (e) {
      toast.error(`Gagal menghubungi ${base}: ${e.message}. Pastikan Funnel aktif di Pi & URL benar.`, { id: t, duration: 9000 });
    } finally {
      setTesting(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    const t = toast.loading("Mencari server di jaringan...");
    try {
      const found = await discoverServer((done, total) => {
        toast.loading(`Memindai jaringan... (${done}/${total})`, { id: t });
      });
      if (found) {
        setServerUrl(found);
        toast.success(`Server ditemukan: ${found}. Menghubungkan...`, { id: t });
        setTimeout(() => window.location.reload(), 900);
      } else {
        toast.error("Server tidak ditemukan otomatis. Isi alamat manual di Pengaturan Server.", { id: t });
        setShowSrv(true);
      }
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (user) nav(user.role === "admin" ? "/dashboard" : user.role === "input" ? "/products" : "/pos");
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Selamat datang, ${u.name}`);
      nav(u.role === "admin" ? "/dashboard" : u.role === "input" ? "/products" : "/pos");
    } catch (err) {
      if (!err.response) {
        toast.error(`Tidak bisa terhubung ke server (${getServerUrl() || "belum diatur"}). Cek alamat server, pastikan diawali http:// dan HP satu jaringan dengan server.`, { duration: 8000 });
      } else if (err.response.status === 401) {
        toast.error("Email atau password salah.");
      } else {
        toast.error(apiError(err.response?.data?.detail) || "Gagal masuk");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#450A0A] via-[#BE123C] to-[#B45309] text-white p-12 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#F97316]/40 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-[#4F46E5]/30 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-11 w-11 rounded-xl bg-[#E63946] grid place-items-center font-heading font-extrabold text-xl">G</div>
          <span className="font-heading font-extrabold text-lg">Grand Aceh Kuliner</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Sistem Kasir Hybrid<br />F&B + Retail</h1>
          <p className="text-white/60 mt-4 max-w-md">
            Dine-in, take away, dan retail dalam satu sistem. Cepat, stabil, dan tetap jalan
            saat internet bermasalah.
          </p>
          <div className="flex gap-3 mt-8">
            <span className="ot-dine_in border rounded-full px-4 py-1.5 text-sm font-bold">Dine-In</span>
            <span className="ot-take_away border rounded-full px-4 py-1.5 text-sm font-bold">Take Away</span>
            <span className="ot-retail border rounded-full px-4 py-1.5 text-sm font-bold">Retail</span>
          </div>
        </div>
        <div className="text-white/40 text-xs relative">© 2026 Grand Aceh Kuliner POS</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <h2 className="text-2xl font-extrabold">Masuk ke POS</h2>
          <p className="text-[#52525B] text-sm mt-1 mb-8">Gunakan akun admin atau kasir Anda.</p>

          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Email</label>
          <div className="relative mt-1.5 mb-4">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
            <input
              data-testid="login-email"
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#E4E4E7] focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/20 outline-none"
              placeholder="anda@grandaceh.com"
            />
          </div>

          <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Password</label>
          <div className="relative mt-1.5 mb-6">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
            <input
              data-testid="login-password"
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#E4E4E7] focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/20 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            data-testid="login-submit" type="submit" disabled={loading}
            className="tap w-full h-13 py-3.5 rounded-xl bg-[#E63946] hover:bg-[#BE123C] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />} Masuk
          </button>

          {/* Baris 1: Cari Server Otomatis | Atur Server Manual */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button" data-testid="server-scan-btn" onClick={scan} disabled={scanning}
              className="tap h-11 rounded-xl border-2 border-[#E63946] text-[#E63946] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 text-center leading-tight disabled:opacity-60"
            >
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />} Cari Server Otomatis
            </button>
            <button
              type="button" data-testid="server-config-toggle" onClick={() => setShowSrv((v) => !v)}
              className="tap h-11 rounded-xl border-2 border-[#71717A] text-[#52525B] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 text-center leading-tight hover:bg-[#52525B] hover:text-white transition-colors"
            >
              <Server size={15} /> Atur Server Manual
            </button>
          </div>
          {showSrv && (
            <div className="mt-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3" data-testid="server-config-panel">
              <label className="text-xs uppercase tracking-wider font-bold text-[#52525B]">Alamat Server</label>
              <input
                data-testid="server-url-input" value={srv} onChange={(e) => setSrv(e.target.value)}
                placeholder="http://192.168.1.100"
                className="w-full h-11 px-3 mt-1.5 rounded-lg border border-[#E4E4E7] text-sm font-mono outline-none focus:border-[#E63946]"
              />
              <p className="text-[11px] text-[#a1a1aa] mt-1.5 leading-snug">
                Kosongkan untuk memakai server yang sama dengan aplikasi. Isi IP komputer server saat memakai APK Android di jaringan toko.
              </p>
              <button
                type="button" data-testid="server-url-save" onClick={saveSrv}
                className="tap mt-2 w-full h-10 rounded-lg bg-[#0A0A0A] text-white font-bold text-sm"
              >
                Simpan &amp; Hubungkan
              </button>
              <button
                type="button" data-testid="server-test-btn" onClick={testConn} disabled={testing}
                className="tap mt-2 w-full h-10 rounded-lg border-2 border-[#0A0A0A] text-[#0A0A0A] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />} Tes Koneksi
              </button>
            </div>
          )}

          {/* Baris 2: Unduh Aplikasi | Koneksi via Tailscale */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <a
              href="https://taqim258.vibecoder.co.id/pos-grand-update/apk/Grand-Aceh-Kuliner-POS-v2.4.apk"
              target="_blank" rel="noopener noreferrer" data-testid="download-app-btn"
              className="tap h-11 rounded-xl border-2 border-[#0A0A0A] text-[#0A0A0A] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 text-center leading-tight hover:bg-[#0A0A0A] hover:text-white transition-colors"
            >
              <Download size={15} /> Unduh APK Android
            </a>
            <button
              type="button" data-testid="tailscale-toggle" onClick={() => setShowTs((v) => !v)}
              className="tap h-11 rounded-xl border-2 border-[#2563EB] text-[#2563EB] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 text-center leading-tight hover:bg-[#2563EB] hover:text-white transition-colors"
            >
              <Globe size={15} /> Koneksi via Tailscale
            </button>
          </div>
          {showTs && (
            <div className="mt-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3" data-testid="tailscale-panel">
              <label className="text-xs uppercase tracking-wider font-bold text-[#1D4ED8]">Alamat Server Tailscale (Funnel)</label>
              <input
                data-testid="tailscale-url-input" value={tsUrl} onChange={(e) => setTsUrl(e.target.value)}
                placeholder="https://grandpos.tailf3a839.ts.net"
                className="w-full h-11 px-3 mt-1.5 rounded-lg border border-[#BFDBFE] bg-white text-sm font-mono outline-none focus:border-[#2563EB]"
              />
              <p className="text-[11px] text-[#3B82F6] mt-1.5 leading-snug">
                Akses server toko dari luar jaringan lewat internet, tanpa memasang aplikasi Tailscale di HP. Jalankan dulu <span className="font-mono">setup-funnel-pi.sh</span> di Raspberry Pi untuk mengaktifkan Funnel.
              </p>
              <button
                type="button" data-testid="tailscale-save" onClick={saveTs}
                className="tap mt-2 w-full h-10 rounded-lg bg-[#2563EB] text-white font-bold text-sm"
              >
                Simpan &amp; Hubungkan
              </button>
              <button
                type="button" data-testid="tailscale-test" onClick={testTs} disabled={testing}
                className="tap mt-2 w-full h-10 rounded-lg border-2 border-[#2563EB] text-[#2563EB] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />} Tes Koneksi
              </button>
            </div>
          )}
        </form>

        {/* Footer versi + Diagnostik — tampil di layar login (bertumpuk) */}
        <div className="mt-4 text-center text-[11px] text-[#8b87a8] font-mono" data-testid="login-version">
          <div className="flex items-center justify-center gap-1.5">
            <Smartphone size={11} />
            <span>{version?.native ? `APK v${version.apk}` : `Web · bundle ${version?.bundle || "-"}`}</span>
          </div>
          {version?.native && (
            <div className="mt-0.5">OTA {version.otaInstalled || version.otaServer || "-"}</div>
          )}
          {version?.native && version.otaServer && version.otaInstalled && version.otaServer > version.otaInstalled && (
            <div className="mt-1 text-[10px] text-[#B45309]">Update OTA tersedia ({version.otaServer}) — buka aplikasi untuk memasang.</div>
          )}
          {/* Diagnostik tanpa login */}
          <button
            type="button"
            data-testid="login-diag-btn"
            onClick={sendLoginDiag}
            disabled={loginDiagSending}
            className="tap mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#4F46E5] text-[#4F46E5] font-bold text-xs px-3 py-2 hover:bg-[#EEF2FF] disabled:opacity-50"
          >
            {loginDiagSending ? <Loader2 size={13} className="animate-spin" /> : <Bug size={13} />}
            {loginDiagSending ? "Mengirim..." : "Kirim Laporan Diagnostik"}
          </button>
        </div>
      </div>
    </div>
  );
}
