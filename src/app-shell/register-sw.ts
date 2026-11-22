export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Registration failure is non-fatal: the app still works online.
    });
  });

  setupUpdateNotification();
}

/**
 * Detects when a new bundle has been deployed and offers a one-tap refresh.
 * Works by comparing the hashed module-script src in the live index.html with
 * the one the current page loaded; the hashed name changes on every build.
 */
function setupUpdateNotification(): void {
  const currentScript = document
    .querySelector('script[type="module"][src]')
    ?.getAttribute('src');
  if (!currentScript) return;

  const checkForUpdate = async () => {
    try {
      const res = await fetch(`./index.html?update=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/<script type="module"[^>]*src="([^"]+)"/);
      if (match && match[1] !== currentScript) {
        showUpdateToast();
      }
    } catch {
      // offline or blocked; ignore
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.setInterval(() => void checkForUpdate(), 5 * 60 * 1000);
}

function showUpdateToast(): void {
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
  toast.addEventListener('click', () => window.location.reload());
  document.body.appendChild(toast);
}
