import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBR8GxthfVr0_rgDeK3sSadtwHuQRo_E7Y',
  authDomain: 'videoteks-a82c1.firebaseapp.com',
  projectId: 'videoteks-a82c1',
  storageBucket: 'videoteks-a82c1.firebasestorage.app',
  messagingSenderId: '769830193670',
  appId: '1:769830193670:web:d89db61d26dff4c81fd187'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const persistenceReady = setPersistence(auth, browserLocalPersistence);

export function waitForUser() {
  return persistenceReady.then(() => new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  }));
}

function setProfileMenuOpen(button, menu, open) {
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

export async function requireLogin() {
  const user = await waitForUser();
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    location.replace(`/?next=${encodeURIComponent(next)}`);
    return new Promise(() => {});
  }

  document.documentElement.classList.remove('auth-pending');
  document.querySelectorAll('[data-account-email]').forEach((element) => {
    element.textContent = user.email || user.displayName || 'Akun Google';
  });

  const profileButton = document.querySelector('[data-profile-trigger]');
  const profileMenu = document.querySelector('[data-profile-menu]');
  if (profileButton && profileMenu) {
    profileButton.addEventListener('click', () => {
      setProfileMenuOpen(profileButton, profileMenu, profileMenu.hidden);
    });
    document.addEventListener('click', (event) => {
      if (!profileMenu.contains(event.target) && !profileButton.contains(event.target)) {
        setProfileMenuOpen(profileButton, profileMenu, false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(profileButton, profileMenu, false);
        profileButton.focus();
      }
    });
  }

  document.querySelectorAll('[data-sign-out]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await signOut(auth);
        document.body.classList.add('page-loading');
        location.replace('/');
      } catch {
        button.disabled = false;
      }
    });
  });
  return user;
}

export async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser || await waitForUser();
  if (!user) {
    location.replace(`/?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
    throw new Error('Silakan masuk dengan Google terlebih dahulu.');
  }
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return fetch(url, { ...options, headers });
}

export async function signInWithGoogle() {
  await persistenceReady;
  return signInWithPopup(auth, new GoogleAuthProvider());
}
