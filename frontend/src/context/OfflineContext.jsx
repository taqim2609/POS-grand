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

  const addPending = useCallback((payload, meta = {}) => {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    const temp_id = `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    list.push({
      temp_id,
      payload: { ...payload, client_ref: temp_id },
      meta,
      created_at: new Date().toISOString(),
      error: null,
    });
    persist(list);
    return temp_id;
  }, []);

  const _syncItems = useCallback(async (items) => {
    const map = new Map(JSON.parse(localStorage.getItem(KEY) || "[]").map((i) => [i.temp_id, i]));
    let ok = 0;
    for (const item of items) {
      try {
        await api.post("/orders", item.payload); // idempotent via client_ref
        map.delete(item.temp_id);
        ok++;
      } catch (e) {
        const cur = map.get(item.temp_id);
        if (cur) {
          const d = e.response?.data?.detail;
          cur.error = e.response ? (typeof d === "string" ? d : "Ditolak server") : "Tidak ada koneksi";
        }
      }
    }
    persist(Array.from(map.values()));
    if (ok) window.dispatchEvent(new Event("gak-synced")); // trigger cache refresh after successful upload
    return ok;
  }, []);

  const syncNow = useCallback(async () => {
    if (!localStorage.getItem("gak_token") || !navigator.onLine) return;
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!list.length) return;
    setSyncing(true);
    const ok = await _syncItems(list);
    setSyncing(false);
    if (ok) toast.success(`${ok} transaksi offline berhasil disinkron ke server`);
  }, [_syncItems]);

  const retryOne = useCallback(async (temp_id) => {
    if (!navigator.onLine) return toast.error("Masih offline, tidak bisa sinkron");
    const item = JSON.parse(localStorage.getItem(KEY) || "[]").find((i) => i.temp_id === temp_id);
    if (!item) return;
    setSyncing(true);
    const ok = await _syncItems([item]);
    setSyncing(false);
    if (ok) toast.success("Transaksi disinkron");
    else toast.error("Masih gagal disinkron");
  }, [_syncItems]);

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
    <OfflineContext.Provider value={{ online, pending, pendingCount: pending.length, syncing, addPending, syncNow, retryOne }}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
