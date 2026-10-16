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
# isi GEMINI_API_KEY di .env
npm start
```

Buka `http://localhost:3000`.

API key hanya dibaca server dari `.env`; jangan commit file `.env`. Untuk deployment Railway, masukkan `GEMINI_API_KEY` dan `GEMINI_MODEL` di Variables.

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
5. Jangan menaruh API key di file frontend atau GitHub.

File `render.yaml` sudah disertakan agar Render dapat membaca konfigurasi dasar secara otomatis.
