# VideoTeks

MVP aplikasi untuk membuat subtitle dari suara asli video, menerjemahkannya, memilih gaya/warna, lalu mengekspor video dengan suara asli tetap dipertahankan.

## Fitur

- Upload video dan ekstraksi audio dengan FFmpeg.
- Transkripsi audio bertimestamp memakai Gemini Files API + generateContent.
- Terjemahan subtitle memakai Gemini.
- Editor segmen subtitle dan preview.
- Ekspor MP4 dengan subtitle tertanam dan audio asli tetap ada.
- Template warna subtitle: merah, jingga, kuning, hijau, biru, ungu, pink, hitam, putih, gradient.

## Menjalankan

Prasyarat: Node.js 18+, FFmpeg, dan Gemini API key.

```bash
npm install
cp .env.example .env
# isi GEMINI_API_KEY di .env untuk Subtitle Video
# isi GEMINI_TTS_API_KEY di .env untuk halaman Suara AI (opsional)
npm start
```

Buka `http://localhost:3000`.

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
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `GEMINI_TTS_API_KEY`: API key Gemini khusus halaman Suara AI
   - `GEMINI_TTS_MODEL`: `gemini-3.8-flash-tts`
5. Jangan menaruh API key di file frontend atau GitHub.

File `render.yaml` sudah disertakan agar Render dapat membaca konfigurasi dasar secara otomatis.
