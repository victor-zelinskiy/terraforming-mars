import {test, expect} from './consoleTest';
import type {Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, commitFocusedSpace, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, placementState, press, pressUntil, settle, waitForBoardHome, walkToSpace} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {TileType} from '../../src/common/TileType';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TR44 — AQUATIC RESEARCH STATION: TWO TILES ON ONE CELL, against a real
 * server on two profiles (fhd / tv4k). The owner's accent (2026-10-13): an
 * ordinary city stands ON TOP OF an ocean and the player must SEE two tiles —
 * and see the difference from an Ocean City, which is ONE tile that counts as
 * both — on the board, in the inspector, in the rules.
 *
 * THE STAND (`aquatic-research-station-twins`, Tharsis, arranged): blue's
 * TR44 city over the ocean on 33 beside red's Ocean City on 32, a plain ocean
 * on 34, blue's plain city on 42 and a stack of two on 24 — every neighbour
 * the two-tile cell must be told from, at arm's length. The spec reads the
 * BOARD's own markup (the pile's tiers and the buried tile's mark, published
 * from the server's one reading — `SpaceModel.under`) and the inspector's
 * words, and shoots the contact sheet the owner judges the concept on
 * (`screenshots/aquatic-research-station/<profile>/stand-*`).
 */
const OUT = path.resolve('screenshots', 'aquatic-research-station');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const STAND = {afloat: '33', composite: '32', ocean: '34', city: '42', stack: '24'} as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, victoryPointsBreakdown: {victoryPoints: number, city: number}, tableau: Array<{name: string, resources?: number}>};
  game: {oceans: number; spaces: Array<{id: string, tileType?: number, color?: string, stackHeight?: number, under?: number}>};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const cellOf = (wire: Wire, id: string) => wire.game.spaces.find((s) => s.id === id);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The board alone, at the page's own pixels — the close look the owner takes on the couch. */
async function shootBoard(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.locator('.con-board').screenshot({path: path.join(dir, `${name}.png`)});
}

/** What the board DRAWS on a cell: the top tile's art, the lower tiers' arts (nearest first), the mark, the counter. */
async function cellPicture(page: Page, id: string) {
  return page.evaluate((spaceId) => {
    const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${spaceId}"]`);
    if (cell === null) {
      return undefined;
    }
    const art = (el: Element | null) => Array.from(el?.classList ?? []).find((c) => c.startsWith('board-space-tile--')) ?? '';
    return {
      top: art(cell.querySelector('[data-test="tile"]')),
      tiers: Array.from(cell.querySelectorAll('[data-stack-tier]')).map((t) => art(t)),
      under: cell.querySelector('[data-stack-under]')?.getAttribute('data-stack-under-tile') ?? '',
      count: cell.querySelector('[data-stack-count]')?.textContent?.trim() ?? '',
      afloat: cell.classList.contains('board-space--afloat'),
      stack: cell.classList.contains('board-space--stack'),
    };
  }, id);
}

/** The context panel's text — the cell inspector at board home. */
async function inspectorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.con-inspector') ?? document.querySelector<HTMLElement>('.con-context');
    return (el?.innerText ?? '').replace(/\s+/g, ' ').trim();
  });
}

const CARD = 'Aquatic Research Station';
const PLAY = {target: '33', payer: '34', third: '43', greenery: '42', reserve: '32', land: '24'} as const;
const composer = '.con-composer--play';

/** The acceptance storyboard (opt-in): every frame the compositor produced, as the player saw it. Returns the stop. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** Open the hand from board home and descend into the card's play composer. */
async function openComposer(page: Page, card: string = CARD): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** «РАЗЫГРАТЬ НА ПОЛЕ» — one press, verified by the board's own placement state. */
async function playOnTheBoard(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, composer);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the staged placement never took the board'}).toBe('aiming');
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

type LandingProbe = {
  samples: number;
  ticks: number;
  /** Interval samples on which the target cell painted NO water — neither on top nor as the pile's base. */
  noWater: Array<string>;
  /** Interval samples on which a city painted over the cell with its water gone (a one-tile cell) — the lie this scene forbids. */
  bareCity: Array<string>;
  proxySeen: boolean;
  firstProxyAt?: number;
  lastProxyAt?: number;
  splashAt?: number;
  pileAt?: number;
  /** The HUD's ocean counter on every tick — it must never move. */
  hud: Array<string>;
  mc: Array<[number, string]>;
};

/**
 * THE LANDING PROBE — MutationObserver + setInterval, never rAF. The claim is about FRAMES: the water under the city is
 * painted on EVERY interval sample from the press to the pile — as the plain ocean before the flight, as the held
 * water under the proxy, as the base of the pile after the paint.
 */
async function armLandingProbe(page: Page, target: string): Promise<void> {
  await page.evaluate((id) => {
    const w = window as unknown as {__tr44: LandingProbe};
    const p: LandingProbe = {samples: 0, ticks: 0, noWater: [], bareCity: [], proxySeen: false, hud: [], mc: []};
    w.__tr44 = p;
    const t0 = Date.now();
    const shown = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 2 && r.height > 2;
    };
    const cell = () => document.querySelector<HTMLElement>(`.board-space[data_space_id="${id}"]`);
    const sample = (tick: boolean) => {
      p.samples++;
      const now = Date.now() - t0;
      const c = cell();
      const top = c?.querySelector<HTMLElement>('[data-test="tile"]') ?? null;
      const topClasses = top?.className ?? '';
      const waterOnTop = /board-space-tile--ocean\b/.test(topClasses) && !/placement-cleared/.test(topClasses);
      const waterBase = c?.querySelector('[data-stack-tier].board-space-tile--ocean') !== null;
      const cityOnTop = /board-space-tile--city\b/.test(topClasses);
      const proxy = Array.from(document.querySelectorAll<HTMLElement>('.con-tileplace__tile')).find(shown);
      if (proxy !== undefined) {
        p.proxySeen = true;
        p.firstProxyAt ??= now;
        p.lastProxyAt = now;
      }
      if (shown(document.querySelector('.con-tileplace__splash'))) {
        p.splashAt ??= now;
      }
      if (c?.querySelector('[data-stack-under-tile="board-space-tile--ocean"]') !== null) {
        p.pileAt ??= now;
      }
      if (tick) {
        p.ticks++;
        if (!waterOnTop && !waterBase) {
          p.noWater.push(`t${now} top=${topClasses.replace(/\s+/g, '.')}`);
        }
        if (cityOnTop && !waterBase) {
          p.bareCity.push(`t${now}`);
        }
        const hud = Array.from(document.querySelectorAll('.con-status__param')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).find((t) => /\/9\b/.test(t)) ?? '';
        if (p.hud[p.hud.length - 1] !== hud) {
          p.hud.push(hud);
        }
        const mc = (document.querySelector('.con-res__row--megacredits .con-res__digits')?.textContent ?? '').trim();
        if (mc !== '' && p.mc[p.mc.length - 1]?.[1] !== mc) {
          p.mc.push([now, mc]);
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
    setInterval(() => sample(true), 16);
  }, target);
}

const readLandingProbe = (page: Page) => page.evaluate(() => (window as unknown as {__tr44: LandingProbe}).__tr44);


// ── THE ACTION: «Действия карт» → the station's tile → its composer; the data pick is a step INSIDE it. ──
const CENSUS = 'Martian Census';
const SUPER = 'Supercomputer';
const actionComposer = '.con-cardactions .con-composer';
const resourcesOn = (w: Wire, card: string) => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);
const tileFocused = (page: Page, card: string) => page.evaluate((name) =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') === name, card);
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

async function openActionComposer(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  // The grid is two-dimensional: a cycle of → → ↓ ← ← ↓ reaches every tile of a small table (memory e2e-action-centre-grid-walk).
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await tileFocused(page, card)); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await tileFocused(page, card), `never focused «${card}» (at «${await focusedTile(page)}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(actionComposer), 'the composer stands').toBeVisible();
}

const focusedRow = (page: Page) => text(page, `${actionComposer} .con-composer__row--focused`);
const composerRows = (page: Page) => page.evaluate((sel) =>
  Array.from(document.querySelectorAll(`${sel} .con-composer__row`)).map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()), actionComposer);

/** Walk the composer's cursor (↑ / ↓) until `ok` holds. */
async function walkComposer(page: Page, ok: () => Promise<boolean>, label: string): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8; i++) {
      if (await ok()) {
        return;
      }
      await press(page, key, 220);
    }
  }
  expect(await ok(), `the composer's cursor never reached ${label} (at «${await focusedRow(page)}»)`).toBe(true);
}

/** The played-target step's focused candidate: the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-ptsel__cell[data-focused="1"]')?.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');

/** A on the data row → the played-target step → walk to `want`; the step stays OPEN. */
async function openDataPick(page: Page, want: string): Promise<void> {
  await walkComposer(page, async () => {
    const row = await focusedRow(page);
    return /данн|data/i.test(row) && !/Подтвердить/i.test(row);
  }, 'the data row');
  await press(page, 'Enter', 500);
  await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    for (let i = 0; i < 6 && (await focusedCandidate(page)) !== want; i++) {
      await press(page, key, 220);
    }
  }
  expect(await focusedCandidate(page), `the step's cursor reached ${want}`).toBe(want);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${actionComposer} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${actionComposer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The workspace is gone and the board is home (the scene's end). */
async function waitSceneEnd(page: Page): Promise<void> {
  await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 20_000}).toBe(0);
  await settle(page, {timeoutMs: 30_000});
  await waitForBoardHome(page, 30);
}


// ── THE OCEAN OUT FROM UNDER (TR39 Canyon Carving on the TR44 cell): the move's two levels, read off the board. ──
const CANYON = 'Canyon Carving';
const LIFT = {source: '33', dest: '32', other: '34'} as const;

/** The move's level, read off the board's own classes: `source` (which ocean) / `cell` (where to) / `` (no move pick). */
const moveLevel = (page: Page) => page.evaluate(() => {
  const board = document.querySelector('.con-board');
  if (board === null) {
    return '';
  }
  return board.classList.contains('con-board--move-pick') ? 'source' : board.classList.contains('con-board--move-lifted') ? 'cell' : '';
});
const legalCells = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.board-space--available[data_space_id]')).map((el) => el.getAttribute('data_space_id') ?? '').sort());

/** «РАЗЫГРАТЬ НА ПОЛЕ» for a MOVE — one press, verified by the board's source level. */
async function playMoveOnTheBoard(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, composer);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => moveLevel(page), {timeout: 30_000, message: 'the staged move never took the board at its source level'}).toBe('source');
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** A LIFTS the focused ocean — one press, verified by the level. */
async function liftOcean(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3 && await moveLevel(page) !== 'cell'; attempt++) {
    await press(page, 'Enter', 250);
    await expect.poll(() => moveLevel(page), {timeout: 2_500}).toBe('cell').catch(() => undefined);
  }
  expect(await moveLevel(page), 'A on the ocean lifts it').toBe('cell');
}

type LiftProbe = {
  samples: number;
  ticks: number;
  /** Interval samples on which the SOURCE cell painted no city on top — the lie this scene forbids (the city stays). */
  noCity: Array<string>;
  /** Interval samples on which the source cell still painted its water base AFTER the destination had its ocean — two oceans. */
  twoOceans: Array<string>;
  proxyArt: Array<string>;
  cubeOnProxy: Array<string>;
  firstProxyAt?: number;
  lastProxyAt?: number;
  /** The COVER of the city that stays: first seen / last seen (it must be gone before the water lands). */
  coverSeenAt?: number;
  coverLastAt?: number;
  /** The first tick the source cell wore the DRY beat. */
  driedAt?: number;
  /** The first tick the source cell had no buried-ocean mark. */
  underGoneAt?: number;
  /** The first tick the destination painted an ocean on top. */
  landedAt?: number;
  degraded: boolean;
  hud: Array<string>;
};

async function armLiftProbe(page: Page, source: string, dest: string): Promise<void> {
  await page.evaluate(([from, to]) => {
    const w = window as unknown as {__tr44lift: LiftProbe};
    const p: LiftProbe = {samples: 0, ticks: 0, noCity: [], twoOceans: [], proxyArt: [], cubeOnProxy: [], degraded: false, hud: []};
    w.__tr44lift = p;
    const t0 = Date.now();
    const shown = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 2 && r.height > 2;
    };
    const cell = (id: string) => document.querySelector<HTMLElement>(`.board-space[data_space_id="${id}"]`);
    const topArt = (id: string) => cell(id)?.querySelector<HTMLElement>('[data-test="tile"]')?.className ?? '';
    const sample = (tick: boolean) => {
      p.samples++;
      const now = Date.now() - t0;
      const proxy = Array.from(document.querySelectorAll<HTMLElement>('.con-tileplace__tile[data-tile-move]')).find(shown);
      const cover = Array.from(document.querySelectorAll<HTMLElement>('.con-tileplace__tile[data-tile-cover]')).find(shown);
      if (cover !== undefined) {
        p.coverSeenAt ??= now;
        p.coverLastAt = now;
      }
      if (proxy !== undefined) {
        p.firstProxyAt ??= now;
        p.lastProxyAt = now;
        if (p.proxyArt.length === 0) {
          p.proxyArt = (proxy.querySelector('.con-tileplace__art')?.className ?? '').split(/\s+/).filter((c) => c.startsWith('board-space-tile--'));
        }
        const cube = proxy.querySelector('.player-cube, .board-owner-cube');
        if (cube !== null && shown(cube) && p.cubeOnProxy.length < 6) {
          p.cubeOnProxy.push(`${now}ms ${cube.className}`);
        }
      }
      if (document.querySelector('[data-tile-move-degraded]') !== null) {
        p.degraded = true;
      }
      const src = cell(from);
      const srcTop = topArt(from);
      const srcWater = src?.querySelector('[data-stack-tier].board-space-tile--ocean') !== null;
      const srcUnder = src?.querySelector('[data-stack-under]') !== null;
      const destOcean = /board-space-tile--ocean\b/.test(topArt(to)) && !/placement-cleared/.test(topArt(to));
      if (src?.classList.contains('board-space--dried')) {
        p.driedAt ??= now;
      }
      if (!srcUnder) {
        p.underGoneAt ??= now;
      }
      if (destOcean) {
        p.landedAt ??= now;
      }
      if (tick) {
        p.ticks++;
        if (!/board-space-tile--city\b/.test(srcTop)) {
          p.noCity.push(`t${now} top=${srcTop.replace(/\s+/g, '.')}`);
        }
        if (destOcean && srcWater) {
          p.twoOceans.push(`t${now}`);
        }
        const hud = Array.from(document.querySelectorAll('.con-status__param')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).find((t) => /\/9\b/.test(t)) ?? '';
        if (hud !== '' && p.hud[p.hud.length - 1] !== hud) {
          p.hud.push(hud);
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
    setInterval(() => sample(true), 16);
  }, [source, dest]);
}

const readLiftProbe = (page: Page) => page.evaluate(() => (window as unknown as {__tr44lift: LiftProbe}).__tr44lift);

for (const preset of PRESETS) {
  test.describe(`TR44 Aquatic Research Station · two tiles on one cell · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the STAND: the city over the ocean reads as TWO pieces beside the Ocean City's ONE — the board, the inspector (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const {playerId} = await bootFixtureSeats(page, request, 'aquatic-research-station-twins', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect([cellOf(wire, STAND.afloat)?.tileType, cellOf(wire, STAND.afloat)?.under, cellOf(wire, STAND.composite)?.tileType, cellOf(wire, STAND.composite)?.under],
        'the server publishes the ocean UNDER the city — and none under the composite').toEqual([TileType.CITY, TileType.OCEAN, TileType.OCEAN_CITY, undefined]);
      expect(wire.game.oceans, 'three oceans: the composite, the one under the city, the plain one').toBe(3);

      await waitForBoardHome(page);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, 'stand-00-board');
      await shootBoard(page, preset.id, 'stand-00-board-close');

      // ── THE PICTURE: two pieces on 33, one on 32. ──
      const afloat = await cellPicture(page, STAND.afloat);
      expect(afloat, 'the TR44 cell is on the board').toBeTruthy();
      expect(afloat!.top, 'an ORDINARY city on top').toBe('board-space-tile--city');
      expect(afloat!.tiers, 'the water is the base of the pile').toEqual(['board-space-tile--ocean']);
      expect(afloat!.under, 'the buried water is marked').toBe('board-space-tile--ocean');
      expect(afloat!.count, 'a single city carries no counter').toBe('');
      expect(afloat!.afloat && afloat!.stack, 'the pile lifts the city over the water').toBe(true);

      const composite = await cellPicture(page, STAND.composite);
      expect(composite!.top, 'the Ocean City is its own one art').toBe('board-space-tile--ocean-city');
      expect(composite!.tiers, 'no tier').toEqual([]);
      expect(composite!.under, 'no mark').toBe('');
      expect(composite!.afloat, 'never afloat — one tile').toBe(false);

      const stack = await cellPicture(page, STAND.stack);
      expect(stack!.tiers, 'the Skyscrapers stack beside: a city tier under a city').toEqual(['board-space-tile--city']);
      expect(stack!.count).toBe('×2');
      expect(stack!.under, 'a pile of plain cities marks nothing').toBe('');

      const plain = await cellPicture(page, STAND.city);
      expect([plain!.tiers, plain!.under, plain!.count]).toEqual([[], '', '']);

      // ── THE CONCEPT ALTERNATIVES for the owner's batch — the same stand, the water's pose changed by a style tag
      //    the product never ships: (b1) the water at the FULL hex under the lifted city (a ring + the strip);
      //    (b2) the «pontoon» — the city a shade smaller, not lifted, the water a ring around it. ──
      const alt = await page.addStyleTag({content: [
        '.board-space--afloat > .board-stack__tier.board-space-tile--ocean { transform: scale(1) translateY(0) !important; }',
      ].join('\n')});
      await cinematicBeat(page, 200, 'the concept stylesheet re-lays the cell before the frame is taken');
      await shootBoard(page, preset.id, 'stand-00-board-close-b1-ring-lift');
      await alt.evaluate((el) => (el as HTMLElement).remove());
      const alt2 = await page.addStyleTag({content: [
        '.board-space--afloat > .board-stack__tier.board-space-tile--ocean { transform: scale(1) translateY(0) !important; }',
        '.board-space--afloat > [class*="board-space-tile--"]:not(.board-stack__tier) { transform: scale(0.9) translateY(0) !important; }',
        '.board-space--afloat > .player-cube.board-owner-cube { bottom: 14px !important; }',
      ].join('\n')});
      await cinematicBeat(page, 200, 'the concept stylesheet re-lays the cell before the frame is taken');
      await shootBoard(page, preset.id, 'stand-00-board-close-b2-pontoon');
      await alt2.evaluate((el) => (el as HTMLElement).remove());
      await cinematicBeat(page, 200, 'the concept stylesheet re-lays the cell before the frame is taken');

      // ── THE INSPECTOR (board inspection mode — L3 at home): the cursor on 33 — «two tiles», counts as city AND
      //    ocean; on 32 — one special tile. ──
      await press(page, 'KeyC', 900);
      await expect.poll(() => page.locator('.con-inspector').count(), {timeout: 10_000, message: 'the inspector is open'}).toBeGreaterThan(0);
      await walkToSpace(page, STAND.afloat);
      await expect.poll(() => inspectorText(page), {timeout: 15_000, message: 'the inspector names the two tiles'}).toMatch(/Два тайла/);
      const afloatText = await inspectorText(page);
      expect(afloatText, 'the ocean still pays and still counts').toMatch(/платит соседям/);
      await shoot(page, preset.id, 'stand-01-inspect-afloat');

      await walkToSpace(page, STAND.composite);
      await expect.poll(() => inspectorText(page), {timeout: 15_000, message: 'the inspector names the composite'}).toMatch(/Океанский город/);
      const compositeText = await inspectorText(page);
      expect(compositeText, 'the composite is ONE tile — never «two tiles»').not.toMatch(/Два тайла/);
      await shoot(page, preset.id, 'stand-02-inspect-composite');

      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`THE PLAY: composer → «поставьте город поверх тайла океана» → the oceans legal → the dossier → the landing INTO the water, the water never gone → the pile, the neighbour pays (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'aquatic-research-station', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([cellOf(before, PLAY.target)?.tileType, cellOf(before, PLAY.payer)?.tileType, cellOf(before, PLAY.third)?.tileType, cellOf(before, PLAY.reserve)?.tileType],
        'three plain oceans, the reserve bare').toEqual([TileType.OCEAN, TileType.OCEAN, TileType.OCEAN, undefined]);
      expect(before.game.oceans).toBe(3);

      // THE SECOND CLIENT — red watches the landing from the board: the water must be held under the flight there too.
      const redPage = await context.newPage();
      await openConsole(redPage, seats[1], preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      const redOnBoard = () => redPage.evaluate(() => {
        const start = document.querySelector<HTMLElement>('.con-start__frame');
        const board = document.querySelector<HTMLElement>('.con-board');
        return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(redPage, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red minimizes its start workspace and stands on the board').toBe(true);
      await settle(redPage, {timeoutMs: 20_000});
      await armLandingProbe(redPage, PLAY.target);
      await page.bringToFront();

      // ── 1. THE COMPOSER: the next step names the water, its icon is the card's one node — a city over an ocean. ──
      await waitForBoardHome(page);
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the staged cell\'s own verb').toContainText('Разыграть на поле');
      await expect(page.locator(composer), 'the next step names the water').toContainText(/поставьте город поверх тайла океана/i);
      await expect(page.locator(`${composer} .con-composer__next-tile--over`), 'the row draws BOTH tiles').toHaveCount(1);
      await expect(page.locator(`${composer} [data-tile-over]`), 'the hero card prints the one node — a city over an ocean').toHaveCount(1);
      await shoot(page, preset.id, 'play-01-composer');

      // ── 2. THE BOARD: the three oceans legal and nothing else; the reticle afloat; the reserve refused for want of water. ──
      await playOnTheBoard(page);
      expect(posts, 'nothing sent before the cell is confirmed').toEqual([]);
      const legal = await page.evaluate(() => Array.from(document.querySelectorAll('.board-space--available')).map((el) => el.getAttribute('data_space_id')).sort());
      expect(legal, 'exactly the three plain oceans').toEqual([PLAY.target, PLAY.payer, PLAY.third].sort());
      await expect(page.locator('.con-bcur.con-bcur--afloat'), 'the reticle projects the city IN THE LIFT over the water').toHaveCount(1);
      // The cursor walks LEGAL cells only — R3 («все клетки») opens the whole board so the refusal can be read.
      await press(page, 'KeyV', 1200);
      await walkToSpace(page, PLAY.reserve);
      await expect.poll(() => inspectorText(page), {timeout: 10_000}).toMatch(/Размещается только на существующем океане/);
      await shoot(page, preset.id, 'play-02-reserve-refused');
      await press(page, 'KeyV', 1200); // …and back to the legal cells

      await walkToSpace(page, PLAY.target);
      await expect.poll(() => inspectorText(page), {timeout: 10_000, message: 'the dossier of the target'}).toMatch(/Без бонуса размещения/);
      const dossier = await inspectorText(page);
      expect(dossier, 'why: the ocean already took the bonus').toMatch(/уже получил океан/);
      expect(dossier, 'the OTHER ocean pays').toMatch(/Соседство с океаном \+2/);
      expect(dossier, 'the ocean stays under the city').toMatch(/Океан остаётся под городом/);
      const fit = await page.evaluate(() => {
        const el = document.querySelector('.con-inspector') as HTMLElement | null;
        return {overflow: el === null ? -1 : el.scrollHeight - el.clientHeight, scrollHint: document.querySelectorAll('.con-inspector__more').length};
      });
      expect(fit.overflow, `the dossier of a city over an ocean FITS (overflows by ${fit.overflow}px)`).toBeLessThanOrEqual(2);
      expect(fit.scrollHint, 'no scroll affordance on the dossier').toBe(0);
      await shoot(page, preset.id, 'play-03-dossier-target');

      // ── 3. THE LANDING: the water is painted on every frame — before, under the flight, as the pile's base after. ──
      await armLandingProbe(page, PLAY.target);
      const stop = await storyboard(page, preset.id, 'landing');
      const pressedAt = Date.now();
      expect(await commitFocusedSpace(page, 0), 'the second press commits the cell').toBe(true);
      await expect.poll(async () => (await readLandingProbe(page)).pileAt, {timeout: 30_000, message: 'the pile painted with its water marked'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const landedMs = Date.now() - pressedAt;
      const probe = await readLandingProbe(page);
      console.log(`[${preset.id} landing] samples ${probe.samples} ticks ${probe.ticks} · proxy ${probe.firstProxyAt}→${probe.lastProxyAt} ms · splash ${probe.splashAt} · pile ${probe.pileAt} · settled ${landedMs} ms · hud ${probe.hud.join(' | ')} · mc ${probe.mc.map((m) => m[1]).join('→')}`);
      expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
      expect(probe.proxySeen, 'the city flew').toBe(true);
      expect(probe.splashAt, 'the water answered the mass').toBeDefined();
      expect(probe.noWater, 'the water was painted on EVERY frame').toEqual([]);
      expect(probe.bareCity, 'never a city without its water').toEqual([]);
      expect(probe.hud.filter((h) => h !== ''), 'the ocean counter never moved').toEqual(['3/9']);
      await shoot(page, preset.id, 'play-04-landed');

      // ── 4. THE SERVER and the board after: two pieces, the neighbour's 2 M€, the greenery scored, the count still 3. ──
      const after = await wireOf(request, playerId);
      expect([cellOf(after, PLAY.target)?.tileType, cellOf(after, PLAY.target)?.under, cellOf(after, PLAY.target)?.color]).toEqual([TileType.CITY, TileType.OCEAN, before.thisPlayer.color]);
      expect(after.game.oceans, 'the ocean under the city still counts').toBe(3);
      expect(after.thisPlayer.megacredits, '20 − 16 + 2 (the ocean beside)').toBe(6);
      expect(after.thisPlayer.victoryPointsBreakdown.city, 'the city scores the greenery beside it').toBe(1);
      const afloat = await cellPicture(page, PLAY.target);
      expect([afloat!.top, afloat!.tiers, afloat!.under, afloat!.count]).toEqual(['board-space-tile--city', ['board-space-tile--ocean'], 'board-space-tile--ocean', '']);

      // ── 5. RED saw the same landing: the water held under the flight, never a bare city. ──
      await expect.poll(async () => (await readLandingProbe(redPage)).pileAt, {timeout: 60_000, message: 'red\'s board painted the pile'}).toBeDefined();
      await settle(redPage, {timeoutMs: 30_000});
      const redProbe = await readLandingProbe(redPage);
      console.log(`[${preset.id} red] samples ${redProbe.samples} · proxy ${redProbe.firstProxyAt}→${redProbe.lastProxyAt} · splash ${redProbe.splashAt} · pile ${redProbe.pileAt}`);
      expect(redProbe.proxySeen, 'red saw the city fly').toBe(true);
      expect(redProbe.noWater, 'red\'s water was painted on every frame').toEqual([]);
      expect(redProbe.bareCity, 'never a bare city on red\'s board').toEqual([]);
      await shoot(redPage, preset.id, 'play-05-red-after');

      expect(posts, 'ONE POST').toHaveLength(1);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`THE ACTION: +1 animal here and «may add 1 data to ANY card» — the pick is a step inside the composer, the refusal is RT inside the pick, one press pays both (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'aquatic-research-station-action', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([resourcesOn(before, CARD), resourcesOn(before, CENSUS), resourcesOn(before, SUPER)], 'the table: 1 animal here, 2 data on the Census, none on the Supercomputer').toEqual([1, 2, 0]);

      // ── 1. THE COMPOSER: the printed row, the data step as a row of the setup. ──
      await openActionComposer(page, CARD);
      console.log(`[${preset.id} action] rows: ${(await composerRows(page)).join(' | ')}`);
      await shoot(page, preset.id, 'action-01-composer');

      // ── 2. THE PICK is the played-target step: both holders, each with its tag; the refusal is a PLATE inside it. ──
      await openDataPick(page, CENSUS);
      await expect(page.locator(`.con-ptsel [data-zoom-slot="${SUPER}"]`), 'the Supercomputer is a candidate').toHaveCount(1);
      await expect(page.locator(`.con-ptsel [data-zoom-slot="${CENSUS}"]`), 'the Census is a candidate').toHaveCount(1);
      await expect(page.locator('.con-ptsel [data-decline-plate]'), 'the refusal is a plate inside the pick (RT)').toHaveCount(1);
      const rail = await text(page, '.con-ptsel__rail');
      expect(rail, 'no raw template on the rail').not.toMatch(/\$\{/);
      await shoot(page, preset.id, 'action-02-pick');

      // ── 3. RT DECLINES — the answered row speaks the refusal; the animal still comes. ──
      await press(page, 'Period', 700);
      await expect(page.locator('.con-ptsel'), 'the step closed on the decline').toHaveCount(0);
      const declined = (await composerRows(page)).find((row) => /Не добавлять/.test(row)) ?? '';
      expect(declined, `the answered row names the refusal («Не добавлять …») — rows: ${(await composerRows(page)).join(' | ')}`).toMatch(/Не добавлять/);
      expect(declined, 'the refusal names what it forgoes').toMatch(/данн/i);
      await shoot(page, preset.id, 'action-03-declined');

      // ── 4. BACK INTO THE PICK — the Census it is. ──
      await openDataPick(page, CENSUS);
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
      await expect(page.locator(`${actionComposer} [data-composer-card="${CENSUS}"]`), 'the Census stands in the answered row').toHaveCount(1);
      await toCommitRow(page);
      await shoot(page, preset.id, 'action-04-ready');

      // ── 5. ONE PRESS, TWO FLIGHTS: the animal into the hero's capsule, the data onto the Census's miniature. ──
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'action');
      await press(page, 'Enter', 300);
      await waitSceneEnd(page);
      await stop();
      const w = await transferWitness(page);
      console.log(`[${preset.id} action] trail:\n${transferTrail(w)}`);
      expect(w.births.length, 'tokens were born').toBeGreaterThanOrEqual(2);
      expect(w.births.some((e) => e.under === 'hero'), 'the animal is born on the hero (its printed icon)').toBe(true);
      expect(w.landings.some((e) => e.under === `composer-card:${CENSUS}`), 'the data lands on the Census\'s miniature in the composer row').toBe(true);
      expect(endsOverGlass(w), 'no end of any flight over a band surface\'s glass').toEqual([]);

      const after = await wireOf(request, playerId);
      expect([resourcesOn(after, CARD), resourcesOn(after, CENSUS), resourcesOn(after, SUPER)], 'the server: 2 animals here, 3 data on the Census').toEqual([2, 3, 0]);
      expect(posts, 'ONE POST').toHaveLength(1);
      expect(pageErrors, 'no page error').toEqual([]);
      await shoot(page, preset.id, 'action-05-after');
    });

    test(`THE OCEAN OUT FROM UNDER: Canyon Carving lifts the TR44 cell's ocean — the source level offers it, the dossier says the city stays, the proxy is the WATER, the city never leaves its cell, the count stands (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'aquatic-research-station-canyon', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([cellOf(before, LIFT.source)?.tileType, cellOf(before, LIFT.source)?.under, cellOf(before, LIFT.other)?.tileType, cellOf(before, LIFT.dest)?.tileType],
        'the city over its ocean, a plain ocean beside, the reserve bare').toEqual([TileType.CITY, TileType.OCEAN, TileType.OCEAN, undefined]);
      expect(before.game.oceans, 'two oceans — the one under the city counts').toBe(2);

      // ── 1. THE SOURCE LEVEL: the ocean UNDER the city is offered like any plain ocean — never «upgraded-ocean» refused. ──
      await openComposer(page, CANYON);
      await playMoveOnTheBoard(page);
      await expect.poll(() => legalCells(page), {timeout: 10_000, message: 'the source level offers both oceans — the one under the city too'}).toEqual([LIFT.source, LIFT.other]);
      await walkToSpace(page, LIFT.source);
      await expect(page.locator('.con-bcur--pickup'), 'the reticle wears its pickup pose over the pile').toHaveCount(1);
      await expect.poll(() => inspectorText(page), {timeout: 10_000, message: 'the dossier reads the SOURCE in the ocean\'s words'}).toMatch(/Этот океан/i);
      const source = await inspectorText(page);
      expect(source, 'К-W1: the city stays — said before the lift').toMatch(/Город остаётся/);
      expect(source, 'only the ocean leaves, the cell stops counting').toMatch(/Уходит только океан из-под города/);
      await shoot(page, preset.id, 'canyon-01-source');

      // ── 2. A LIFTS the ocean out from under; the destination is the bare reserve beside. ──
      await liftOcean(page);
      expect(posts, 'lifting sends nothing').toEqual([]);
      await expect(page.locator(`.board-space--move-source[data_space_id="${LIFT.source}"]`), 'the pile wears «leaving from here»').toHaveCount(1);
      await walkToSpace(page, LIFT.dest);
      await expect(page.locator('.con-bmove'), 'the vector points at the reserve').toHaveCount(1);
      await shoot(page, preset.id, 'canyon-02-dest');

      // ── 3. THE COMMIT and THE SCENE: the proxy is the WATER, nobody's; the city is painted on EVERY frame; the cell dries. ──
      await armLiftProbe(page, LIFT.source, LIFT.dest);
      const stop = await storyboard(page, preset.id, 'lift');
      await press(page, 'Enter', 420); // lock
      await expect(page.locator('.con-bcur--locked'), 'A locks the cell').toHaveCount(1);
      await page.keyboard.press('Enter'); // confirm — past the lock's dwell
      await expect.poll(async () => cellOf(await wireOf(request, playerId), LIFT.dest)?.tileType, {timeout: 30_000, message: 'the ocean never reached the reserve on the server'}).toBe(TileType.OCEAN);
      await expect.poll(async () => (await readLiftProbe(page)).landedAt, {timeout: 30_000, message: 'the ocean never landed on screen'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const probe = await readLiftProbe(page);
      console.log(`[${preset.id} lift] samples ${probe.samples} ticks ${probe.ticks} · proxy ${probe.firstProxyAt}→${probe.lastProxyAt} ms · cover ${probe.coverSeenAt}→${probe.coverLastAt} · dried ${probe.driedAt} · under gone ${probe.underGoneAt} · landed ${probe.landedAt} · art ${probe.proxyArt.join(',')} · hud ${probe.hud.join(' | ')}`);
      // THE WATER COMES OUT FROM UNDER THE CITY, never through it: the city's cover stands over the water's proxy from
      // the proxy's birth and is gone before the water lands on the reserve.
      expect(probe.coverSeenAt, 'the city\'s cover stood over the leaving water').toBeDefined();
      expect(probe.coverSeenAt!, 'the cover stands from the water\'s birth').toBeLessThanOrEqual(probe.firstProxyAt! + 40);
      expect(probe.coverLastAt!, 'the cover is gone before the water lands').toBeLessThan(probe.landedAt!);
      expect(probe.ticks, 'the probe sampled').toBeGreaterThan(20);
      expect(probe.degraded, 'the move never degraded').toBe(false);
      expect(probe.proxyArt, 'THE PIECE THAT TRAVELS is the ocean').toContain('board-space-tile--ocean');
      expect(probe.cubeOnProxy, 'an ocean has no owner — no cube rides the proxy').toEqual([]);
      expect(probe.noCity, 'the city was painted on its cell on EVERY frame').toEqual([]);
      expect(probe.twoOceans, 'never two oceans — the water left the source before it stood on the reserve').toEqual([]);
      expect(probe.underGoneAt, 'the buried-ocean mark left the pile').toBeDefined();
      expect(probe.driedAt, 'the cell DRIED — the water\'s leaving was a beat, not a swap').toBeDefined();
      expect(probe.hud, 'the HUD\'s ocean counter never moved — the count is the same').toEqual(['2/9']);
      await shoot(page, preset.id, 'canyon-03-after');

      // ── 4. THE BOARD and THE SERVER after: a plain city where the pile stood, the ocean on the reserve, nobody's. ──
      const sourceAfter = await cellPicture(page, LIFT.source);
      expect([sourceAfter?.top, sourceAfter?.under, sourceAfter?.afloat], 'a plain city, no water under it').toEqual(['board-space-tile--city', '', false]);
      expect((await cellPicture(page, LIFT.dest))?.top, 'the ocean stands on the reserve').toBe('board-space-tile--ocean');
      const after = await wireOf(request, playerId);
      expect([cellOf(after, LIFT.source)?.tileType, cellOf(after, LIFT.source)?.under, cellOf(after, LIFT.source)?.color], 'the city stays, its owner with it, the water gone').toEqual([TileType.CITY, undefined, before.thisPlayer.color]);
      expect([cellOf(after, LIFT.dest)?.tileType, cellOf(after, LIFT.dest)?.color], 'the ocean on the reserve — nobody\'s').toEqual([TileType.OCEAN, undefined]);
      expect(after.game.oceans, 'the count is the same — the parameter never moved').toBe(2);
      expect(posts, 'ONE POST').toHaveLength(1);
      expect(pageErrors, 'no page error').toEqual([]);

      // ── 5. THE INSPECTOR of the dried cell: one city, never «two tiles». ──
      await waitForBoardHome(page, 30);
      await press(page, 'KeyC', 900); // L3 — board inspection
      await walkToSpace(page, LIFT.source);
      await expect.poll(() => inspectorText(page), {timeout: 10_000}).toMatch(/Город/);
      expect(await inspectorText(page), 'no longer two tiles').not.toMatch(/Два тайла/);
      await shoot(page, preset.id, 'canyon-04-inspect');
    });
  });
}
