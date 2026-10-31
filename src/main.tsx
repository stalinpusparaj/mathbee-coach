import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Gallery } from './screens/Gallery';
import { store } from './app/store';
import { IS_ANDROID_BUILD, IS_ARTIFACT, E2E_HOOKS } from './app/platform';
import { inShell, onShell } from './app/shell';
import { flushAll } from './persistence/storage';
import { music } from './audio/music';
import './styles/app.css';
// feature stylesheets (one per work package), loaded after the base styles
import.meta.glob('./styles/features/*.css', { eager: true });

const gallery = E2E_HOOKS && new URLSearchParams(location.search).has('gallery');
if (!gallery) void store.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gallery ? <Gallery /> : <App />}
  </StrictMode>,
);

/**
 * Never lose the last taps: make sure queued writes commit when the page hides or unloads.
 * The Android app also calls window.__mbFlush() from onPause, and sends `lifecycle: pause`
 * (shell.ts flushes and answers `flushed` before native pauses the WebView's timers).
 */
declare global { interface Window { __mbFlush?: () => Promise<void> } }
window.__mbFlush = () => flushAll();
document.addEventListener('visibilitychange', () => { if (document.hidden) void flushAll(); });
window.addEventListener('pagehide', () => { void flushAll(); });

// Android: the app going to the background (or losing audio focus) pauses or lowers the music.
// WebView does not reliably fire visibilitychange on pause, so native says so explicitly.
onShell('lifecycle', (m) => {
  if (m.state === 'pause') music.setHidden(true);
  else if (m.state === 'resume') { music.setHidden(false); music.duck(false); }
  else if (m.state === 'duck') music.duck(true);
  else if (m.state === 'unduck') music.duck(false);
});

/**
 * Offline support. A new version installs in the background and waits; the app offers
 * "Update now" and only reloads when asked, so a child is never interrupted mid-question.
 */
// (not in the Android app: the APK carries every file and Play delivers updates)
if ('serviceWorker' in navigator && import.meta.env.PROD && !IS_ARTIFACT && !IS_ANDROID_BUILD && !inShell()) {
  let updateRequested = false;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
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
