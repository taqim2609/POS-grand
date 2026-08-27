/* Membuat paket OTA (bundle.zip + version.json) di build/ota/
   Dijalankan otomatis sebagai "postbuild". Pi (nginx) menyajikan folder ini
   di /ota/, dan APK (Capgo) mengunduh update dari sana lewat LAN. */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const buildDir = path.join(__dirname, "..", "build");
const otaDir = path.join(buildDir, "ota");

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  if (!fs.existsSync(buildDir)) {
    console.error("[make-ota] folder build/ tidak ditemukan");
    process.exit(1);
  }
  fs.mkdirSync(otaDir, { recursive: true });
  const version = process.env.OTA_VERSION || stamp();
  const zipPath = path.join(otaDir, "bundle.zip");

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    // zip seluruh isi build/ KECUALI folder ota/ (hindari rekursi)
    archive.glob("**/*", { cwd: buildDir, ignore: ["ota/**"], dot: true });
    archive.finalize();
  });

  // === Sanitasi kompatibilitas WebView lama (Android 7 / Chrome <63) ===
  // Webpack menyisipkan `import(t.module)` (dynamic import native) untuk modul ESM
  // tertentu (mis. react-router 7). Chrome <63 gagal PARSE `import(` di mana pun
  // -> "Unexpected token import" -> app blank. Karena tidak ada chunk async
  // (splitChunks nonaktif), jalur ini tidak pernah dieksekusi — aman diganti
  // dengan Promise.resolve agar sintaks lolos di WebView lama.
  // DILAKUKAN SEBELUM ZIP dibuat? Tidak — zip dibuat dulu di atas; patch file build
  // lalu REZIP supaya bundle.zip ikut versi tersanitasi.
  const jsDir = path.join(buildDir, "static", "js");
  const RE_IMPORT = /import\(([a-zA-Z_$][\w$]*\.module)\)/g;
  let patched = 0;
  for (const f of fs.readdirSync(jsDir)) {
    if (!f.endsWith(".js") || f.endsWith(".LICENSE.txt")) continue;
    const p = path.join(jsDir, f);
    let src = fs.readFileSync(p, "utf8");
    if (RE_IMPORT.test(src)) {
      src = src.replace(RE_IMPORT, "Promise.resolve($1)");
      fs.writeFileSync(p, src);
      patched += 1;
    }
  }
  console.log(`[make-ota] sanitasi import() WebView lama: ${patched} file dipatch`);

  // Rezip build/ (sudah tersanitasi) ke bundle.zip
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", { cwd: buildDir, ignore: ["ota/**"], dot: true });
    archive.finalize();
  });

  fs.writeFileSync(
    path.join(otaDir, "version.json"),
    JSON.stringify({ version, url: "/ota/bundle.zip" }, null, 2)
  );

  console.log(`[make-ota] OTA siap — versi ${version}`);
}
main();
