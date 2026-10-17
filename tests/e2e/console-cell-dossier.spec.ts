import {test, expect} from './consoleTest';
import type {Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, placeTile, placementState, press, settle, waitForBoardHome, walkToSpace} from './consoleStart';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TR67 «КЛЕТКА — ОДНО ДОСЬЕ» (docs/TURMOIL_REDUX_ENCELADEAN_INCUBATOR.md) — the board column reads ONE cell in every
 * mode on ONE chassis, with the cell's PORTRAIT and its six neighbours, and the field lights the same neighbours:
 *   A · L3 over every kind of cell of the stand (`enceladean-incubator`): the portrait of THAT cell, the effective
 *       type (zoom-aware) never under the couch floor, no scroll, the drawer's OUTER box constant and NOTHING animating
 *       while the d-pad walks, the lit neighbours in the ring ≡ the marks on the field, the city's own points, the
 *       greenery feeding a rival's city (with the rival's dot), the Capital's card — X opens its face, B returns.
 *   B · TR67 played: the microbes asked in the composer («КУДА»), the staged ocean on the board — the same chassis,
 *       the portrait, the paying ocean lit in the ring and on the field; the commit: 4 microbes, the ocean, +1 TR.
 *   C · the skips before the press: no holder → the microbes named; nine oceans → the oceans named.
 *   D · R3: the step on the same chassis (the step plate, «КОГДА»), the floor kept.
 * Frames under screenshots/cell-dossier/<profile>/.
 */
const OUT = path.resolve('screenshots', 'cell-dossier');
const CARD = 'Enceladean Incubator';
const COMPOSER = '.con-composer--play';
const STAND = {city: '40', greenA: '39', greenB: '41', rivalCity: '48', between: '47', ocean: '32', capital: '50', capitalOcean: '43', land: '31', reserve: '33'} as const;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

type Wire = {
  thisPlayer: {terraformRating: number, tableau: Array<{name: string, resources?: number}>},
  game: {oceans: number, spaces: Array<{id: string, tileType?: number}>},
};

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type ColumnRead = {
  space: string | undefined;
  rect: string;
  scroll: number;
  below: Array<string>;
  contentShare: number;
  ring: Array<string>;
  field: Array<string>;
  vp: string;
  source: string;
};

/** The column as DATA: whose portrait, its box, the effective type under the floor, the lit ring vs the lit field. */
/** The couch floor is the TV's (`--con-t-floor`, the 4K profile); a desk / a handheld read their own scale. */
let COUCH = false;

async function readColumn(page: Page, couch = COUCH): Promise<ColumnRead> {
  return page.evaluate((couchFloor) => {
    const col = document.querySelector<HTMLElement>('.con-context');
    const portrait = col?.querySelector<HTMLElement>('[data-cell-portrait]');
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem;
    const below: Array<string> = [];
    let maxY = 0;
    const cr = col?.getBoundingClientRect();
    for (const el of Array.from(col?.querySelectorAll<HTMLElement>('*') ?? [])) {
      const r = el.getBoundingClientRect();
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      maxY = Math.max(maxY, r.bottom);
      // An SVG's text is sized by its viewBox (the VP shield), never by the cascade — not a reading line.
      if (!own || !couchFloor || el.closest('.gp-glyph') !== null || el.closest('svg') !== null || !(floor > 0)) {
        continue;
      }
      const zoom = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
      const px = parseFloat(getComputedStyle(el).fontSize) * zoom;
      if (px + 0.5 < floor) {
        below.push(`${String(el.className).split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 20)}» ${Math.round(px)}px < ${Math.round(floor)}px`);
      }
    }
    const neighbours = Array.from(portrait?.querySelectorAll<HTMLElement>('[data-ring-space]') ?? []).map((n) => n.getAttribute('data-ring-space') ?? '');
    const ring = Array.from(portrait?.querySelectorAll<HTMLElement>('[data-ring-space][data-ring-tone]') ?? [])
      .map((n) => n.getAttribute('data-ring-space') ?? '').sort();
    const field = Array.from(document.querySelectorAll<HTMLElement>('.board-space.con-rel[data_space_id]'))
      .map((n) => n.getAttribute('data_space_id') ?? '').filter((id) => neighbours.includes(id)).sort();
    return {
      space: portrait?.getAttribute('data-cell-space') ?? undefined,
      rect: cr === undefined ? '' : `${Math.round(cr.left)},${Math.round(cr.top)},${Math.round(cr.width)}×${Math.round(cr.height)}`,
      scroll: col === null ? -1 : col.scrollHeight - col.clientHeight,
      below,
      contentShare: cr === undefined ? 0 : Math.round(((maxY - cr.top) / cr.height) * 100),
      ring,
      field,
      vp: (portrait?.querySelector('[data-cell-vp]')?.textContent ?? '').replace(/\s+/g, ''),
      source: col?.querySelector('[data-cell-source]')?.getAttribute('data-cell-source-card') ?? '',
    };
  }, couch);
}

/** Walk to a cell in the L3 inspection and wait for ITS portrait (the hover answer of that very cell). */
async function inspect(page: Page, id: string): Promise<ColumnRead> {
  await walkToSpace(page, id);
  await expect.poll(async () => (await readColumn(page)).space, {timeout: 15_000, message: `the portrait of ${id}`}).toBe(id);
  await settle(page).catch(() => undefined);
  return readColumn(page);
}

/** Every running animation / transition inside the column, apart from the value flick (the one allowed motion). */
async function armMotionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__cellMotion?: {foreign: Array<string>, boxes: Array<string>, timer: number}};
    const state = {foreign: [] as Array<string>, boxes: [] as Array<string>, timer: 0};
    state.timer = window.setInterval(() => {
      const col = document.querySelector<HTMLElement>('.con-context');
      if (col === null) {
        return;
      }
      const r = col.getBoundingClientRect();
      const box = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}×${Math.round(r.height)}`;
      if (!state.boxes.includes(box)) {
        state.boxes.push(box);
      }
      for (const a of document.getAnimations()) {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        if (target === null || target === undefined) {
          continue;
        }
        const inColumn = col.contains(target);
        const onFieldMark = target.classList?.contains('con-rel') === true;
        const name = (a as unknown as {animationName?: string, transitionProperty?: string}).animationName ??
          (a as unknown as {transitionProperty?: string}).transitionProperty ?? 'anim';
        if ((inColumn || onFieldMark) && name !== 'con-dossier-val-in' && a.playState === 'running') {
          const tag = `${String((target as HTMLElement).className).split(' ')[0]}:${name}`;
          if (!state.foreign.includes(tag)) {
            state.foreign.push(tag);
          }
        }
      }
    }, 40);
    w.__cellMotion = state;
  });
}

async function readMotionProbe(page: Page): Promise<{foreign: Array<string>, boxes: Array<string>}> {
  return page.evaluate(() => {
    const w = window as unknown as {__cellMotion?: {foreign: Array<string>, boxes: Array<string>, timer: number}};
    const s = w.__cellMotion;
    if (s === undefined) {
      return {foreign: ['no probe'], boxes: []};
    }
    window.clearInterval(s.timer);
    return {foreign: s.foreign, boxes: s.boxes};
  });
}

function expectHonest(read: ColumnRead, what: string): void {
  expect(read.below, `${what}: no text under the couch floor (zoom-aware)`).toEqual([]);
  expect(read.scroll, `${what}: the column never scrolls`).toBeLessThanOrEqual(2);
  expect(read.ring, `${what}: the ring lights exactly the neighbours the field lights`).toEqual(read.field);
}

async function openComposer(page: Page): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBeTruthy();
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

const composerText = (page: Page) => page.evaluate((sel) => (document.querySelector<HTMLElement>(sel)?.innerText ?? '').replace(/\s+/g, ' ').trim(), COMPOSER);
const focusedRow = (page: Page) => page.evaluate((sel) => (document.querySelector(`${sel} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), COMPOSER);
const ctaReady = (page: Page) => page.evaluate((sel) => document.querySelector(`${sel} .con-composer__cta--ready`) !== null, COMPOSER);

/** The microbes' holder — the composer's own target step (one holder is still a question). */
async function answerMicrobeTarget(page: Page): Promise<void> {
  expect(await ctaReady(page), 'one holder is still asked — the play is not ready before the answer').toBe(false);
  for (const k of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8 && !/получател|микроб|Куда/i.test(await focusedRow(page)); i++) {
      await press(page, k, 220);
    }
  }
  expect(await focusedRow(page), 'the microbes\' target row is focused').toMatch(/получател|микроб|Куда/i);
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
  await expect.poll(() => ctaReady(page), {timeout: 10_000, message: 'ready once the microbes have a holder'}).toBe(true);
}

async function playOnTheBoard(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 220);
  }
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, COMPOSER);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the staged ocean never took the board'}).toBe('aiming');
  await settle(page, {timeoutMs: 20_000});
}

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

for (const preset of PRESETS) {
  test.describe(`TR67 · the cell dossier · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test.beforeEach(() => {
      COUCH = preset.id === 'tv4k';
    });

    test(`A · L3 — every kind of cell on one chassis: the portrait, the ring ≡ the field, the floor, a still walk, X → the tile's card (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await bootFixtureSeats(page, request, 'enceladean-incubator', {query: preset.query});
      await waitForBoardHome(page);
      await press(page, 'KeyC', 900); // L3 — the board inspection
      await expect(page.locator('.con-context'), 'the column opens').toHaveCount(1, {timeout: 10_000});

      // ── blue's CITY between its two greeneries: its own points on the portrait, the two greeneries lit gold. ──
      const city = await inspect(page, STAND.city);
      expectHonest(city, 'the city');
      expect(city.ring, 'the greeneries it scores').toEqual(expect.arrayContaining([STAND.greenA, STAND.greenB]));
      expect(city.vp, 'the city scores its three greeneries (39 · 41 · 47)').toMatch(/\+3$/);
      await expect(page.locator('.con-context [data-cell-title]')).toHaveText(/Город/i);
      await expect(page.locator('.con-context [data-cell-owner]')).toHaveCount(1);
      await shoot(page, preset.id, 'a1-city');

      // ── the greenery between two cities: it feeds blue's AND red's — red's group, red's dot on the ring. ──
      const between = await inspect(page, STAND.between);
      expectHonest(between, 'the greenery');
      expect(between.ring, 'both cities it feeds are lit').toEqual(expect.arrayContaining([STAND.city, STAND.rivalCity]));
      await expect(page.locator(`.con-context [data-ring-space="${STAND.rivalCity}"] [data-ring-chip] .con-cellp__chip-dot`), 'the rival\'s point wears the rival\'s dot').toHaveCount(1);
      await expect(page.locator('.con-context [data-dossier-section="endgame"]')).toContainText(/Соседние города/);
      await shoot(page, preset.id, 'a2-greenery-feeds');

      // ── an empty land beside the ocean: the ocean lit, «+2» on it; «при размещении здесь». ──
      const land = await inspect(page, STAND.land);
      expectHonest(land, 'the land');
      expect(land.ring, 'the paying ocean is lit').toContain(STAND.ocean);
      await expect(page.locator(`.con-context [data-ring-space="${STAND.ocean}"] [data-ring-chip]`)).toHaveText(/\+2/);
      await expect(page.locator('.con-context [data-dossier-section="gain"]')).toContainText(/При размещении здесь/i);
      await shoot(page, preset.id, 'a3-land');

      // ── the ocean tile: what a tile beside it receives is its standing mechanic. ──
      const ocean = await inspect(page, STAND.ocean);
      expectHonest(ocean, 'the ocean');
      await expect(page.locator('.con-context [data-dossier-section="tile"]')).toContainText(/При размещении рядом/i);
      await shoot(page, preset.id, 'a4-ocean');

      // ── the CAPITAL — placed by its card: the chip, and X opens the card's face; B comes back to the same cell. ──
      const capital = await inspect(page, STAND.capital);
      expectHonest(capital, 'the Capital');
      expect(capital.source, 'the card that placed it').toBe('Capital');
      await shoot(page, preset.id, 'a5-capital');
      await press(page, 'KeyX', 900);
      await expect(page.locator('.con-zoom .card-zoom-stage .pcard'), 'X opens the placing card fullscreen').toBeVisible({timeout: 10_000});
      await shoot(page, preset.id, 'a6-capital-x');
      await press(page, 'Escape', 900);
      await expect(page.locator('.con-zoom')).toHaveCount(0, {timeout: 10_000});
      expect((await readColumn(page)).space, 'the inspection stands where it was').toBe(STAND.capital);

      // ── THE WALK: six d-pad steps — the drawer's outer box never moves, nothing animates in it or on the marks. ──
      await armMotionProbe(page);
      for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
        await press(page, k, 450);
      }
      await settle(page).catch(() => undefined);
      const motion = await readMotionProbe(page);
      expect(motion.foreign, 'nothing animates while the player points (the value flick aside)').toEqual([]);
      expect(motion.boxes, 'the drawer\'s outer box is constant').toHaveLength(1);
      const last = await readColumn(page);
      expectHonest(last, 'after the walk');
      console.log(`[${preset.id} L3] content share: city ${city.contentShare}% · greenery ${between.contentShare}% · land ${land.contentShare}% · ocean ${ocean.contentShare}% · capital ${capital.contentShare}%`);

      // ── a cell with no card behind it: X stays in the bar, refused, its reason as the label. ──
      await inspect(page, STAND.land);
      await expect(page.locator('.con-cmdbar')).toContainText(/Без карты-источника/i);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    if (preset.id !== 'deck') {
      test(`B · TR67 played — «КУДА» for the microbes, the staged ocean on the same chassis, the commit (${preset.id})`, async ({page, request}) => {
        test.setTimeout(420_000);
        const {playerId} = await bootFixtureSeats(page, request, 'enceladean-incubator', {query: preset.query});
        const before = await wireOf(request, playerId);
        await waitForBoardHome(page);
        await openComposer(page);
        await shoot(page, preset.id, 'b1-composer');
        await answerMicrobeTarget(page);
        await shoot(page, preset.id, 'b2-composer-ready');
        await playOnTheBoard(page);
        await walkToSpace(page, STAND.reserve);
        await expect.poll(async () => (await readColumn(page)).space, {timeout: 15_000, message: 'the reserve\'s portrait'}).toBe(STAND.reserve);
        await expect.poll(async () => (await readColumn(page)).ring, {timeout: 15_000, message: 'the paying ocean lit by the preview'}).toContain(STAND.ocean);
        const aimed = await readColumn(page);
        expectHonest(aimed, 'the placement');
        await expect(page.locator('.con-context [data-dossier-section="gain"]')).toContainText(/Соседство с океаном/);
        await shoot(page, preset.id, 'b3-placement');
        expect(await placeTile(page), 'the ocean is placed').toBe(true);
        await expect.poll(async () => (await wireOf(request, playerId)).game.oceans, {timeout: 30_000}).toBe(before.game.oceans + 1);
        const after = await wireOf(request, playerId);
        expect(after.thisPlayer.terraformRating, '+1 TR for the ocean').toBe(before.thisPlayer.terraformRating + 1);
        expect(after.thisPlayer.tableau.find((c) => c.name === 'Decomposers')?.resources, '4 microbes landed where they were addressed').toBe(4);
        expect(after.thisPlayer.tableau.some((c) => c.name === CARD), 'the card is played').toBe(true);
        await waitForBoardHome(page);
        await shoot(page, preset.id, 'b4-after');
      });
    }

    if (preset.id === 'fhd') {
      test('C · the skips are named before the press: no holder → the microbes; nine oceans → the oceans', async ({page, request}) => {
        test.setTimeout(300_000);
        await bootFixtureSeats(page, request, 'enceladean-incubator-bare', {query: preset.query});
        await waitForBoardHome(page);
        await openComposer(page);
        expect(await composerText(page), 'the microbes\' loss is named').toMatch(/Нет подходящей карты|не будет добавлен/i);
        await shoot(page, preset.id, 'c1-bare');
        await bootFixtureSeats(page, request, 'enceladean-incubator-max', {query: preset.query});
        await waitForBoardHome(page);
        await openComposer(page);
        expect(await composerText(page), 'the oceans at nine are named').toMatch(/все океаны уже на поле/i);
        await shoot(page, preset.id, 'c2-max');
      });
    }

    if (preset.id !== 'deck') {
      test(`D · R3 — the scale step on the same chassis (${preset.id})`, async ({page, request}) => {
        test.setTimeout(240_000);
        await bootFixtureSeats(page, request, 'enceladean-incubator', {query: preset.query});
        await waitForBoardHome(page);
        await press(page, 'KeyV', 1200);
        await expect(page.locator('.con-context [data-track-step]'), 'the step plate').toBeVisible({timeout: 10_000});
        await expect(page.locator('.con-context [data-track-title]')).not.toHaveText('');
        await expect(page.locator('.con-context [data-dossier-section="track-when"]')).toContainText(/Когда/i);
        const read = await readColumn(page);
        expect(read.below, 'R3: no text under the couch floor').toEqual([]);
        expect(read.scroll).toBeLessThanOrEqual(2);
        await shoot(page, preset.id, 'd1-r3');
      });
    }
  });
}
