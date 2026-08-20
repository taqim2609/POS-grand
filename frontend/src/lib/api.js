import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
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
