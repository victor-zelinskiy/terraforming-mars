import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {cinematicBeat, press} from './consoleStart';
import {campaignBase, createCampaign, seedIdentity} from './campaignFixtures';

/**
 * CAMPAIGN MISSION MODIFIERS — the roguelike layer of the route (2026-11-06).
 *   A · the creator: in a campaign with «Случайные цели и награды» on, the dial «Шанс на миссию» stands right under the
 *       rule; ◄ ► step it along 10 · 15 · 20 · 30 · 40 · 50 %, A cycles.
 *   B · the map: every mission whose slot rolled the modifier (Hollandia always) wears the «Случайные цели» badge — and
 *       only those; X on such a card names the modifier in the inspect.
 * The roll itself is unit-tested (`tests/campaign/missionModifiers.spec.ts`); here the deal is the CLASS: a route is
 * created at 50 % until at least one slot carries the modifier, and the badges are matched against the server's model.
 */

const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'};
test.use({viewport: TV.viewport});

async function shot(page: Page, name: string): Promise<void> {
  const dir = path.join('screenshots', 'campaign-modifiers', TV.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function modifiedSlots(request: APIRequestContext, id: string): Promise<Array<number>> {
  const res = await request.get(`${campaignBase()}/api/campaign?id=${id}&name=Alice`);
  expect(res.ok(), await res.text()).toBeTruthy();
  const model = await res.json() as {missions: Array<{slot: number, modifiers?: Array<{id: string}>}>};
  return model.missions.filter((m) => (m.modifiers ?? []).some((x) => x.id === 'randomMA')).map((m) => m.slot);
}

test('A — the creator: «Шанс на миссию» under the rule, stepped by ◄ ► and cycled by A', async ({page}) => {
  test.setTimeout(180_000);
  await seedIdentity(page, 'Alice');
  await page.addInitScript((s) => {
    if (window.localStorage.getItem('tm_last_game_settings') === null) {
      window.localStorage.setItem('tm_last_game_settings', JSON.stringify(s));
    }
  }, {
    sessionMode: 'campaign', gameMode: 'multiplayer',
    players: [{name: 'Alice', color: 'blue'}, {name: 'Bruno', color: 'red'}],
    rules: {randomMilestonesAwards: true}, campaignRandomMAChance: 30,
  });
  await page.goto(`${campaignBase()}/?x=1${TV.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
    await press(page, 'ArrowDown', 120);
  }
  await press(page, 'Enter', 300);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await expect(page.locator('.cm-mode__tile--cursor')).toHaveClass(/cm-mode__tile--campaign/);
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
  for (let i = 0; i < 6 && await page.locator('.cm-rules').count() === 0; i++) {
    await press(page, 'KeyE', 400);
  }
  const dial = page.locator('[data-rule-sub="maChance"]');
  await expect(dial, 'the dial stands in a campaign with the rule on').toHaveCount(1, {timeout: 15_000});
  await expect(dial.locator('.cm-rule__dial-value')).toHaveText('30%');
  // Right under its parent rule — in its column, the next row down (the wide grid and the list alike).
  const parent = page.locator('.cm-rule').filter({hasText: 'Случайные цели и награды'}).first();
  const [p, d] = [await parent.boundingBox(), await dial.boundingBox()];
  expect(p !== null && d !== null).toBe(true);
  expect(d!.y, 'the dial stands below its rule').toBeGreaterThan(p!.y + p!.height - 2);
  expect(d!.x + d!.width, 'the dial shares the column of its rule').toBeGreaterThan(p!.x + p!.width - 4);
  expect(d!.x + d!.width).toBeLessThan(p!.x + p!.width + 4);

  // Walk the cursor onto the dial by GEOMETRY (the deck is a grid on the wide creator, a list elsewhere).
  for (let i = 0; i < 12; i++) {
    const step = await page.evaluate(() => {
      const want = document.querySelector('[data-rule-sub="maChance"]')?.getBoundingClientRect();
      const at = document.querySelector('.cm-rules .cm-row--cursor')?.getBoundingClientRect();
      if (want === undefined || at === undefined) {
        return 'none';
      }
      if (Math.abs(want.top - at.top) < 4 && Math.abs(want.right - at.right) < 4) {
        return 'here';
      }
      if (Math.abs(want.right - at.right) >= 4) {
        return want.right > at.right ? 'ArrowRight' : 'ArrowLeft';
      }
      return want.top > at.top ? 'ArrowDown' : 'ArrowUp';
    });
    if (step === 'here' || step === 'none') {
      break;
    }
    await press(page, step, 180);
  }
  await expect(dial).toHaveClass(/cm-row--cursor/);
  await press(page, 'ArrowRight', 200);
  await expect(dial.locator('.cm-rule__dial-value')).toHaveText('40%');
  await expect(page.locator('.cm-rules'), '◄ ► dial the value — the deck stays').toHaveCount(1);
  await press(page, 'Enter', 200);
  await expect(dial.locator('.cm-rule__dial-value')).toHaveText('50%');
  await press(page, 'Enter', 200);
  await expect(dial.locator('.cm-rule__dial-value')).toHaveText('10%');
  await press(page, 'ArrowLeft', 200);
  await expect(dial.locator('.cm-rule__dial-value')).toHaveText('10%');
  await press(page, 'ArrowRight', 200);
  await shot(page, 'a-creator-dial');
});

test('B — the map: the badge on exactly the modified missions, named in the inspect', async ({page, request}) => {
  test.setTimeout(180_000);
  let id = '';
  let slots: Array<number> = [];
  for (let i = 0; i < 12 && slots.length === 0; i++) {
    id = (await createCampaign(request, {randomMA: 'All milestones and awards'}, {randomMAChance: 50})).id;
    slots = await modifiedSlots(request, id);
  }
  expect(slots.length, 'a 50 % route rolled at least one modifier in 12 tries').toBeGreaterThan(0);

  await seedIdentity(page, 'Alice');
  await page.goto(`${campaignBase()}/campaign?id=${id}${TV.query}`);
  await page.waitForSelector('.cmap__card', {timeout: 30_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  const cards = page.locator('.cmap__card');
  await expect(cards).toHaveCount(4);
  await expect.poll(async () => {
    const out: Array<number> = [];
    for (let i = 0; i < 4; i++) {
      if (await cards.nth(i).locator('[data-mission-modifier="randomMA"]').count() > 0) {
        out.push(i);
      }
    }
    return out;
  }, {message: 'the badges stand on the slots the server rolled'}).toEqual(slots);
  await expect(page.locator('[data-mission-modifier="randomMA"]').first()).toContainText(/Случайные цели/i);
  // Zero layout: every card of the route keeps one height whatever it rolled.
  const heights = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(new Set(heights).size, `card heights ${heights.join(', ')}`).toBe(1);
  await cinematicBeat(page, 1600, 'the route reveal + the one-shot seal finish before the frame');
  await shot(page, 'b-map-badges');

  for (let i = 0; i < slots[0]; i++) {
    await press(page, 'ArrowRight', 300);
  }
  await press(page, 'KeyX', 600);
  await expect(page.locator('.cminsp')).toBeVisible();
  await expect(page.locator('.cminsp__mod')).toHaveCount(1);
  await expect(page.locator('.cminsp__mod-name')).toHaveText('Случайные цели и награды');
  await cinematicBeat(page, 500, 'the inspect layer unfolds before the frame');
  await shot(page, 'b-inspect-modifier');
});
