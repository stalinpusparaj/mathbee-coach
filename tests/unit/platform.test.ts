import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Stub of the Android bridge object that answers every request with a scripted status. */
type Sent = Record<string, unknown> & { type: string };
function installShell(answer: (m: Sent) => string | null) {
  const sent: Sent[] = [];
  const classes = new Set<string>();
  const stub = {
    onmessage: null as ((e: { data: unknown }) => void) | null,
    postMessage(s: string) {
      const m = JSON.parse(s) as Sent;
      sent.push(m);
      if (m.type === 'hello') queueMicrotask(() => deliver({ type: 'shell', voices: { en: true, ta: true } }));
      // chunked files are answered after `end`; print answers straight away
      const done = m.type === 'print' || m.phase === 'end';
      const status = done ? answer(m) : null;
      if (status) queueMicrotask(() => deliver({ type: 'result', reqId: m.reqId, status }));
    },
  };
  const deliver = (m: Record<string, unknown>) => stub.onmessage?.({ data: JSON.stringify({ v: 1, ...m }) });
  const g = globalThis as Record<string, unknown>;
  g.window = { MathBeeAndroid: stub, addEventListener() {}, removeEventListener() {}, print: vi.fn() };
  g.document = {
    documentElement: { style: { setProperty() {} }, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } },
    addEventListener() {},
  };
  return { sent, deliver, classes };
}

const g = globalThis as Record<string, unknown>;
beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  delete g.window;
  delete g.document;
});

async function load() {
  const shell = await import('../../src/app/shell');
  await shell.initShell();
  return import('../../src/app/platform');
}

describe('platform flags', () => {
  it('the test build is neither the artifact nor the android build, so e2e hooks are on', async () => {
    const p = await import('../../src/app/platform');
    expect(p.IS_ARTIFACT).toBe(false);
    expect(p.IS_ANDROID_BUILD).toBe(false);
    expect(p.E2E_HOOKS).toBe(true);
  });
});

describe('saving and sharing through the shell', () => {
  it('saveTextFile sends a chunked saveFile and returns saved', async () => {
    const { sent } = installShell(() => 'saved');
    const p = await load();
    await expect(p.saveTextFile('mathbee-backup.json', '{"a":1}')).resolves.toBe('saved');
    const msgs = sent.filter((m) => m.type === 'saveFile');
    expect(msgs[0]).toMatchObject({ phase: 'begin', filename: 'mathbee-backup.json', mime: 'application/json', size: 7, chunks: 1 });
    expect(msgs[1]).toMatchObject({ phase: 'chunk', index: 0, data: '{"a":1}' });
    expect(msgs[2]).toMatchObject({ phase: 'end' });
  });

  it("saveTextFile returns 'declined' on cancelled and 'unavailable' on error", async () => {
    let status = 'cancelled';
    installShell(() => status);
    const p = await load();
    await expect(p.saveTextFile('a.json', '{}')).resolves.toBe('declined');
    status = 'error';
    await expect(p.saveTextFile('a.json', '{}')).resolves.toBe('unavailable');
  });

  it('shareTextFile sends shareFile and maps the result', async () => {
    let status = 'shared';
    const { sent } = installShell(() => status);
    const p = await load();
    await expect(p.shareTextFile('a.json', '{}')).resolves.toBe('shared');
    expect(sent.some((m) => m.type === 'shareFile' && m.phase === 'begin')).toBe(true);
    status = 'cancelled';
    await expect(p.shareTextFile('a.json', '{}')).resolves.toBe('declined');
  });
});

describe('printing', () => {
  it('printPage sends print with a job name and hides chrome while the dialog is up', async () => {
    const { sent, classes, deliver } = installShell(() => 'printed');
    const p = await load();
    expect(p.canPrint()).toBe(true);
    const job = p.printPage('MathBee practice sheet');
    expect(classes.has('printing')).toBe(true);
    await expect(job).resolves.toBe('printed');
    expect(sent.find((m) => m.type === 'print')).toMatchObject({ v: 1, jobName: 'MathBee practice sheet' });
    expect((g.window as { print: ReturnType<typeof vi.fn> }).print).not.toHaveBeenCalled();
    // the system print dialog covers the app; chrome returns when the app resumes
    expect(classes.has('printing')).toBe(true);
    deliver({ type: 'lifecycle', state: 'resume' });
    expect(classes.has('printing')).toBe(false);
  });

  it('a cancelled print restores the chrome at once', async () => {
    const { classes } = installShell(() => 'cancelled');
    const p = await load();
    await expect(p.printPage()).resolves.toBe('cancelled');
    expect(classes.has('printing')).toBe(false);
  });

  it('outside the shell printPage uses window.print', async () => {
    const print = vi.fn();
    g.window = { print };
    const p = await import('../../src/app/platform');
    expect(p.canPrint()).toBe(true);
    await expect(p.printPage()).resolves.toBe('printed');
    expect(print).toHaveBeenCalledTimes(1);
  });
});
