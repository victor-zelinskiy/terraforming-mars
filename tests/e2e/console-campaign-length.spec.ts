import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {openConsole, press} from './consoleStart';
import {campaignBase, campaignModelAs, createCampaign, devCommit, launchMission, seedIdentity} from './campaignFixtures';
import {waitWithFrames} from './consoleEndgameHarness';

/**
 * THE CAMPAIGN'S LENGTH (2026-11-07) — 3…6 missions, four by default, the LAST always the finale.
 *   A · the creator: the campaign's map deck is the route briefing, and it IS the length dial — ◄ ► clamp along
 *       3 · 4 · 5 · 6, A cycles; the lane of unknown boards grows and shrinks with it, the last stop the finale's.
 *   B · the map of a six-mission campaign: six cards on the lane, ONE finale (the last), one height for all.
 *   C · the finale of a six-mission campaign: each human deploys FIVE corporations — the start's «Наследие» strip
 *       carries all five, whole, on screen (the final count's three charters + «+N» is the endgame's own pure rule).
 * The rules (length ladder, the bot's rhythm, the corporation floor, the finale on the last slot) are unit-tested in
 * `tests/campaign/campaignLength.spec.ts`; here the surfaces.
 */

const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'};
test.use({viewport: TV.viewport});

async function shot(page: Page, name: string): Promise<void> {
  const dir = path.join('screenshots', 'campaign-length', TV.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const EXPANSIONS = {
  corpera: true, promo: true, venus: true, colonies: true, prelude: true,
  prelude2: false, turmoil: false, community: false, ares: false, moon: false,
  pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
};

test('A — the creator: the route briefing IS the length dial (3…6, four by default)', async ({page}) => {
  test.setTimeout(180_000);
  await seedIdentity(page, 'Alice');
  await page.addInitScript((s) => {
    if (window.localStorage.getItem('tm_last_game_settings') === null) {
      window.localStorage.setItem('tm_last_game_settings', JSON.stringify(s));
    }
  }, {sessionMode: 'campaign', gameMode: 'multiplayer', players: [{name: 'Alice', color: 'blue'}, {name: 'Bruno', color: 'red'}]});
  await page.goto(`${campaignBase()}/?x=1${TV.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
    await press(page, 'ArrowDown', 120);
  }
  await press(page, 'Enter', 300);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  // The mode tile's little route is as long as the chosen campaign.
  await expect(page.locator('.cm-mode__tile--campaign .cm-mode__stop')).toHaveCount(4);
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
  for (let i = 0; i < 6 && await page.locator('[data-route-length]').count() === 0; i++) {
    await press(page, 'KeyE', 400);
  }
  const brief = page.locator('[data-route-length]');
  await expect(brief).toHaveCount(1, {timeout: 15_000});
  const value = brief.locator('[data-route-length-value]');
  const stops = brief.locator('.cm-routebrief__stop:not(.cm-routestop-leave-active)');
  const finals = brief.locator('.cm-routebrief__stop--final:not(.cm-routestop-leave-active)');
  await expect(value).toHaveText('4');
  await expect(stops).toHaveCount(4);

  await press(page, 'ArrowRight', 250);
  await expect(value).toHaveText('5');
  await press(page, 'ArrowRight', 250);
  await expect(value).toHaveText('6');
  await press(page, 'ArrowRight', 250);
  await expect(value, '◄ ► clamp at six').toHaveText('6');
  await expect(stops).toHaveCount(6);
  await expect(finals, 'one finale — the last stop').toHaveCount(1);
  await expect(page.locator('.cm-create .cm-tabs__tab--active'), '◄ ► dial the length — the deck stays').toHaveText(/маршрут/i);
  // The launch panel names the length too.
  await expect(page.locator('.cm-launch__map-name')).toContainText('Миссий: 6');
  await shot(page, 'a-creator-six');

  await press(page, 'Enter', 250);
  await expect(value, 'A cycles past six to three').toHaveText('3');
  await expect(stops).toHaveCount(3);
  await press(page, 'ArrowLeft', 250);
  await expect(value, '◄ ► clamp at three').toHaveText('3');
  await shot(page, 'a-creator-three');
});

test('B — a six-mission map: six cards, the last the finale, one height', async ({page, request}) => {
  test.setTimeout(180_000);
  const {id} = await createCampaign(request, {}, {missionCount: 6});
  await seedIdentity(page, 'Alice');
  await page.goto(`${campaignBase()}/campaign?id=${id}${TV.query}`);
  await page.waitForSelector('.cmap__card', {timeout: 30_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  const cards = page.locator('.cmap__card');
  await expect(cards).toHaveCount(6);
  await expect(page.locator('.ccard__final-banner')).toHaveCount(1);
  await expect(cards.nth(5).locator('.ccard__final-banner')).toHaveCount(1);
  await expect(page.locator('.cmap__head')).toContainText(/Миссия 1 из 6/i);
  const boxes = await cards.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return {h: Math.round(r.height), left: r.left, right: r.right};
  }));
  expect(new Set(boxes.map((b) => b.h)).size, `card heights ${boxes.map((b) => b.h).join(', ')}`).toBe(1);
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].left, `card ${i} never overlaps card ${i - 1}`).toBeGreaterThanOrEqual(boxes[i - 1].right - 1);
  }
  expect(boxes[5].right, 'the route fits the screen').toBeLessThanOrEqual(TV.viewport.width);
  await waitWithFrames(page, async () => page.evaluate(() =>
    [...document.querySelectorAll('.cmap__node')].every((el) => el.getAnimations().every((a) => a.playState !== 'running'))),
  15_000, 'the route standing');
  await shot(page, 'b-map-six');
});

test('C — the finale of a six-mission campaign: five corporations per seat, all on the start’s «Наследие» strip', async ({page, request}) => {
  test.setTimeout(240_000);
  const names = ['Alice', 'Bruno'];
  const lineages: Record<number, Array<string>> = {
    0: ['Ecoline', 'Mining Guild', 'Tharsis Republic', 'CrediCor', 'Interplanetary Cinematics'],
    1: ['Helion', 'Saturn Systems', 'Teractor', 'Thorgate', 'Inventrix'],
  };
  const {id} = await createCampaign(request, {
    testMode: true,
    players: names.map((name, i) => ({name, color: ['blue', 'red'][i], beginner: false, handicap: 0, first: i === 0})),
    expansions: EXPANSIONS,
  }, {missionCount: 6});
  // Five fabricated missions grow each lineage in acquisition order; the sixth deploys it («Штаб»).
  for (let slot = 0; slot < 5; slot++) {
    await devCommit(request, id, slot % 2 === 0 ? [0, 1] : [1, 0], {
      lineages: {0: lineages[0].slice(0, slot + 1), 1: lineages[1].slice(0, slot + 1)},
    });
  }
  await launchMission(request, id);
  const ids: Array<string> = [];
  for (const name of names) {
    const pid = (await campaignModelAs(request, id, name)).missions[5]?.yourPlayerId;
    expect(pid, `no finale seat for ${name}`).toBeTruthy();
    ids.push(pid!);
  }

  // ── The start: the finale opens on the selection, its «Наследие» strip carrying all five, whole, on screen. ──
  await openConsole(page, ids[0], TV.query);
  await page.waitForSelector('.con-start__frame', {timeout: 90_000});
  await waitWithFrames(page, async () => (await page.locator('[data-legacy-dock]').count()) >= 5, 60_000, 'the lineage strip');
  const legacy = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-legacy-dock]')].map((el) => {
    const r = el.getBoundingClientRect();
    return {name: el.dataset.legacyDock ?? '', inside: r.width > 0 && r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight};
  }));
  expect(legacy.map((l) => l.name), 'the whole lineage in acquisition order').toEqual(lineages[0]);
  for (const l of legacy) {
    expect(l.inside, `${l.name} is on screen`).toBe(true);
  }
  await shot(page, 'c-start-five-corporations');

  // The final COUNT of such a lineage is the endgame's own rule — three charters behind the face and the rest named
  // «+N» (`LINEAGE_VISIBLE` / `lineageShown`, consoleEndgamePodium) — and is not re-walked here: the generic API
  // terraformer that drives a table to the count can loop on what a five-corporation deal offers (the deal is not
  // seeded — a mission rolls its own), and a journey that may never arrive is a flake, not a check.
});
