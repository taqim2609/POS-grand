export const rupiah = (n) =>
  "Rp" + Math.round(Number(n || 0)).toLocaleString("id-ID");

export const ORDER_TYPE_LABEL = {
  dine_in: "Dine-In",
  take_away: "Take Away",
  retail: "Retail",
};

export const TYPE_LABEL = {
  makanan: "Makanan",
  minuman: "Minuman",
  retail: "Retail",
  vendor: "Vendor",
};

export const wibToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
