const state = { file: null, segments: [], color: '#ef4444', template: 'pill', fontSize: 28, position: 'bottom', fontFamily: 'DejaVu Sans', outputFormat: 'source' };
const previewFontStacks = {
  'DejaVu Sans': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  'DejaVu Serif': 'Georgia, "Times New Roman", serif',
  'DejaVu Sans Mono': '"Courier New", Courier, monospace',
  'Liberation Sans': 'Arial, Helvetica, sans-serif'
};
const $ = (s) => document.querySelector(s);
const video = $('#video');
const fileInput = $('#fileInput');
const preview = $('#subtitlePreview');
const status = $('#status');
const caption = $('#caption');

function fmt(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function setStatus(text, error = false) { status.textContent = text; status.className = `status ${error ? 'error' : ''}`; }
function setBusy(active, text = 'Sedang membuat teks otomatis...') { const overlay = $('#busyOverlay'); const button = $('#transcribeBtn'); if (overlay) overlay.classList.toggle('show', active); if (button) { button.disabled = active; button.style.opacity = active ? '.65' : '1'; button.textContent = active ? '⏳ Sedang bekerja...' : '▣ Buat Teks Otomatis'; } const title = $('#busyTitle'); if (title) title.textContent = text; }
function syncCaption() {
  if (state.segments[0]) {
    state.segments[0].text = caption.value;
    const firstInput = $('#segmentList input[data-i="0"]');
    if (firstInput && document.activeElement !== firstInput) firstInput.value = caption.value;
  }
  const count = $('#charCount');
  if (count) count.textContent = `${caption.value.length}/120`;
  syncPreview();
}
function syncPreview() {
  const time = Number(video.currentTime) || 0;
  const active = state.segments.find((s) => time >= Number(s.start) && time <= Number(s.end));
  const text = state.segments.length ? active?.text || '' : caption.value;
  preview.textContent = text;
  preview.style.display = text.trim() ? 'block' : 'none';
  preview.style.opacity = '1';
}
function applyPreviewFormat() {
  if (!video.videoWidth || !video.videoHeight) return;
  const originalRatio = video.videoWidth / video.videoHeight;
  const ratio = state.outputFormat === 'short' ? 9 / 16 : state.outputFormat === 'square' ? 1 : state.outputFormat === 'landscape' ? 16 / 9 : originalRatio;
  const maxHeight = Math.min(window.innerHeight * 0.42, 360);
  const maxWidth = Math.min($('#videoWrap').parentElement.clientWidth - 16, maxHeight * ratio);
  $('#videoWrap').style.aspectRatio = `${ratio}`;
  $('#videoWrap').style.width = `${Math.max(180, maxWidth)}px`;
  $('#videoWrap').style.margin = 'auto';
  video.style.objectFit = state.outputFormat === 'source' ? 'contain' : 'cover';
}
function esc(value) { return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function applyPreviewStyle() {
  preview.className = `subtitle ${state.template}`;
  preview.style.fontSize = `${state.fontSize}px`;
  preview.style.fontFamily = previewFontStacks[state.fontFamily] || previewFontStacks['DejaVu Sans'];
  preview.style.color = state.color === 'gradient' ? '#fff' : state.color;
  preview.style.background = state.template === 'gradient' || state.color === 'gradient'
    ? 'linear-gradient(90deg,#06b6d4,#8b5cf6,#ec4899)'
    : '';
  preview.style.top = state.position === 'top' ? '12%' : state.position === 'middle' ? '45%' : '';
  preview.style.bottom = state.position === 'bottom' ? '12%' : 'auto';
  preview.style.transform = state.position === 'middle' ? 'translateY(-50%)' : '';
}
function drawSegments() {
  const box = $('#segmentList');
  box.innerHTML = state.segments.map((s, i) => `<div class="segment"><span>${fmt(s.start)}</span><input data-i="${i}" value="${esc(s.text)}"></div>`).join('');
  box.querySelectorAll('input').forEach((input) => input.oninput = () => {
    state.segments[+input.dataset.i].text = input.value;
    if (+input.dataset.i === 0) { caption.value = input.value; syncCaption(); }
    else syncPreview();
  });
}
caption.oninput = syncCaption;
$('#clearCaption').onclick = () => { caption.value = ''; syncCaption(); };
fileInput.onchange = (event) => {
  state.file = event.target.files[0];
  if (!state.file) return;
  video.src = URL.createObjectURL(state.file);
  video.onloadedmetadata = () => { $('#seek').max = video.duration; $('#duration').textContent = fmt(video.duration); applyPreviewFormat(); setStatus(`Video ${video.videoWidth}×${video.videoHeight}. Format output: ${state.outputFormat === 'source' ? 'asli' : state.outputFormat}.`); };
  $('#empty').style.display = 'none';
  $('#videoWrap').classList.add('has-video');
  setStatus('Video siap. Atur gaya, lalu klik “Buat Teks Otomatis”.');
};
$('#playBtn').onclick = () => video.paused ? video.play() : video.pause();
$('#muteBtn').onclick = () => { video.muted = !video.muted; $('#muteBtn').textContent = video.muted ? '🔇 Suara dimatikan' : '🔊 Suara asli'; };

video.ontimeupdate = () => { $('#seek').value = video.currentTime; $('#time').textContent = fmt(video.currentTime); syncPreview(); };
$('#seek').oninput = () => { video.currentTime = $('#seek').value; };

document.querySelectorAll('.swatch').forEach((button) => button.onclick = () => {
  document.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
  button.classList.add('active'); state.color = button.dataset.color; applyPreviewStyle(); setStatus(`Warna subtitle: ${button.querySelector('span')?.textContent || 'dipilih'}.`);
});
document.querySelectorAll('.mini').forEach((button) => button.onclick = () => {
  document.querySelectorAll('.mini').forEach((x) => x.classList.remove('active'));
  button.classList.add('active'); state.template = button.dataset.template; applyPreviewStyle();
});
$('#fontSize').oninput = (e) => { state.fontSize = Number(e.target.value); $('#fontSizeValue').textContent = `${state.fontSize}px`; applyPreviewStyle(); };
$('#position').onchange = (e) => { state.position = e.target.value; applyPreviewStyle(); };
$('#fontFamily').onchange = (e) => { state.fontFamily = e.target.value; applyPreviewStyle(); };
$('#outputFormat').onchange = (e) => { state.outputFormat = e.target.value; applyPreviewFormat(); };
$('#transcribeBtn').onclick = async () => {
  if (!state.file) return setStatus('Pilih video terlebih dahulu.', true);
  const form = new FormData(); form.append('video', state.file);
  setStatus('Menyiapkan audio ringkas dan membuat subtitle...'); setBusy(true);
  try {
    const response = await fetch('/api/transcribe', { method: 'POST', body: form });
    const data = await response.json(); if (!response.ok) throw Error(data.error);
    state.segments = data.segments || [];
    caption.value = state.segments[0]?.text || '';
    syncCaption(); drawSegments();
    setStatus(`${state.segments.length} segmen siap diedit. Atur template sebelum ekspor.`);
  } catch (error) { setStatus(error.message, true); } finally { setBusy(false); }
};
$('#translateBtn').onclick = async () => {
  if (!state.segments.length) return setStatus('Buat teks otomatis terlebih dahulu.', true);
  setStatus('Menerjemahkan subtitle...');
  try {
    const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: state.segments.map((s) => s.text).join('\n'), target: $('#target').value }) });
    const data = await response.json(); if (!response.ok) throw Error(data.error);
    const lines = data.text.split(/\r?\n/);
    state.segments.forEach((s, i) => { s.text = lines[i] || s.text; });
    caption.value = state.segments[0]?.text || ''; syncCaption(); drawSegments(); setStatus('Terjemahan selesai dan bisa diedit.');
  } catch (error) { setStatus(error.message, true); }
};
$('#exportBtn').onclick = async () => {
  if (!state.file || !state.segments.length) return setStatus('Buat subtitle terlebih dahulu.', true);
  const form = new FormData(); form.append('video', state.file); form.append('segments', JSON.stringify(state.segments));
  form.append('color', state.color); form.append('template', state.template); form.append('fontSize', String(state.fontSize)); form.append('position', state.position); form.append('fontFamily', state.fontFamily); form.append('format', state.outputFormat);
  const button = $('#exportBtn');
  const originalButton = button.innerHTML;
  const showLoading = (label) => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${label}`; };
  showLoading('Memproses video...');
  setStatus('Video sedang diproses. Jangan tutup halaman.');
  try {
    const response = await fetch('/api/export', { method: 'POST', body: form });
    if (!response.ok) { const data = await response.json(); throw Error(data.error); }
    showLoading('Mengunduh video...');
    setStatus('Render selesai. Sedang mengunduh file video...');
    const blob = await response.blob(); const downloadUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = downloadUrl; link.download = 'videoteks-subtitle.mp4'; link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    setStatus('Selesai. Video dengan template pilihan sudah diunduh.');
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); button.innerHTML = originalButton; }
};
applyPreviewStyle(); syncCaption();
