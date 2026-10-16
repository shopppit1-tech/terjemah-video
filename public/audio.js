import { authenticatedFetch, requireLogin } from './firebase-client.js';

await requireLogin();

const $ = (selector) => document.querySelector(selector);
const videoInput = $('#videoInput');
const audioInput = $('#audioInput');
const videoPreview = $('#videoPreview');
const audioPreview = $('#audioPreview');
const videoName = $('#videoName');
const audioName = $('#audioName');
const speedMode = $('#speedMode');
const manualSpeed = $('#manualSpeed');
const manualSpeedSlider = $('#manualSpeedSlider');
const manualSpeedValue = $('#manualSpeedValue');
const fitInfo = $('#fitInfo');
const replaceBtn = $('#replaceBtn');
const status = $('#status');
const progress = $('#progress');
const progressFill = $('#progressFill');
const resultActions = $('#resultActions');
let videoUrl = null;
let audioUrl = null;
let busy = false;

function saveVideoForHandoff(blob) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('videoteks-audio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('generated');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('generated', 'readwrite');
      transaction.objectStore('generated').put({ blob, name: 'video-audio-baru.mp4', createdAt: Date.now() }, 'video-latest');
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  });
}

function loadGeneratedAudio() {
  if (new URLSearchParams(location.search).get('generated') !== '1') return;
  const request = indexedDB.open('videoteks-audio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('generated');
  request.onerror = () => setStatus('Penyimpanan audio AI tidak tersedia di browser.', true);
  request.onsuccess = () => {
    const database = request.result;
    const getRequest = database.transaction('generated', 'readonly').objectStore('generated').get('latest');
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      database.close();
      if (!record?.blob) {
        setStatus('Audio AI tidak ditemukan. Buat audio terlebih dahulu.', true);
        return;
      }
      const file = new File([record.blob], record.name || 'suara-ai-gemini.wav', { type: record.blob.type || 'audio/wav' });
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        audioInput.files = transfer.files;
        audioInput.dispatchEvent(new Event('change'));
        setStatus('Audio AI sudah dimasukkan. Pilih video untuk melanjutkan.');
      } catch {
        setStatus('Audio AI tersimpan, tetapi browser tidak dapat memasukkannya otomatis.', true);
      }
    };
    getRequest.onerror = () => { database.close(); setStatus('Audio AI tidak dapat dibaca.', true); };
  };
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.className = `status ${error ? 'error' : ''}`;
}
function updateButton() {
  replaceBtn.disabled = busy || !videoInput.files[0] || !audioInput.files[0];
  videoInput.disabled = busy;
  audioInput.disabled = busy;
  speedMode.disabled = busy;
  manualSpeedSlider.disabled = busy;
}
function updateFitInfo() {
  manualSpeed.hidden = speedMode.value !== 'manual';
  manualSpeedValue.textContent = `${Number(manualSpeedSlider.value).toFixed(2).replace('.', ',')}×`;
  if (!videoInput.files[0] || !audioInput.files[0]) {
    fitInfo.hidden = true;
    return;
  }
  fitInfo.hidden = false;
  const videoDuration = Number(videoPreview.duration);
  const audioDuration = Number(audioPreview.duration);
  if (speedMode.value === 'original') {
    fitInfo.textContent = 'Kecepatan audio asli dipertahankan; audio pendek diulang dan audio panjang dipotong agar sepanjang video.';
    return;
  }
  if (!Number.isFinite(videoDuration) || !Number.isFinite(audioDuration) || videoDuration <= 0 || audioDuration <= 0) {
    fitInfo.textContent = 'Membaca durasi video dan audio...';
    return;
  }
  const speed = speedMode.value === 'manual' ? Number(manualSpeedSlider.value) : audioDuration / videoDuration;
  const adjustedDuration = audioDuration / speed;
  const action = speed > 1.02 ? 'dipercepat' : speed < 0.98 ? 'diperlambat' : 'hampir normal';
  if (speedMode.value === 'manual') {
    const tail = adjustedDuration > videoDuration + 0.05 ? 'bagian akhir audio akan dipotong' : adjustedDuration < videoDuration - 0.05 ? 'sisa durasi video akan hening' : 'durasi audio hampir pas';
    fitInfo.textContent = `Kecepatan ${speed.toFixed(2)}× (${action}); audio setelah diatur sekitar ${adjustedDuration.toFixed(1)} dtk. ${tail}.`;
  } else {
    fitInfo.textContent = `Kecepatan otomatis ${speed.toFixed(2)}× (${action}) agar audio pas dengan durasi video.`;
  }
}
function showProgress(percent) {
  progress.hidden = false;
  progress.setAttribute('aria-valuenow', String(percent));
  progressFill.style.width = `${percent}%`;
}
function clearProgress() {
  progress.hidden = true;
  progress.setAttribute('aria-valuenow', '0');
  progressFill.style.width = '0%';
}

videoPreview.addEventListener('loadedmetadata', updateFitInfo);
audioPreview.addEventListener('loadedmetadata', updateFitInfo);
speedMode.onchange = updateFitInfo;
manualSpeedSlider.oninput = updateFitInfo;

videoInput.onchange = () => {
  const file = videoInput.files[0];
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = file ? URL.createObjectURL(file) : null;
  videoName.textContent = file ? file.name : 'Belum ada video';
  videoPreview.hidden = !file;
  if (file) {
    videoPreview.src = videoUrl;
    videoPreview.muted = true;
    videoPreview.load();
  } else {
    videoPreview.removeAttribute('src');
  }
  updateButton();
  updateFitInfo();
};

audioInput.onchange = () => {
  const file = audioInput.files[0];
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = file ? URL.createObjectURL(file) : null;
  audioName.textContent = file ? file.name : 'Belum ada file audio';
  audioPreview.hidden = !file;
  if (file) {
    audioPreview.src = audioUrl;
    audioPreview.load();
  } else {
    audioPreview.removeAttribute('src');
  }
  updateButton();
  updateFitInfo();
};

replaceBtn.onclick = async () => {
  const videoFile = videoInput.files[0];
  const audioFile = audioInput.files[0];
  if (!videoFile || !audioFile || busy) return;
  const form = new FormData();
  form.append('video', videoFile);
  form.append('audio', audioFile);
  form.append('audioMode', speedMode.value);
  form.append('manualSpeed', manualSpeedSlider.value);
  busy = true;
  updateButton();
  clearProgress();
  const modeMessage = speedMode.value === 'auto' ? 'Menyamakan kecepatan audio dengan durasi video...' : speedMode.value === 'manual' ? `Mengatur kecepatan audio ${Number(manualSpeedSlider.value).toFixed(2)}×...` : 'Mengganti suara tanpa mengubah kecepatan...';
  setStatus(modeMessage);
  replaceBtn.textContent = speedMode.value === 'manual' ? 'Menerapkan kecepatan...' : 'Memproses video...';

  try {
    const response = await authenticatedFetch('/api/replace-audio', { method: 'POST', body: form });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Video gagal diproses.');
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    const reader = response.body?.getReader();
    let blob;
    if (reader) {
      const chunks = [];
      let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.byteLength;
        if (totalBytes) {
          const percent = Math.min(99, Math.floor(receivedBytes / totalBytes * 100));
          showProgress(percent);
          setStatus(`Mengunduh hasil... ${percent}%`);
          replaceBtn.textContent = `Mengunduh... ${percent}%`;
        } else {
          setStatus(`Mengunduh hasil... ${(receivedBytes / 1048576).toFixed(1)} MB`);
        }
      }
      blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
    } else {
      blob = await response.blob();
    }

    showProgress(100);
    replaceBtn.textContent = 'Mengunduh... 100%';
    setStatus('Unduhan siap. Menyimpan video baru...');
    try { await saveVideoForHandoff(blob); } catch { /* unduhan tetap tersedia jika penyimpanan browser tidak tersedia */ }
    resultActions.hidden = false;
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'video-audio-baru.mp4';
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    const completion = speedMode.value === 'manual' ? `Video diunduh dengan kecepatan audio ${Number(manualSpeedSlider.value).toFixed(2)}×.` : speedMode.value === 'auto' ? 'Kecepatan audio disesuaikan otomatis dengan video.' : 'Kecepatan asli audio dipertahankan.';
    setStatus(`Selesai. ${completion}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    busy = false;
    replaceBtn.textContent = 'Ganti suara & unduh';
    updateButton();
  }
};

loadGeneratedAudio();
