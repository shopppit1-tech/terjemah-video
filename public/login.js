import { auth, signInWithGoogle, waitForUser } from './firebase-client.js?v=restore-popup-1';

const button = document.querySelector('#googleSignIn');
const status = document.querySelector('#loginStatus');
const appBase = new URL('./', import.meta.url);
const fallbackNext = new URL('studio.html?view=app', appBase);
const requestedNext = new URLSearchParams(location.search).get('next') || fallbackNext.href;
let nextUrl = fallbackNext.href;
const featureRoutes = { 'app.html': 'app', 'audio.html': 'audio', 'voice.html': 'voice', 'history.html': 'history' };
function normalizeNext(candidate) {
  const route = featureRoutes[candidate.pathname.split('/').pop()];
  if (!route) return candidate.href;
  const shell = new URL('studio.html', appBase);
  shell.searchParams.set('view', route);
  candidate.searchParams.forEach((value, key) => { if (key !== 'view') shell.searchParams.append(key, value); });
  shell.hash = candidate.hash;
  return shell.href;
}
try {
  const candidate = new URL(requestedNext, appBase);
  if (candidate.origin === location.origin && candidate.pathname.startsWith(appBase.pathname)) nextUrl = normalizeNext(candidate);
} catch { /* gunakan halaman subtitle sebagai tujuan aman */ }

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

try {
  const user = await waitForUser();
  if (user) {
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
