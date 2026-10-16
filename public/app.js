const state = { file: null, segments: [], color: '#ef4444', template: 'pill', fontSize: 28, position: 'bottom', fontFamily: 'DejaVu Sans', outputFormat: 'short' };
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
  preview.textContent = caption.value || '';
  const count = $('#charCount');
  if (count) count.textContent = `${caption.value.length}/120`;
}
function esc(value) { return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function applyPreviewStyle() {
  preview.className = `subtitle ${state.template}`;
  preview.style.fontSize = `${state.fontSize}px`;
  preview.style.fontFamily = state.fontFamily;
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
  });
}
caption.oninput = syncCaption;
$('#clearCaption').onclick = () => { caption.value = ''; syncCaption(); };
fileInput.onchange = (event) => {
  state.file = event.target.files[0];
  if (!state.file) return;
  video.src = URL.createObjectURL(state.file);
  video.onloadedmetadata = () => { $('#seek').max = video.duration; $('#duration').textContent = fmt(video.duration); const ratio = video.videoWidth / video.videoHeight || 16 / 9; const maxHeight = Math.min(window.innerHeight * 0.42, 360); const maxWidth = Math.min($('#videoWrap').parentElement.clientWidth - 16, maxHeight * ratio); $('#videoWrap').style.aspectRatio = `${ratio}`; $('#videoWrap').style.width = `${Math.max(180, maxWidth)}px`; $('#videoWrap').style.margin = 'auto'; setStatus(`Video ${video.videoWidth}×${video.videoHeight}. Seluruh frame terlihat. Output: Short 9:16.`); };
  $('#empty').style.display = 'none';
  $('#videoWrap').classList.add('has-video');
  setStatus('Video siap. Atur gaya, lalu klik “Buat Teks Otomatis”.');
};
$('#playBtn').onclick = () => video.paused ? video.play() : video.pause();
$('#muteBtn').onclick = () => { video.muted = !video.muted; $('#muteBtn').textContent = video.muted ? '🔇 Suara dimatikan' : '🔊 Suara asli'; };

video.ontimeupdate = () => { $('#seek').value = video.currentTime; $('#time').textContent = fmt(video.currentTime); };
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
$('#outputFormat').onchange = (e) => { state.outputFormat = e.target.value; $('#settingsPanel').classList.remove('show'); setStatus(e.target.value === 'auto' ? 'Kanvas mengikuti rasio video asli.' : `Format ${e.target.options[e.target.selectedIndex].text} dipilih.`); };
$('#settingsBtn').onclick = () => $('#settingsPanel').classList.toggle('show');

$('#transcribeBtn').onclick = async () => {
  if (!state.file) return setStatus('Pilih video terlebih dahulu.', true);
  const form = new FormData(); form.append('video', state.file);
  setStatus('Mengekstrak suara asli dan membuat subtitle...'); setBusy(true);
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
  setStatus('Menerapkan template dan merender video...');
  try {
    const response = await fetch('/api/export', { method: 'POST', body: form });
    if (!response.ok) { const data = await response.json(); throw Error(data.error); }
    const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'videoteks-subtitle.mp4'; link.click();
    setStatus('Selesai. Video dengan template pilihan sudah diunduh.');
  } catch (error) { setStatus(error.message, true); }
};
applyPreviewStyle(); syncCaption();