import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the object WebViewCompat.addWebMessageListener injects: postMessage(string)
 * towards native, and onmessage / addEventListener('message') for native → web messages.
 */
type Sent = Record<string, unknown> & { type: string };
function installShell(opts: { autoReply?: Record<string, unknown> | null; useListener?: boolean } = {}) {
  const sent: Sent[] = [];
  const listeners: ((e: { data: unknown }) => void)[] = [];
  const stub: {
    postMessage(s: string): void;
    onmessage: ((e: { data: unknown }) => void) | null;
    addEventListener?: (t: 'message', fn: (e: { data: unknown }) => void) => void;
  } = {
    postMessage(s: string) {
      const m = JSON.parse(s) as Sent;
      sent.push(m);
      if (m.type === 'hello' && opts.autoReply !== null) {
        queueMicrotask(() => deliver({ type: 'shell', versionName: '1.0.0', sdk: 36, lowRam: false, voices: { en: true, ta: false }, insets: { top: 24, right: 0, bottom: 16, left: 0 }, ...(opts.autoReply ?? {}) }));
      }
    },
    onmessage: null,
  };
  if (opts.useListener) stub.addEventListener = (_t, fn) => { listeners.push(fn); };
  const deliverRaw = (data: unknown) => {
    stub.onmessage?.({ data });
    listeners.forEach((l) => l({ data }));
  };
  const deliver = (m: Record<string, unknown>) => deliverRaw(JSON.stringify({ v: 1, ...m }));
  const style = new Map<string, string>();
  const classes = new Set<string>();
  const g = globalThis as Record<string, unknown>;
  g.window = { MathBeeAndroid: stub, addEventListener() {}, removeEventListener() {} };
  g.document = {
    documentElement: {
      style: { setProperty: (k: string, v: string) => style.set(k, v) },
      classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
    },
    addEventListener() {},
  };
  return { stub, sent, deliver, deliverRaw, style, classes };
}

const g = globalThis as Record<string, unknown>;

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.useRealTimers();
  delete g.window;
  delete g.document;
});

describe('shell outside the app', () => {
  it('is a safe no-op in a plain browser or node', async () => {
    const shell = await import('../../src/app/shell');
    expect(shell.inShell()).toBe(false);
    expect(shell.shellInfo()).toBeNull();
    shell.send('ready');
    shell.haptic('tap');
    shell.keepAwake(true);
    await expect(shell.initShell()).resolves.toBeUndefined();
    await expect(shell.request('print')).resolves.toBe('unavailable');
    await expect(shell.sendFile('saveFile', 'a.json', 'application/json', '{}')).resolves.toBe('unavailable');
  });
});

describe('shell message bus', () => {
  it('detects the shell at runtime and says hello with a v:1 JSON message', async () => {
    const { sent, classes } = installShell();
    const shell = await import('../../src/app/shell');
    expect(shell.inShell()).toBe(true);
    await shell.initShell();
    expect(sent[0]).toEqual({ v: 1, type: 'hello' });
    expect(classes.has('in-android')).toBe(true);
  });

  it('initShell resolves after the native shell reply with voices, insets and info cached', async () => {
    const { style } = installShell();
    const shell = await import('../../src/app/shell');
    const seen: unknown[] = [];
    shell.onVoicesChange((v) => seen.push(v));
    await shell.initShell();
    expect(shell.voices()).toEqual({ en: true, ta: false });
    expect(seen).toEqual([{ en: true, ta: false }]);
    expect(style.get('--shell-inset-top')).toBe('24px');
    expect(style.get('--shell-inset-bottom')).toBe('16px');
    expect(shell.shellInfo()).toMatchObject({ platform: 'android', versionName: '1.0.0', sdk: 36, lowRam: false });
  });

  it('works with addEventListener-style bridges too', async () => {
    installShell({ useListener: true });
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    expect(shell.voices()).toEqual({ en: true, ta: false });
  });

  it('gives up waiting for the reply after the timeout', async () => {
    vi.useFakeTimers();
    installShell({ autoReply: null });
    const shell = await import('../../src/app/shell');
    let done = false;
    void shell.initShell().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(shell.HELLO_TIMEOUT_MS - 10);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toBe(true);
    expect(shell.voices()).toBeNull();
  });

  it('ignores malformed JSON, wrong versions and messages without a type', async () => {
    const { deliverRaw } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const got: unknown[] = [];
    shell.onShell('back', (m) => got.push(m));
    expect(() => deliverRaw('{not json')).not.toThrow();
    deliverRaw(JSON.stringify({ v: 2, type: 'back' }));
    deliverRaw(JSON.stringify({ v: 1 }));
    deliverRaw(JSON.stringify(null));
    deliverRaw(42);
    expect(got).toEqual([]);
    deliverRaw(JSON.stringify({ v: 1, type: 'back' }));
    expect(got).toHaveLength(1);
  });

  it('onShell subscribers can unsubscribe, and a failing subscriber does not stop the others', async () => {
    const { deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a: unknown[] = [];
    shell.onShell('back', () => { throw new Error('boom'); });
    const off = shell.onShell('back', (m) => a.push(m));
    deliver({ type: 'back' });
    off();
    deliver({ type: 'back' });
    expect(a).toHaveLength(1);
    warn.mockRestore();
  });

  it('request() matches the result by reqId', async () => {
    const { sent, deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const p1 = shell.request('print', { jobName: 'Sheet' });
    const p2 = shell.request('print', { jobName: 'Other' });
    const [r1, r2] = sent.filter((m) => m.type === 'print');
    expect(r1).toMatchObject({ v: 1, type: 'print', jobName: 'Sheet' });
    expect(r1.reqId).not.toBe(r2.reqId);
    deliver({ type: 'result', reqId: r2.reqId, status: 'cancelled' });
    deliver({ type: 'result', reqId: r1.reqId, status: 'printed' });
    await expect(p1).resolves.toBe('printed');
    await expect(p2).resolves.toBe('cancelled');
  });

  it('request() turns unknown statuses into error and times out', async () => {
    const { sent, deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const p = shell.request('print');
    deliver({ type: 'result', reqId: sent.at(-1)!.reqId, status: 'weird' });
    await expect(p).resolves.toBe('error');
    vi.useFakeTimers();
    const slow = shell.request('print', {}, 1000);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(slow).resolves.toBe('error');
  });

  it('sends files in 512 KB pieces between begin and end, up to 20 MB', async () => {
    const { sent, deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const data = 'x'.repeat(shell.FILE_CHUNK_CHARS * 2 + 10);
    const p = shell.sendFile('saveFile', 'backup.json', 'application/json', data);
    const msgs = sent.filter((m) => m.type === 'saveFile');
    expect(msgs.map((m) => m.phase)).toEqual(['begin', 'chunk', 'chunk', 'chunk', 'end']);
    expect(msgs[0]).toMatchObject({ filename: 'backup.json', mime: 'application/json', size: data.length, chunks: 3 });
    expect(msgs.slice(1, 4).map((m) => m.index)).toEqual([0, 1, 2]);
    expect(msgs.slice(1, 4).map((m) => m.data as string).join('')).toBe(data);
    expect(new Set(msgs.map((m) => m.reqId)).size).toBe(1);
    deliver({ type: 'result', reqId: msgs[0].reqId, status: 'saved' });
    await expect(p).resolves.toBe('saved');
    await expect(shell.sendFile('shareFile', 'big.json', 'application/json', 'x'.repeat(shell.MAX_FILE_CHARS + 1))).resolves.toBe('error');
  });

  it('throttles haptics to one per 150 ms', async () => {
    const { sent } = installShell();
    const shell = await import('../../src/app/shell');
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    shell.haptic('tap');
    shell.haptic('success');
    now.mockReturnValue(1160);
    shell.haptic('celebrate');
    expect(sent.filter((m) => m.type === 'haptic').map((m) => m.style)).toEqual(['tap', 'celebrate']);
    now.mockRestore();
  });

  it('keepAwake sends only changes, and is cleared while paused then restored on resume', async () => {
    const { sent, deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    shell.keepAwake(true);
    shell.keepAwake(true);
    deliver({ type: 'lifecycle', state: 'pause' });
    deliver({ type: 'lifecycle', state: 'resume' });
    shell.keepAwake(false);
    expect(sent.filter((m) => m.type === 'keepAwake').map((m) => m.on)).toEqual([true, false, true, false]);
  });

  it('flushes storage on lifecycle pause and answers flushed', async () => {
    const { sent, deliver } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    const seen: unknown[] = [];
    shell.onShell('lifecycle', (m) => seen.push(m.state));
    deliver({ type: 'lifecycle', state: 'pause' });
    expect(shell.isPaused()).toBe(true);
    await vi.waitFor(() => expect(sent.some((m) => m.type === 'flushed')).toBe(true));
    deliver({ type: 'lifecycle', state: 'duck' });
    deliver({ type: 'lifecycle', state: 'resume' });
    expect(shell.isPaused()).toBe(false);
    expect(seen).toEqual(['pause', 'duck', 'resume']);
  });

  it('updates insets and voices when native reports changes', async () => {
    const { deliver, style } = installShell();
    const shell = await import('../../src/app/shell');
    await shell.initShell();
    deliver({ type: 'insets', insets: { top: 30, right: 12, bottom: 48, left: 0 } });
    expect(style.get('--shell-inset-right')).toBe('12px');
    expect(style.get('--shell-inset-bottom')).toBe('48px');
    deliver({ type: 'insets', insets: { top: 'nope' } });
    expect(style.get('--shell-inset-top')).toBe('30px');
    deliver({ type: 'voices', voices: { en: true, ta: true } });
    expect(shell.voices()).toEqual({ en: true, ta: true });
  });
});
