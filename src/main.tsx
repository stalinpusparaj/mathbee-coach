import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Gallery } from './screens/Gallery';
import { store } from './app/store';
import { IS_ARTIFACT } from './app/platform';
import './styles/app.css';

const gallery = new URLSearchParams(location.search).has('gallery');
if (!gallery) void store.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gallery ? <Gallery /> : <App />}
  </StrictMode>,
);

/**
 * Offline support. A new version installs in the background and waits; the app offers
 * "Update now" and only reloads when asked, so a child is never interrupted mid-question.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD && !IS_ARTIFACT) {
  let updateRequested = false;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const markReady = () => {
        // a waiting worker with an existing controller = a genuine update (not the first install)
        if (reg.waiting && navigator.serviceWorker.controller) store.setUpdateReady(true);
      };
      markReady();
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', markReady);
      });
      window.addEventListener('mathbee:apply-update', () => {
        updateRequested = true;
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
      // check for a newer version when the app regains focus
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void reg.update().catch(() => undefined); });
    }).catch(() => undefined);
    // Only reload when the grown-up/child pressed "Update now" — never on first install
    // (clients.claim also fires controllerchange) and never in the middle of a question.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!updateRequested) return;
      updateRequested = false;
      window.location.reload();
    });
  });
}
