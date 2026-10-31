import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Stub of the Android bridge object (postMessage out, onmessage in), replying to hello. */
type Sent = Record<string, unknown> & { type: string };
function installShell(voices: { en: boolean; ta: boolean }) {
  const sent: Sent[] = [];
  const stub = {
    onmessage: null as ((e: { data: unknown }) => void) | null,
    postMessage(s: string) {
      const m = JSON.parse(s) as Sent;
      sent.push(m);
      if (m.type === 'hello') queueMicrotask(() => deliver({ type: 'shell', voices, insets: { top: 0, right: 0, bottom: 0, left: 0 } }));
    },
  };
  const deliver = (m: Record<string, unknown>) => stub.onmessage?.({ data: JSON.stringify({ v: 1, ...m }) });
  const g = globalThis as Record<string, unknown>;
  g.window = { MathBeeAndroid: stub, addEventListener() {}, removeEventListener() {} };
  g.document = { documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } }, addEventListener() {} };
  return { sent, deliver };
}

const g = globalThis as Record<string, unknown>;
beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.useRealTimers();
  delete g.window;
  delete g.document;
});

describe('speech with the native backend', () => {
  it('chooses the native backend and sends speak messages', async () => {
    const { sent } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    await shell.initShell();
    expect(speech.speak('Count the flowers', 'en')).toBe(true);
    const m = sent.find((x) => x.type === 'speak')!;
    expect(m).toMatchObject({ v: 1, type: 'speak', text: 'Count the flowers', lang: 'en' });
    expect(typeof m.id).toBe('string');
    expect(m.rate).toBeGreaterThanOrEqual(0.5);
    expect(m.rate).toBeLessThanOrEqual(1.5);
  });

  it('caps the text at 600 characters', async () => {
    const { sent } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    await shell.initShell();
    speech.speak('a'.repeat(900), 'en');
    expect((sent.find((x) => x.type === 'speak')!.text as string).length).toBe(600);
  });

  it('narrationAvailable follows the voices the shell reports', async () => {
    const { deliver, sent } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    expect(speech.narrationAvailable('en')).toBe(false); // nothing known before the hello reply
    await shell.initShell();
    expect(speech.narrationAvailable('en')).toBe(true);
    expect(speech.narrationAvailable('ta')).toBe(false);
    expect(speech.speak('வணக்கம்', 'ta')).toBe(false);
    expect(sent.some((x) => x.type === 'speak')).toBe(false);
    const changed = vi.fn();
    speech.onVoicesChange(changed);
    deliver({ type: 'voices', en: true, ta: true }); // a parent installed Tamil voice data
    expect(changed).toHaveBeenCalledTimes(1);
    expect(speech.narrationAvailable('ta')).toBe(true);
  });

  it('whenVoicesReady waits for the shell reply', async () => {
    installShell({ en: true, ta: true });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    const cb = vi.fn();
    speech.whenVoicesReady(cb);
    expect(cb).not.toHaveBeenCalled();
    await shell.initShell();
    expect(cb).toHaveBeenCalledTimes(1);
    const later = vi.fn();
    speech.whenVoicesReady(later);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('speech start/end events drive onSpeakingChange (music ducking, active timer)', async () => {
    const { sent, deliver } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    await shell.initShell();
    const states: boolean[] = [];
    speech.onSpeakingChange((on) => states.push(on));
    speech.speak('one', 'en');
    const first = sent.filter((x) => x.type === 'speak')[0].id;
    speech.speak('two', 'en');
    const second = sent.filter((x) => x.type === 'speak')[1].id;
    deliver({ type: 'speech', id: first, state: 'start' }); // stale utterance: ignored
    expect(states).toEqual([]);
    deliver({ type: 'speech', id: second, state: 'start' });
    expect(speech.isSpeaking()).toBe(true);
    deliver({ type: 'speech', id: second, state: 'end' });
    expect(states).toEqual([true, false]);
    speech.speak('three', 'en');
    const third = sent.filter((x) => x.type === 'speak')[2].id;
    deliver({ type: 'speech', id: third, state: 'start' });
    deliver({ type: 'speech', id: third, state: 'error' });
    expect(states).toEqual([true, false, true, false]);
  });

  it('stopSpeaking tells native and releases ducking at once', async () => {
    const { sent, deliver } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    await shell.initShell();
    speech.speak('hello', 'en');
    deliver({ type: 'speech', id: sent.at(-1)!.id, state: 'start' });
    speech.stopSpeaking();
    expect(sent.at(-1)).toMatchObject({ type: 'stopSpeaking' });
    expect(speech.isSpeaking()).toBe(false);
  });

  it('never leaves the music ducked: app pause or a lost end event both release it', async () => {
    const { sent, deliver } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const speech = await import('../../src/audio/speech');
    await shell.initShell();
    speech.speak('hello', 'en');
    deliver({ type: 'speech', id: sent.at(-1)!.id, state: 'start' });
    deliver({ type: 'lifecycle', state: 'pause' });
    expect(speech.isSpeaking()).toBe(false);

    vi.useFakeTimers();
    speech.speak('short line', 'en');
    deliver({ type: 'speech', id: sent.filter((x) => x.type === 'speak').at(-1)!.id, state: 'start' });
    expect(speech.isSpeaking()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(speech.isSpeaking()).toBe(false);
  });
});

describe('speech without the shell', () => {
  it('reports no narration when there is no speech engine at all', async () => {
    const speech = await import('../../src/audio/speech');
    expect(speech.narrationAvailable('en')).toBe(false);
    expect(speech.speak('hello', 'en')).toBe(false);
    expect(() => speech.stopSpeaking()).not.toThrow();
  });
});

describe('recorded voice lookup', () => {
  it('ships an empty clip list, so every line falls back to text-to-speech', async () => {
    const voice = await import('../../src/audio/voice');
    expect(voice.VOICE_CLIPS.en).toEqual([]);
    expect(voice.VOICE_CLIPS.ta).toEqual([]);
    expect(voice.clipUrl('ui.next', 'en')).toBeNull();
  });

  it('finds a listed clip by i18n key, but never for lines with parameters', async () => {
    const voice = await import('../../src/audio/voice');
    voice.__setClipsForTests({ en: ['cheer.great'], ta: [] });
    expect(voice.clipUrl('cheer.great', 'en')).toBe('/voice/en/cheer.great.ogg');
    expect(voice.clipUrl('cheer.great', 'ta')).toBeNull();
    expect(voice.clipUrl('cheer.great', 'en', { n: 3 })).toBeNull();
  });

  it('say() uses text-to-speech through the shell when no clip exists', async () => {
    const { sent } = installShell({ en: true, ta: false });
    const shell = await import('../../src/app/shell');
    const voice = await import('../../src/audio/voice');
    await shell.initShell();
    expect(voice.say('ui.next', 'en')).toBe(true);
    const m = sent.find((x) => x.type === 'speak')!;
    expect(typeof m.text).toBe('string');
    expect(m.text).not.toBe('ui.next');
  });
});
