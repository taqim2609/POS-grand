import { useState } from "react";
import UsersPage from "@/pages/Users";
import Tables from "@/pages/Tables";
import SettingsAI from "@/pages/SettingsAI";
import SettingsData from "@/pages/SettingsData";
import SettingsReport from "@/pages/SettingsReport";
import SettingsInstaller from "@/pages/SettingsInstaller";
import WhatsAppReport from "@/pages/WhatsAppReport";
import DeviceSettings from "@/pages/DeviceSettings";
import Diagnostik from "@/pages/Diagnostik";
import AppVersi from "@/pages/AppVersi";
import { Users, Armchair, Sparkles, Trash2, MessageCircle, Download, Printer, Bug, Box } from "lucide-react";

const TABS = [
  { key: "users", label: "Pengguna", icon: Users, comp: UsersPage },
  { key: "tables", label: "Meja", icon: Armchair, comp: Tables },
  { key: "device", label: "Perangkat", icon: Printer, comp: DeviceSettings },
  { key: "ai", label: "Pengaturan AI", icon: Sparkles, comp: SettingsAI },
  { key: "wa", label: "WhatsApp & Laporan", icon: MessageCircle, comp: WhatsAppReport },
  { key: "installer", label: "Installer", icon: Download, comp: SettingsInstaller },
  { key: "diagnostik", label: "Diagnostik", icon: Bug, comp: Diagnostik },
  { key: "versi", label: "Versi", icon: Box, comp: AppVersi },
  { key: "data", label: "Reset Data", icon: Trash2, comp: SettingsData },
];

export default function Settings() {
  const [tab, setTab] = useState("users");
  const Active = TABS.find((t) => t.key === tab).comp;
  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-6 bg-white border-b">
        <h1 className="text-3xl font-extrabold mb-4">Pengaturan</h1>
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`settings-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`tap px-4 h-11 rounded-t-lg font-bold text-sm flex items-center gap-2 border-b-2 -mb-px ${
                tab === t.key ? "border-[#E63946] text-[#E63946]" : "border-transparent text-[#52525B] hover:text-[#0A0A0A]"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Active />
      </div>
    </div>
  );
}
