const $ = (selector) => document.querySelector(selector);
const textInput = $('#textInput');
const voiceSelect = $('#voiceSelect');
const styleInput = $('#styleInput');
const count = $('#count');
const generateBtn = $('#generateBtn');
const result = $('#result');
const audioResult = $('#audioResult');
const downloadLink = $('#downloadLink');
const status = $('#status');
let audioUrl = null;
let busy = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.className = `status ${error ? 'error' : ''}`;
}
function updateCount() {
  count.textContent = textInput.value.length.toLocaleString('id-ID');
  generateBtn.disabled = busy || !textInput.value.trim();
}
textInput.addEventListener('input', updateCount);

generateBtn.onclick = async () => {
  const text = textInput.value.trim();
  if (!text || busy) return;
  busy = true;
  updateCount();
  result.hidden = true;
  generateBtn.textContent = 'Membuat suara...';
  setStatus('Gemini sedang membuat audio...');
  try {
    const response = await fetch('/api/generate-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceSelect.value, style: styleInput.value })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Suara AI gagal dibuat.');
    }
    const blob = await response.blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audioResult.src = audioUrl;
    downloadLink.href = audioUrl;
    result.hidden = false;
    setStatus('Selesai. Audio siap diputar atau diunduh.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    busy = false;
    generateBtn.textContent = 'Buat suara AI';
    updateCount();
  }
};
updateCount();
