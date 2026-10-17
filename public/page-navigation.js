window.addEventListener('pageshow', () => {
  document.body.classList.remove('page-loading');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
