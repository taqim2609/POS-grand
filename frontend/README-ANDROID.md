# Membuat APK Android (Capacitor) — Grand Aceh Kuliner POS

Proyek ini sudah disiapkan dengan **Capacitor 6** dan platform **Android** (folder `android/`).
Anda tinggal membuka & build di **Android Studio** di komputer Anda.

## Prasyarat (di komputer Anda, bukan di server ini)
- **Android Studio** (versi terbaru) + Android SDK (API 34).
- **JDK 17** (dibundel Android Studio).
- **Node.js 18/20** + **Yarn** (untuk membangun ulang aset web bila ada perubahan).

## Ringkasan konfigurasi
- App ID / package: `host.emergent.hybridposaceh`
- Nama app: **Grand Aceh Kuliner POS**
- Orientasi: **bebas** (landscape & portrait — mendukung tablet & HP)
- minSdk 22, target/compile SDK 34
- Aset web di-*bundle* dari folder `build/`.
- **Alamat server diatur SAAT PEMAKAIAN (runtime), bukan di-bake.** Setelah pasang APK, buka
  layar Login → **"Pengaturan Server (LAN)"** → isi `http://IP-komputer-server`. Jadi 1 APK bisa
  dipakai di banyak toko/IP tanpa build ulang. TIDAK ada koneksi ke Emergent.

## Langkah build APK
1. Salin/clone folder `frontend/` ini ke komputer Anda.
2. (Opsional, bila ada perubahan kode web) build ulang aset lalu sync:
   ```bash
   # dari folder frontend/  — alamat server dibiarkan kosong (diisi di aplikasi saat runtime)
   yarn build
   npx cap sync android
   ```
3. Buka proyek Android:
   ```bash
   npx cap open android
   ```
   (atau buka folder `frontend/android` langsung dari Android Studio)
4. Di Android Studio: tunggu Gradle sync selesai → menu **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
5. APK debug ada di: `android/app/build/outputs/apk/debug/app-debug.apk`.

### APK rilis ter-tanda-tangan (untuk distribusi)
- Menu **Build → Generate Signed Bundle / APK → APK**.
- Buat **keystore** baru (SIMPAN file + password — wajib untuk update ke depan).
- Pilih build variant **release** → hasil di `android/app/build/outputs/apk/release/`.

## Update versi
Ubah di `android/app/build.gradle`:
```
versionCode 2
versionName "1.1"
```

---

## 🖨️ Cetak thermal Sunmi (T2s) — native
WebView Capacitor **tidak** otomatis menyediakan bridge `window.SunmiInnerPrinter`.
Aplikasi saat ini akan memakai **fallback cetak (print dialog)** di dalam WebView.

Untuk auto-cut & laci kas Sunmi yang benar-benar native, tambahkan plugin printer Sunmi:
1. Cari plugin Capacitor Sunmi di npm (mis. paket komunitas `@kduma-autoid/capacitor-sunmi-printer` atau sejenis yang mendukung Capacitor 6).
2. Pasang & sync:
   ```bash
   yarn add <nama-plugin-sunmi>
   npx cap sync android
   ```
3. Hubungkan ke pencetakan di `src/lib/receipt.js`:
   - Impor API plugin, lalu pada fungsi cetak panggil perintah plugin (init printer → print text/QR → cut → open drawer).
   - Pertahankan fallback yang ada untuk perangkat non-Sunmi.
4. Beberapa perangkat Sunmi butuh izin/paket layanan printer (`woyou.aidlservice.jiuiv5`) — plugin biasanya menanganinya; jika tidak, tambahkan `<queries>`/permission sesuai dokumentasi plugin.

> Butuh bantuan menyambungkan plugin Sunmi ke `receipt.js`? Beri tahu paket plugin yang Anda pilih, saya bantu wiring-nya.
