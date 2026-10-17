import { signInWithGoogleIdToken, waitForUser } from './firebase-client.js?v=gsi-1';

const status = document.querySelector('#loginStatus');
const buttonContainer = document.querySelector('#googleSignInButton');
const googleScript = document.querySelector('#googleIdentityScript');
const appBase = new URL('./', import.meta.url);
const GOOGLE_CLIENT_ID = '769830193670-c6r52fi5jdntn34gk0jes3hvf45cc5md.apps.googleusercontent.com';
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

function setBusy(busy) {
  buttonContainer.setAttribute('aria-busy', String(busy));
  buttonContainer.style.pointerEvents = busy ? 'none' : '';
}

function waitForGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleScript) return Promise.reject(new Error('Google Sign-In tidak tersedia di halaman ini.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => finish(reject, new Error('Waktu tunggu Google Sign-In habis.')), 15000);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback(value);
    };
    googleScript.addEventListener('load', () => {
      if (window.google?.accounts?.id) finish(resolve, window.google);
      else finish(reject, new Error('Google Sign-In gagal dimuat.'));
    }, { once: true });
    googleScript.addEventListener('error', () => finish(reject, new Error('Google Sign-In tidak dapat dimuat.')), { once: true });
  });
}

function firebaseErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Google tidak dapat memverifikasi sesi. Coba masuk lagi.',
    'auth/operation-not-allowed': 'Login Google belum diaktifkan untuk proyek ini.',
    'auth/unauthorized-domain': 'Domain website belum diizinkan untuk login Google.',
    'auth/network-request-failed': 'Koneksi terputus. Periksa internet lalu coba lagi.'
  };
  return messages[error?.code] || error?.message || 'Login Google gagal. Coba lagi.';
}

async function handleGoogleCredential(response) {
  if (typeof response?.credential !== 'string' || !response.credential) {
    setStatus('Google tidak mengirim kredensial. Coba lagi.', true);
    setBusy(false);
    return;
  }

  setBusy(true);
  setStatus('Menyelesaikan login Google…');
  try {
    await signInWithGoogleIdToken(response.credential);
    location.replace(nextUrl);
  } catch (error) {
    setStatus(firebaseErrorMessage(error), true);
    setBusy(false);
  }
}

async function initializeGoogleSignIn() {
  try {
    const google = await waitForGoogleIdentity();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      context: 'signin',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_button: true
    });

    const width = Math.min(400, Math.max(180, Math.floor(buttonContainer.getBoundingClientRect().width || 360)));
    google.accounts.id.renderButton(buttonContainer, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'id',
      width
    });
    google.accounts.id.prompt();
  } catch {
    setStatus('Layanan Google tidak dapat dimuat. Periksa koneksi internet lalu coba lagi.', true);
  }
}

try {
  const user = await waitForUser();
  if (user) location.replace(nextUrl);
  else await initializeGoogleSignIn();
} catch {
  setStatus('Firebase belum siap. Muat ulang halaman atau hubungi pengelola.', true);
}
