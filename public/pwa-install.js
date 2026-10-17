const installButton = document.querySelector('#installApp');
const installStatus = document.querySelector('#installStatus');
let deferredPrompt = null;

const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isInstalled && installButton) {
  installButton.hidden = true;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.textContent = 'Instal VideoTeks';
});

installButton?.addEventListener('click', async () => {
  if (isInstalled) {
    if (installStatus) installStatus.textContent = 'VideoTeks sudah terpasang di perangkat ini.';
    return;
  }

  if (!deferredPrompt) {
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (installStatus) {
      installStatus.textContent = isAppleMobile
        ? 'Ketuk Bagikan pada browser, lalu pilih Tambahkan ke Layar Utama.'
        : 'Buka menu ⋮ Chrome, lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.';
    }
    return;
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (installStatus) {
    installStatus.textContent = choice.outcome === 'accepted'
      ? 'VideoTeks sedang dipasang.'
      : 'Instalasi dibatalkan. Anda dapat mencoba lagi dari menu browser.';
  }
});

window.addEventListener('appinstalled', () => {
  if (installButton) installButton.hidden = true;
  if (installStatus) installStatus.textContent = 'VideoTeks berhasil dipasang.';
});
