import { rupiah, ORDER_TYPE_LABEL } from "@/lib/format";

export function printReceipt(order) {
  const dt = new Date(order.paid_at || order.created_at).toLocaleString("id-ID");
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.name}<br><span class="s">${i.qty} x ${rupiah(i.price)}</span></td>
         <td class="r">${rupiah(i.price * i.qty)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${order.order_number}</title>
  <style>
    body{font-family:'JetBrains Mono',monospace;width:78mm;margin:0 auto;padding:8px;color:#000;font-size:12px}
    h1{font-size:16px;text-align:center;margin:0}
    .c{text-align:center}.r{text-align:right}.s{color:#555;font-size:10px}
    table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
    .hr{border-top:1px dashed #000;margin:6px 0}
    .tot{font-weight:700;font-size:14px}
    .badge{display:inline-block;border:1px solid #000;border-radius:4px;padding:1px 6px;font-size:10px}
  </style></head><body>
    <h1>GRAND ACEH KULINER</h1>
    <div class="c s">Jl. Contoh No. 1, Banda Aceh</div>
    <div class="hr"></div>
    <div>No: ${order.order_number}</div>
    <div>${dt}</div>
    <div>Kasir: ${order.cashier_name || "-"}</div>
    <div class="c" style="margin:4px 0"><span class="badge">${ORDER_TYPE_LABEL[order.order_type]}</span></div>
    <div class="hr"></div>
    <table>${rows}</table>
    <div class="hr"></div>
    <table>
      <tr><td>Subtotal</td><td class="r">${rupiah(order.subtotal)}</td></tr>
      ${order.discount ? `<tr><td>Diskon</td><td class="r">-${rupiah(order.discount)}</td></tr>` : ""}
      <tr class="tot"><td>TOTAL</td><td class="r">${rupiah(order.total)}</td></tr>
      ${order.payment_method_name ? `<tr><td>${order.payment_method_name}</td><td class="r">${rupiah(order.amount_paid || order.total)}</td></tr>` : ""}
      ${order.change ? `<tr><td>Kembali</td><td class="r">${rupiah(order.change)}</td></tr>` : ""}
    </table>
    <div class="hr"></div>
    <div class="c s">Terima kasih & selamat menikmati</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},400)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=380,height=640");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
