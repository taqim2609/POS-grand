import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { checkOtaUpdate } from "@/lib/ota";
import { installDiag } from "@/lib/diag";
import { AuthProvider } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import OtaIndicator from "@/components/OtaIndicator";
import Login from "@/pages/Login";
import POS from "@/pages/POS";
import Shift from "@/pages/Shift";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Tables from "@/pages/Tables";
import Orders from "@/pages/Orders";
import UsersPage from "@/pages/Users";
import Inventory from "@/pages/Inventory";
import Cash from "@/pages/Cash";
import SettingsAI from "@/pages/SettingsAI";
import SettingsData from "@/pages/SettingsData";
import Settings from "@/pages/Settings";
import WhatsApp from "@/pages/WhatsApp";
import DeviceSettings from "@/pages/DeviceSettings";
import Catalog from "@/pages/Catalog";
import AssistantAI from "@/pages/AssistantAI";
import Reports from "@/pages/Reports";
import Members from "@/pages/Members";
import Promos from "@/pages/Promos";

const wrap = (el, roles) => (
  <ProtectedRoute roles={roles}>
    <Layout>{el}</Layout>
  </ProtectedRoute>
);

function App() {
  useEffect(() => {
    checkOtaUpdate();
    installDiag();
    // Cek ulang OTA setiap kali app kembali aktif (Android: kembali dari background),
    // supaya update terpasang tanpa perlu restart penuh.
    const onVis = () => { if (document.visibilityState === "visible") checkOtaUpdate(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return (
    <div className="App">
      <AuthProvider>
        <OfflineProvider>
          <Toaster position="top-center" richColors />
          <OtaIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/pos" element={wrap(<POS />, ["admin", "kasir"])} />
              <Route path="/shift" element={wrap(<Shift />, ["admin", "kasir"])} />
              <Route path="/cash" element={wrap(<Cash />, ["admin", "kasir"])} />
              <Route path="/dashboard" element={wrap(<Dashboard />, ["admin"])} />
              <Route path="/products" element={wrap(<Products />, ["admin", "input"])} />
              <Route path="/inventory" element={wrap(<Inventory />, ["admin", "input"])} />
              <Route path="/categories" element={wrap(<Categories />, ["admin", "input"])} />
              <Route path="/catalog" element={wrap(<Catalog />, ["admin", "input"])} />
              <Route path="/laporan" element={wrap(<Reports />, ["admin", "kasir"])} />
              <Route path="/members" element={wrap(<Members />, ["admin"])} />
              <Route path="/promos" element={wrap(<Promos />, ["admin"])} />
              <Route path="/tanya-ai" element={<Navigate to="/asisten-ai" replace />} />
              <Route path="/asisten-ai" element={wrap(<AssistantAI />, ["admin", "kasir"])} />
              <Route path="/tables" element={wrap(<Tables />, ["admin"])} />
              <Route path="/orders" element={wrap(<Orders />, ["admin"])} />
              <Route path="/users" element={wrap(<UsersPage />, ["admin"])} />
              <Route path="/settings-ai" element={wrap(<SettingsAI />, ["admin"])} />
              <Route path="/settings-data" element={wrap(<SettingsData />, ["admin"])} />
              <Route path="/settings" element={wrap(<Settings />, ["admin"])} />
              <Route path="/whatsapp" element={wrap(<WhatsApp />, ["admin"])} />
              <Route path="/device" element={wrap(<DeviceSettings />)} />
              <Route path="/" element={<Navigate to="/pos" replace />} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </BrowserRouter>
        </OfflineProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
