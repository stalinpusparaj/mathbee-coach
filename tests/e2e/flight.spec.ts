import { test, expect, type Page } from '@playwright/test';
import { nectar, newProfile } from './helpers';

/**
 * Bee Flight end to end: opened from World 1's map, a full 8-gate run steered with the lane
 * buttons and finished through the ?e2e hook (the 3D pace is gentle: ~12 s per gate headless),
 * one different gate opens "Let's look with Buzzy", results show, nectar is paid once per gate,
 * back during a run opens the pause sheet; and the calm 2D version under reduced motion.
 */

type Hook = { correctLane: number; phase: string; gate: number; lane: number; question: { id: string; choices: { id: string; correct: boolean }[] } | null; pass: (lane: number) => void };

async function hook(page: Page): Promise<Omit<Hook, 'pass'>> {
  await page.waitForFunction(() => (window as unknown as { __mathbeeFlight?: Hook }).__mathbeeFlight?.phase);
  return page.evaluate(() => {
    const h = (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight;
    return { correctLane: h.correctLane, phase: h.phase, gate: h.gate, lane: h.lane, question: h.question };
  });
}

/** Wait until the hook shows gate `n` ready to fly. */
async function atGate(page: Page, n: number) {
  await page.waitForFunction((g) => {
    const h = (window as unknown as { __mathbeeFlight?: Hook }).__mathbeeFlight;
    return !!h && h.phase === 'fly' && h.gate === g && h.correctLane >= 0;
  }, n);
  return hook(page);
}

async function flightStats(page: Page) {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('mathbee-coach', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const raw: string = await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get('app'); q.onsuccess = () => res(q.result); });
    const st = JSON.parse(raw);
    const p = st.profiles.find((x: { id: string }) => x.id === st.activeProfileId);
    return { flight: p.flight as { runs: number; gates: number; firstTry: number; helped: number } | undefined, keys: (p.awarded as string[]).filter((k) => k.startsWith('flight:')).length };
  });
}

async function openFromWorld1(page: Page) {
  await page.getByTestId('adventure-btn').click();
  await page.getByTestId('adv-world-w1').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  await page.getByTestId('flight-w1').click();
  await expect(page.getByTestId('flight')).toBeVisible();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'meadow');
  await expect(page.getByTestId('flight-intro')).toBeVisible();
  await page.getByTestId('flight-go').click();
}

test('Bee Flight from World 1: a full run, the look sheet, results, nectar paid once, back pauses', async ({ page }) => {
  test.setTimeout(180_000);
  await newProfile(page);
  const before = await nectar(page);
  await openFromWorld1(page);

  // back (Escape) during a run opens the pause sheet; Resume carries on
  await atGate(page, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('resume')).toBeVisible();
  await expect(page.getByTestId('flight')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('resume')).toHaveCount(0);

  for (let g = 0; g < 8; g++) {
    const h = await atGate(page, g);
    await expect(page.getByTestId('flight-prompt')).toBeVisible();
    await expect(page.getByTestId('flight-gate-count')).toContainText(`${g + 1}/8`);
    if (g === 2) {
      // a different gate: Buzzy lands and the "Let's look" sheet shows the three choices again
      const other = [0, 1, 2].find((l) => l !== h.correctLane)!;
      await page.evaluate((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.pass(l), other);
      await expect(page.getByTestId('flight-look')).toBeVisible();
      await expect(page.getByTestId('flight-look')).not.toContainText(/wrong/i);
      await page.getByTestId(`look-choice-${h.correctLane}`).click();
      await expect(page.getByTestId('flight-look')).toHaveCount(0);
      continue;
    }
    // steer with the big ◀ ▶ buttons to the right lane, then fly through it now
    const steps = h.correctLane - h.lane;
    for (let i = 0; i < Math.abs(steps); i++) await page.getByTestId(steps < 0 ? 'lane-left' : 'lane-right').click();
    await page.waitForFunction((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.lane === l, h.correctLane);
    await page.evaluate((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.pass(l), h.correctLane);
  }

  await expect(page.getByTestId('flight-results')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('flight-blooms')).toBeVisible();
  await expect(page.getByTestId('flight-earned')).toBeVisible();
  expect(await nectar(page)).toBe(before + 8);
  const st = await flightStats(page);
  expect(st.keys).toBe(8);
  expect(st.flight).toMatchObject({ runs: 1, gates: 8, firstTry: 7, helped: 1 });

  // results are recorded once: a reload of the stats after a moment shows no extra run or nectar
  await page.waitForTimeout(500);
  expect(await nectar(page)).toBe(before + 8);
  expect((await flightStats(page)).flight?.runs).toBe(1);

  // back to the world map
  await page.getByTestId('flight-back').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
});

test('Bee Flight in 3D: "Fly again" flies a second run; Buzzy waits at a row until the child chooses', async ({ page }) => {
  test.setTimeout(180_000);
  await newProfile(page);
  await openFromWorld1(page);
  await expect(page.getByTestId('flight-stage')).toHaveAttribute('data-3d', '1');
  // first run: through the hook, quickly
  for (let g = 0; g < 8; g++) {
    const h = await atGate(page, g);
    await page.evaluate((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.pass(l), h.correctLane);
  }
  // the 3D bee flies on to the friend and the results show
  await expect(page.getByTestId('flight-results')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('flight-again').click();
  await expect(page.getByTestId('flight-results')).toHaveCount(0);

  // second run, no hook: the world moves again and Buzzy hovers at the first row (no timer)
  const h = await atGate(page, 0);
  await expect(page.getByTestId('flight-wait')).toBeVisible({ timeout: 40_000 });
  expect((await hook(page)).gate).toBe(0);
  await expect(page.getByTestId('flight-gate-count')).toContainText('1/8');
  // a tap on the right lane (even the one Buzzy is in) flies through it
  await page.getByTestId(`lane-${h.correctLane}`).click();
  await expect(page.getByTestId('flight-gate-count')).toContainText('2/8', { timeout: 20_000 });
  await expect(page.getByTestId('flight-look')).toHaveCount(0);
});

/** Same as honeyLane() in src/three/Flight3D.tsx: the lane of a row's honey trail. */
const honeyLaneOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % 3; };

test('Bee Flight in 3D: the honey trail is caught by steering, and Buzzy still waits for a choice', async ({ page }) => {
  test.setTimeout(150_000);
  await newProfile(page);
  const before = await nectar(page);
  await openFromWorld1(page);
  await expect(page.getByTestId('flight-stage')).toHaveAttribute('data-3d', '1');
  const h = await atGate(page, 0);
  const lane = honeyLaneOf(h.question!.id);
  const steps = lane - h.lane;
  for (let i = 0; i < Math.abs(steps); i++) await page.getByTestId(steps < 0 ? 'lane-left' : 'lane-right').click();
  await expect(page.getByTestId('flight-honey')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('flight-honey')).toContainText('4');
  // steering for honey is not an answer: Buzzy hovers at the row until the child chooses
  await expect(page.getByTestId('flight-wait')).toBeVisible({ timeout: 40_000 });
  expect((await hook(page)).gate).toBe(0);
  await page.getByTestId(`lane-${h.correctLane}`).click();
  await expect(page.getByTestId('flight-gate-count')).toContainText('2/8', { timeout: 20_000 });
  await expect(page.getByTestId('flight-look')).toHaveCount(0);
  // honey is a tally only: nectar is still 1 per gate
  await expect.poll(() => nectar(page)).toBe(before + 1);
});

test('Bee Flight under reduced motion: the calm 2D gates, a full run, results', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await newProfile(page);
  const before = await nectar(page);

  // the garden map's quick row opens the flight of the current world (meadow at first)
  await page.getByTestId('flight-btn').click();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'meadow');
  await page.getByTestId('flight-go').click();
  await expect(page.getByTestId('flight-stage')).toHaveAttribute('data-3d', '0');
  for (let g = 0; g < 8; g++) {
    const h = await atGate(page, g);
    // the 2D view: three big gate buttons, tapped directly
    await expect(page.getByTestId('gate-0')).toBeVisible();
    const box = await page.getByTestId(`gate-${h.correctLane}`).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    await page.getByTestId(`gate-${h.correctLane}`).click();
  }
  await expect(page.getByTestId('flight-results')).toBeVisible({ timeout: 20_000 });
  expect(await nectar(page)).toBe(before + 8);
  // the results card: this flight's stars (8/8 first try → 3), a next goal, and a garden button;
  // the first flight in a world is never a "new best"
  await expect(page.getByTestId('flight-stars')).toHaveAttribute('data-n', '3');
  await expect(page.getByTestId('flight-next-goal')).toBeVisible();
  await expect(page.getByTestId('flight-results-garden')).toBeVisible();
  await expect(page.getByTestId('flight-new-best')).toHaveCount(0);

  // from the garden (a theme, not a world id) back leads to the garden map
  await page.getByTestId('flight-back').click();
  await expect(page.getByTestId('flight-btn')).toBeVisible();

  // the garden's Bee Flight card now shows the meadow's stars (8/8 first try → 3) and best streak
  const card = page.getByTestId('flight-card');
  await expect(card).toHaveAttribute('data-world', 'meadow');
  await expect(page.getByTestId('flight-card-stars')).toHaveAttribute('data-stars', '3');
  await expect(page.getByTestId('flight-card-streak')).toContainText('8');
  // Change world picks another world; it has no stars yet, and Fly opens that world
  await page.getByTestId('flight-card-world').click();
  await expect(page.getByTestId('flight-world-river')).toBeVisible();
  await page.getByTestId('flight-world-river').click();
  await expect(card).toHaveAttribute('data-world', 'river');
  await expect(page.getByTestId('flight-card-stars')).toHaveCount(0);
  await expect(page.getByTestId('flight-card-streak')).toHaveCount(0);
  // the picker's back closes it without changing the world
  await page.getByTestId('flight-card-world').click();
  await page.getByTestId('flight-world-back').click();
  await expect(card).toHaveAttribute('data-world', 'river');
  await page.getByTestId('flight-btn').click();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'river');
  await ctx.close();
});

async function calmFlight(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await newProfile(page);
  return { ctx, page };
}

test('Bee Flight pause sheet: restart, sound, change world and my garden', async ({ browser }) => {
  test.setTimeout(150_000);
  const { ctx, page } = await calmFlight(browser);
  const before = await nectar(page);
  await page.getByTestId('flight-btn').click();
  await page.getByTestId('flight-go').click();

  // fly two gates, then Restart run: back to gate 1 with fresh gates, nothing paid twice
  for (let g = 0; g < 2; g++) {
    const h = await atGate(page, g);
    await page.getByTestId(`gate-${h.correctLane}`).click();
  }
  const first = (await atGate(page, 2)).question?.id;
  expect(await nectar(page)).toBe(before + 2);
  await page.getByTestId('pause').click();
  await page.getByTestId('flight-restart').click();
  await expect(page.getByTestId('resume')).toHaveCount(0);
  const h0 = await atGate(page, 0);
  expect(h0.question?.id).not.toBe(first);
  await expect(page.getByTestId('flight-gate-count')).toContainText('1/8');
  expect(await nectar(page)).toBe(before + 2);

  // sound toggles the existing setting
  await page.getByTestId('pause').click();
  const sound = page.getByTestId('flight-sound');
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('music-toggle')).toBeVisible();

  // Change world: the picker lists all 7 worlds; back returns to the sheet; a pick starts that world
  await page.getByTestId('flight-change-world').click();
  for (const w of ['meadow', 'river', 'orchard', 'ice', 'trail', 'town', 'garden']) await expect(page.getByTestId(`flight-world-${w}`)).toBeVisible();
  await page.getByTestId('flight-world-back').click();
  await expect(page.getByTestId('flight-restart')).toBeVisible();
  await page.getByTestId('flight-change-world').click();
  await page.getByTestId('flight-world-orchard').click();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'orchard');
  await expect(page.getByTestId('flight-intro')).toBeVisible();
  await page.getByTestId('flight-go').click();
  await atGate(page, 0);

  // My garden ends the run kindly and opens Restore garden
  await page.getByTestId('pause').click();
  await page.getByTestId('flight-garden').click();
  await expect(page.locator('.screen.restore')).toBeVisible();
  await expect(page.getByTestId('flight')).toHaveCount(0);
  // the unfinished run is not recorded
  expect((await flightStats(page)).flight?.runs ?? 0).toBe(0);
  await ctx.close();
});

test('Bee Flight on the Logic trail: an odd-one-out gate appears and can be flown', async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await calmFlight(browser);
  await page.getByTestId('flight-card-world').click();
  await page.getByTestId('flight-world-trail').click();
  await page.getByTestId('flight-btn').click();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'trail');
  await page.getByTestId('flight-go').click();

  let seen = false;
  for (let run = 0; run < 4 && !seen; run++) {
    if (run > 0) {
      await expect(page.getByTestId('flight-results')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('flight-again').click();
    }
    for (let g = 0; g < 8; g++) {
      const h = await atGate(page, g);
      const q = h.question as unknown as { skill: string; choices: { correct: boolean }[] };
      if (q.skill === 'odd' && !seen) {
        seen = true;
        await expect(page.getByTestId('flight-prompt')).toContainText('Which one is different?');
        expect(q.choices.filter((c) => c.correct)).toHaveLength(1);
        for (let l = 0; l < 3; l++) await expect(page.getByTestId(`gate-${l}`)).toBeVisible();
      }
      await page.getByTestId(`gate-${h.correctLane}`).click();
    }
  }
  expect(seen).toBe(true);
  await expect(page.getByTestId('flight-results')).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

test('Bee Flight from the garden card: changing world in the pause sheet keeps Stop on the garden map; A/D steer and P pauses', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await calmFlight(browser);
  await page.getByTestId('flight-btn').click();
  await page.getByTestId('flight-go').click();
  await atGate(page, 0);

  // keyboard: D steers right, A steers left, P opens and closes the pause sheet
  const lane0 = (await hook(page)).lane;
  await page.locator('body').press('d');
  await page.waitForFunction((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.lane !== l, lane0);
  await page.locator('body').press('a');
  await page.waitForFunction((l) => (window as unknown as { __mathbeeFlight: Hook }).__mathbeeFlight.lane === l, lane0);
  await page.locator('body').press('p');
  await expect(page.getByTestId('resume')).toBeVisible();

  // change to Clock Town (World 6, still closed for a new player), then Stop: back on the garden map
  await page.getByTestId('flight-change-world').click();
  await page.getByTestId('flight-world-town').click();
  await expect(page.getByTestId('flight')).toHaveAttribute('data-world', 'town');
  await page.getByTestId('flight-go').click();
  await atGate(page, 0);
  await page.getByTestId('pause').click();
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('flight-card')).toBeVisible();
  await expect(page.getByTestId('world-map')).toHaveCount(0);
  await ctx.close();
});
