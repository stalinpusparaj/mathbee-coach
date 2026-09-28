/** True in the claude.ai Artifact build (`npm run build:artifact`). */
export const IS_ARTIFACT = import.meta.env.MODE === 'artifact';

interface Downloads { save(r: { filename: string; data: string }): Promise<{ status: string }> }
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

/**
 * Save a text file. In the Artifact viewer, pages cannot start downloads themselves, so the
 * platform's `downloads` capability asks the viewer to confirm; elsewhere a normal link is used.
 * Returns false when no save was possible (the caller then offers copy-and-paste instead).
 */
export async function saveTextFile(filename: string, data: string): Promise<'saved' | 'declined' | 'unavailable'> {
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
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'saved';
}
