document.addEventListener('click', (event) => {
  const target = event.target;
  const link = target instanceof Element ? target.closest('a[href]') : null;
  if (!link || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

  const destination = new URL(link.href, location.href);
  if (destination.origin !== location.origin || destination.href === location.href) return;
  document.body.classList.add('page-loading');
});

window.addEventListener('pageshow', () => {
  document.body.classList.remove('page-loading');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
