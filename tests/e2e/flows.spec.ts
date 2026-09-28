import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerCurrent, current, newProfile, nectar } from './helpers';

const CATS = Array.from({ length: 14 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`);

test('profile → assessment (wrong → hint → success) → refresh → resume without duplicate reward', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('mission').click(); // garden check-up
  await expect(page.getByTestId('session')).toBeVisible();

  // wrong first, specific feedback, work kept, then a hint, then success
  await answerCurrent(page, false);
  await expect(page.getByTestId('feedback')).toBeVisible();
  await expect(page.getByTestId('feedback')).not.toContainText(/wrong/i);
  await page.getByTestId('try-again').click();
  await page.getByTestId('hint').click();
  await expect(page.locator('.hints li')).toHaveCount(1);
  await answerCurrent(page, true);
  await expect(page.getByTestId('celebration')).toBeVisible(); // bee cheer after a correct answer
  await expect(page.getByTestId('next')).toBeVisible();
  await page.getByTestId('next').click(); // the celebration never blocks the controls
  await expect(page.getByTestId('celebration')).toHaveCount(0);
  await expect.poll(() => nectar(page)).toBe(1);

  // refresh in the middle of the next question → resume where we were
  const before = await current(page);
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('session')).toBeVisible();
  const after = await current(page);
  expect(after.templateId).toBe(before.templateId);
  expect(await nectar(page)).toBe(1); // no duplicate reward after refresh

  // finish the assessment (answers correct), reach results
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId('results').isVisible()) break;
    await answerCurrent(page, true);
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('results')).toBeVisible();
  await page.getByTestId('to-map').click();
  await expect(page.getByTestId('mission')).toBeVisible();
});

test('lesson → practice → result: worked example first, then guided and independent steps', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('loc-C07').click();
  await page.getByTestId('learn-explore').click();
  await expect(page.getByText(/watch me/i)).toBeVisible();
  // worked example: step through, no answer required
  for (let i = 0; i < 6 && (await page.getByTestId('next-step').isVisible()); i++) await page.getByTestId('next-step').click();
  await page.getByTestId('ready').click();
  await expect(page.getByText(/try together/i)).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await answerCurrent(page, true);
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('results')).toBeVisible();
  await page.getByTestId('to-map').click();
  await page.getByTestId('loc-C07').click();
  await page.getByTestId('practise-explore').click();
  await answerCurrent(page, true);
  await page.getByTestId('next').click();
  // stop early without penalty
  await page.getByTestId('pause').click();
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('results')).toContainText(/stopped early/i);
});

test('all 42 category-stage combinations are reachable and answerable', async ({ page }) => {
  test.setTimeout(240_000);
  await newProfile(page);
  // unlock gated regrouping so every Apply stage has its full template set
  for (const cat of CATS) {
    for (const stage of ['explore', 'practise', 'apply']) {
      await page.getByTestId(`loc-${cat}`).click();
      await page.getByTestId(`practise-${stage}`).click();
      await expect(page.getByTestId('session')).toBeVisible();
      await answerCurrent(page, true);
      await expect(page.getByTestId('next'), `${cat} ${stage}`).toBeVisible();
      await page.getByTestId('pause').click();
      await page.getByTestId('stop').click();
      await page.getByTestId('to-map').click();
    }
  }
});

test('keyboard-only: digits and Enter answer a question; Escape pauses', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('loc-C08').click();
  await page.getByTestId('practise-explore').click();
  let q = await current(page);
  for (let i = 0; i < 6 && q.answer.kind !== 'number'; i++) {
    await answerCurrent(page, true);
    await page.getByTestId('next').click();
    q = await current(page);
  }
  if (q.answer.kind === 'number') {
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.type(String(q.answer.value));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('next')).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('resume')).toBeVisible();
});

test('generic test: no hints or feedback, answers survive refresh, confirmation, explanations', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('tests').click();
  await page.getByTestId('start-generic').click();
  await expect(page.getByTestId('mock')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveCount(0);
  await expect(page.getByTestId('check')).toHaveCount(0);
  const choice = page.locator('[data-testid^="choice-"]').first();
  const key = page.getByTestId('key-3');
  if (await choice.count()) await choice.click(); else await key.click();
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('mock')).toBeVisible();
  const answered = page.locator('.qnav button.answered');
  await expect(answered).toHaveCount(1);
  await expect(page.getByTestId('feedback')).toHaveCount(0);
  await page.getByTestId('mock-submit').click();
  await expect(page.getByText(/finish the test now/i)).toBeVisible();
  await page.getByTestId('confirm-submit').click();
  await expect(page.getByTestId('mock-results')).toContainText(/not the official format/i);
});

test('official mock stays locked until the parent confirms rules', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('tests').click();
  await expect(page.getByTestId('start-official')).toHaveCount(0);
  await page.goto('/?e2e');
  await page.getByTestId('continue').click();
  // open parent area via press-and-hold
  const hold = page.getByTestId('parent-hold');
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await expect(page.getByTestId('parent')).toBeVisible();
  await page.getByTestId('to-setup').click();
  await page.getByTestId('comp-count').fill('10');
  await page.getByTestId('rules-confirmed').check();
  await page.getByTestId('save-setup').click();
  await page.getByTestId('back').click();
  await page.getByTestId('tests').click();
  await expect(page.getByTestId('start-official')).toBeVisible();
});

test('parent area: report reflects real attempts; import rejects malformed data; reset can be cancelled', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('loc-C01').click();
  await page.getByTestId('practise-explore').click();
  await answerCurrent(page, true);
  await page.getByTestId('next').click();
  await page.getByTestId('pause').click();
  await page.getByTestId('stop').click();
  await page.getByTestId('to-map').click();
  const hold = page.getByTestId('parent-hold');
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await expect(page.getByTestId('parent')).toContainText(/Based on 1 recorded questions/);
  await expect(page.getByTestId('parent')).not.toContainText(/readiness:/i);
  await page.getByTestId('to-settings').click();
  await page.getByTestId('import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
  await expect(page.getByTestId('import-msg')).toContainText(/not a MathBee Coach export/i);
  await page.getByTestId('reset-all').click();
  await page.getByTestId('reset-cancel').click();
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible(); // data still there
});

test('storage unavailable: play continues with a visible warning', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } });
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const page = await ctx.newPage();
  await page.goto('/?e2e');
  await expect(page.getByRole('alert')).toContainText(/cannot be saved/i);
  await page.getByTestId('play').click();
  await page.getByTestId('create-profile').click();
  await page.getByTestId('skip-controls').click();
  await page.getByTestId('mission').click();
  await answerCurrent(page, true);
  await expect(page.getByTestId('next')).toBeVisible();
  await ctx.close();
});

test('offline: after the first visit the app loads and plays without a network', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/?e2e');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.locator('.welcome-card img')).toBeVisible();
  await page.getByTestId('play').click();
  await page.getByTestId('create-profile').click();
  await page.getByTestId('skip-controls').click();
  await page.getByTestId('loc-C12').click();
  await page.getByTestId('practise-apply').click();
  await expect(page.getByTestId('session')).toBeVisible();
  await expect(page.getByTestId('prompt')).not.toBeEmpty();
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length);
  expect(broken).toBe(0);
  await ctx.close();
});

for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }], ['tablet-landscape', { width: 1024, height: 768 }], ['desktop', { width: 1440, height: 900 }]] as const) {
  test(`layout ${name}: no horizontal scrolling on key screens`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'phone', hasTouch: name !== 'desktop' });
    const page = await ctx.newPage();
    await newProfile(page);
    const noOverflow = async (label: string) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(w, label).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-results/layout-${name}-${label}.png`, fullPage: true });
    };
    await noOverflow('map');
    for (const cat of ['C03', 'C12', 'C13', 'C08']) {
      await page.getByTestId(`loc-${cat}`).click();
      await page.getByTestId('practise-practise').click();
      await noOverflow(`session-${cat}`);
      await page.getByTestId('pause').click();
      await page.getByTestId('stop').click();
      await page.getByTestId('to-map').click();
    }
    await ctx.close();
  });
}

test('update handling: a new version waits and is applied only when asked', async ({ browser }) => {
  const swPath = join(process.cwd(), 'dist', 'sw.js');
  const original = readFileSync(swPath, 'utf8');
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto('/?e2e');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.getByTestId('play').click();
    await page.getByTestId('create-profile').click();
    await page.getByTestId('skip-controls').click();
    await page.getByTestId('back').click();

    // "deploy" a new version: a byte-different service worker on the server
    writeFileSync(swPath, original.replace("const BUILD_ID = '", "const BUILD_ID = 'v2-"));
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r?.update(); });
    await expect(page.getByText(/new version is ready/i)).toBeVisible({ timeout: 15_000 });
    // nothing reloaded by itself: the welcome screen is still here
    await expect(page.getByTestId('continue')).toBeVisible();
    const nav = page.waitForEvent('framenavigated');
    await page.getByRole('button', { name: /update now/i }).click();
    await nav;
    await expect(page.getByTestId('continue')).toBeVisible();
    const id = await page.evaluate(() => new Promise<string>((res) => {
      navigator.serviceWorker.addEventListener('message', (e) => res(e.data.buildId), { once: true });
      navigator.serviceWorker.controller!.postMessage({ type: 'GET_BUILD_ID' });
    }));
    expect(id.startsWith('v2-')).toBe(true);
  } finally {
    writeFileSync(swPath, original);
    await ctx.close();
  }
});

test('background music can be muted from the home screen and stays muted after reload', async ({ page }) => {
  await page.goto('/?e2e');
  const toggle = page.getByTestId('music-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText(/music off/i);
  await page.reload();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('music-toggle').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('background music really plays after the first tap, quieter during questions', async ({ page }) => {
  await page.goto('/?e2e');
  const state = () => page.evaluate(() => (window as unknown as { __mathbeeMusic: { debugState(): { playing: boolean; context: string; level: number; scene: string } } }).__mathbeeMusic.debugState());
  await page.getByTestId('play').click(); // first gesture starts the music
  await expect.poll(async () => (await state()).context).toBe('running');
  await expect.poll(async () => (await state()).level, { timeout: 5000 }).toBeGreaterThan(0.2);
  await page.getByTestId('create-profile').click();
  await page.getByTestId('skip-controls').click();
  await page.getByTestId('mission').click();
  await expect.poll(async () => (await state()).scene).toBe('play');
  await expect.poll(async () => (await state()).level, { timeout: 5000 }).toBeLessThan(0.16);
});

test('3D garden: explorable world opens places, the bee journey is 3D, and grown-ups can switch to flat 2D', async ({ page }) => {
  await newProfile(page);
  const garden = page.locator('.garden3d');
  await expect(garden).toBeVisible();
  await expect(page.locator('.garden3d canvas')).toBeVisible();
  await expect(page.locator('.loc3d')).toHaveCount(14);
  // the scene really drew its meshes (WebGL draw calls this frame)
  await expect.poll(async () => Number(await garden.getAttribute('data-draw-calls')), { timeout: 10_000 }).toBeGreaterThan(50);

  // a place label opens that place; the session journey is drawn in 3D
  await page.getByTestId('loc-C07').click();
  await page.getByTestId('practise-explore').click();
  await expect(page.locator('[data-testid="journey"][data-3d="1"]')).toBeVisible();
  await expect(page.locator('[data-testid="journey"]')).toHaveAttribute('data-at', '0');
  await answerCurrent(page, true);
  await page.getByTestId('next').click();
  await expect(page.locator('[data-testid="journey"]')).toHaveAttribute('data-at', '1');
  await page.getByTestId('pause').click();
  await page.getByTestId('stop').click();
  await page.getByTestId('to-map').click();

  // grown-ups: Graphics → flat 2D brings back the picture map
  const hold = page.getByTestId('parent-hold');
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await page.getByTestId('to-settings').click();
  await page.getByTestId('graphics-setting').selectOption('2d');
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.garden3d')).toHaveCount(0);
  await expect(page.locator('.location')).toHaveCount(14);
});

test('reduced motion falls back to the flat 2D garden automatically', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await newProfile(page);
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.garden3d')).toHaveCount(0);
  await ctx.close();
});
