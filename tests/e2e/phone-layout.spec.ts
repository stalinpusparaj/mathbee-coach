import { test, expect, type Page } from '@playwright/test';
import { newProfile } from './helpers';

/**
 * Phones and tablets, portrait and landscape: no sideways scrolling on the child's screens, and
 * every control the child can tap is at least 48 px in both directions (answer controls aim for 56).
 */
const VIEWPORTS = [
  { name: 'phone-360x640', size: { width: 360, height: 640 }, mobile: true },
  { name: 'phone-412x915', size: { width: 412, height: 915 }, mobile: true },
  { name: 'landscape-915x412', size: { width: 915, height: 412 }, mobile: true },
  { name: 'tablet-768x1024', size: { width: 768, height: 1024 }, mobile: false },
] as const;

const MIN = 48;

async function noSideScroll(page: Page, label: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
}

/** Every visible tappable control on the screen, with its size. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input[type="checkbox"], select');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') continue;
      // layout size, not the on-screen box: a pop-in animation may still be scaling the element
      const w = el.offsetWidth || r.width;
      const h = el.offsetHeight || r.height;
      // allow a pixel of rounding
      if (w < min - 1 || h < min - 1) {
        out.push(`${el.dataset.testid ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)} ${Math.round(w)}x${Math.round(h)}`);
      }
    }
    return out;
  }, MIN);
}

async function check(page: Page, label: string) {
  await noSideScroll(page, label);
  expect(await smallTargets(page), `${label}: targets under ${MIN}px`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test(`layout ${vp.name}: garden map, adventure and a level fit and are easy to tap`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: vp.size, isMobile: vp.mobile, hasTouch: true });
    const page = await ctx.newPage();
    await newProfile(page);
    await check(page, 'map');
    await page.screenshot({ path: `test-results/phone-${vp.name}-map.png`, animations: 'disabled' });

    await page.getByTestId('adventure-btn').click();
    await expect(page.getByTestId('adventure')).toBeVisible();
    await check(page, 'worlds');

    await page.getByTestId('adv-world-w1').click();
    await expect(page.getByTestId('world-map')).toBeVisible();
    await check(page, 'world-map');
    await page.screenshot({ path: `test-results/phone-${vp.name}-world.png`, animations: 'disabled' });

    await page.getByTestId('level-w1-01').click();
    await expect(page.getByTestId('level-intro')).toBeVisible();
    await check(page, 'level-intro');
    await page.getByTestId('level-go').click();
    await expect(page.getByTestId('session')).toBeVisible();
    await check(page, 'session');
    await page.screenshot({ path: `test-results/phone-${vp.name}-session.png`, animations: 'disabled' });
    // the answer controls stay on screen: Check is reachable without scrolling the page
    const box = await page.getByTestId('check').boundingBox();
    expect(box, 'check button').not.toBeNull();
    expect(box!.y + box!.height, 'check button within the viewport').toBeLessThanOrEqual(vp.size.height + 1);

    await page.getByTestId('pause').click();
    await check(page, 'pause-sheet');
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('world-map')).toBeVisible();
    await ctx.close();
  });
}
