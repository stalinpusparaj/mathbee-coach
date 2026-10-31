import { test, expect, type Page } from '@playwright/test';
import { answerCurrent, nectar, newProfile } from './helpers';

/**
 * Adventure Mode end to end: the garden map's main action starts the next level, a finished
 * level blooms (1–3 flowers), opens the next bud, survives a reload, and a same-day replay of
 * the same level pays no per-question nectar again.
 */

/** Answer every question of the running level correctly until the level's blooms show. */
async function playToResults(page: Page) {
  await expect(page.getByTestId('session')).toBeVisible();
  for (let i = 0; i < 14; i++) {
    if (await page.getByTestId('level-results').isVisible()) break;
    await answerCurrent(page, true);
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('level-results')).toBeVisible();
}

test('w1-01 from the garden map: blooms, the next bud opens, progress survives a reload, replays pay no nectar twice', async ({ page }) => {
  test.setTimeout(180_000);
  await newProfile(page);

  // the adventure is the main way forward on the garden map
  const next = page.getByTestId('adventure-next');
  await expect(next).toBeVisible();
  await expect(next).toContainText(/First Flowers/);
  await next.click();
  await playToResults(page);
  await expect(page.getByTestId('level-results')).toHaveAttribute('data-level', 'w1-01');

  const blooms = Number(await page.getByTestId('run-blooms').getAttribute('data-blooms'));
  expect(blooms).toBeGreaterThanOrEqual(1);
  expect(blooms).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('new-bloom')).toBeVisible();
  await expect(page.getByTestId('level-nectar')).toBeVisible();
  // no trophy or "perfect" language anywhere on the results
  await expect(page.getByTestId('level-results')).not.toContainText(/perfect|trophy/i);
  const afterFirst = await nectar(page);
  expect(afterFirst).toBeGreaterThan(0);

  // the world map: w1-01 is done, w1-02 is open
  await page.getByTestId('to-world').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  await expect(page.getByTestId('level-w1-01')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('level-w1-02')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('level-w1-03')).toHaveAttribute('data-state', 'locked');

  // reload: progress is kept and the garden map now suggests w1-02
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('adventure-next')).toContainText(/Empty Basket/);
  await page.getByTestId('adventure-btn').click();
  await expect(page.getByTestId('adventure')).toBeVisible();
  await page.getByTestId('adv-world-w1').click();
  await expect(page.getByTestId('level-w1-02')).toHaveAttribute('data-state', 'open');

  // replay w1-01 the same day through its intro card: no per-question or session nectar again
  await page.getByTestId('level-w1-01').click();
  await expect(page.getByTestId('level-intro')).toBeVisible();
  await page.getByTestId('level-go').click();
  await playToResults(page);
  const blooms2 = Number(await page.getByTestId('run-blooms').getAttribute('data-blooms'));
  // all answers were right first time both times, so no new bloom and no star bonus either
  expect(blooms2).toBe(blooms);
  expect(await nectar(page)).toBe(afterFirst);
});

test('a closed bud never opens a level; back closes the intro card, then returns to the worlds', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('adventure-btn').click();
  await expect(page.getByTestId('adv-world-w1')).toBeVisible();
  await page.getByTestId('adv-world-w1').click();
  await expect(page.getByTestId('world-map')).toBeVisible();
  // locked buds look like closed buds (never padlocks) and do not open the intro card
  await page.getByTestId('level-w1-05').click({ force: true }); // aria-disabled: a gentle note, nothing opens
  await expect(page.getByTestId('level-intro')).toHaveCount(0);
  await expect(page.getByTestId('world-map')).not.toContainText('🔒');
  // the open first bud shows the friend's intro card; Escape (back) closes it
  await page.getByTestId('level-w1-01').click();
  await expect(page.getByTestId('level-intro')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('level-intro')).toHaveCount(0);
  await expect(page.getByTestId('world-map')).toBeVisible();
  // list view shows the same levels
  await page.getByTestId('list-toggle').click();
  await expect(page.getByTestId('level-w1-01')).toBeVisible();
});
