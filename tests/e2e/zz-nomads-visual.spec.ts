import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';
import {TileType} from '@/common/TileType';

/**
 * MARS NOMADS — the visual verification probe of the two flows (scratch).
 *
 * Flow A (the FIRST landing, `placementEffect: 'marker'`): the NomadToken
 * materializes over the picked cell and descends — and NOTHING reacts: no
 * move-scene layer, no bonus proxies, no blanked printed icons, no resource
 * chips, no stock change beyond the card's own cost.
 *
 * Flow B (the MOVE, `placementEffect: 'bonus-only'`): the camp lifts off,
 * hops to the adjacent cell, the destination's printed bonuses are displaced
 * and collected through the shared resource chips, and then MATERIALIZE BACK
 * (the one-shot restore class comes and goes). Exactly one camp remains, on
 * the new cell, and the board's printed icons are all still there.
 */

const OUT_DIR = path.resolve('screenshots', 'zz-nomads-visual');
const CARD = 'Mars Nomads';
/** An ocean with NO global requirement — the cheapest way to put real water
 *  on a board that starts dry, so the shore can pay the camp. */
const FLOODING = 'Flooding';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** A burst of frames — each screenshot forces a BeginFrame in headless, so
 *  this both records AND drives the animation forward. */
async function filmstrip(page: Page, name: string, frames: number, gapMs: number): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await shoot(page, `${name}-f${String(i).padStart(2, '0')}`);
    await page.waitForTimeout(gapMs);
  }
}

type Clip = {x: number, y: number, width: number, height: number};

/** A clipped burst — a small region screenshots ~5× faster than the full
 *  frame, so the strip catches the motion at a much finer time step. */
async function clipStrip(page: Page, name: string, clip: Clip, frames: number, gapMs: number): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  for (let i = 0; i < frames; i++) {
    await page.screenshot({path: path.join(OUT_DIR, `${name}-f${String(i).padStart(2, '0')}.png`), clip});
    await page.waitForTimeout(gapMs);
  }
}

/** The viewport box around one or two board cells, padded. */
async function cellsClip(page: Page, ids: ReadonlyArray<string>, padPx: number): Promise<Clip> {
  const rects = await page.evaluate((cellIds: ReadonlyArray<string>) => cellIds.map((id) => {
    const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: r.left, y: r.top, w: r.width, h: r.height};
  }).filter((r): r is {x: number, y: number, w: number, h: number} => r !== undefined), ids);
  expect(rects.length).toBeGreaterThan(0);
  const x0 = Math.min(...rects.map((r) => r.x)) - padPx;
  const y0 = Math.min(...rects.map((r) => r.y)) - padPx;
  const x1 = Math.max(...rects.map((r) => r.x + r.w)) + padPx;
  const y1 = Math.max(...rects.map((r) => r.y + r.h)) + padPx;
  return {
    x: Math.max(0, Math.round(x0)),
    y: Math.max(0, Math.round(y0)),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };
}

type NomadProbe = {
  landingCells: Array<string>,
  moveLayerFrames: number,
  moveTokenSeen: boolean,
  bonusProxySeen: number,
  tileBonusProxySeen: number,
  holdSeenOn: Array<string>,
  restoreSeenOn: Array<string>,
  chipSeen: number,
  /** The SHARED ocean-adjacency beat: a paying ocean's swell + its M€ coin.
   *  A camp that moves next to water is paid by that water exactly as a build
   *  is (`Game.grantPlacementBonuses` computes ocean adjacency with no tile),
   *  so the hop must show the SAME coins the tile hero shows. */
  oceanPulseSeen: number,
  oceanCoinSeen: number,
  boardTokens: Array<string>,
};

/** The in-page observer (MutationObserver + interval — NEVER rAF: headless
 *  Chromium parks rAF exactly when the screen goes quiet). */
async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe: NomadProbe = {
      landingCells: [], moveLayerFrames: 0, moveTokenSeen: false,
      bonusProxySeen: 0, tileBonusProxySeen: 0,
      holdSeenOn: [], restoreSeenOn: [], chipSeen: 0,
      oceanPulseSeen: 0, oceanCoinSeen: 0, boardTokens: [],
    };
    (window as unknown as {__nomadProbe: NomadProbe}).__nomadProbe = probe;
    const scan = () => {
      document.querySelectorAll('.board-nomad .nomad-token--landing').forEach((el) => {
        const id = el.closest('.board-space')?.getAttribute('data_space_id') ?? '';
        if (id !== '' && !probe.landingCells.includes(id)) {
          probe.landingCells.push(id);
        }
      });
      if (document.querySelector('.con-nomadmove') !== null) {
        probe.moveLayerFrames++;
        const token = document.querySelector<HTMLElement>('.con-nomadmove__token');
        if (token !== null && token.style.visibility !== 'hidden' && token.style.opacity !== '0') {
          probe.moveTokenSeen = true;
        }
      }
      probe.bonusProxySeen = Math.max(probe.bonusProxySeen,
        document.querySelectorAll('.con-nomadmove__bonus').length);
      probe.tileBonusProxySeen = Math.max(probe.tileBonusProxySeen,
        document.querySelectorAll('.con-tileplace__bonus').length);
      document.querySelectorAll('.board-space-bonuses.con-deal-hold').forEach((el) => {
        const id = el.closest('.board-space')?.getAttribute('data_space_id') ?? '';
        if (id !== '' && !probe.holdSeenOn.includes(id)) {
          probe.holdSeenOn.push(id);
        }
      });
      document.querySelectorAll('.board-space-bonuses--nomad-restore').forEach((el) => {
        const id = el.closest('.board-space')?.getAttribute('data_space_id') ?? '';
        if (id !== '' && !probe.restoreSeenOn.includes(id)) {
          probe.restoreSeenOn.push(id);
        }
      });
      probe.chipSeen = Math.max(probe.chipSeen, document.querySelectorAll('.con-transfer__chip').length);
      probe.oceanPulseSeen = Math.max(probe.oceanPulseSeen,
        document.querySelectorAll('.con-tileplace__oceanpulse:not(.con-tileplace__oceanpulse--ares)').length);
      probe.oceanCoinSeen = Math.max(probe.oceanCoinSeen,
        document.querySelectorAll('.con-tileplace__oceancoin').length);
      probe.boardTokens = Array.from(document.querySelectorAll('.board-space .board-nomad'))
        .map((el) => el.closest('.board-space')?.getAttribute('data_space_id') ?? '')
        .filter((id) => id !== '');
    };
    scan();
    new MutationObserver(scan).observe(document.body,
      {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
    window.setInterval(scan, 90);
  });
}

async function readProbe(page: Page): Promise<NomadProbe> {
  return page.evaluate(() => (window as unknown as {__nomadProbe: NomadProbe}).__nomadProbe);
}

async function focusedSpaceId(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '');
}

/** Walk the board cursor onto a legal cell — preferring one WITH printed
 *  bonuses when any is reachable. Returns the chosen cell id. */
async function walkToLegalCell(page: Page, preferBonus: boolean): Promise<string> {
  const legal = await page.evaluate(() => Array.from(
    document.querySelectorAll('.board-space--available'))
    .map((el) => ({
      id: el.getAttribute('data_space_id') ?? '',
      bonuses: el.querySelectorAll('.board-space-bonus').length,
    }))
    .filter((c) => c.id !== ''));
  expect(legal.length, 'the board offers at least one legal cell').toBeGreaterThan(0);
  const withBonus = legal.filter((c) => c.bonuses > 0).map((c) => c.id);
  const wanted = preferBonus && withBonus.length > 0 ? withBonus : legal.map((c) => c.id);
  for (let i = 0; i < 40 && !wanted.includes(await focusedSpaceId(page)); i++) {
    await press(page, ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4], 300);
  }
  const cell = await focusedSpaceId(page);
  expect(wanted, 'the cursor reached a legal cell of the wanted class').toContain(cell);
  return cell;
}

/** Every cell that currently carries an OCEAN tile (the server's own view). */
async function oceanCells(page: Page, request: APIRequestContext): Promise<Array<string>> {
  void page;
  const id = new URL(page.url()).searchParams.get('id') ?? '';
  const model = await (await request.get(`/api/player?id=${id}`)).json() as {
    game: {spaces: Array<{id: string, tileType?: number}>},
  };
  return model.game.spaces.filter((s) => s.tileType === TileType.OCEAN).map((s) => s.id);
}

/** The server's transient ocean-payout manifest for the viewer, if any. */
async function oceanManifest(request: APIRequestContext, playerId: string):
  Promise<{spaceId: string, oceanSpaceIds: Array<string>, perOcean: number, megacredits: number} | undefined> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    lastOceanBonus?: {spaceId: string, oceanSpaceIds: Array<string>, perOcean: number, megacredits: number},
  };
  return model.lastOceanBonus;
}

/**
 * Pick a SEAT + SHORE pair around a given ocean, geometrically: the shore is a
 * legal cell adjacent to the water, the seat is a legal cell adjacent to the
 * shore. Adjacency is derived from the hexes' own on-screen centres (a
 * neighbour is one hex-width away), so it needs no board table and holds for
 * any layout the config happens to deal.
 */
async function planShoreHop(page: Page, oceanCell: string): Promise<{seat: string, shore: string} | null> {
  return page.evaluate((ocean: string) => {
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width};
    };
    const oceanEl = document.querySelector(`.board-space[data_space_id="${ocean}"]`);
    if (oceanEl === null) {
      return null;
    }
    const oc = centre(oceanEl);
    const legal = Array.from(document.querySelectorAll('.board-space--available'))
      .map((el) => ({
        id: el.getAttribute('data_space_id') ?? '',
        c: centre(el),
        bonuses: el.querySelectorAll('.board-space-bonus').length,
      }))
      .filter((cell) => cell.id !== '');
    const near = (a: {x: number, y: number}, b: {x: number, y: number}, w: number) =>
      Math.hypot(a.x - b.x, a.y - b.y) < w * 1.15;
    const shores = legal.filter((cell) => near(cell.c, oc, oc.w));
    for (const shore of shores) {
      // Prefer a seat WITH printed bonuses — the honest case for the hop.
      const seats = legal
        .filter((cell) => cell.id !== shore.id && near(cell.c, shore.c, oc.w))
        .sort((a, b) => b.bonuses - a.bonuses);
      if (seats.length > 0) {
        return {seat: seats[0].id, shore: shore.id};
      }
    }
    return null;
  }, oceanCell);
}

/** Walk the board cursor onto ONE named cell (act → verify → retry). */
async function walkToCell(page: Page, cellId: string): Promise<void> {
  for (let i = 0; i < 60 && await focusedSpaceId(page) !== cellId; i++) {
    await press(page, ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4], 260);
  }
  expect(await focusedSpaceId(page), `the cursor never reached ${cellId}`).toBe(cellId);
}

async function playerStocks(request: APIRequestContext, playerId: string):
  Promise<{mc: number, steel: number, ti: number, plants: number, heat: number, energy: number}> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    thisPlayer: {megacredits: number, steel: number, titanium: number, plants: number, heat: number, energy: number},
  };
  const p = model.thisPlayer;
  return {mc: p.megacredits, steel: p.steel, ti: p.titanium, plants: p.plants, heat: p.heat, energy: p.energy};
}

async function cellBonuses(request: APIRequestContext, playerId: string, spaceId: string): Promise<Array<number>> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    game: {spaces: Array<{id: string, bonus: Array<number>}>},
  };
  return model.game.spaces.find((s) => s.id === spaceId)?.bonus ?? [];
}

/** Open the hand, walk onto the card, descend and confirm the play (the
 *  ordinary console road — presses are act→verify→retry by contract). */
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
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
}

// NOMADS_VP=3840x2160 (tv-4k) / 1280x800 (deck) / default FHD.
const VP = (() => {
  const m = /^(\d+)x(\d+)$/.exec(process.env.NOMADS_VP ?? '');
  return m ? {width: Number(m[1]), height: Number(m[2])} : {width: 1920, height: 1080};
})();

test.describe('Mars Nomads — the two flows, visually', () => {
  test.use({viewport: VP, deviceScaleFactor: 1, screen: VP});

  test('first landing grants nothing; the move hops, collects and restores', async ({page, request}) => {
    test.setTimeout(420_000);

    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {promo: true},
        customProjectCards: [CARD],
      }),
      cards: [CARD],
    });
    await installProbe(page);
    await shoot(page, '00-board-home');

    // ── FLOW A · play the card and SEAT the camp ─────────────────────────
    const stocksBefore = await playerStocks(request, playerId);
    await playFromHand(page, CARD);

    // The follow-up SelectSpace ('marker') hands the board over.
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available').length),
    {timeout: 45_000}).toBeGreaterThan(0);
    await page.waitForTimeout(700);
    const seatCell = await walkToLegalCell(page, true);
    const seatBonuses = await cellBonuses(request, playerId, seatCell);
    await shoot(page, '10-A-placement-open');

    const seatClip = await cellsClip(page, [seatCell], 90);
    await page.keyboard.press('Enter');
    await clipStrip(page, '11-A-landing', seatClip, 14, 70); // the ~860ms descent, close up
    await page.waitForTimeout(1500);
    await shoot(page, '12-A-settled');
    await clipStrip(page, '12z-A-closeup', await cellsClip(page, [seatCell], 60), 1, 0);

    const probeA = await readProbe(page);
    expect(probeA.landingCells, 'the seat played the LANDING beat').toContain(seatCell);
    expect(probeA.moveLayerFrames, 'the MOVE scene must never run on a first landing').toBe(0);
    expect(probeA.bonusProxySeen, 'no printed bonus was displaced').toBe(0);
    expect(probeA.tileBonusProxySeen, 'no tile-hero bonus proxy either').toBe(0);
    expect(probeA.holdSeenOn, 'no printed-icon container was blanked').toEqual([]);
    expect(probeA.chipSeen, 'no resource chip flew for a seat that grants nothing').toBe(0);
    expect(probeA.oceanCoinSeen, 'and no ocean paid a SEAT — the first placement grants nothing').toBe(0);
    expect(probeA.boardTokens, 'exactly one camp stands, on the seat').toEqual([seatCell]);

    const stocksAfterSeat = await playerStocks(request, playerId);
    expect(stocksAfterSeat.steel, 'no steel was granted').toBe(stocksBefore.steel);
    expect(stocksAfterSeat.ti).toBe(stocksBefore.ti);
    expect(stocksAfterSeat.plants).toBe(stocksBefore.plants);
    expect(stocksAfterSeat.heat).toBe(stocksBefore.heat);
    expect(stocksAfterSeat.energy).toBe(stocksBefore.energy);
    expect(stocksAfterSeat.mc, 'only the card cost left the account').toBe(stocksBefore.mc - 13);
    expect(seatBonuses.length, 'the probe really seated on a bonus cell (the honest case)').toBeGreaterThan(0);

    // ── FLOW B · the ACTION: move the camp to an adjacent cell ───────────
    const actions = page.locator('.con-cardactions');
    for (let tries = 0; tries < 5 && await actions.count() === 0; tries++) {
      await press(page, 'Period', 700);
      await press(page, 'ArrowUp', 1200);
    }
    await expect(actions).toHaveCount(1, {timeout: 20_000});
    await page.waitForTimeout(1200);
    await shoot(page, '20-B-actions-open');

    // The only activatable action in this game is the nomads' — descend + commit.
    await press(page, 'Enter', 1400); // descend into НАСТРОЙКА
    await shoot(page, '21-B-composer');
    await press(page, 'Enter', 1000); // commit the activation

    // The follow-up SelectSpace ('bonus-only') hands the board over.
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available').length),
    {timeout: 45_000}).toBeGreaterThan(0);
    await page.waitForTimeout(700);

    // Reset the probe for the move's own window.
    await installProbe(page);
    const stocksBeforeMove = await playerStocks(request, playerId);
    const boardIconsBefore = await page.evaluate(() =>
      document.querySelectorAll('.board-space .board-space-bonus').length);
    const destCell = await walkToLegalCell(page, true);
    const destBonuses = await cellBonuses(request, playerId, destCell);
    await shoot(page, '22-B-move-placement-open');

    // The camp stands on ITS cell right now — clip the from+to pair while both
    // are still measurable in the (possibly focused) board space.
    const fromCell = (await readProbe(page)).boardTokens[0] ?? seatCell;
    const hopClip = await cellsClip(page, [fromCell, destCell], 110);
    await page.keyboard.press('Enter');
    await clipStrip(page, '23-B-hop', hopClip, 16, 60); // lift + hop + touchdown, close up
    await filmstrip(page, '24-B-collect', 8, 200); // chips + restore (full frame)
    await page.waitForTimeout(2500);
    await shoot(page, '25-B-settled');
    await clipStrip(page, '25z-B-closeup', await cellsClip(page, [destCell], 60), 1, 0);

    const probeB = await readProbe(page);
    expect(probeB.moveLayerFrames, 'the MOVE scene ran').toBeGreaterThan(0);
    expect(probeB.moveTokenSeen, 'the flying module was visible').toBeTruthy();
    expect(probeB.landingCells, 'a move never replays the first-landing beat').toEqual([]);
    expect(probeB.boardTokens, 'exactly one camp stands, on the destination').toEqual([destCell]);

    // SpaceBonus stock kinds: TITANIUM=0, STEEL=1, PLANT=2, HEAT=4, MC=6, ENERGY=9.
    const stockBonusCount = destBonuses.filter((b) => [0, 1, 2, 4, 6, 9].includes(b)).length;
    if (stockBonusCount > 0) {
      expect(probeB.bonusProxySeen, 'the printed bonuses were displaced').toBeGreaterThan(0);
      expect(probeB.holdSeenOn, 'the destination container was blanked under the proxies').toContain(destCell);
      expect(probeB.chipSeen, 'the collection flew through the shared resource chips').toBeGreaterThan(0);
      expect(probeB.restoreSeenOn, 'the field materialized its bonuses back').toContain(destCell);
    }
    // The one-shot restore class must be GONE at rest, and the icons all back.
    expect(await page.evaluate(() =>
      document.querySelectorAll('.board-space-bonuses--nomad-restore').length)).toBe(0);
    expect(await page.evaluate(() =>
      document.querySelectorAll('.board-space-bonuses.con-deal-hold').length)).toBe(0);
    expect(await page.evaluate(() =>
      document.querySelectorAll('.board-space .board-space-bonus').length),
    'no printed bonus left the board').toBe(boardIconsBefore);
    expect(await page.locator('.con-nomadmove').count(), 'the flight layer unmounted').toBe(0);

    // The SERVER granted the destination's stock bonuses (steel=1, ti=2 keys …).
    const stocksAfterMove = await playerStocks(request, playerId);
    const gained =
      (stocksAfterMove.steel - stocksBeforeMove.steel) +
      (stocksAfterMove.ti - stocksBeforeMove.ti) +
      (stocksAfterMove.plants - stocksBeforeMove.plants) +
      (stocksAfterMove.heat - stocksBeforeMove.heat) +
      (stocksAfterMove.energy - stocksBeforeMove.energy);
    expect(gained, 'the move really collected the printed stock bonuses').toBe(stockBonusCount);
  });

  /**
   * THE WATER PAYS A MOVING CAMP TOO — the reported gap.
   *
   * `Game.grantPlacementBonuses` computes ocean adjacency for EVERY placement
   * bonus it grants, tile or no tile, so a camp that hops next to water earns
   * the same M€ a build does. It must therefore play the SAME beat: the shore
   * wakes, a coin condenses out of the lit water and rides the shared
   * resource-transfer flight onto the M€ row. Before this iteration the money
   * arrived in silence.
   *
   * The board starts dry, so the probe BUILDS the water first (Flooding — an
   * ocean with no global requirement), then seats the camp one cell away from
   * a shore cell and hops onto it.
   */
  test('a camp that hops next to water is paid by that water — with the coins', async ({page, request}) => {
    test.setTimeout(420_000);

    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {promo: true},
        customProjectCards: [CARD, FLOODING],
      }),
      cards: [CARD, FLOODING],
    });
    await installProbe(page);

    // ── Build the ocean (an ordinary play + placement — the tile hero's road).
    await playFromHand(page, FLOODING);
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available').length),
    {timeout: 45_000}).toBeGreaterThan(0);
    await page.waitForTimeout(700);
    const oceanCell = await walkToLegalCell(page, false);
    await page.keyboard.press('Enter');
    await expect.poll(async () => oceanCells(page, request).then((ids) => ids.includes(oceanCell)),
      {timeout: 45_000}).toBeTruthy();
    await page.waitForTimeout(2500); // the placement hero owns the screen
    await shoot(page, '30-ocean-built');

    // ── Seat the camp one hop away from a SHORE cell, so the move can land on it.
    await playFromHand(page, CARD);
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available').length),
    {timeout: 45_000}).toBeGreaterThan(0);
    await page.waitForTimeout(700);
    const plan = await planShoreHop(page, oceanCell);
    expect(plan, `no legal seat+shore pair around ocean ${oceanCell}`).not.toBeNull();
    const {seat, shore} = plan!;
    await walkToCell(page, seat);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await shoot(page, '31-camp-seated-near-water');

    // ── The MOVE onto the shore cell.
    const actions = page.locator('.con-cardactions');
    for (let tries = 0; tries < 5 && await actions.count() === 0; tries++) {
      await press(page, 'Period', 700);
      await press(page, 'ArrowUp', 1200);
    }
    await expect(actions).toHaveCount(1, {timeout: 20_000});
    await page.waitForTimeout(1200);
    await press(page, 'Enter', 1400); // descend
    await press(page, 'Enter', 1000); // commit the activation
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available').length),
    {timeout: 45_000}).toBeGreaterThan(0);
    await page.waitForTimeout(700);

    await installProbe(page);
    const mcBefore = (await playerStocks(request, playerId)).mc;
    await walkToCell(page, shore);
    await shoot(page, '32-shore-move-open');
    const hopClip = await cellsClip(page, [seat, shore, oceanCell], 110);
    await page.keyboard.press('Enter');
    await clipStrip(page, '33-shore-hop', hopClip, 14, 60);
    await filmstrip(page, '34-ocean-payout', 10, 220); // the swell + the coin + the chip
    await page.waitForTimeout(3000);
    await shoot(page, '35-shore-settled');

    // The SERVER's own manifest is the authority on what should have been shown.
    const manifest = await oceanManifest(request, playerId);
    expect(manifest?.spaceId, 'the server published the payout for THIS destination').toBe(shore);
    expect(manifest!.megacredits, 'the water really paid').toBeGreaterThan(0);
    expect((await playerStocks(request, playerId)).mc - mcBefore,
      'the M€ landed on the player').toBeGreaterThanOrEqual(manifest!.megacredits);

    const probe = await readProbe(page);
    expect(probe.oceanPulseSeen, 'the paying shore WOKE (the swell)').toBeGreaterThan(0);
    expect(probe.oceanCoinSeen, 'an M€ coin CONDENSED out of the lit water').toBeGreaterThan(0);
    expect(probe.chipSeen, '…and rode the shared resource-transfer flight to the rail').toBeGreaterThan(0);
    expect(probe.boardTokens, 'the camp stands on the shore cell').toEqual([shore]);
    // Nothing may be left staged once the payout is over.
    expect(await page.evaluate(() =>
      document.querySelectorAll('.con-tileplace__oceancoin').length)).toBe(0);
    expect(await page.locator('.con-nomadmove').count()).toBe(0);
  });
});
