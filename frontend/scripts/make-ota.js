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

  fs.writeFileSync(
    path.join(otaDir, "version.json"),
    JSON.stringify({ version, url: "/ota/bundle.zip" }, null, 2)
  );
  console.log(`[make-ota] OTA siap — versi ${version}`);
}
main();
