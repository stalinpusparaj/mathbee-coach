import { inShell, onShell, request, sendFile } from './shell';

/** True in the claude.ai Artifact build (`npm run build:artifact`). */
export const IS_ARTIFACT = import.meta.env.MODE === 'artifact';
/** True in the bundle packed into the Android app (`npm run build:android`). */
export const IS_ANDROID_BUILD = import.meta.env.MODE === 'android';
/**
 * Test-only URL hooks (`?e2e`, `?gallery`). Always on for the web build; the Android bundle has
 * them only when built with VITE_E2E=1 for the Playwright android project, never for release.
 */
export const E2E_HOOKS = !IS_ANDROID_BUILD || import.meta.env.VITE_E2E === '1';

interface Downloads { save(r: { filename: string; data: string }): Promise<{ status: string }> }
type ClaudeHost = { use?: (name: string) => Promise<unknown> };
export type SaveResult = 'saved' | 'declined' | 'unavailable';

/**
 * Save a text file. In the Android app the system "save to…" picker is used through the shell;
 * in the Artifact viewer, pages cannot start downloads themselves, so the platform's `downloads`
 * capability asks the viewer to confirm; elsewhere a normal link is used.
 * Returns 'unavailable' when no save was possible (the caller then offers copy-and-paste instead).
 */
export async function saveTextFile(filename: string, data: string, mime = 'application/json'): Promise<SaveResult> {
  if (inShell()) {
    const s = await sendFile('saveFile', filename, mime, data);
    return s === 'saved' ? 'saved' : s === 'cancelled' ? 'declined' : 'unavailable';
  }
  if (IS_ARTIFACT) {
    const host = (window as unknown as { claude?: ClaudeHost }).claude;
    const downloads = (await host?.use?.('downloads').catch(() => null)) as Downloads | null | undefined;
    if (!downloads) return 'unavailable';
    try {
      await downloads.save({ filename, data });
      return 'saved';
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'saved';
}

/**
 * Hand a text file to another app (Drive, mail, chat) through the share sheet. Android uses the
 * shell; browsers that can share files use the Web Share API; otherwise 'unavailable'.
 */
export async function shareTextFile(filename: string, data: string, mime = 'application/json'): Promise<'shared' | 'declined' | 'unavailable'> {
  if (inShell()) {
    const s = await sendFile('shareFile', filename, mime, data);
    return s === 'shared' ? 'shared' : s === 'cancelled' ? 'declined' : 'unavailable';
  }
  if (IS_ARTIFACT || typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File === 'undefined') return 'unavailable';
  const file = new File([data], filename, { type: mime });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return 'unavailable';
  try {
    await navigator.share({ files: [file], title: filename });
    return 'shared';
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? 'declined' : 'unavailable';
  }
}

/** Whether printing (or "Save as PDF") is possible here. */
export function canPrint(): boolean {
  if (inShell()) return true;
  return !IS_ARTIFACT && typeof window !== 'undefined' && typeof window.print === 'function';
}

/**
 * Print the current page. In the Android app the shell opens the system print dialog for the
 * WebView; `html.printing` is set meanwhile so screen-only chrome can hide even if the print
 * adapter ignores `@media print`.
 */
export async function printPage(jobName = 'MathBee worksheet'): Promise<'printed' | 'cancelled' | 'error' | 'unavailable'> {
  if (inShell()) {
    const root = document.documentElement;
    root.classList.add('printing');
    const s = await request('print', { jobName });
    if (s === 'printed') {
      // the system dialog lays the page out after `printed` arrives; it covers the app, so the
      // chrome comes back when the app resumes (or after a minute at most)
      const off = onShell('lifecycle', (m) => { if (m.state === 'resume') done(); });
      const timer = setTimeout(() => done(), 60_000);
      const done = () => { off(); clearTimeout(timer); root.classList.remove('printing'); };
    } else root.classList.remove('printing');
    return s === 'printed' || s === 'cancelled' || s === 'unavailable' ? s : 'error';
  }
  if (!canPrint()) return 'unavailable';
  window.print();
  return 'printed';
}
