import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, forceSwiftPlacement, press, soloGameConfig} from './consoleStart';
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

async function focusedSpaceId(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '');
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
 * Walk the board cursor onto ONE named cell — geometrically (press the arrow
 * that reduces the on-screen distance; a fixed rotation orbits a hex grid).
 */
async function walkToCell(page: Page, cellId: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const at = await focusedSpaceId(page);
    if (at === cellId) {
      return;
    }
    const key = await page.evaluate((target: string) => {
      const centre = (id: string) => {
        const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
        if (el === null) {
          return undefined;
        }
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      };
      const from = document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '';
      const a = centre(from);
      const b = centre(target);
      if (a === undefined || b === undefined) {
        return 'ArrowRight';
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      }
      return dy > 0 ? 'ArrowDown' : 'ArrowUp';
    }, cellId);
    await press(page, key, 220);
  }
  expect(await focusedSpaceId(page), `the cursor never reached ${cellId}`).toBe(cellId);
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
  for (let tries = 0; tries < 5 && await actions.count() === 0; tries++) {
    await press(page, 'Period', 700);
    await press(page, 'ArrowUp', 1200);
  }
  await expect(actions).toHaveCount(1, {timeout: 20_000});
  await page.waitForTimeout(1200);
  const focusedCard = () => page.evaluate(() =>
    document.querySelector('[data-action-flow-thumb]')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 12 && await focusedCard() !== card; i++) {
    await press(page, i % 2 === 0 ? 'ArrowDown' : 'ArrowRight', 320);
  }
  expect(await focusedCard(), `the action list never focused ${card}`).toBe(card);
}

/** Open the hand, walk onto the card, descend and confirm the play. */
async function playFromHand(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(800);
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const selected = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    await press(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
    lastSelected = selected;
  }
  expect(await onTarget(), `the hand cursor never reached ${card}`).toBeGreaterThan(0);
  // Descend act→verify→retry: on a loaded 4K frame the first press's release
  // edge can be swallowed while the album is still settling — re-press ONLY
  // while the composer has not appeared (a blind second press would confirm).
  const composer = page.locator('.con-hand__stage .con-composer--play');
  for (let i = 0; i < 5 && await composer.count() === 0; i++) {
    await press(page, 'Enter', 1600);
  }
  await expect(composer).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
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
    await page.waitForTimeout(1000);

    const plan = await planHazardNeighbourhood(page, hazards);
    expect(plan, 'no seat/destination pair around a hazard on this deal').not.toBeNull();
    const {seat, dest} = plan!;

    await walkToCell(page, seat);
    await press(page, 'Enter', 2600); // swift placement: one press commits
    await shoot(page, '01-camp-seated');

    // The repeatable action → the MOVE prompt (bonus-only).
    await focusCardAction(page, CARD);
    await press(page, 'Enter', 1400);
    // The composer's confirm hands the pick to the board.
    for (let i = 0; i < 6 && await boardOpen.count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await expect(boardOpen.first()).toBeVisible({timeout: 30_000});
    await page.waitForTimeout(800);

    // Sweep EVERY legal destination — none may promise what the commit
    // never charges, and no hazard may light as a triggering source.
    const destIds = await page.evaluate(() => Array.from(
      document.querySelectorAll('.board-space--available'))
      .map((el) => el.getAttribute('data_space_id') ?? '').filter((id) => id !== ''));
    expect(destIds, 'the move offers the hazard-adjacent destination').toContain(dest);

    const panel = page.locator('.con-context');
    for (const id of destIds) {
      await walkToCell(page, id);
      await page.waitForTimeout(600);
      const text = await panel.innerText();
      expect(text, `cell ${id} promises a production penalty the move never charges`)
        .not.toContain('Снизить производство');
      expect(text, `cell ${id} explains a hazard-adjacency count for a markerless cost`)
        .not.toContain('опасных зон рядом');
      const penaltyMarks = await page.evaluate(() =>
        document.querySelectorAll('.con-rel--penalty').length);
      expect(penaltyMarks, `cell ${id} lights a penalty relation for a camp move`).toBe(0);
      if (id === dest) {
        await shoot(page, '02-hazard-adjacent-destination');
      }
    }

    // The promise the move KEEPS: the destination's printed bonus (when the
    // chosen destination prints one — the plan prefers such a cell).
    await walkToCell(page, dest);
    await page.waitForTimeout(600);
    const destBonuses = await page.evaluate((id: string) =>
      document.querySelector(`.board-space[data_space_id="${id}"]`)
        ?.querySelectorAll('.board-space-bonus').length ?? 0, dest);
    if (destBonuses > 0) {
      const text = await panel.innerText();
      expect(text, 'the collected cell bonus disappeared from the dossier')
        .toContain('ВЫ ПОЛУЧИТЕ');
    }
    await shoot(page, '03-final-destination-panel');
  });
});
