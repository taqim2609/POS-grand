import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { rupiah, ORDER_TYPE_LABEL } from "@/lib/format";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  LayoutDashboard, ShoppingCart, Grid3x3, Package, Tags,
  Armchair, Clock, FileSpreadsheet, Users, LogOut, ShieldCheck, Menu, X, Printer,
  Boxes, Wallet, Wifi, WifiOff, RefreshCw, CloudOff, Database, Sparkles, KeyRound, Trash2, Settings, Bot, BarChart3,
} from "lucide-react";

function ChangePasswordDialog({ open, onClose }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [nw2, setNw2] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!cur) return toast.error("Masukkan password lama");
    if (nw.length < 6) return toast.error("Password baru minimal 6 karakter");
    if (nw !== nw2) return toast.error("Konfirmasi password tidak cocok");
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: nw });
      toast.success("Password berhasil diganti");
      setCur(""); setNw(""); setNw2(""); onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ganti Password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input data-testid="cur-password" type="password" placeholder="Password lama" value={cur} onChange={(e) => setCur(e.target.value)} className="w-full h-11 rounded-xl border px-3" />
          <input data-testid="new-password" type="password" placeholder="Password baru (min. 6 karakter)" value={nw} onChange={(e) => setNw(e.target.value)} className="w-full h-11 rounded-xl border px-3" />
          <input data-testid="confirm-password" type="password" placeholder="Ulangi password baru" value={nw2} onChange={(e) => setNw2(e.target.value)} className="w-full h-11 rounded-xl border px-3" />
        </div>
        <DialogFooter>
          <button data-testid="save-password-btn" onClick={submit} disabled={saving} className="tap w-full h-12 rounded-xl bg-[#E63946] text-white font-bold disabled:opacity-50">
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/pos", label: "POS Kasir", icon: ShoppingCart, roles: ["admin", "kasir"] },
  { to: "/cash", label: "Kas", icon: Wallet, roles: ["admin", "kasir"] },
  { to: "/shift", label: "Shift", icon: Clock, roles: ["admin", "kasir"] },
  { to: "/catalog", label: "Produk & Stok", icon: Package, roles: ["admin", "input"] },
  { to: "/laporan", label: "Laporan", icon: BarChart3, roles: ["admin"] },
  { to: "/tanya-ai", label: "Tanya AI", icon: Bot, roles: ["admin"] },
  { to: "/asisten-ai", label: "Asisten AI", icon: Sparkles, roles: ["admin"] },
  { to: "/orders", label: "Transaksi", icon: FileSpreadsheet, roles: ["admin"] },
  { to: "/device", label: "Perangkat", icon: Printer, roles: ["kasir", "input"] },
  { to: "/settings", label: "Pengaturan", icon: Settings, roles: ["admin"] },
];

function OfflineStatus({ onOpenQueue }) {
  const { online, pendingCount, syncing, syncNow, syncLog } = useOffline();
  const cacheAt = localStorage.getItem("gak_pos_cache_at");
  return (
    <div data-testid="offline-status" className={`px-3 py-2.5 border-b border-white/10 ${online ? "" : "bg-[#EF4444]/20"}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        {online ? <Wifi size={16} className="text-[#22C55E]" /> : <WifiOff size={16} className="text-[#EF4444]" />}
        <span className={online ? "text-[#22C55E]" : "text-[#EF4444]"}>{online ? "Online" : "Offline"}</span>
      </div>
      {cacheAt && (
        <div className="mt-1 text-[10px] text-white/40 flex items-center gap-1" data-testid="cache-time">
          <Database size={10} /> Data ter-cache {new Date(cacheAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
      {pendingCount > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 bg-[#F59E0B]/20 rounded-lg px-2 py-1.5" data-testid="pending-sync">
          <button onClick={onOpenQueue} data-testid="open-queue-btn" className="text-[11px] font-bold text-[#FBBF24] flex items-center gap-1 hover:underline">
            <CloudOff size={13} /> {pendingCount} belum sinkron
          </button>
          {online && (
            <button data-testid="sync-now-btn" onClick={syncNow} disabled={syncing} className="tap text-[11px] font-bold bg-white/15 hover:bg-white/25 rounded px-2 py-1 flex items-center gap-1">
              <RefreshCw size={11} className={syncing ? "animate-spin" : ""} /> Sinkron
            </button>
          )}
        </div>
      )}
      {pendingCount === 0 && syncLog.length > 0 && (
        <button data-testid="open-history-btn" onClick={onOpenQueue} className="mt-2 text-[10px] font-bold text-white/45 hover:text-white/80 flex items-center gap-1">
          <RefreshCw size={10} /> Riwayat sinkron ({syncLog.length})
        </button>
      )}
    </div>
  );
}

function SyncQueueDialog({ open, onClose }) {
  const { pending, online, syncNow, retryOne, syncing, syncLog, clearSyncLog } = useOffline();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Antrean Sinkronisasi Offline</DialogTitle></DialogHeader>
        {pending.length === 0 ? (
          <p className="text-sm text-[#52525B] py-6 text-center">Tidak ada transaksi menunggu sinkron.</p>
        ) : (
          <>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {pending.map((p) => (
                <div key={p.temp_id} data-testid={`queue-item-${p.temp_id}`} className="rounded-xl border p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="overflow-hidden">
                      <div className="font-bold text-sm">{ORDER_TYPE_LABEL[p.meta?.order_type] || p.meta?.order_type} · {rupiah(p.meta?.total || 0)}</div>
                      <div className="text-xs text-[#52525B] truncate">{p.meta?.preview}</div>
                      <div className="text-[11px] text-[#a1a1aa] font-num">{new Date(p.created_at).toLocaleString("id-ID")}</div>
                      {p.error && <div className="text-[11px] text-[#EF4444] font-bold mt-1">Gagal: {p.error}</div>}
                    </div>
                    {online && (
                      <button data-testid={`retry-${p.temp_id}`} onClick={() => retryOne(p.temp_id)} disabled={syncing} className="tap shrink-0 text-xs font-bold bg-[#F4F5F7] rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                        <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Coba lagi
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {online ? (
              <button data-testid="sync-all-btn" onClick={syncNow} disabled={syncing} className="tap w-full h-11 rounded-xl bg-[#E63946] text-white font-bold mt-3">Sinkron Semua</button>
            ) : (
              <p className="text-xs text-[#B45309] font-bold text-center mt-3">Masih offline — otomatis sinkron saat online kembali.</p>
            )}
          </>
        )}
        <div className="mt-4 border-t pt-3" data-testid="sync-history">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-extrabold text-sm">Riwayat Sinkron</h4>
            {syncLog.length > 0 && (
              <button data-testid="clear-history-btn" onClick={clearSyncLog} className="text-[11px] font-bold text-[#EF4444] hover:underline">Bersihkan</button>
            )}
          </div>
          {syncLog.length === 0 ? (
            <p className="text-xs text-[#a1a1aa]">Belum ada riwayat sinkron.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-2">
              {syncLog.map((e) => (
                <div key={e.at} data-testid="history-item" className="rounded-lg bg-[#F4F5F7] p-2.5">
                  <div className="text-xs font-bold text-[#047857]">
                    {e.ok} transaksi disinkron <span className="text-[#52525B] font-normal font-num">· {new Date(e.at).toLocaleString("id-ID")}</span>
                  </div>
                  {e.items.map((it) => (
                    <div key={it.client_ref} className="text-[11px] text-[#52525B] font-num mt-0.5 truncate">
                      {it.client_ref} → <span className="font-bold text-[#0A0A0A]">{it.order_number || "-"}</span> · {rupiah(it.total || 0)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [queueOpen, setQueueOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <button data-testid="sidebar-toggle" onClick={() => setSidebarOpen(true)} className="lg:hidden fixed top-3 left-3 z-30 h-11 w-11 rounded-xl bg-[#0A0A0A] text-white grid place-items-center shadow-lg">
        <Menu size={20} />
      </button>
      {sidebarOpen && <div data-testid="sidebar-backdrop" onClick={() => setSidebarOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-40" />}
      <aside className={`fixed lg:static z-50 h-full w-[240px] shrink-0 bg-[#0A0A0A] text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E63946] grid place-items-center font-heading font-extrabold">G</div>
            <div className="leading-tight">
              <div className="font-heading font-extrabold text-[15px]">Grand Aceh</div>
              <div className="text-[11px] text-white/50 tracking-wide">KULINER POS</div>
            </div>
          </div>
          <button data-testid="sidebar-close" onClick={() => setSidebarOpen(false)} className="lg:hidden h-9 w-9 rounded-lg bg-white/10 grid place-items-center"><X size={18} /></button>
        </div>
        <OfflineStatus onOpenQueue={() => setQueueOpen(true)} />
        <nav className="flex-1 overflow-y-auto no-scrollbar py-3 px-3 space-y-1">
          {NAV.filter((n) => n.roles.includes(user?.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.to.slice(1)}`}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `tap flex items-center gap-3 px-3 h-12 rounded-lg font-medium text-sm ${
                  isActive ? "bg-[#E63946] text-white" : "text-white/70 hover:bg-white/10"
                }`
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="leading-tight overflow-hidden">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-[11px] text-white/50 flex items-center gap-1">
                {user?.role === "admin" && <ShieldCheck size={11} />}
                {user?.role}
              </div>
            </div>
          </div>
          <button
            data-testid="change-password-btn"
            onClick={() => setPwOpen(true)}
            className="tap w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold mb-2"
          >
            <KeyRound size={16} /> Ganti Password
          </button>
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="tap w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden pt-14 lg:pt-0">{children}</main>
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <SyncQueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
}
