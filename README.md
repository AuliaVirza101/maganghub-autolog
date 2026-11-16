# MagangHub Auto-Log ⚡

Ekstensi Google Chrome (Manifest V3) bertenaga **Google Gemini AI** untuk menyusun dan mengisi otomatis jurnal logbook harian (Monev) **MagangHub Kemnaker**.

---

## ✨ Fitur Utama

- **🧠 Gemini AI Powered:** Ubah 1 kalimat ringkasan harian (misal: *"fixing bug query sql dan meeting sprint"*) menjadi 3 bagian laporan resmi MagangHub (Uraian Aktivitas, Pembelajaran, dan Kendala) yang terstruktur dan memenuhi batas minimal karakter (150-350 karakter).
- **🏷️ Preset Chips Praktis:** Tombol jalan pintas untuk kegiatan umum (Bug Fix, Fitur Baru, Integrasi API, Code Review, Daily Standup, Testing).
- **✏️ Live Editable Preview:** Hasil generate dari Gemini bisa ditinjau dan diedit langsung di popup sebelum disuntikkan ke halaman MagangHub.
- **🎯 Smart DOM Injection (React & Material-UI Support):**
  - Menggunakan native prototype descriptor setter agar state controlled component React di MagangHub mendeteksi perubahan nilai secara presisi.
  - Otomatis memilih status presensi **"Hadir"** pada komponen MUI Combobox/Select.
  - Otomatis mencentang checkbox keabsahan / integritas data.
  - Otomatis scroll ke tombol *Simpan* sehingga Anda tinggal me-review dan submit.
- **🔒 Privasi & Aman:** API Key disimpan secara lokal di `chrome.storage.local` pada browser Anda sendiri. Tidak ada data yang dikirim ke server pihak ketiga manapun selain langsung ke endpoint resmi Google Gemini API.

---

## 🚀 Cara Instalasi di Google Chrome

1. Buka browser Google Chrome, lalu kunjungi `chrome://extensions/` pada address bar.
2. Aktifkan toggle **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked** di pojok kiri atas.
4. Pilih folder repositori ini: `D:\maganghub-autolog`.
5. Ekstensi **MagangHub Auto-Log** sekarang sudah terpasang di Chrome Anda! (Disarankan untuk mem-pin ikon ekstensi di toolbar agar mudah diakses).

---

## ⚙️ Konfigurasi Awal

1. Buka [Google AI Studio](https://aistudio.google.com/) dan login dengan akun Google.
2. Klik menu **Get API key** lalu klik **Create API key** (100% Gratis / Free Tier).
3. Klik kanan ikon ekstensi di browser atau klik ikon roda gigi di dalam popup ekstensi untuk membuka halaman **Pengaturan**.
4. Tempelkan API Key Anda, isi konteks magang (misal: *Software Engineer Intern*), lalu klik tombol **Test Koneksi**.
5. Klik **Simpan Pengaturan**.

---

## 📖 Cara Pemakaian

1. Buka halaman logbook harian di **https://monev.maganghub.kemnaker.go.id/** dan buka modal **Tambah Laporan**.
2. Klik ikon ekstensi **MagangHub Auto-Log**.
3. Ketik poin kegiatan Anda atau klik salah satu preset chip.
4. Klik **Generate Jurnal dengan AI** (atau tekan `Ctrl + Enter`).
5. Periksa draft pada preview card (Anda dapat mengedit kalimatnya jika diperlukan).
6. Klik **Isi ke Form MagangHub**.
7. Form di halaman MagangHub akan otomatis terisi dan status kehadiran otomatis terpilih **Hadir**.
8. Cek sekilas di form MagangHub, lalu klik tombol **Simpan**.

---

## 🛠️ Tech Stack

- **Extension Framework:** Chrome Extension Manifest V3
- **Language:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **AI Model:** Google Gemini API (`gemini-1.5-flash` default, support `gemini-2.0-flash` dan `gemini-1.5-pro`)
- **Compatibility:** React 18 & Material-UI (MUI) Form Components
