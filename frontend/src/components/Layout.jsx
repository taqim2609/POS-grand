import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Grid3x3, Package, Tags,
  Armchair, Clock, FileSpreadsheet, Users, LogOut, ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/pos", label: "POS Kasir", icon: ShoppingCart, roles: ["admin", "kasir"] },
  { to: "/shift", label: "Shift", icon: Clock, roles: ["admin", "kasir"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/products", label: "Produk", icon: Package, roles: ["admin"] },
  { to: "/categories", label: "Kategori", icon: Tags, roles: ["admin"] },
  { to: "/tables", label: "Meja", icon: Armchair, roles: ["admin"] },
  { to: "/orders", label: "Transaksi", icon: FileSpreadsheet, roles: ["admin"] },
  { to: "/users", label: "Pengguna", icon: Users, roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <aside className="w-[240px] shrink-0 bg-[#0A0A0A] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E63946] grid place-items-center font-heading font-extrabold">G</div>
            <div className="leading-tight">
              <div className="font-heading font-extrabold text-[15px]">Grand Aceh</div>
              <div className="text-[11px] text-white/50 tracking-wide">KULINER POS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar py-3 px-3 space-y-1">
          {NAV.filter((n) => n.roles.includes(user?.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.to.slice(1)}`}
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
            data-testid="logout-btn"
            onClick={logout}
            className="tap w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
