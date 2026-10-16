import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_KEY_COOLDOWN_MS = 5 * 60 * 1000;
let nextGeminiKeyIndex = 0;
const geminiKeyCooldowns = new Map();
const upload = multer({ dest: path.join(os.tmpdir(), 'videoteks-uploads'), limits: { fileSize: 500 * 1024 * 1024 } });
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

function requireKey(res) {
  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY_2) {
    res.status(503).json({ error: 'GEMINI_API_KEY belum diatur di environment variable server.' });
    return false;
  }
  return true;
}
function configuredGeminiKeys() {
  return [...new Set([process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean))];
}
function geminiKeysInRotation() {
  const keys = configuredGeminiKeys();
  if (!keys.length) return [];
  const start = nextGeminiKeyIndex % keys.length;
  const rotated = [...keys.slice(start), ...keys.slice(0, start)];
  const now = Date.now();
  return rotated.filter(key => (geminiKeyCooldowns.get(key) || 0) <= now);
}
function rotateGeminiKeyAfter(apiKey) {
  const keys = configuredGeminiKeys();
  const index = keys.indexOf(apiKey);
  if (index >= 0) nextGeminiKeyIndex = (index + 1) % keys.length;
}
function geminiKeyWaitMessage() {
  const keys = configuredGeminiKeys();
  const earliest = Math.min(...keys.map(key => geminiKeyCooldowns.get(key) || Date.now()));
  const seconds = Math.max(1, Math.ceil((earliest - Date.now()) / 1000));
  return `Semua Gemini API key sedang dibatasi kuota. Coba lagi sekitar ${seconds} detik.`;
}
function isGeminiQuotaError(status, message) {
  return status === 429 || /\b429\b|quota|resource exhausted|rate.?limit|too many requests/i.test(message || '');
}
function geminiQuotaCooldownMs(data, message) {
  const retryDelay = data?.error?.details?.find(detail => String(detail['@type'] || '').includes('RetryInfo'))?.retryDelay;
  const seconds = String(retryDelay || message || '').match(/(\d+(?:\.\d+)?)s\b/i)?.[1];
  if (seconds) return Math.max(1000, Math.ceil(Number(seconds) * 1000));
  if (/per[ _-]?day|daily/i.test(message || '')) return 24 * 60 * 60 * 1000;
  return GEMINI_KEY_COOLDOWN_MS;
}
function coolDownGeminiKey(apiKey, data, message) {
  geminiKeyCooldowns.set(apiKey, Date.now() + geminiQuotaCooldownMs(data, message));
  rotateGeminiKeyAfter(apiKey);
}
async function geminiRequest(model, body, fixedKey = null) {
  const models = [model || 'gemini-3.8-flash'];
  const keys = fixedKey ? [fixedKey] : geminiKeysInRotation();
  if (!keys.length) throw new Error(geminiKeyWaitMessage());
  let lastError;
  for (const apiKey of keys) {
    let keyQuotaExhausted = false;
    for (const activeModel of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          if (!fixedKey) rotateGeminiKeyAfter(apiKey);
          return data;
        }
        lastError = new Error(data?.error?.message || `Gemini API error ${r.status}`);
        lastError.status = r.status;
        lastError.responseData = data;
        if (isGeminiQuotaError(r.status, lastError.message)) {
          if (!fixedKey) coolDownGeminiKey(apiKey, data, lastError.message);
          keyQuotaExhausted = true;
          break;
        }
        const retryable = /high demand|overloaded|temporarily unavailable|unavailable/i.test(lastError.message) || [500, 502, 503, 504].includes(r.status);
        if (!retryable) break;
        await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
      }
      if (keyQuotaExhausted) break;
    }
    if (!fixedKey && !keyQuotaExhausted) rotateGeminiKeyAfter(apiKey);
  }
  throw lastError || new Error('Gemini API tidak merespons.');
}
async function uploadToGemini(filePath, mimeType, apiKey) {
  const stat = await fs.stat(filePath);
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(stat.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file: { display_name: path.basename(filePath) } })
  });
  if (!start.ok) throw new Error(`Gemini upload start failed: ${start.status} ${await start.text()}`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini tidak mengembalikan upload URL.');
  const bytes = await fs.readFile(filePath);
  const finish = await fetch(uploadUrl, {
    method: 'POST', headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes
  });
  const fileInfo = await finish.json().catch(() => ({}));
  if (!finish.ok) throw new Error(fileInfo?.error?.message || `Gemini upload failed: ${finish.status}`);
  return fileInfo.file;
}
function jsonPart(text) {
  const raw = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
}
function srtTime(seconds) { const ms = Math.max(0, Math.round(Number(seconds) * 1000)); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); const x = ms % 1000; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`; }
function toSrt(segments) { return segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${String(s.text || '').trim()}\n`).join('\n'); }
function assColor(value) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || '') ? value.slice(1) : 'FFFFFF';
  const r = hex.slice(0, 2), g = hex.slice(2, 4), b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`;
}
function subtitleStyle(settings) {
  const allowedFonts = new Set(['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans']);
  const font = allowedFonts.has(settings.fontFamily) ? settings.fontFamily : 'DejaVu Sans';
  const color = assColor(settings.color === 'gradient' ? '#8b5cf6' : settings.color);
  const size = Math.min(56, Math.max(14, Number(settings.fontSize) || 28));
  const align = settings.position === 'top' ? 6 : settings.position === 'middle' ? 10 : 2;
  const margin = settings.position === 'top' ? 36 : settings.position === 'middle' ? 20 : 42;
  const templates = {
    pill: `BorderStyle=4,Outline=0,Shadow=0,BackColour=&H99000000`,
    neon: `BorderStyle=1,Outline=2,Shadow=0,BackColour=&H66000000`,
    minimal: `BorderStyle=1,Outline=0,Shadow=0,BackColour=&H00000000`,
    outline: `BorderStyle=1,Outline=2,Shadow=0,BackColour=&H00000000`,
    karaoke: `BorderStyle=4,Outline=1,Shadow=0,BackColour=&H88000000`,
    bubble: `BorderStyle=3,Outline=0,Shadow=0,BackColour=&H00FFFFFF`,
    shadow: `BorderStyle=1,Outline=0,Shadow=3,BackColour=&H00000000`,
    gradient: `BorderStyle=4,Outline=1,Shadow=0,BackColour=&H66000000`
  };
  const outlineColor = settings.template === 'neon' ? assColor('#38e8ff') : '&H00000000';
  return `FontName=${font},FontSize=${size},PrimaryColour=${color},OutlineColour=${outlineColor},${templates[settings.template] || templates.pill},Alignment=${align},MarginV=${margin}`;
}
async function cleanup(...files) { await Promise.all(files.filter(Boolean).map(f => fs.rm(f, { force: true }).catch(() => {}))); }
function responseText(data) { return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''; }

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'videoteks', provider: 'gemini' }));

app.post('/api/transcribe', upload.single('video'), async (req, res) => {
  if (!requireKey(res)) return;
  if (!req.file) return res.status(400).json({ error: 'File video wajib dipilih.' });
  const audio = `${req.file.path}.mp3`;
  try {
    await exec('ffmpeg', ['-y', '-i', req.file.path, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio]);
    const prompt = `Transkripsikan audio ini menjadi subtitle. Kembalikan JSON valid saja dengan bentuk {"segments":[{"start":0.0,"end":2.5,"text":"..."}]}. Gunakan waktu dalam detik, urutkan dari awal sampai akhir, pecah kalimat menjadi segmen pendek yang nyaman dibaca, dan tulis teks persis sesuai ucapan dalam bahasa aslinya. Jangan tambahkan markdown atau komentar.`;
    const keys = geminiKeysInRotation();
    if (!keys.length) throw new Error(geminiKeyWaitMessage());
    let lastError;
    for (const apiKey of keys) {
      try {
        const file = await uploadToGemini(audio, 'audio/mpeg', apiKey);
        const data = await geminiRequest(MODEL, { contents: [{ parts: [{ text: prompt }, { fileData: { fileUri: file.uri, mimeType: file.mimeType || 'audio/mpeg' } }] }], generationConfig: { responseMimeType: 'application/json' } }, apiKey);
        const parsed = jsonPart(responseText(data));
        const segments = (parsed?.segments || []).map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || (Number(s.start) + 2), text: String(s.text || '').trim() })).filter(s => s.text);
        rotateGeminiKeyAfter(apiKey);
        res.json({ text: segments.map(s => s.text).join(' '), segments });
        return;
      } catch (error) {
        lastError = error;
        if (isGeminiQuotaError(error.status, error.message)) coolDownGeminiKey(apiKey, error.responseData, error.message);
        else rotateGeminiKeyAfter(apiKey);
      }
    }
    throw lastError || new Error('Semua Gemini API key gagal memproses audio.');
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  finally { await cleanup(req.file.path, audio); }
});

app.post('/api/translate', async (req, res) => {
  if (!requireKey(res)) return;
  const { text, target = 'Indonesian' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Teks wajib diisi.' });
  try {
    const prompt = `Terjemahkan teks subtitle berikut ke ${target}. Pertahankan jumlah baris dan urutan baris. Kembalikan hanya hasil terjemahan tanpa komentar.\n\n${text}`;
    const data = await geminiRequest(MODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } });
    res.json({ text: responseText(data).trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/export', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File video wajib dipilih.' });
  const id = crypto.randomUUID(); const srt = path.join(os.tmpdir(), `videoteks-${id}.srt`); const out = path.join(os.tmpdir(), `videoteks-${id}.mp4`);
  try {
    const segments = JSON.parse(req.body.segments || '[]');
    const settings = { color: req.body.color, template: req.body.template, fontSize: req.body.fontSize, position: req.body.position, fontFamily: req.body.fontFamily, format: req.body.format || 'auto' };
    if (!segments.length) return res.status(400).json({ error: 'Belum ada subtitle untuk diekspor.' });
    await fs.writeFile(srt, toSrt(segments), 'utf8');
    const style = subtitleStyle(settings);
    const shape = settings.format === 'short' ? 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,' : settings.format === 'square' ? 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,' : settings.format === 'landscape' ? 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,' : '';
    const preset = settings.format === 'short' ? 'ultrafast' : 'veryfast';
    await exec('ffmpeg', ['-y', '-i', req.file.path, '-vf', `${shape}subtitles=${srt}:force_style='${style}'`, '-c:a', 'aac', '-b:a', '128k', '-c:v', 'libx264', '-preset', preset, '-crf', '25', '-movflags', 'faststart', out]);
    res.download(out, 'videoteks-subtitle.mp4', async () => { await cleanup(req.file.path, srt, out); });
  } catch (e) { console.error(e); await cleanup(req.file.path, srt, out); res.status(500).json({ error: e.message }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`VideoTeks Gemini berjalan di port ${PORT}`));
