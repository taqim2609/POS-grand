import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError, getServerUrl, setServerUrl, discoverServer } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Server, Radar } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSrv, setShowSrv] = useState(false);
  const [srv, setSrv] = useState(getServerUrl());
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);

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
    if (user) nav("/pos");
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
      <div className="hidden lg:flex flex-col justify-between bg-[#0A0A0A] text-white p-12 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#E63946]/30 blur-3xl" />
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

          <button
            type="button" data-testid="server-scan-btn" onClick={scan} disabled={scanning}
            className="tap mt-4 w-full h-11 rounded-xl border-2 border-[#E63946] text-[#E63946] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />} Cari Server Otomatis
          </button>

          <button
            type="button" data-testid="server-config-toggle" onClick={() => setShowSrv((v) => !v)}
            className="mt-3 mx-auto flex items-center gap-1.5 text-xs font-bold text-[#a1a1aa] hover:text-[#52525B]"
          >
            <Server size={13} /> Atur Server Manual (LAN)
          </button>
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
        </form>
      </div>
    </div>
  );
}
