import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, cinematicBeat, focusedSpaceId, forceSwiftPlacement, openCardActions, press, pressUntil, pressUntilVisible,
  settle, soloGameConfig, walkToSpace} from './consoleStart';
import {TileType} from '@/common/TileType';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

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
 *  this both records AND drives the animation forward. The gap is the strip's
 *  own cadence (the frames ARE the motion), never a wait for anything. */
async function filmstrip(page: Page, name: string, frames: number, gapMs: number): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await shoot(page, `${name}-f${String(i).padStart(2, '0')}`);
    await cinematicBeat(page, gapMs, 'the filmstrip\'s cadence — every frame a capture of the motion itself');
  }
}

type Clip = {x: number, y: number, width: number, height: number};

/** A clipped burst — a small region screenshots ~5× faster than the full
 *  frame, so the strip catches the motion at a much finer time step. */
async function clipStrip(page: Page, name: string, clip: Clip, frames: number, gapMs: number): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  for (let i = 0; i < frames; i++) {
    await page.screenshot({path: path.join(OUT_DIR, `${name}-f${String(i).padStart(2, '0')}.png`), clip});
    if (gapMs > 0) {
      await cinematicBeat(page, gapMs, 'the close-up strip\'s cadence — every frame a capture of the motion itself');
    }
  }
}

type CellRect = {x: number, y: number, w: number, h: number};

/** The on-screen boxes of the given board cells (the ones that exist), rounded. */
async function cellRects(page: Page, ids: ReadonlyArray<string>): Promise<Array<CellRect>> {
  return page.evaluate((cellIds: ReadonlyArray<string>) => cellIds.map((id) => {
    const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
  }).filter((r): r is {x: number, y: number, w: number, h: number} => r !== undefined), ids);
}

/** The viewport box around one or two board cells, padded — measured on a board AT REST (the planet's focus moves it). */
async function cellsClip(page: Page, ids: ReadonlyArray<string>, padPx: number): Promise<Clip> {
  const rects = await readSettled(page, () => cellRects(page, ids), {message: `the cells ${ids.join(', ')}`});
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

/** One observation of the board's nomad / payout layers — what the frame holds NOW (the witness's reader). */
type NomadSeen = {
  landing: Array<string>,
  moveLayer: boolean,
  moveToken: boolean,
  bonusProxies: number,
  tileBonusProxies: number,
  holds: Array<string>,
  restores: Array<string>,
  chips: number,
  oceanPulses: number,
  oceanCoins: number,
  boardTokens: Array<string>,
};

/**
 * The probe, RECORDED (FLAKE ZERO — `armWitness`: the product's own writes + a frame tick, armed before the action,
 * replace-proof): the reader returns what stands NOW, and the Node side folds the record into the probe's verdicts
 * (`nomadRecord`) — «ever», «the most at once», «on which cells», «what stands last». Each window has its own key.
 */
async function armNomadProbe(page: Page, key: string): Promise<void> {
  await armWitness<NomadSeen>(page, key, () => {
    const cellsOf = (sel: string): Array<string> => Array.from(document.querySelectorAll(sel))
      .map((el) => el.closest('.board-space')?.getAttribute('data_space_id') ?? '')
      .filter((id) => id !== '');
    const token = document.querySelector<HTMLElement>('.con-nomadmove__token');
    return {
      landing: cellsOf('.board-nomad .nomad-token--landing'),
      moveLayer: document.querySelector('.con-nomadmove') !== null,
      moveToken: document.querySelector('.con-nomadmove') !== null && token !== null &&
        token.style.visibility !== 'hidden' && token.style.opacity !== '0',
      bonusProxies: document.querySelectorAll('.con-nomadmove__bonus').length,
      tileBonusProxies: document.querySelectorAll('.con-tileplace__bonus').length,
      holds: cellsOf('.board-space-bonuses.con-deal-hold'),
      restores: cellsOf('.board-space-bonuses--nomad-restore'),
      chips: document.querySelectorAll('.con-transfer__chip').length,
      oceanPulses: document.querySelectorAll('.con-tileplace__oceanpulse:not(.con-tileplace__oceanpulse--ares)').length,
      oceanCoins: document.querySelectorAll('.con-tileplace__oceancoin').length,
      boardTokens: cellsOf('.board-space .board-nomad'),
    };
  });
}

/** The probe's verdicts over the window recorded under `key` (the record folded on the Node side). */
async function nomadRecord(page: Page, key: string): Promise<NomadProbe> {
  const seen = await witnessOf<NomadSeen>(page, key).values();
  const union = (pick: (v: NomadSeen) => Array<string>): Array<string> => {
    const out: Array<string> = [];
    for (const v of seen) {
      for (const id of pick(v)) {
        if (!out.includes(id)) {
          out.push(id);
        }
      }
    }
    return out;
  };
  const most = (pick: (v: NomadSeen) => number): number => Math.max(0, ...seen.map(pick));
  return {
    landingCells: union((v) => v.landing),
    // The distinct recorded states that stood the move layer — «did it run», never a count of frames.
    moveLayerFrames: seen.filter((v) => v.moveLayer).length,
    moveTokenSeen: seen.some((v) => v.moveToken),
    bonusProxySeen: most((v) => v.bonusProxies),
    tileBonusProxySeen: most((v) => v.tileBonusProxies),
    holdSeenOn: union((v) => v.holds),
    restoreSeenOn: union((v) => v.restores),
    chipSeen: most((v) => v.chips),
    oceanPulseSeen: most((v) => v.oceanPulses),
    oceanCoinSeen: most((v) => v.oceanCoins),
    boardTokens: seen.at(-1)?.boardTokens ?? [],
  };
}

/** The legal cells the board offers right now (the placement's own marker class). */
async function availableCells(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.board-space--available').length);
}

/**
 * ONE VERIFIED HOP of a d-pad walk: the press, then the WHOLE window for `where()` to move (act → verify — a move
 * lands a beat after the press's quiet). False = it stood still: a wall, or a swallowed press.
 */
async function hop(page: Page, code: string, where: () => Promise<string>, settleMs: number): Promise<boolean> {
  const at = await where();
  return pressUntil(page, code, async () => (await where()) !== at, {tries: 1, settleMs});
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
  // Every hop waits for ITS move before the next one (a cell read a beat late took one more step than the walk needed).
  for (let i = 0; i < 40 && !wanted.includes(await focusedSpaceId(page)); i++) {
    await hop(page, ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4], () => focusedSpaceId(page), 300);
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

/** What the game and the screen actually are — the only honest thing to put
 *  in a give-up message (a bare timeout blames the product for a driver miss). */
async function diagnose(page: Page, request: APIRequestContext, playerId: string): Promise<string> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    game: {phase: string},
    waitingFor?: {type?: string, title?: unknown},
  };
  const screen = await page.evaluate(() => {
    const roots: Array<string> = [];
    document.querySelectorAll<HTMLElement>('[class*="con-"]').forEach((el) => {
      if (el.checkVisibility === undefined || !el.checkVisibility()) {
        return;
      }
      // `className` is an SVGAnimatedString on SVG nodes — read the attribute.
      const root = (el.getAttribute('class') ?? '').split(/\s+/).find((c) => /^con-[a-z]+$/.test(c));
      if (root !== undefined && !roots.includes(root)) {
        roots.push(root);
      }
    });
    return {
      surfaces: roots.slice(0, 16),
      actionTile: (document.querySelector('.con-cardactions__tile')?.textContent ?? '').trim().slice(0, 90),
      composer: document.querySelectorAll('.con-composer').length,
      available: document.querySelectorAll('.board-space--available').length,
    };
  });
  return `phase=${model.game.phase} waitingFor=${model.waitingFor?.type ?? 'none'} ` +
    `composer=${screen.composer} available=${screen.available} tile="${screen.actionTile}" ` +
    `surfaces=[${screen.surfaces.join(',')}]`;
}

/**
 * Walk the board cursor onto ONE named cell — the SHARED serpentine (`walkToSpace`: the d-pad snaps between LEGAL
 * cells only, the axes clamp; it throws with the cells it visited). The private «press the arrow that reduces the
 * on-screen distance» walk read the cells' boxes mid-glide of the planet's focus, and is retired for it.
 */
async function walkToCell(page: Page, cellId: string): Promise<void> {
  await walkToSpace(page, cellId);
  await expect.poll(() => focusedSpaceId(page), {message: `the cursor never reached ${cellId}`}).toBe(cellId);
}

/**
 * Open «ДЕЙСТВИЯ КАРТ» and put the cursor on THIS card's action.
 *
 * ⚠ The list is not «the card the probe played»: a corporation with a blue
 * action is in it too (a run where the deal handed one made the probe descend
 * into «Добавьте астероид…» and wait forever for a board). The focused tile
 * publishes its card name (`[data-zoom-slot]` on the detail column), so the
 * cursor is walked until that name is the one we want.
 */
async function focusCardAction(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  await settle(page);
  const focusedCard = () => page.evaluate(() =>
    document.querySelector('[data-action-flow-thumb]')?.getAttribute('data-zoom-slot') ?? '');
  // Each hop waits for the focused tile to answer before the next one.
  for (let i = 0; i < 12 && await focusedCard() !== card; i++) {
    await hop(page, i % 2 === 0 ? 'ArrowDown' : 'ArrowRight', focusedCard, 320);
  }
  await expect.poll(focusedCard, {message: `the action list never focused ${card}`}).toBe(card);
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

/** The cells the SERVER says carry the nomads' camp (`SpaceModel.nomads`). */
async function nomadCells(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    game: {spaces: Array<{id: string, nomads?: boolean}>},
  };
  return model.game.spaces.filter((s) => s.nomads === true).map((s) => s.id);
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
  // The album's entrance at rest before the cursor is walked.
  await settle(page);
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  const selectedCard = () => page.evaluate(() =>
    document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
  // Right along the row; a hop that moved nothing (the row's end) steps DOWN once. Each hop is verified by the
  // selection moving — never a selection read a beat late taken for a wall.
  let dir = 'ArrowRight';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const moved = await hop(page, dir, selectedCard, 260);
    dir = moved ? 'ArrowRight' : 'ArrowDown';
  }
  await expect.poll(onTarget, {message: `the hand cursor never reached ${card}`}).toBeGreaterThan(0);
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await settle(page);
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

    await forceSwiftPlacement(page); // a landing-scene capture, not a confirm-flow spec
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {promo: true},
        customProjectCards: [CARD],
      }),
      cards: [CARD],
    });
    await armNomadProbe(page, 'nomad-A');
    await shoot(page, '00-board-home');

    // ── FLOW A · play the card and SEAT the camp ─────────────────────────
    const stocksBefore = await playerStocks(request, playerId);
    await playFromHand(page, CARD);

    // The follow-up SelectSpace ('marker') hands the board over — and the hand-over's own motion comes to rest.
    await expect.poll(() => availableCells(page), {timeout: 45_000}).toBeGreaterThan(0);
    await settle(page, {timeoutMs: 20_000});
    const seatCell = await walkToLegalCell(page, true);
    const seatBonuses = await cellBonuses(request, playerId, seatCell);
    await shoot(page, '10-A-placement-open');

    const seatClip = await cellsClip(page, [seatCell], 90);
    await page.keyboard.press('Enter');
    await clipStrip(page, '11-A-landing', seatClip, 14, 70); // the ~860ms descent, close up
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '12-A-settled');
    await clipStrip(page, '12z-A-closeup', await cellsClip(page, [seatCell], 60), 1, 0);

    const probeA = await nomadRecord(page, 'nomad-A');
    await witnessOf<NomadSeen>(page, 'nomad-A').stop();
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
    await focusCardAction(page, CARD);
    await shoot(page, '20-B-actions-open');

    // Act → verify: each A gets its whole window for its effect (the composer, then the board) before the next.
    await pressUntilVisible(page, 'Enter', '.con-composer', {tries: 6, settleMs: 1200}); // descend into НАСТРОЙКА
    await expect.poll(() => page.locator('.con-composer').count(), {message: `the action never descended · ${await diagnose(page, request, playerId)}`}).toBeGreaterThan(0);
    await shoot(page, '21-B-composer');
    await pressUntil(page, 'Enter', async () => await availableCells(page) > 0, {tries: 6, settleMs: 1500}); // commit the activation

    // The follow-up SelectSpace ('bonus-only') hands the board over — and the hand-over's own motion comes to rest.
    await expect.poll(() => availableCells(page), {timeout: 45_000}).toBeGreaterThan(0);
    await settle(page, {timeoutMs: 20_000});

    // A fresh record for the move's own window.
    await armNomadProbe(page, 'nomad-B');
    const stocksBeforeMove = await playerStocks(request, playerId);
    const boardIconsBefore = await page.evaluate(() =>
      document.querySelectorAll('.board-space .board-space-bonus').length);
    const destCell = await walkToLegalCell(page, true);
    const destBonuses = await cellBonuses(request, playerId, destCell);
    await shoot(page, '22-B-move-placement-open');

    // The camp stands on ITS cell right now — clip the from+to pair while both
    // are still measurable in the (possibly focused) board space.
    const fromCell = (await witnessOf<NomadSeen>(page, 'nomad-B').last())?.boardTokens[0] ?? seatCell;
    const hopClip = await cellsClip(page, [fromCell, destCell], 110);
    await page.keyboard.press('Enter');
    await clipStrip(page, '23-B-hop', hopClip, 16, 60); // lift + hop + touchdown, close up
    await filmstrip(page, '24-B-collect', 8, 200); // chips + restore (full frame)
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '25-B-settled');
    await clipStrip(page, '25z-B-closeup', await cellsClip(page, [destCell], 60), 1, 0);

    const probeB = await nomadRecord(page, 'nomad-B');
    await witnessOf<NomadSeen>(page, 'nomad-B').stop();
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
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll('.board-space-bonuses--nomad-restore').length), {message: 'the restore class is gone at rest'}).toBe(0);
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll('.board-space-bonuses.con-deal-hold').length), {message: 'no container stays blanked'}).toBe(0);
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll('.board-space .board-space-bonus').length),
    {message: 'no printed bonus left the board'}).toBe(boardIconsBefore);
    await expect.poll(() => page.locator('.con-nomadmove').count(), {message: 'the flight layer unmounted'}).toBe(0);

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

    await forceSwiftPlacement(page); // a landing-scene capture, not a confirm-flow spec
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {promo: true},
        customProjectCards: [CARD, FLOODING],
      }),
      cards: [CARD, FLOODING],
    });

    // ── Build the ocean (an ordinary play + placement — the tile hero's road).
    await playFromHand(page, FLOODING);
    await expect.poll(() => availableCells(page), {timeout: 45_000}).toBeGreaterThan(0);
    await settle(page, {timeoutMs: 20_000});
    const oceanCell = await walkToLegalCell(page, false);
    await page.keyboard.press('Enter');
    await expect.poll(async () => oceanCells(page, request).then((ids) => ids.includes(oceanCell)),
      {timeout: 45_000}).toBeTruthy();
    await settle(page, {timeoutMs: 20_000}); // the placement hero owns the screen until its scene is over
    await shoot(page, '30-ocean-built');

    // ── Seat the camp one hop away from a SHORE cell, so the move can land on it.
    await playFromHand(page, CARD);
    await expect.poll(() => availableCells(page), {timeout: 45_000}).toBeGreaterThan(0);
    // The plan is read off the cells' boxes — measured on a board AT REST.
    const plan = await readSettled(page, () => planShoreHop(page, oceanCell), {message: `the cells around ocean ${oceanCell}`});
    expect(plan, `no legal seat+shore pair around ocean ${oceanCell}`).not.toBeNull();
    const {seat, shore} = plan!;
    await walkToCell(page, seat);
    await page.keyboard.press('Enter');
    // The seat is the SERVER's camp first (its token on the cell), then the landing scene's rest.
    await expect.poll(async () => (await nomadCells(request, playerId)).includes(seat),
      {timeout: 45_000, message: `the camp never seated on ${seat}`}).toBe(true);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '31-camp-seated-near-water');

    // ── The MOVE onto the shore cell.
    await focusCardAction(page, CARD);
    // ⚠ A press can be SWALLOWED by design (a busy frame, a commit gate), so
    // every step is act → verify → retry, and a give-up says what it saw.
    await pressUntilVisible(page, 'Enter', '.con-composer', {tries: 6, settleMs: 1200});
    await expect.poll(() => page.locator('.con-composer').count(), {message: `the action never descended into its composer · ${await diagnose(page, request, playerId)}`}).toBeGreaterThan(0);
    await pressUntil(page, 'Enter', async () => await availableCells(page) > 0, {tries: 6, settleMs: 1500});
    await expect.poll(() => availableCells(page),
      {message: `the move never handed the board over · ${await diagnose(page, request, playerId)}`}).toBeGreaterThan(0);
    await settle(page, {timeoutMs: 20_000});

    await armNomadProbe(page, 'nomad-C');
    const mcBefore = (await playerStocks(request, playerId)).mc;
    await walkToCell(page, shore);
    await shoot(page, '32-shore-move-open');
    const hopClip = await cellsClip(page, [seat, shore, oceanCell], 110);
    await page.keyboard.press('Enter');
    await clipStrip(page, '33-shore-hop', hopClip, 14, 60);
    await filmstrip(page, '34-ocean-payout', 10, 220); // the swell + the coin + the chip
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '35-shore-settled');

    // The SERVER's own manifest is the authority on what should have been shown.
    const manifest = await oceanManifest(request, playerId);
    expect(manifest?.spaceId, 'the server published the payout for THIS destination').toBe(shore);
    expect(manifest!.megacredits, 'the water really paid').toBeGreaterThan(0);
    expect((await playerStocks(request, playerId)).mc - mcBefore,
      'the M€ landed on the player').toBeGreaterThanOrEqual(manifest!.megacredits);

    const probe = await nomadRecord(page, 'nomad-C');
    await witnessOf<NomadSeen>(page, 'nomad-C').stop();
    expect(probe.oceanPulseSeen, 'the paying shore WOKE (the swell)').toBeGreaterThan(0);
    expect(probe.oceanCoinSeen, 'an M€ coin CONDENSED out of the lit water').toBeGreaterThan(0);
    expect(probe.chipSeen, '…and rode the shared resource-transfer flight to the rail').toBeGreaterThan(0);
    expect(probe.boardTokens, 'the camp stands on the shore cell').toEqual([shore]);
    // Nothing may be left staged once the payout is over.
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll('.con-tileplace__oceancoin').length), {message: 'no coin left staged'}).toBe(0);
    await expect.poll(() => page.locator('.con-nomadmove').count()).toBe(0);
  });
});
