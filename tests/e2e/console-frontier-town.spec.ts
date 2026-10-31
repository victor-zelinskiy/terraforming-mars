import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  FixtureName, bootFixture, cinematicBeat, commitFocusedSpace, fetchPlayerModel, focusCard, placementState, press, pressUntil, settle, waitForBoardHome,
  walkToSpace,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P74 «ПОГРАНИЧНЫЙ ГОРОД» — the series' first city with a MULTIPLIED printed bonus, and the stand of «НАГРАДА КЛЕТКИ —
 * НА САМОЙ КЛЕТКЕ, СО СВОИМ МНОЖИТЕЛЕМ» (docs/claude/prompts/prelude2-p74-frontier-town.md, ledger DD).
 *
 *   A · `frontier-town-locked` (the Greens rule, ONE delegate on Mars First's resolution): the verdict refuses «1/2»; A
 *       sends nothing.
 *   B · `frontier-town` (Mars First rules by a quiet law): the composer → the staged board. EVERY legal candidate that
 *       prints a bonus wears «×3» (the server's count — `data-bonus-times`), no other cell does, the cluster does not
 *       move when the marks come, nothing animates while the cursor walks; the dossier of a two-plant cell reads ×3;
 *       A → lock → A → ONE POST → +6 plants, energy production 1 → 0, every token's ends visible; the marks are gone.
 *   C · `frontier-town-craze` (Development Craze enacted): «×6» on the candidates (the Redux FAQ); +12 plants.
 *   D · an ordinary city (the standard project) on the same table marks NOTHING.
 *
 * FUNCTIONAL class — state is judged by the server and the DOM's own attributes, never a frame count.
 */

const CARD = 'Frontier Town';
const OUT = path.resolve('screenshots', 'p74');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const PLANT = 2; // SpaceBonus.PLANT
const RESTRICTED = 14; // SpaceBonus._RESTRICTED — a marker, never a bonus (TITANIUM is 0)

type Space = {id: string, bonus: Array<number>, tileType?: number, color?: string};
type Wire = {
  game: {spaces: Array<Space>},
  thisPlayer: {color: string, plants: number, energyProduction: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

/** The hand → the composer → «Разыграть» → the staged board aiming. */
async function openStagedBoard(page: Page): Promise<string> {
  await focusInHand(page);
  await expect(page.locator('.con-hand__verdictbar'), 'Mars First rules: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
  await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
  const composer = (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');
  test.info().annotations.push({type: 'composer', description: composer.slice(0, 1200)});
  expect(composer, 'the composer names the energy step: 1 → 0').toMatch(/1\s*→\s*0/);
  const started = async () => await page.locator('[data-staged-plate]').count() > 0 || await page.locator(COMPOSER).count() === 0;
  expect(await pressUntil(page, 'Enter', started, {tries: 4, settleMs: 1200}), '«Разыграть» never opened the staged board').toBe(true);
  await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the reticle never aimed'}).toBe('aiming');
  await page.locator('.con-context').waitFor({state: 'visible', timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
  return composer;
}

type Marks = {marked: Array<{id: string, times: string}>, unmarkedWithBonus: Array<string>, strayMarks: Array<string>, halos: Array<string>};

/** The board's «×N» marks against the legal grid and the server's printed bonuses. */
async function readMarks(page: Page, spaces: Array<Space>): Promise<Marks> {
  const raw = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>('#main_board .board-space[data_space_id]')];
    return cells.map((el) => {
      const mark = el.querySelector<HTMLElement>('[data-bonus-times-mark]');
      const s = mark === null ? undefined : getComputedStyle(mark);
      return {
        id: el.getAttribute('data_space_id') ?? '',
        times: el.getAttribute('data-bonus-times'),
        mark: mark?.textContent?.trim(),
        legal: el.classList.contains('board-space--available'),
        halo: s !== undefined && /rgba?\([^)]*\) 0px 0px [1-9]/.test(s.boxShadow),
      };
    });
  });
  const printed = (id: string) => (spaces.find((s) => s.id === id)?.bonus ?? []).some((b) => b !== RESTRICTED);
  return {
    marked: raw.filter((c) => c.times !== null).map((c) => ({id: c.id, times: c.times!})),
    unmarkedWithBonus: raw.filter((c) => c.legal && c.times === null && printed(c.id)).map((c) => c.id),
    strayMarks: raw.filter((c) => c.times !== null && (!c.legal || !printed(c.id) || c.mark !== `×${c.times}`)).map((c) => c.id),
    halos: raw.filter((c) => c.halo).map((c) => c.id),
  };
}

async function cellRect(page: Page, id: string): Promise<{x: number, y: number, w: number, h: number} | undefined> {
  return page.evaluate((spaceId) => {
    const el = document.querySelector(`#main_board .board-space[data_space_id="${spaceId}"] .board-space-bonuses`);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
  }, id);
}

/** B/C — the multiplied play end to end. */
async function playMultiplied(page: Page, request: APIRequestContext, fixture: FixtureName, times: number, plants: number, label: string): Promise<void> {
  const pageErrors: Array<string> = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const id = await bootFixture(page, request, fixture, {query: PRESET.query});
  await settle(page);
  const posts = watchPosts(page);
  const before = await wireOf(request, id);
  const twoPlant = before.game.spaces.filter((s) => s.tileType === undefined && s.bonus.length === 2 && s.bonus.every((b) => b === PLANT)).map((s) => s.id);
  expect(twoPlant.length, 'the board prints two-plant cells').toBeGreaterThan(0);
  // The cluster's place BEFORE the marks (the board home) — the marks are absolute, the cluster never moves.
  const clusterBefore = await cellRect(page, twoPlant[0]);

  await openStagedBoard(page);
  const marks = await readMarks(page, before.game.spaces);
  test.info().annotations.push({type: 'marks', description: JSON.stringify(marks).slice(0, 1500)});
  expect(marks.marked.length, 'the candidates wear their «×N»').toBeGreaterThan(0);
  expect([...new Set(marks.marked.map((m) => m.times))], 'ONE number — the server\'s').toEqual([String(times)]);
  expect(marks.unmarkedWithBonus, 'every legal candidate that prints a bonus is marked').toEqual([]);
  expect(marks.strayMarks, 'no mark off the grid or on a bare cell').toEqual([]);
  expect(marks.halos, 'a mark is material, never a glow').toEqual([]);
  await shoot(page, `${label}-marks`);

  // The two-plant candidate: the cluster stands where it stood; the dossier states the multiple.
  const legal = new Set(marks.marked.map((m) => m.id));
  const target = twoPlant.find((cell) => legal.has(cell));
  expect(target, 'a two-plant candidate').toBeDefined();
  await walkToSpace(page, target!);
  await settle(page);
  const clusterAfter = await cellRect(page, twoPlant[0]);
  if (clusterBefore !== undefined && clusterAfter !== undefined && twoPlant[0] !== target) {
    expect(Math.abs(clusterAfter.x - clusterBefore.x) + Math.abs(clusterAfter.y - clusterBefore.y), 'the cluster did not move for its mark').toBeLessThanOrEqual(2);
  }
  // Nothing animates while the player points: the marks run no animation, standing or transient.
  const animating = await page.evaluate(() => [...document.querySelectorAll('[data-bonus-times-mark]')]
    .flatMap((el) => el.getAnimations()).length);
  expect(animating, 'the marks stand still while the cursor walks').toBe(0);
  const dossier = (await page.locator('.con-context').innerText()).replace(/\s+/g, ' ');
  test.info().annotations.push({type: 'dossier', description: dossier.slice(0, 1200)});
  expect(dossier, 'the dossier: 6 plants on a two-plant cell').toMatch(/\b6\b/);
  expect(dossier, 'the dossier names the multiple').toMatch(/×\s*3/);
  await shoot(page, `${label}-dossier`);

  // A → lock → A → ONE POST.
  await armTransferWitness(page);
  expect(posts.length, 'nothing sent before the commit').toBe(0);
  expect(await commitFocusedSpace(page, 900), 'the staged city committed').toBe(true);
  await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the play reached the tableau'}).toBe(true);
  await settle(page, {timeoutMs: 60_000});
  await waitForBoardHome(page, 40);
  const after = await wireOf(request, id);
  expect(posts, 'ONE POST for the play and its cell').toHaveLength(1);
  expect(after.game.spaces.find((s) => s.id === target)?.color, 'the city is blue\'s, on the chosen cell').toBe(before.thisPlayer.color);
  expect(after.thisPlayer.plants - before.thisPlayer.plants, `the server: +${plants} plants`).toBe(plants);
  expect(after.thisPlayer.energyProduction, 'energy production 1 → 0').toBe(before.thisPlayer.energyProduction - 1);
  const witness = await transferWitness(page);
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  fs.writeFileSync(path.join(OUT, PRESET.id, `${label}-trail.txt`), transferTrail(witness) + '\n');
  expect(endsOverGlass(witness), `no end over glass or nothing\n${transferTrail(witness)}`).toEqual([]);
  await expect(page.locator('[data-bonus-times-mark]'), 'the marks went with the grid').toHaveCount(0);
  await shoot(page, `${label}-board`);
  expect(pageErrors, 'no page errors').toEqual([]);
}

test.describe(`P74 Frontier Town · the cell's reward on the cell, with its multiple · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · the Greens rule, one delegate on Mars First\'s resolution: the verdict refuses «1/2»; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'frontier-town-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    const text = (await verdict.innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'verdict', description: text});
    expect(text, 'Mars First\'s road counted: 1 of 2').toMatch(/1\s*\/\s*2/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · Mars First rules: «×3» on every candidate, the dossier ×3, ONE POST, +6 plants, the marks gone', async ({page, request}) => {
    test.setTimeout(420_000);
    await playMultiplied(page, request, 'frontier-town', 3, 6, 'b');
  });

  test('C · Development Craze enacted: «×6» on every candidate (the FAQ), ONE POST, +12 plants', async ({page, request}) => {
    test.setTimeout(420_000);
    await playMultiplied(page, request, 'frontier-town-craze', 6, 12, 'c');
  });

  test('D · an ordinary city (the standard project) marks NOTHING', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'frontier-town', {query: PRESET.query});
    await settle(page);
    await press(page, 'Comma', 900);
    await expect(page.locator('.con-quick'), 'the wheel is open').toBeVisible({timeout: 15_000});
    await press(page, 'Enter', 1200);
    await expect(page.locator('.con-stdp'), 'the standard projects stand').toBeVisible({timeout: 15_000});
    let hit = false;
    for (let i = 0; i < 16 && !hit; i++) {
      const step = await page.evaluate(() => {
        const at = document.querySelector('.con-stdp__card--focused');
        const target = document.querySelector('.con-stdp__card[data-stdp-card="City"]');
        if (at === null || target === null) {
          return 'none';
        }
        if (at === target) {
          return 'hit';
        }
        const a = at.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        return Math.abs(dy) > a.height / 2 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      });
      expect(step, 'the City card stands on the screen').not.toBe('none');
      hit = step === 'hit';
      if (!hit) {
        await press(page, step, 280);
      }
    }
    expect(hit, 'the cursor reached City').toBe(true);
    await press(page, 'Enter', 900);
    await expect(page.locator('.con-board--placing'), 'the city placement opened').toBeVisible({timeout: 20_000});
    await settle(page);
    expect(await page.locator('.board-space--available').count(), 'the grid is lit').toBeGreaterThan(0);
    await expect(page.locator('[data-bonus-times]'), 'an ordinary city marks nothing').toHaveCount(0);
    await shoot(page, 'd-ordinary');
  });
});
