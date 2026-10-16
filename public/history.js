import { authenticatedFetch, requireLogin } from './firebase-client.js';

const status = document.querySelector('#historyStatus');
const list = document.querySelector('#historyList');

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('history-error', error);
  status.hidden = false;
}

function makeHistoryCard(item) {
  const card = document.createElement('article');
  card.className = 'history-card';
  const head = document.createElement('div');
  head.className = 'history-card__head';
  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'history-card__title';
  title.textContent = item.fileName || 'Transkripsi video';
  const date = document.createElement('p');
  date.className = 'history-card__date';
  const createdAt = Number(item.createdAt) || Date.parse(item.createdAt || '');
  date.textContent = Number.isFinite(createdAt) ? new Date(createdAt).toLocaleString('id-ID') : 'Waktu tidak tersedia';
  titleBlock.append(title, date);
  const deleteButton = document.createElement('button');
  deleteButton.className = 'history-card__delete';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Hapus';
  deleteButton.addEventListener('click', async () => {
    if (!confirm('Hapus riwayat ini secara permanen?')) return;
    deleteButton.disabled = true;
    try {
      const response = await authenticatedFetch(`/api/history/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Riwayat gagal dihapus.');
      card.remove();
      if (!list.children.length) showStatus('Belum ada riwayat transkripsi.');
    } catch (error) {
      deleteButton.disabled = false;
      showStatus(error.message, true);
    }
  });
  head.append(titleBlock, deleteButton);
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Lihat teks subtitle';
  const transcript = document.createElement('pre');
  transcript.textContent = item.text || (Array.isArray(item.segments) ? item.segments.map((segment) => segment.text || '').join('\n') : '');
  details.append(summary, transcript);
  card.append(head, details);
  return card;
}

async function loadHistory() {
  showStatus('Memuat riwayat…');
  try {
    const response = await authenticatedFetch('/api/history');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Riwayat tidak dapat dimuat.');
    list.replaceChildren(...data.items.map(makeHistoryCard));
    list.hidden = false;
    if (!data.items.length) showStatus('Belum ada riwayat transkripsi.');
    else status.hidden = true;
  } catch (error) {
    showStatus(error.message, true);
  }
}

await requireLogin();
await loadHistory();
