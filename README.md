# VideoTeks

MVP aplikasi untuk membuat subtitle dari suara asli video, menerjemahkannya, memilih gaya/warna, lalu mengekspor video dengan suara asli tetap dipertahankan.

## Fitur

- Upload video dan ekstraksi audio dengan FFmpeg.
- Transkripsi audio bertimestamp memakai Gemini Files API + generateContent.
- Terjemahan subtitle memakai Gemini.
- Editor segmen subtitle dan preview.
- Ekspor MP4 dengan subtitle tertanam dan audio asli tetap ada.
- Template warna subtitle: merah, jingga, kuning, hijau, biru, ungu, pink, hitam, putih, gradient.
- Google Sign-In sebelum membuka fitur, serta riwayat transkripsi per akun yang dapat dihapus.

## Menjalankan

Prasyarat: Node.js 18+, FFmpeg, Gemini API key, serta Firebase project dengan Google Authentication dan Firestore.

```bash
npm install
cp .env.example .env
# isi GEMINI_API_KEY di .env untuk Subtitle Video
# isi GEMINI_TTS_API_KEY di .env untuk halaman Suara AI (opsional)
# isi FIREBASE_SERVICE_ACCOUNT_JSON menggunakan kredensial server Firebase (wajib untuk login/riwayat)
npm start
```

Buka `http://localhost:3000`. Firebase Web app di frontend menggunakan project ID `videoteks-a82c1`; tambahkan domain yang dipakai (misalnya `localhost` dan domain Render) pada **Authentication → Settings → Authorized domains**, lalu aktifkan **Authentication → Sign-in method → Google**.

Untuk riwayat, buat Firestore Database. Backend menyimpan dokumen di `users/{uid}/history/{historyId}` sehingga endpoint menggunakan UID sesi yang tokennya diverifikasi server. Di Render, buat service account Firebase dengan akses Firestore yang diperlukan dan isi environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` dengan **seluruh JSON service-account**. Jangan commit service-account atau memasukkan private key ke frontend/chat. Jangan membuat Firestore rules `allow read, write: if true`; akses aplikasi dilakukan melalui server Admin SDK dan tiap operasi membatasi koleksi ke UID token yang diverifikasi. File video tidak disimpan; hanya teks, segmen subtitle, dan pengaturan.

API key hanya dibaca server dari `.env`; jangan commit file `.env`. Untuk halaman Suara AI, gunakan nama terpisah `GEMINI_TTS_API_KEY` agar tidak bentrok dengan `GEMINI_API_KEY`. Model default-nya adalah Gemini 3 TTS `gemini-3.8-flash-tts`; model dapat diganti dengan `GEMINI_TTS_MODEL`.

## Deploy ke Render

1. Upload ZIP ini ke GitHub atau gunakan repository `nana99-alt/videoteks`.
2. Di Render pilih **New > Web Service** lalu hubungkan repository.
3. Gunakan pengaturan berikut:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Tambahkan environment variable di Render:
   - `GEMINI_API_KEY`: API key Gemini akun/project pertama
   - `GEMINI_API_KEY_2`: API key Gemini akun/project kedua
   - `GEMINI_API_KEY_3`: API key Gemini akun/project ketiga, ikut rotasi otomatis
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `GEMINI_TTS_API_KEY`: API key Gemini khusus halaman Suara AI
   - `GEMINI_TTS_MODEL`: `gemini-3.8-flash-tts`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: seluruh JSON service-account Firebase sebagai nilai environment (jangan commit file/key tersebut)
5. Di Firebase Authentication, aktifkan Google Sign-In dan tambahkan domain Render pada Authorized domains. Buat Firestore Database.
6. Jangan menaruh API key Gemini atau service-account private key di file frontend atau GitHub. Tanpa `FIREBASE_SERVICE_ACCOUNT_JSON`, endpoint aplikasi mengembalikan status konfigurasi belum siap.

File `render.yaml` sudah disertakan agar Render dapat membaca konfigurasi dasar secara otomatis.
