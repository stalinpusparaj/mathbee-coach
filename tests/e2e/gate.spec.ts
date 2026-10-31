import { test, expect, type Page } from '@playwright/test';

/**
 * Parent gate, story intro and the grown-up area (WP6).
 * Under `?e2e` (web builds only) the gate root carries the expected answer in `data-answer`.
 */

/** Make a new player; the story intro comes first, then the button practice. */
async function newPlayer(page: Page, name = 'Gate') {
  await page.goto('/?e2e');
  await page.getByTestId('play').click();
  await page.getByTestId('nickname').fill(name);
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click(); // appears after 2 s; click() waits for it
  await page.getByTestId('skip-controls').click();
  await expect(page.getByTestId('mission')).toBeVisible();
}

async function typeOnGate(page: Page, n: number | string) {
  for (const d of String(n)) await page.getByTestId(`gate-key-${d}`).click();
}

/** Answer the gate correctly (reads the e2e-only expected answer). */
async function passGate(page: Page) {
  const gate = page.getByTestId('parent-gate');
  await expect(gate).toBeVisible();
  const answer = await gate.getAttribute('data-answer');
  expect(answer).toMatch(/^\d{3}$/);
  await typeOnGate(page, answer!);
  await page.getByTestId('gate-submit').click();
}

/** A guaranteed-wrong answer for the current question. */
async function wrongAnswer(page: Page): Promise<string> {
  const answer = Number(await page.getByTestId('parent-gate').getAttribute('data-answer'));
  return String(answer === 999 ? 998 : answer + 1);
}

test('the grown-up area is behind the gate; the right answer opens it', async ({ page }) => {
  await newPlayer(page);
  await page.getByTestId('parent-hold').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await expect(page.getByTestId('parent')).toHaveCount(0);
  // the instruction is shown in both languages
  await expect(page.getByTestId('parent-gate')).toContainText('For grown-ups');
  await expect(page.getByTestId('parent-gate')).toContainText('பெரியவர்களுக்கு');
  await expect(page.getByTestId('gate-question')).toContainText('×');

  await passGate(page);
  await expect(page.getByTestId('parent')).toBeVisible();
  await expect(page.getByTestId('home-ideas')).toBeVisible();
  // moving between grown-up screens does not ask again
  await page.getByTestId('to-settings').click();
  await expect(page.getByTestId('grown-up-settings')).toBeVisible();
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);

  // leaving the grown-up area closes the gate again
  await page.getByTestId('back').click();
  await page.getByTestId('back').click();
  await expect(page.getByTestId('mission')).toBeVisible();
  await page.getByTestId('parent-hold').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
});

test('a wrong answer brings a new question; three wrong answers rest the gate', async ({ page }) => {
  await newPlayer(page);
  await page.getByTestId('parent-hold').click();
  const gate = page.getByTestId('parent-gate');
  const status = page.getByTestId('gate-status');

  await typeOnGate(page, await wrongAnswer(page));
  await page.getByTestId('gate-submit').click();
  await expect(status).toContainText('2 tries left');
  await expect(page.getByTestId('parent')).toHaveCount(0);

  for (let i = 0; i < 2; i++) {
    await typeOnGate(page, await wrongAnswer(page));
    await page.getByTestId('gate-submit').click();
  }
  await expect(status).toContainText(/wait \d+ seconds/);
  await expect(page.getByTestId('gate-key-5')).toBeDisabled();
  await expect(page.getByTestId('gate-submit')).toBeDisabled();

  // closing and reopening does not reset the rest
  await page.getByTestId('gate-cancel').click();
  await expect(page.getByTestId('mission')).toBeVisible();
  await page.getByTestId('parent-hold').click();
  await expect(gate).toBeVisible();
  await expect(page.getByTestId('gate-key-5')).toBeDisabled();
});

test('gate keypad: delete and clear edit the typed answer; keyboard digits work', async ({ page }) => {
  await newPlayer(page);
  await page.getByTestId('parent-hold').click();
  const display = page.getByTestId('gate-display');
  await typeOnGate(page, '123');
  await expect(display).toHaveText('123');
  await page.getByTestId('gate-del').click();
  await expect(display).toHaveText('12');
  await page.getByTestId('gate-clear').click();
  await expect(display).toHaveText('?');
  const answer = (await page.getByTestId('parent-gate').getAttribute('data-answer'))!;
  await page.keyboard.type(answer);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('parent')).toBeVisible();
});

/** Reload to the garden map, leaving any session or gated screen an earlier tap opened. */
async function backToMap(page: Page) {
  await page.goto('/?e2e');
  await page.getByTestId('continue').click();
  const quick = { timeout: 1500 };
  if (await page.getByTestId('parent-gate').isVisible().catch(() => false)) await page.getByTestId('gate-cancel').click();
  if (await page.getByTestId('pause').isVisible().catch(() => false)) {
    await page.getByTestId('pause').click();
    await page.getByTestId('stop').click(quick).catch(() => undefined);
    await page.getByTestId('to-map').click(quick).catch(() => undefined);
  }
  // a stopped adventure level returns to its world map: walk back to the garden
  for (let i = 0; i < 3 && !(await page.getByTestId('mission').isVisible().catch(() => false)); i++) {
    await page.getByTestId('back').first().click(quick).catch(() => undefined);
  }
  await expect(page.getByTestId('mission')).toBeVisible();
}

test('every gated route shows the gate when reached from the child area', async ({ page }) => {
  await newPlayer(page);
  // tap every labelled button on the garden map except the grown-up entry; none may reveal a
  // grown-up screen without the gate
  const ids = await page.locator('button[data-testid]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!).filter((id) => id !== 'parent-hold'));
  for (const id of ids) {
    await backToMap(page);
    const btn = page.getByTestId(id).first();
    if (!(await btn.isVisible().catch(() => false)) || !(await btn.isEnabled().catch(() => false))) continue;
    await btn.click();
    await page.waitForTimeout(150);
    const gateShown = await page.getByTestId('parent-gate').count();
    if (!gateShown) {
      await expect(page.getByTestId('parent'), `button ${id}`).toHaveCount(0);
      await expect(page.getByTestId('grown-up-settings'), `button ${id}`).toHaveCount(0);
      await expect(page.locator('.screen.tests, .screen.print, [data-testid="mock"], [data-testid="mock-results"]'), `button ${id}`).toHaveCount(0);
    }
  }
});

test('grown-up settings: limit, open-all, haptics, privacy page in the app', async ({ page }) => {
  await newPlayer(page);
  await page.getByTestId('parent-hold').click();
  await passGate(page);
  await page.getByTestId('to-settings').click();
  await page.getByTestId('daily-limit').selectOption('20');
  await page.getByTestId('open-all').check();
  await page.getByTestId('haptics-setting').uncheck();
  await page.reload();
  // a reload lands on the welcome screen; settings were saved
  await page.getByTestId('continue').click();
  await page.getByTestId('parent-hold').click();
  await passGate(page);
  await page.getByTestId('to-settings').click();
  await expect(page.getByTestId('daily-limit')).toHaveValue('20');
  await expect(page.getByTestId('open-all')).toBeChecked();
  await expect(page.getByTestId('haptics-setting')).not.toBeChecked();

  await page.getByTestId('privacy-link').click();
  await expect(page.getByTestId('privacy-sheet')).toBeVisible();
  const frame = page.frameLocator('.privacy-frame');
  await expect(frame.locator('h1')).toContainText('Privacy Policy');
  await expect(frame.locator('body')).toContainText('We collect no personal information');
  await page.getByTestId('privacy-close').click();
  await expect(page.getByTestId('privacy-sheet')).toHaveCount(0);
});

test('the privacy page loads no external resources', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) external.push(r.url()); });
  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toContainText('Privacy Policy');
  expect(external).toEqual([]);
});

test('the story intro has 5 pages and ends at the button practice', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByTestId('play').click();
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  // the skip button is not there straight away
  await expect(page.getByTestId('intro-skip')).toHaveCount(0);
  for (let i = 0; i < 4; i++) await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-done').click();
  await expect(page.getByTestId('skip-controls')).toBeVisible();
});
