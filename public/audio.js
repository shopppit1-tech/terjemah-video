const $ = (selector) => document.querySelector(selector);
const videoInput = $('#videoInput');
const audioInput = $('#audioInput');
const videoPreview = $('#videoPreview');
const audioPreview = $('#audioPreview');
const videoName = $('#videoName');
const audioName = $('#audioName');
const fitAudio = $('#fitAudio');
const fitInfo = $('#fitInfo');
const replaceBtn = $('#replaceBtn');
const status = $('#status');
const progress = $('#progress');
const progressFill = $('#progressFill');
let videoUrl = null;
let audioUrl = null;
let busy = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.className = `status ${error ? 'error' : ''}`;
}
function updateButton() {
  replaceBtn.disabled = busy || !videoInput.files[0] || !audioInput.files[0];
  videoInput.disabled = busy;
  audioInput.disabled = busy;
  fitAudio.disabled = busy;
}
function updateFitInfo() {
  if (!videoInput.files[0] || !audioInput.files[0]) {
    fitInfo.hidden = true;
    return;
  }
  fitInfo.hidden = false;
  if (!fitAudio.checked) {
    fitInfo.textContent = 'Kecepatan asli dipertahankan; audio pendek diulang dan audio panjang dipotong.';
    return;
  }
  const videoDuration = Number(videoPreview.duration);
  const audioDuration = Number(audioPreview.duration);
  if (!Number.isFinite(videoDuration) || !Number.isFinite(audioDuration) || videoDuration <= 0 || audioDuration <= 0) {
    fitInfo.textContent = 'Membaca durasi video dan audio...';
    return;
  }
  const speed = audioDuration / videoDuration;
  const action = speed > 1.02 ? 'dipercepat' : speed < 0.98 ? 'diperlambat' : 'hampir normal';
  fitInfo.textContent = `Perkiraan kecepatan ${speed.toFixed(2)}× (${action}) agar pas dengan video.`;
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
fitAudio.onchange = updateFitInfo;

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
  form.append('fitAudio', fitAudio.checked ? 'true' : 'false');
  busy = true;
  updateButton();
  clearProgress();
  setStatus(fitAudio.checked ? 'Menyamakan kecepatan audio dengan durasi video...' : 'Mengganti suara tanpa mengubah kecepatannya...');
  replaceBtn.textContent = fitAudio.checked ? 'Menyesuaikan audio...' : 'Memproses video...';

  try {
    const response = await fetch('/api/replace-audio', { method: 'POST', body: form });
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
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'video-audio-baru.mp4';
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    setStatus(fitAudio.checked ? 'Selesai. Kecepatan audio sudah disesuaikan dengan video.' : 'Selesai. Audio asli sudah diganti dan video diunduh.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    busy = false;
    replaceBtn.textContent = 'Ganti suara & unduh';
    updateButton();
  }
};
