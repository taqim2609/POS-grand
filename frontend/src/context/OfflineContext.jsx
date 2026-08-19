import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

const KEY = "gak_pending_orders";
const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(() => JSON.parse(localStorage.getItem(KEY) || "[]"));
  const [syncing, setSyncing] = useState(false);

  const persist = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list));
    setPending(list);
  };

  const addPending = useCallback((payload) => {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    list.push({ temp_id: `OFF-${Date.now()}`, payload, created_at: new Date().toISOString() });
    persist(list);
  }, []);

  const syncNow = useCallback(async () => {
    if (!localStorage.getItem("gak_token")) return;
    let list = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!list.length || !navigator.onLine) return;
    setSyncing(true);
    const remain = [];
    let ok = 0;
    for (const item of list) {
      try {
        await api.post("/orders", item.payload);
        ok++;
      } catch (e) {
        remain.push(item);
      }
    }
    persist(remain);
    setSyncing(false);
    if (ok) toast.success(`${ok} transaksi offline berhasil disinkron ke server`);
  }, []);

  useEffect(() => {
    const goOnline = () => { setOnline(true); syncNow(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) syncNow();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  return (
    <OfflineContext.Provider value={{ online, pending, pendingCount: pending.length, syncing, addPending, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
