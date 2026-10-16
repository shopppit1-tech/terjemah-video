import { auth, signInWithGoogle, waitForUser } from './firebase-client.js';

const button = document.querySelector('#googleSignIn');
const status = document.querySelector('#loginStatus');
const requestedNext = new URLSearchParams(location.search).get('next') || '/app.html';
const nextUrl = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/app.html';

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

try {
  const user = await waitForUser();
  if (user) {
    document.body.classList.add('page-loading');
    location.replace(nextUrl);
  }
} catch {
  setStatus('Firebase belum siap. Muat ulang halaman atau hubungi pengelola.', true);
}

button.addEventListener('click', async () => {
  button.disabled = true;
  setStatus('Menghubungkan ke Google…');
  try {
    await signInWithGoogle();
    document.body.classList.add('page-loading');
    location.replace(nextUrl);
  } catch (error) {
    const messages = {
      'auth/popup-closed-by-user': 'Jendela masuk ditutup sebelum selesai.',
      'auth/popup-blocked': 'Browser memblokir jendela masuk. Izinkan pop-up lalu coba lagi.',
      'auth/unauthorized-domain': 'Domain situs belum ditambahkan di Authorized domains Firebase.',
      'auth/operation-not-allowed': 'Google Sign-In belum diaktifkan di Firebase Authentication.'
    };
    setStatus(messages[error.code] || error.message || 'Gagal masuk dengan Google. Coba lagi.', true);
    button.disabled = false;
  }
});
