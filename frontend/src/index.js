import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Service worker HANYA untuk versi web (PWA). Di APK Android (Capacitor) service worker
// BERKONFLIK dengan update OTA (Capgo): SW menyajikan index/JS lama dari cache setelah
// bundle diganti -> layar putih. Di APK, ketahanan offline sudah ditangani localStorage,
// jadi SW dimatikan & cache lama dibersihkan agar OTA berjalan mulus.
const IS_NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());

if (IS_NATIVE) {
  // Bersihkan sisa service worker / cache dari instalasi lama (pemulihan dari blank).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
} else if ("serviceWorker" in navigator) {
  // Web / PWA: tetap pakai service worker untuk ketahanan offline app-shell.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
