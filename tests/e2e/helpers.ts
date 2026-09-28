import { expect, type Page } from '@playwright/test';

type Answer =
  | { kind: 'number'; value: number }
  | { kind: 'choice'; value: string; options: { id: string }[] }
  | { kind: 'order'; value: string[] }
  | { kind: 'fields'; fields: { id: string; value: number }[] }
  | { kind: 'time'; h: number; m: number };

export async function current(page: Page): Promise<{ answer: Answer; scene: { type: string; startH?: number; startM?: number; mode?: string }; templateId: string }> {
  await page.waitForFunction(() => (window as unknown as { __mathbeeAnswer?: unknown }).__mathbeeAnswer);
  return page.evaluate(() => (window as unknown as { __mathbeeAnswer: never }).__mathbeeAnswer);
}

async function typeNumber(page: Page, n: number) {
  for (const d of String(n)) await page.getByTestId(`key-${d}`).first().click();
}

/** Give the correct (or a deliberately wrong) response to the current question and press Check. */
export async function answerCurrent(page: Page, correct = true) {
  const { answer: a, scene } = await current(page);
  switch (a.kind) {
    case 'number':
      await page.getByRole('button', { name: /clear|அழி/i }).first().click().catch(() => undefined);
      await typeNumber(page, correct ? a.value : a.value + 1);
      break;
    case 'choice': {
      const id = correct ? a.value : a.options.find((o) => o.id !== a.value)!.id;
      await page.getByTestId(`choice-${id}`).click();
      break;
    }
    case 'order': {
      const order = correct ? a.value : [...a.value].reverse();
      for (const id of order) await page.getByTestId(`order-${id}`).click();
      break;
    }
    case 'fields':
      for (const f of a.fields) {
        await page.getByTestId(`field-${f.id}`).click();
        await typeNumber(page, correct ? f.value : f.value + 1);
      }
      break;
    case 'time': {
      const clock = page.getByRole('slider');
      await clock.focus();
      const h0 = scene.startH ?? 12;
      const m0 = scene.startM ?? 0;
      const targetH = correct ? a.h : (a.h % 12) + 1;
      const dh = (((targetH - h0) % 12) + 12) % 12;
      for (let i = 0; i < dh; i++) await page.keyboard.press('ArrowUp');
      for (let i = 0; i < (a.m - m0 + 60) % 60 / 5; i++) await page.keyboard.press('ArrowRight');
      // the keypad listener is not involved; make sure a response was recorded even if no move was needed
      if (dh === 0 && a.m === m0) { await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown'); }
      break;
    }
  }
  await page.getByTestId('check').click();
}

export async function newProfile(page: Page, name = 'Ari') {
  await page.goto('/?e2e');
  await page.getByTestId('play').click();
  await page.getByTestId('nickname').fill(name);
  await page.getByTestId('create-profile').click();
  await page.getByTestId('skip-controls').click();
  await expect(page.getByTestId('mission')).toBeVisible();
}

export async function nectar(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('mathbee-coach', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const raw: string = await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get('app'); q.onsuccess = () => res(q.result); });
    const st = JSON.parse(raw);
    return st.profiles.find((p: { id: string }) => p.id === st.activeProfileId).nectar;
  });
}
