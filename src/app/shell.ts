/**
 * Web side of the Android shell bridge (CONTRACT — see docs/BUILD_PLAN.md §Bridge).
 * The shell is detected at runtime (window.MathBeeAndroid / window.__MATHBEE_SHELL__), so the
 * same bundle runs in a browser, in tests with a stub, and inside the Kotlin app.
 * SCAFFOLD STUB: every function is a safe no-op outside the shell. WP2 implements the real bus.
 */
export interface ShellInfo { platform: 'android'; versionName: string; versionCode: number; sdk: number; lowRam: boolean; animScale: number }
export type HapticStyle = 'tap' | 'success' | 'celebrate';
export type RequestStatus = 'saved' | 'shared' | 'printed' | 'cancelled' | 'error' | 'unavailable';
export interface Insets { top: number; right: number; bottom: number; left: number }

export function inShell(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { MathBeeAndroid?: unknown }).MathBeeAndroid;
}
export function shellInfo(): ShellInfo | null {
  return (typeof window !== 'undefined' && (window as unknown as { __MATHBEE_SHELL__?: ShellInfo }).__MATHBEE_SHELL__) || null;
}
/** Fire-and-forget message to native. */
export function send(_type: string, _payload: Record<string, unknown> = {}): void {}
/** Request/response message to native (saveFile, shareFile, print). Resolves 'unavailable' outside the shell. */
export async function request(_type: string, _payload: Record<string, unknown> = {}): Promise<RequestStatus> { return 'unavailable'; }
/** Subscribe to a native→web message type ('back' | 'lifecycle' | 'insets' | 'voices' | 'speech' | ...). */
export function onShell(_type: string, _fn: (payload: Record<string, unknown>) => void): () => void { return () => undefined; }
export function haptic(_style: HapticStyle): void {}
export function keepAwake(_on: boolean): void {}
/** Resolves once the native hello/shell reply arrived (or immediately outside the shell). */
export async function initShell(): Promise<void> {}
