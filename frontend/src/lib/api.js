import axios from "axios";

// Runtime-configurable backend root so the SAME web build / Android APK can point to
// ANY local server IP (LAN) without rebuilding.
// Priority: saved server URL (localStorage) > build-time env > relative "" (same-origin via nginx).
export function getServerUrl() {
  try {
    const s = localStorage.getItem("gak_server_url");
    if (s) return s.replace(/\/+$/, "");
  } catch (e) {}
  return (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
}

export function setServerUrl(url) {
  const clean = (url || "").trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem("gak_server_url", clean);
  else localStorage.removeItem("gak_server_url");
}

// Probe one base URL for the POS server health endpoint (short timeout).
async function probe(base, timeoutMs = 1500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const j = await res.json();
    return j && j.app === "gak-pos";
  } catch (e) {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// Auto-discover the POS server on the local network.
// Tries mDNS hostnames + common gateway IPs. Returns the base URL or null.
export async function discoverServer(onProgress) {
  const hosts = [
    "pos.local", "grandaceh.local", "raspberrypi.local",
  ];
  const subnets = ["192.168.1", "192.168.0", "192.168.100", "10.0.0"];
  const lastOctets = ["1", "2", "10", "11", "100", "200", "50"];
  const candidates = [];
  // current origin first (app served from server)
  if (typeof window !== "undefined" && window.location?.origin?.startsWith("http")) {
    candidates.push(window.location.origin);
  }
  hosts.forEach((h) => candidates.push(`http://${h}`));
  subnets.forEach((s) => lastOctets.forEach((o) => candidates.push(`http://${s}.${o}`)));

  let done = 0;
  const total = candidates.length;
  // Probe all candidates in parallel; first valid POS server wins (much faster than sequential).
  return await new Promise((resolve) => {
    let remaining = total;
    let settled = false;
    candidates.forEach((base) => {
      probe(base).then((ok) => {
        done += 1;
        if (onProgress) onProgress(done, total, base);
        if (ok && !settled) { settled = true; resolve(base); }
        remaining -= 1;
        if (remaining === 0 && !settled) resolve(null);
      });
    });
  });
}

const api = axios.create({
  baseURL: `${getServerUrl()}/api`,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("gak_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes("login")) {
      localStorage.removeItem("gak_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function apiError(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") {
    const s = detail.trim();
    // Ignore non-JSON gateway/HTML error pages (e.g. Cloudflare 5xx)
    if (/<\/?html|<!doctype|cloudflare|origin web server/i.test(s)) {
      return "Terjadi kesalahan pada server. Coba lagi.";
    }
    return s;
  }
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return detail?.msg || String(detail);
}

export default api;
