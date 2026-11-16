import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, composerLoaded, dossierLoaded, focusedSpaceId, forceSwiftPlacement, openQuickWheel, placementState, press, pressUntil, settle,
  soloGameConfig} from './consoleStart';
import {readSettled} from './settledRead';
import {HAZARD_TILES} from '@/common/TileType';

/**
 * Console placement dossier · Mars Nomads next to an Ares hazard — the
 * NEGATIVE pair of `console-hazard-placement.spec.ts`.
 *
 * The regression this guards (2026-09-03 screenshot): the camp-move prompt
 * (`placementEffect: 'bonus-only'`) previewed the destination with FULL tile
 * semantics — «ЭФФЕКТ КЛЕТКИ · Снизить производство −1» beside a hazard, and
 * the hazard lit up as a triggering source — although the commit
 * (`MarsNomads.action` → `grantPlacementBonuses`) never reaches
 * `Game.addTile`, the only place those costs are charged.
 *
 * The probe walks EVERY legal move destination: none may promise a production
 * penalty and no hazard may carry a penalty relation mark; the destination's
 * printed bonus (the thing the move DOES collect) must still be promised.
 * The geometry guarantees the sweep is not vacuous: the camp is seated so
 * that at least one destination touches a hazard.
 */

const OUT_DIR = path.resolve('screenshots', 'console-nomads-hazard');
const CARD = 'Mars Nomads';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}


/** The server's own view of the hazard cells (never a pixel guess). */
async function hazardCells(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    game: {spaces: Array<{id: string, tileType?: number}>},
  };
  return model.game.spaces
    .filter((s) => s.tileType !== undefined && HAZARD_TILES.has(s.tileType))
    .map((s) => s.id);
}

/**
 * ONE HOP OF A WALK — the press, and the cursor's move as its witness: the WHOLE window before «no move» is believed
 * (the cursor / the rail land a beat after the press), and never a second press here — a wall is a legitimate no-move.
 */
async function hop(page: Page, key: string, where: () => Promise<string>, settleMs: number): Promise<void> {
  const at = await where();
  await pressUntil(page, key, async () => (await where()) !== at, {tries: 1, settleMs});
}

/**
 * The arrow that brings the cursor closer to `target` — from the hexes' on-screen centres, read AT REST (C: the board
 * camera may still be gliding when a placement opens; a centre read mid-glide points the walk the wrong way).
 */
async function arrowToward(page: Page, target: string): Promise<string> {
  return page.evaluate((id: string) => {
    const centre = (cell: string) => {
      const el = document.querySelector(`.board-space[data_space_id="${cell}"]`);
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    };
    const from = document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '';
    const a = centre(from);
    const b = centre(id);
    if (a === undefined || b === undefined) {
      return 'ArrowRight';
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }
    return dy > 0 ? 'ArrowDown' : 'ArrowUp';
  }, target);
}

/**
 * Walk the board cursor onto ONE named cell — geometrically (press the arrow
 * that reduces the on-screen distance; a fixed rotation orbits a hex grid).
 * Each hop waits for the cursor's move before the next arrow is chosen.
 */
async function walkToCell(page: Page, cellId: string): Promise<void> {
  const where = () => focusedSpaceId(page);
  for (let i = 0; i < 40; i++) {
    const at = await focusedSpaceId(page);
    if (at === cellId) {
      return;
    }
    const key = await readSettled(page, () => arrowToward(page, cellId), {settle: false, message: `the arrow toward ${cellId}`});
    await hop(page, key, where, 600);
  }
  await expect.poll(where, {message: `the cursor never reached ${cellId}`}).toBe(cellId);
}

/**
 * Pick the SEAT for the camp so a future MOVE destination touches a hazard:
 * a legal cell D adjacent to a hazard, and a legal cell C ≠ hazard adjacent
 * to D. Adjacency from the hexes' own on-screen centres (holds for any deal).
 */
async function planHazardNeighbourhood(page: Page, hazards: ReadonlyArray<string>):
  Promise<{seat: string, dest: string} | null> {
  return page.evaluate((hazardIds: ReadonlyArray<string>) => {
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width};
    };
    const legal = Array.from(document.querySelectorAll('.board-space--available'))
      .map((el) => ({
        id: el.getAttribute('data_space_id') ?? '',
        c: centre(el),
        bonuses: el.querySelectorAll('.board-space-bonus').length,
      }))
      .filter((cell) => cell.id !== '');
    const near = (a: {x: number, y: number}, b: {x: number, y: number}, w: number) =>
      Math.hypot(a.x - b.x, a.y - b.y) < w * 1.15;
    for (const hz of hazardIds) {
      const hzEl = document.querySelector(`.board-space[data_space_id="${hz}"]`);
      if (hzEl === null) {
        continue;
      }
      const hc = centre(hzEl);
      // Prefer a destination WITH printed bonuses — then the probe can also
      // assert the promise the move keeps, not just the one it drops.
      const dests = legal.filter((cell) => near(cell.c, hc, hc.w))
        .sort((a, b) => b.bonuses - a.bonuses);
      for (const dest of dests) {
        const seats = legal.filter((cell) =>
          cell.id !== dest.id && !hazardIds.includes(cell.id) && near(cell.c, dest.c, hc.w));
        if (seats.length > 0) {
          return {seat: seats[0].id, dest: dest.id};
        }
      }
    }
    return null;
  }, hazards);
}

/** Open «ДЕЙСТВИЯ КАРТ» and focus THIS card's action (never a blind Enter —
 *  a dealt corporation with a blue action shares the list). */
async function focusCardAction(page: Page, card: string): Promise<void> {
  const actions = page.locator('.con-cardactions');
  if (await actions.count() === 0) {
    // RT wheel → ↑ («ДЕЙСТВИЯ КАРТ»): on a quick wheel the direction press IS the activation — its effect is the wheel
    // leaving (or the workspace standing).
    await openQuickWheel(page);
    await pressUntil(page, 'ArrowUp',
      async () => await actions.count() > 0 || await page.locator('.con-quick').count() === 0, {settleMs: 1200});
  }
  await expect(actions).toHaveCount(1, {timeout: 20_000});
  // The browse list is ready when its focused thumb stands and the console is quiet.
  await page.locator('[data-action-flow-thumb]').first().waitFor({state: 'attached', timeout: 20_000});
  await settle(page);
  const focusedCard = () => page.evaluate(() =>
    document.querySelector('[data-action-flow-thumb]')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 12 && await focusedCard() !== card; i++) {
    await hop(page, i % 2 === 0 ? 'ArrowDown' : 'ArrowRight', focusedCard, 600);
  }
  await expect.poll(focusedCard, {message: `the action list never focused ${card}`}).toBe(card);
}

/** Open the hand, walk onto the card, descend and confirm the play. */
async function playFromHand(page: Page, card: string): Promise<void> {
  const frame = page.locator('.con-hand__frame');
  if (await frame.count() === 0) {
    // RT wheel → A («КАРТЫ»): the wheel leaving (or the hand standing) is the centre press's effect.
    await openQuickWheel(page);
    await pressUntil(page, 'Enter',
      async () => await frame.count() > 0 || await page.locator('.con-quick').count() === 0, {settleMs: 1100});
  }
  await expect(frame).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  // The open episode is over when the hand drops its transit hold.
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 20_000});
  await settle(page);
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  const selectedSlot = () => page.evaluate(() =>
    document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
  let lastSelected = '';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const selected = await selectedSlot();
    // A hop that moved nothing was a wall: the next row. Each hop waits for the cursor's move before this is judged.
    await hop(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', selectedSlot, 600);
    lastSelected = selected;
  }
  await expect.poll(onTarget, {message: `the hand cursor never reached ${card}`}).toBeGreaterThan(0);
  // Descend act→verify→retry: on a loaded 4K frame the first press's release
  // edge can be swallowed while the album is still settling — re-press ONLY
  // while the composer has not appeared (a blind second press would confirm).
  const composer = page.locator('.con-hand__stage .con-composer--play');
  await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 5, settleMs: 1600});
  await expect(composer).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  // The sheet is read (and confirmed) once its preview has LOADED; the deciding press itself waits out the
  // decision's settle window (`press` — the absorb gates), never a fixed beat.
  await composerLoaded(page);
  await press(page, 'Enter');
}

// NOMADS_VP=3840x2160 (tv-4k) / 1280x800 (deck) / default FHD.
const VP = (() => {
  const m = /^(\d+)x(\d+)$/.exec(process.env.NOMADS_VP ?? '');
  return m ? {width: Number(m[1]), height: Number(m[2])} : {width: 1920, height: 1080};
})();

test.describe('Mars Nomads move · the dossier promises no tile costs', () => {
  test.use({viewport: VP, deviceScaleFactor: 1, screen: VP});

  test('no destination promises a production penalty; the cell bonus stays promised', async ({page, request}) => {
    test.setTimeout(420_000);

    await forceSwiftPlacement(page); // the pick itself is setup, not the subject
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {ares: true},
        customProjectCards: [CARD],
      }),
      cards: [CARD],
    });

    const hazards = await hazardCells(request, playerId);
    expect(hazards.length, 'an Ares game opens with hazards on the board').toBeGreaterThan(0);

    // Play the card → the SEAT prompt (marker) opens on the board.
    await playFromHand(page, CARD);
    const boardOpen = page.locator('.board-space--available');
    await expect(boardOpen.first()).toBeVisible({timeout: 30_000});

    // The plan reads the hexes' centres — AT REST (C: the board's camera settles first, then two equal reads).
    const plan = await readSettled(page, () => planHazardNeighbourhood(page, hazards), {message: 'the seat / destination plan'});
    expect(plan, 'no seat/destination pair around a hazard on this deal').not.toBeNull();
    const {seat, dest} = plan!;

    await walkToCell(page, seat);
    await press(page, 'Enter', 2600); // swift placement: one press commits
    // «Seated» is the placement over (the board left its placing state) and the landing's scene at rest.
    await expect.poll(() => placementState(page), {message: 'the camp seat never committed', timeout: 30_000}).toBe('none');
    await settle(page);
    await shoot(page, '01-camp-seated');

    // The repeatable action → the MOVE prompt (bonus-only). A on the focused row opens the action's setup — repeated
    // only while neither its stage nor the board has answered.
    await focusCardAction(page, CARD);
    await pressUntil(page, 'Enter', async () =>
      await page.locator('.con-cardactions__stagewrap .con-composer--stage').count() > 0 || await boardOpen.count() > 0,
    {tries: 1, settleMs: 1400});
    await composerLoaded(page);
    // The composer's confirm hands the pick to the board — re-pressed only after a whole window with no board.
    await pressUntil(page, 'Enter', async () => await boardOpen.count() > 0, {tries: 6, settleMs: 2500});
    await expect(boardOpen.first()).toBeVisible({timeout: 30_000});

    // Sweep EVERY legal destination — none may promise what the commit
    // never charges, and no hazard may light as a triggering source.
    // The legal set is read AT REST (the grid lights in, the camera settles).
    const destIds = await readSettled(page, () => page.evaluate(() => Array.from(
      document.querySelectorAll('.board-space--available'))
      .map((el) => el.getAttribute('data_space_id') ?? '').filter((id) => id !== '')), {message: 'the move\'s legal destinations'});
    expect(destIds, 'the move offers the hazard-adjacent destination').toContain(dest);

    const panel = page.locator('.con-context');
    /*
     * The dossier of the focused cell: once it stands for THIS cell, loaded (its own marker — `dossierLoaded`, class F),
     * and AT REST: the panel's text and the board's penalty marks, the same across frames after the console is quiet.
     */
    const dossierAtRest = async (id: string) => {
      await dossierLoaded(page, id);
      return readSettled(page, async () => ({
        text: await panel.innerText(),
        penalty: await page.evaluate(() => document.querySelectorAll('.con-rel--penalty').length),
      }), {equal: 3, message: `the dossier of cell ${id}`});
    };
    for (const id of destIds) {
      await walkToCell(page, id);
      const {text, penalty: penaltyMarks} = await dossierAtRest(id);
      expect(text, `cell ${id} promises a production penalty the move never charges`)
        .not.toContain('Снизить производство');
      expect(text, `cell ${id} explains a hazard-adjacency count for a markerless cost`)
        .not.toContain('опасных зон рядом');
      expect(penaltyMarks, `cell ${id} lights a penalty relation for a camp move`).toBe(0);
      if (id === dest) {
        await shoot(page, '02-hazard-adjacent-destination');
      }
    }

    // The promise the move KEEPS: the destination's printed bonus (when the
    // chosen destination prints one — the plan prefers such a cell).
    await walkToCell(page, dest);
    const destBonuses = await page.evaluate((id: string) =>
      document.querySelector(`.board-space[data_space_id="${id}"]`)
        ?.querySelectorAll('.board-space-bonus').length ?? 0, dest);
    if (destBonuses > 0) {
      // A positive live state: asserted by a poll (the dossier lands a beat after the cursor).
      await expect(panel, 'the collected cell bonus disappeared from the dossier').toContainText('ВЫ ПОЛУЧИТЕ', {useInnerText: true});
    }
    await shoot(page, '03-final-destination-panel');
  });
});
