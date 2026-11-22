export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        // The browser byte-compares sw.js on every load; a new stamped build
        // makes updatefound fire, and we prompt the user to refresh.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(() => newWorker.postMessage({ type: 'SKIP_WAITING' }));
            }
          });
        });
      })
      .catch(() => {
        // Registration failure is non-fatal: the app still works online.
      });
  });
}

function showUpdateToast(onRefresh: () => void): void {
  if (document.getElementById('hikerppl-update-toast')) return;
  const toast = document.createElement('button');
  toast.id = 'hikerppl-update-toast';
  toast.type = 'button';
  toast.textContent = 'App has been updated — tap to refresh';
  toast.style.cssText = [
    'position: fixed',
    'left: 50%',
    'bottom: 16px',
    'transform: translateX(-50%)',
    'z-index: 2000',
    'background: #1a7a4c',
    'color: #fff',
    'border: 0',
    'border-radius: 999px',
    'padding: 10px 18px',
    'font: 600 14px/1 system-ui, sans-serif',
    'box-shadow: 0 8px 24px rgba(0,0,0,.4)',
    'cursor: pointer',
  ].join(';');
  toast.addEventListener('click', onRefresh);
  document.body.appendChild(toast);
}
