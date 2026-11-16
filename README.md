# MagangHub Auto-Log ⚡

Ekstensi Google Chrome untuk menyusun dan **otomatis langsung mengisi** jurnal logbook harian (Monev) **MagangHub Kemnaker** menggunakan AI dalam **1 Kali Klik**.

Ekstensi ini otomatis mengisi:
- Kolom **Uraian Aktivitas** (sesuai standar minimal karakter)
- Kolom **Pembelajaran**
- Kolom **Kendala & Solusi**
- Status Kehadiran otomatis terpilih **"Hadir"**
- Checkbox pernyataan integritas otomatis **tercentang**

---

## 📖 Panduan Lengkap Cara Pasang (Langkah Demi Langkah)

Bagi yang belum pernah menggunakan GitHub, ikuti urutan langkah di bawah ini:

---

### Langkah 1: Cara Download File dari Halaman Ini

1. Lihat ke bagian kanan atas dari tabel daftar file di halaman ini.
2. Temukan tombol berwarna hijau yang ada tulisan **`<> Code`**. Klik tombol hijau tersebut.
3. Pada kotak menu yang muncul ke bawah, klik pilihan paling bawah: **Download ZIP**.
4. Laptop kamu akan men-download file bernama `maganghub-autolog-main.zip`.
5. Buka folder **Downloads** di laptopmu:
   - Klik kanan file `maganghub-autolog-main.zip`
   - Pilih **Extract All...** (Ekstrak Semua)
   - Klik tombol **Extract**.
   - *Sekarang kamu sudah memiliki folder biasa bernama `maganghub-autolog-main`.*

---

### Langkah 2: Cara Pasang ke Google Chrome

1. Buka aplikasi **Google Chrome** di laptopmu.
2. Di baris alamat website paling atas (address bar), ketik:
   ```text
   chrome://extensions
   ```
   lalu tekan **Enter**.
3. Perhatikan **pojok kanan atas layar**: aktifkan tombol toggle **Developer mode** (Mode pengembang) sampai menyala (warna biru).
4. Setelah Developer mode aktif, lihat ke **pojok kiri atas layar**: klik tombol **Load unpacked** (Muat yang belum dibongkar).
5. Jendela file laptopmu akan terbuka:
   - Cari dan buka folder `maganghub-autolog-main` yang sudah kamu ekstrak tadi.
   - Klik folder tersebut, lalu klik tombol **Select Folder** (Pilih Folder).
6. Ekstensi **MagangHub Auto-Log** sekarang sudah terpasang di Chrome kamu!
7. **Biar mudah dibuka:** Klik ikon puzzle (logo ekstensi) di pojok kanan atas Chrome, lalu klik ikon **Pin (📌)** di samping *Auto-Log MagangHub* agar logonya selalu terlihat di sebelah address bar.

---

### Langkah 3: Ambil API Key AI Gratis (Hanya Sekali di Awal, 100% Gratis)

Agar AI bisa bekerja menulis jurnal untukmu, kamu butuh kunci izin gratis dari Google:

1. Buka website: [https://aistudio.google.com/](https://aistudio.google.com/)
2. Login menggunakan akun Google / Gmail biasamu.
3. Di panel menu sebelah kiri, klik menu **Get API key**.
4. Klik tombol biru **Create API key**.
5. Pilih opsi project yang muncul, lalu klik **Create API key in existing project** (atau buat project baru jika diminta).
6. Klik tombol **Copy** pada kode kunci yang muncul (kodenya diawali tulisan `AIzaSy...`).
7. Buka ekstensi di Chrome:
   - Klik ikon ekstensi **MagangHub Auto-Log** di pojok kanan atas browsermu.
   - Klik tombol roda gigi / pengaturan (di pojok kanan atas jendela popup ekstensi).
   - Di kolom **API Key Gemini**, paste kode kunci yang tadi kamu copy.
   - Di kolom **Posisi / Role Magang**, tulis posisi kamu (contoh: *Staf Administrasi*, *Marketing*, *UI/UX Designer*, *Software Engineer*, dll).
   - Klik tombol **Simpan Pengaturan**.

*(Catatan: Jika memiliki langganan AI lain seperti OpenAI, Groq, DeepSeek, atau server lokal Ollama, Anda juga dapat mengaturnya di menu Pengaturan).*

---

### Langkah 4: Cara Pakai Sehari-hari (1-Click Workflow)

1. Buka website Monev MagangHub: [https://monev.maganghub.kemnaker.go.id/](https://monev.maganghub.kemnaker.go.id/)
2. Buka menu logbook dan klik tombol **Tambah Laporan** sampai formulir isian (pop-up modal) terbuka di layar.
3. Klik ikon ekstensi **MagangHub Auto-Log** di pojok kanan atas Chrome.
4. Di kotak input, ketik 1 kalimat singkat kegiatanmu hari ini (atau klik preset tombol cepat yang tersedia).
5. Klik tombol **⚡ Generate & Langsung Isi Form** (atau tekan `Ctrl + Enter`).
6. Tunggu 1–2 detik:
   - AI langsung menyusun laporan formal dan **langsung mengisikannya ke formulir web MagangHub**.
   - Status presensi otomatis terpilih **"Hadir"** dan checkbox persetujuan otomatis **tercentang**.
7. **Ingin mengedit?** Kamu bisa langsung mengedit teksnya secara leluasa di formulir halaman MagangHub.
8. **Ingin generate ulang?** Cukup klik lagi tombol **🔄 Generate Ulang & Timpa Form** di ekstensi.
9. Jika sudah pas, klik tombol **Simpan** di web MagangHub. Selesai!

---

## ❓ FAQ

**Q: Apakah data akun atau password MagangHub saya diambil?**  
A: Tidak sama sekali. Ekstensi ini tidak pernah meminta username atau password akun MagangHub kamu.

**Q: Apakah API Key Google Gemini ini bayar?**  
A: Tidak. Google AI Studio memberikan kuota gratis yang sangat besar untuk penggunaan pribadi. Tidak perlu memasukkan kartu kredit.

**Q: Bisakah dipakai di Microsoft Edge atau Brave?**  
A: Bisa. Caranya sama: buka `edge://extensions` atau `brave://extensions`, nyalakan Developer Mode, lalu klik *Load unpacked*.
