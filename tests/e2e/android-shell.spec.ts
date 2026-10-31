import { test, expect, type Page } from '@playwright/test';
import { answerCurrent, finishOnboarding, openParent, openTests } from './helpers';

/**
 * The web side of the Android shell, against the normal web build with a stub bridge.
 * The stub mimics WebViewCompat.addWebMessageListener: `MathBeeAndroid.postMessage(string)` and
 * `onmessage({ data })`; JSON `{v:1,type,...}` both ways. Every message the page sends is kept
 * in `window.__sent`; `window.__native(msg)` delivers a native → web message.
 */
type Sent = { type: string; [k: string]: unknown };

async function withStubShell(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sent: unknown[]; __native: (m: object) => void; MathBeeAndroid: unknown };
    w.__sent = [];
    const port: { onmessage: ((e: { data: string }) => void) | null; postMessage: (s: string) => void } = {
      onmessage: null,
      postMessage(s: string) {
        const m = JSON.parse(s);
        w.__sent.push(m);
        const reply = (o: object, ms = 0) => setTimeout(() => port.onmessage?.({ data: JSON.stringify({ v: 1, ...o }) }), ms);
        if (m.type === 'hello') {
          reply({ type: 'shell', versionName: '1.0.0', versionCode: 1000, sdk: 35, lowRam: true, animScale: 1, voices: { en: true, ta: false }, insets: { top: 24, right: 0, bottom: 16, left: 0 } });
        } else if ((m.type === 'saveFile' || m.type === 'shareFile') && m.phase === 'end') {
          reply({ type: 'result', reqId: m.reqId, status: m.type === 'saveFile' ? 'saved' : 'shared' });
        } else if (m.type === 'print') {
          reply({ type: 'result', reqId: m.reqId, status: 'printed' });
        } else if (m.type === 'speak') {
          reply({ type: 'speech', id: m.id, state: 'start' });
          reply({ type: 'speech', id: m.id, state: 'end' }, 40);
        }
      },
    };
    w.MathBeeAndroid = port;
    w.__native = (o: object) => port.onmessage?.({ data: JSON.stringify({ v: 1, ...o }) });
  });
}

const sent = (page: Page) => page.evaluate(() => (window as unknown as { __sent: Sent[] }).__sent);
const ofType = async (page: Page, type: string) => (await sent(page)).filter((m) => m.type === type);
const native = (page: Page, m: object) => page.evaluate((x) => (window as unknown as { __native: (m: object) => void }).__native(x), m);
const lastRoute = async (page: Page) => (await ofType(page, 'route')).at(-1);

async function newPlayer(page: Page) {
  await page.goto('/?e2e');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByTestId('play').click();
  await page.getByTestId('nickname').fill('Droid');
  await page.getByTestId('create-profile').click();
  await finishOnboarding(page);
  await expect(page.getByTestId('mission')).toBeVisible();
}

test('handshake: hello → shell reply → ready; routes, insets and keep-awake are reported', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await expect.poll(async () => (await sent(page)).map((m) => m.type)).toContain('ready');
  const types = (await sent(page)).map((m) => m.type);
  expect(types[0]).toBe('hello');
  expect(types.indexOf('hello')).toBeLessThan(types.indexOf('ready'));
  for (const m of await sent(page)) expect(m.v).toBe(1);
  // kid-proofing class and the native insets as CSS variables
  await expect(page.locator('html')).toHaveClass(/in-android/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--shell-inset-top').trim())).toBe('24px');
  // the first keep-awake is off; the map is a root with the Bye-bye handler, so back stays in-app
  expect((await ofType(page, 'keepAwake'))[0]).toMatchObject({ on: false });
  expect(await lastRoute(page)).toMatchObject({ name: 'map', canGoBack: true });
  // the narrated story intro went through the native voice
  const speak = await ofType(page, 'speak');
  expect(speak.length).toBeGreaterThan(0);
  expect(speak[0]).toMatchObject({ lang: 'en' });
  expect(String(speak[0].text).length).toBeLessThanOrEqual(600);
});

test('session: keep-awake on, narration via the shell, back opens and closes the pause sheet', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await page.getByTestId('adventure-next').click();
  await expect(page.getByTestId('session')).toBeVisible();
  await expect.poll(async () => (await ofType(page, 'keepAwake')).at(-1)).toMatchObject({ on: true });
  await expect.poll(async () => lastRoute(page)).toMatchObject({ name: 'session', canGoBack: true });
  await expect.poll(async () => (await ofType(page, 'speak')).length).toBeGreaterThan(1); // the question is read aloud

  await native(page, { type: 'back' });
  await expect(page.getByTestId('resume')).toBeVisible();
  await expect(page.getByTestId('stop')).toBeVisible();
  await native(page, { type: 'back' });
  await expect(page.getByTestId('resume')).toHaveCount(0);
  await expect(page.getByTestId('session')).toBeVisible(); // still playing: back never leaves a level

  // the app being paused flushes the store and answers `flushed`
  await answerCurrent(page, true);
  await native(page, { type: 'lifecycle', state: 'pause' });
  await expect.poll(async () => (await ofType(page, 'flushed')).length).toBe(1);
  await expect.poll(async () => (await ofType(page, 'keepAwake')).at(-1)).toMatchObject({ on: false });
  await native(page, { type: 'lifecycle', state: 'resume' });
  await expect.poll(async () => (await ofType(page, 'keepAwake')).at(-1)).toMatchObject({ on: true });

  // stop for now: back on the garden map, keep-awake off again
  await page.getByTestId('pause').click();
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  await expect.poll(async () => (await ofType(page, 'keepAwake')).at(-1)).toMatchObject({ on: false });
});

test('back at the garden map shows the Bye-bye sheet; staying keeps playing, leaving sends exitApp', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await native(page, { type: 'back' });
  await expect(page.getByTestId('bye-sheet')).toBeVisible();
  await expect(page.getByTestId('bye-stay')).toBeVisible();
  // back again closes the sheet (it is the newest overlay), never an instant exit
  await native(page, { type: 'back' });
  await expect(page.getByTestId('bye-sheet')).toHaveCount(0);
  expect(await ofType(page, 'exitApp')).toHaveLength(0);
  await native(page, { type: 'back' });
  await page.getByTestId('bye-stay').click();
  await expect(page.getByTestId('bye-sheet')).toHaveCount(0);
  await expect(page.getByTestId('mission')).toBeVisible();
  await native(page, { type: 'back' });
  await page.getByTestId('bye-leave').click();
  await expect.poll(async () => (await ofType(page, 'exitApp')).length).toBe(1);
});

test('back on a mock test opens the submit / keep-working sheet, and back closes it again', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await openTests(page);
  await page.getByTestId('start-generic').click();
  await expect(page.getByTestId('mock')).toBeVisible();
  await native(page, { type: 'back' });
  await expect(page.getByTestId('confirm-submit')).toBeVisible();
  await native(page, { type: 'back' });
  await expect(page.getByTestId('confirm-submit')).toHaveCount(0);
  await expect(page.getByTestId('mock')).toBeVisible();
});

test('back closes an open dialog before leaving the screen (reset confirm in settings)', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await openParent(page);
  await page.getByTestId('to-settings').click();
  await page.getByTestId('reset-profile').click();
  await expect(page.getByTestId('reset-cancel')).toBeVisible();
  await native(page, { type: 'back' });
  await expect(page.getByTestId('reset-cancel')).toHaveCount(0);
  await expect(page.getByTestId('reset-profile')).toBeVisible(); // still on settings
  await native(page, { type: 'back' });
  await expect(page.getByTestId('parent')).toBeVisible();
});

test('back from a child screen goes to its parent screen, not out of the app', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await page.getByTestId('sticker-book-btn').click();
  await expect(page.getByTestId('sticker-book')).toBeVisible();
  await expect.poll(async () => lastRoute(page)).toMatchObject({ name: 'stickers', canGoBack: true });
  await native(page, { type: 'back' });
  await expect(page.getByTestId('mission')).toBeVisible();
  await expect(page.getByTestId('bye-sheet')).toHaveCount(0);
});

test('grown-up area: backup is saved through chunked saveFile, printing goes through the shell', async ({ page }) => {
  await withStubShell(page);
  await newPlayer(page);
  await openParent(page);

  // print the report: the shell prints, the page hides its chrome until the app resumes
  await page.getByTestId('print-report').click();
  await expect.poll(async () => (await ofType(page, 'print')).length).toBe(1);
  await expect(page.locator('html')).toHaveClass(/printing/);
  await native(page, { type: 'lifecycle', state: 'resume' });
  await expect(page.locator('html')).not.toHaveClass(/printing/);

  // back up progress: begin, chunk(s), end; the saved result shows a message
  await page.getByTestId('to-settings').click();
  await page.getByTestId('export').click();
  await expect(page.getByTestId('backup-msg')).toBeVisible();
  const save = await ofType(page, 'saveFile');
  expect(save[0]).toMatchObject({ phase: 'begin', mime: 'application/json' });
  expect(String(save[0].filename)).toMatch(/^[A-Za-z0-9._-]{1,80}$/);
  const chunks = save.filter((m) => m.phase === 'chunk');
  expect(chunks.length).toBe(save[0].chunks);
  expect(save.at(-1)).toMatchObject({ phase: 'end' });
  const json = chunks.map((c) => String(c.data)).join('');
  expect(json.length).toBe(save[0].size);
  expect(() => JSON.parse(json)).not.toThrow();
  expect(json).toContain('Droid');
  // the grown-up area never sends haptics or keep-awake on
  expect((await ofType(page, 'keepAwake')).some((m) => m.on === true)).toBe(false);
});

test('without the shell nothing is sent and back at the root does nothing', async ({ page }) => {
  await page.goto('/?e2e');
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/in-android/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bye-sheet')).toHaveCount(0);
  await expect(page.getByTestId('play')).toBeVisible();
});
