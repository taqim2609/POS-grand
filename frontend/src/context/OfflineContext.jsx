import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

const KEY = "gak_pending_orders";
const LOG_KEY = "gak_sync_log";
const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(() => JSON.parse(localStorage.getItem(KEY) || "[]"));
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState(() => JSON.parse(localStorage.getItem(LOG_KEY) || "[]"));
  const inFlight = useRef(false);

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
    const done = [];
    for (const item of items) {
      try {
        const res = await api.post("/orders", item.payload); // idempotent via client_ref
        map.delete(item.temp_id);
        ok++;
        done.push({ client_ref: item.temp_id, order_number: res.data?.order_number, total: item.meta?.total || 0, status: "ok" });
      } catch (e) {
        const cur = map.get(item.temp_id);
        if (cur) {
          const d = e.response?.data?.detail;
          cur.error = e.response ? (typeof d === "string" ? d : "Ditolak server") : "Tidak ada koneksi";
        }
      }
    }
    persist(Array.from(map.values()));
    if (done.length) {
      // record sync history + reconcile offline receipt numbers; dedupe by client_ref
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      const seen = new Set(log.flatMap((e) => (e.items || []).map((i) => i.client_ref)));
      const fresh = done.filter((d) => !seen.has(d.client_ref));
      if (fresh.length) {
        log.unshift({ at: new Date().toISOString(), ok: fresh.length, items: fresh });
        const trimmed = log.slice(0, 50);
        localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
        setSyncLog(trimmed);
      }
      window.dispatchEvent(new Event("gak-synced")); // refresh cached master data after upload
    }
    return ok;
  }, []);

  const syncNow = useCallback(async () => {
    if (inFlight.current) return;
    if (!localStorage.getItem("gak_token") || !navigator.onLine) return;
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!list.length) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const ok = await _syncItems(list);
      if (ok) toast.success(`${ok} transaksi offline berhasil disinkron ke server`);
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [_syncItems]);

  const retryOne = useCallback(async (temp_id) => {
    if (inFlight.current) return;
    if (!navigator.onLine) return toast.error("Masih offline, tidak bisa sinkron");
    const item = JSON.parse(localStorage.getItem(KEY) || "[]").find((i) => i.temp_id === temp_id);
    if (!item) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const ok = await _syncItems([item]);
      if (ok) toast.success("Transaksi disinkron");
      else toast.error("Masih gagal disinkron");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [_syncItems]);

  const clearSyncLog = useCallback(() => {
    localStorage.removeItem(LOG_KEY);
    setSyncLog([]);
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

  const value = useMemo(
    () => ({ online, pending, pendingCount: pending.length, syncing, addPending, syncNow, retryOne, syncLog, clearSyncLog }),
    [online, pending, syncing, addPending, syncNow, retryOne, syncLog, clearSyncLog]
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
