import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
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

const wrap = (el, adminOnly = false) => (
  <ProtectedRoute adminOnly={adminOnly}>
    <Layout>{el}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <OfflineProvider>
          <Toaster position="top-center" richColors />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/pos" element={wrap(<POS />)} />
              <Route path="/shift" element={wrap(<Shift />)} />
              <Route path="/cash" element={wrap(<Cash />)} />
              <Route path="/dashboard" element={wrap(<Dashboard />, true)} />
              <Route path="/products" element={wrap(<Products />, true)} />
              <Route path="/inventory" element={wrap(<Inventory />, true)} />
              <Route path="/categories" element={wrap(<Categories />, true)} />
              <Route path="/tables" element={wrap(<Tables />, true)} />
              <Route path="/orders" element={wrap(<Orders />, true)} />
              <Route path="/users" element={wrap(<UsersPage />, true)} />
              <Route path="/settings-ai" element={wrap(<SettingsAI />, true)} />
              <Route path="/settings-data" element={wrap(<SettingsData />, true)} />
              <Route path="/settings" element={wrap(<Settings />, true)} />
              <Route path="/whatsapp" element={wrap(<WhatsApp />, true)} />
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
