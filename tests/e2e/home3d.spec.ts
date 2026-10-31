import { test, expect } from '@playwright/test';
import { newProfile } from './helpers';

/**
 * The live 3D home scene behind the Welcome card: Buzzy over the current flight world's path.
 * It draws (WebGL draw calls > 0), never takes taps from the card, follows the chosen flight
 * world, and under reduced motion the painted picture shows instead.
 */

test('home 3D scene draws behind the Welcome card and the card stays clickable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?e2e');
  const scene = page.getByTestId('home-3d');
  await expect(scene).toHaveAttribute('data-3d', '1');
  await expect(scene).toHaveAttribute('data-world', 'meadow');
  await expect(scene).toHaveClass(/\bon\b/, { timeout: 20_000 });
  await expect.poll(async () => Number(await scene.getAttribute('data-draw-calls')), { timeout: 10_000 }).toBeGreaterThan(0);
  // the canvas is decoration only: it is hidden from assistive tech and the card is on top
  await expect(scene.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('nickname')).toBeVisible();
  expect(errors).toEqual([]);
});

test('home 3D scene shows the world chosen on the garden card', async ({ page }) => {
  await newProfile(page);
  await page.getByTestId('flight-card-world').click();
  await page.getByTestId('flight-world-ice').click();
  await expect(page.getByTestId('flight-card')).toHaveAttribute('data-world', 'ice');
  await page.waitForTimeout(800); // let the save reach storage
  await page.goto('/?e2e');
  const scene = page.getByTestId('home-3d');
  await expect(scene).toHaveAttribute('data-world', 'ice');
  await expect(scene).toHaveClass(/\bon\b/, { timeout: 20_000 });
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('flight-card')).toBeVisible();
});

test('reduced motion: no 3D home scene, the painted picture shows and the card works', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/?e2e');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.waitForTimeout(1500); // the lazy 3D chunk would have arrived by now
  await expect(page.getByTestId('home-3d')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  const bg = await page.locator('.screen.welcome').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('url(');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('nickname')).toBeVisible();
  await ctx.close();
});
