/*
 * T15 · CD — THE STAGED BOARD SPEAKS THE PLAY (the stand of «STAGED PLAY — РОЗЫГРЫШ, КОТОРЫЙ ЗАКАНЧИВАЕТСЯ НА ПОЛЕ»).
 *
 * Wildlife Dome on a Redux table (the Greens rule; blue owns a city + a greenery and Herbivores — fixture
 * `wildlife-dome`) is the subject: a declarative greenery is a STAGED PLAY — «Разыграть» sends nothing, the board takes
 * the screen, the cell's confirm is the one POST. Scenes:
 *
 *   A · the staged board reads TRUE: the bar «A Разыграть здесь · B К карте» (never «Разместить» / «Отменить
 *       размещение»), the PLAY PLATE (the card, «15 M€», one line) over the tile's identity, the first cell's dossier
 *       «РТ … → … +2» with BOTH causes and «Сработает · Травоядные», the server untouched.
 *   B · the cursor's FIRST cell is the pure law's (`initialPlacementCursor` — beside blue's own tiles, never the
 *       board's centre).
 *   C · B is OWED, NEVER LOST: B pressed in every window of the hand-off (inside the ritual, at its tail, on the
 *       standing board, after a d-pad step, on a LOCKED cell) gives the composer back — the same card, the server
 *       untouched; in a window a hold owns, the bar SHOWED «Возвращаемся…». `TM_E2E_T15_B_ROUNDS` repeats the sweep.
 *   D · the commit: «Разыграть · 15 M€» on the locked cell, ONE POST, the greenery on that cell, O2 +1, TR +2, the
 *       flow ends on the board — and the held place lets go with the landing (PL-039).
 *   E · `wildlife-dome-o2max`: the dossier's rating row is the tile's +1 alone, still naming itself; TR +1.
 *   F · `wildlife-dome-noroom`: T15 is NOT playable and the hand says why — no play whose tile is skipped.
 *   G · `oceans-one-left`: Ice Asteroid's composer names the lost second ocean (PL-595) before the press.
 *
 * TWO PROFILES ON PURPOSE (the owner's acceptance of this iteration asks for the plate's height budget at 4K AND at
 * 1080 — the plate is ≤ 12 % of the dossier's height on each). TIMING class: scene C presses inside a ritual's windows
 * (motion ×1, `--exclusive --workers=1` on the box).
 *
 * Frames: `screenshots/t15/<TM_E2E_SHOTS_TAG | after>/<profile>/stand-*.png` (storyboard with `TM_E2E_STORYBOARD=1`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, focusedSpaceId, placementState, press, pressUntil, settle} from './consoleStart';
import {initialPlacementCursor} from '../../src/client/console/tilePlacement/placementCursorStart';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
] as const;

const T15 = 'Wildlife Dome';
const OUT = path.resolve('screenshots', 't15', process.env.TM_E2E_SHOTS_TAG ?? 'after');
const STORY = process.env.TM_E2E_STORYBOARD === '1';
const ROUNDS = Math.max(1, Number(process.env.TM_E2E_T15_B_ROUNDS ?? '1'));

type Space = {id: string, x: number, y: number, tileType?: number, color?: string};
type Wire = {
  game: {gameAge?: number, oxygenLevel: number, spaces: Array<Space>},
  thisPlayer: {color: string, terraformRating: number, megacredits: number, tableau?: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};

async function model(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `stand-${name}.png`)});
}

async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').first().textContent() ?? '').replace(/\s+/g, ' ').trim();
}

/** RT wheel → the hand, the cursor on `card`. */
async function focusInHand(page: Page, card: string): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(14, slots * 3)), `the cursor stands on ${card}`).toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

async function openComposer(page: Page, card: string): Promise<void> {
  if (await page.locator('.con-hand').count() === 0) {
    await focusInHand(page, card);
  }
  await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

/** «Разыграть» — the composer's commit (the arrival law may absorb the first press): until the ritual or the board runs. */
async function pressPlay(page: Page): Promise<void> {
  const started = async () => await page.locator('.con-played-hero__proxy').count() > 0 ||
    await page.locator('[data-staged-plate]').count() > 0 || await page.locator('.con-composer--play').count() === 0;
  expect(await pressUntil(page, 'Enter', started, {tries: 4, settleMs: 1200}), '«Разыграть» never started the staged play').toBe(true);
}

/**
 * «Разыграть» pressed RAW, its moment returned (scene C times every B window from it): the decision / arrival windows
 * waited out first (the press must be the commit, never the arrival — the driver's `press` would add its settle AFTER
 * the key, and the «400 ms» window landed past the ritual), then the key, then the ritual's proxy witnessed.
 */
async function pressPlayRaw(page: Page): Promise<number> {
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as {__conPromptSequence?: () => {settleLeftMs: number}, __conCommitArrival?: () => {leftMs: number}};
    return Math.max(w.__conPromptSequence?.().settleLeftMs ?? 0, w.__conCommitArrival?.().leftMs ?? 0);
  }), {timeout: 5_000, message: 'the arrival window of the composer never closed'}).toBeLessThanOrEqual(0);
  const t0 = Date.now();
  await page.keyboard.press('Enter');
  await page.locator('.con-played-hero__proxy').first().waitFor({state: 'attached', timeout: 4_000});
  return t0;
}

/** The staged board stands: the reticle aiming over the placement dossier (the plate is asserted where it is the subject). */
async function stagedBoard(page: Page): Promise<void> {
  await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the reticle never aimed'}).toBe('aiming');
  await page.locator('.con-context').waitFor({state: 'visible', timeout: 15_000});
}

/**
 * WHERE THE B LANDED — read until it is STABLE (two equal samples 400 ms apart): `composer` = the play composer stands
 * with no ritual proxy and no placement (the card is back, nothing sent); `board` = the staged board took the screen
 * (the B was lost). A composer still mounted UNDER the ritual is neither — it is the hand-off in flight.
 */
async function bLanding(page: Page, timeoutMs = 15_000): Promise<'composer' | 'board' | 'undecided'> {
  const read = async (): Promise<'composer' | 'board' | 'flight'> => {
    const state = await placementState(page);
    const proxy = await page.locator('.con-played-hero__proxy').count();
    const composer = await page.locator('.con-composer--play').count();
    if (state !== 'none' && composer === 0) {
      return 'board';
    }
    if (state === 'none' && proxy === 0 && composer > 0 && await page.locator('.con-composer--play').isVisible()) {
      return 'composer';
    }
    return 'flight';
  };
  const deadline = Date.now() + timeoutMs;
  let last: string | undefined;
  while (Date.now() < deadline) {
    const now = await read();
    if (now !== 'flight' && now === last) {
      return now;
    }
    last = now;
    await cinematicBeat(page, 400, 'the B landing read twice, 400 ms apart — a stable answer, not a frame of the hand-off');
  }
  return 'undecided';
}

/** A bar sampler (MutationObserver + setInterval — never rAF): did the bar ever read `needle`? */
async function armBarProbe(page: Page, needle: string): Promise<void> {
  await page.evaluate((n) => {
    const w = window as unknown as {__t15Bar: {seen: boolean, samples: number, texts: Array<string>}};
    w.__t15Bar = {seen: false, samples: 0, texts: []};
    const tick = () => {
      w.__t15Bar.samples++;
      const t = document.querySelector('.con-cmdbar')?.textContent ?? '';
      if (t.includes(n)) {
        w.__t15Bar.seen = true;
      }
      const flat = t.replace(/\s+/g, ' ').trim();
      if (w.__t15Bar.texts.length < 10 && w.__t15Bar.texts[w.__t15Bar.texts.length - 1] !== flat) {
        w.__t15Bar.texts.push(flat);
      }
    };
    const iv = setInterval(tick, 30);
    const mo = new MutationObserver(tick);
    mo.observe(document.body, {childList: true, subtree: true, characterData: true});
    setTimeout(() => {
      clearInterval(iv);
      mo.disconnect();
    }, 12_000);
  }, needle);
}

async function barProbe(page: Page): Promise<{seen: boolean, samples: number, texts: Array<string>}> {
  return await page.evaluate(() => (window as unknown as {__t15Bar: {seen: boolean, samples: number, texts: Array<string>}}).__t15Bar);
}

for (const preset of PROFILES) {
  test.describe(`T15 · the staged board speaks the play · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A·B · the bar, the plate, the first cell and its dossier (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'wildlife-dome', {query: preset.query});
      const before = await model(request, playerId);
      const price = before.cardsInHand?.find((c) => c.name === T15)?.calculatedCost ?? 15;
      await openComposer(page, T15);
      await pressPlay(page);
      await stagedBoard(page);

      // A · the bar speaks the play — and never the generic placement's words.
      const bar = await barText(page);
      test.info().annotations.push({type: 'bar', description: bar});
      expect(bar, bar).toContain('Разыграть здесь');
      expect(bar, bar).toContain('К карте');
      expect(bar, bar).not.toMatch(/Отменить размещение|Разместить здесь/);
      // …the plate carries the card and the price, above the tile's own identity.
      const plate = page.locator('[data-staged-plate]');
      await expect(plate.locator('[data-staged-card]')).toHaveText(/Заповедник под куполом/);
      await expect(plate.locator('[data-staged-price]')).toHaveText(new RegExp(`\\b${price}\\b`));
      await expect(page.locator('.con-context__title')).toHaveText(/Озеленение/);
      const plateBox = await plate.boundingBox();
      const panelBox = await page.locator('.con-context').boundingBox();
      expect(plateBox !== null && panelBox !== null).toBe(true);
      expect(plateBox!.height / panelBox!.height, `the plate takes ${plateBox!.height}px of a ${panelBox!.height}px panel`).toBeLessThanOrEqual(0.12);
      // …the server is untouched.
      const now = await model(request, playerId);
      expect(now.game.gameAge, 'nothing was sent').toBe(before.game.gameAge);
      expect(now.cardsInHand?.some((c) => c.name === T15)).toBe(true);

      // B · the first cell is the law's — beside blue's own tiles.
      const legal = await page.evaluate(() => [...document.querySelectorAll('.board-space--available[data_space_id]')].map((e) => e.getAttribute('data_space_id') ?? ''));
      const expected = initialPlacementCursor({
        cells: before.game.spaces.map((s) => ({id: s.id as never, x: s.x, y: s.y, tileType: s.tileType, color: s.color})),
        legal: legal as never,
        viewer: before.thisPlayer.color,
      });
      await expect.poll(() => focusedSpaceId(page), {timeout: 5_000, message: 'the cursor opens on the law\'s cell'}).toBe(expected);

      // A · the first cell's dossier: the rating ONE vector with both causes; the table's answer under «Сработает».
      const gain = page.locator('[data-dossier-section="gain"]');
      await expect(gain, 'the cell names what it gives').toContainText(/РТ/, {timeout: 15_000});
      await expect(gain).toContainText(/Кислород/);
      await expect(gain).toContainText(/Тайл озеленения/);
      const tr = before.thisPlayer.terraformRating;
      await expect(gain).toContainText(new RegExp(`${tr}\\s*→\\s*${tr + 2}`));
      const answers = page.locator('[data-dossier-section="reactions"]');
      await expect(answers, '«Сработает» names the table\'s answer').toContainText(/Травоядные/);
      await expect(gain, 'the table\'s answer is not the cell\'s gain').not.toContainText(/Травоядные/);
      // …and the dossier, plate included, does not scroll (a placement panel that scrolls is a defect — console-ui.md).
      const scroll = await page.locator('.con-context').evaluate((el) => ({sh: el.scrollHeight, ch: el.clientHeight}));
      test.info().annotations.push({type: 'dossier-scroll', description: JSON.stringify(scroll)});
      expect(scroll.sh, `the dossier scrolls: ${JSON.stringify(scroll)}`).toBeLessThanOrEqual(scroll.ch + 2);
      await shot(page, preset.id, 'A-board');
    });

    test(`C · B is owed, never lost — every window of the hand-off (${preset.id})`, async ({page, request}) => {
      test.setTimeout(120_000 + ROUNDS * 360_000);
      const {playerId} = await bootFixtureSeats(page, request, 'wildlife-dome', {query: preset.query});
      const age = (await model(request, playerId)).game.gameAge;
      // The windows: inside the ritual (from the press), at its tail, on the standing board, after a d-pad step,
      // on a locked cell (B unlocks, the next B returns).
      const windows: Array<{name: string, offsetMs?: number, after?: 'board' | 'dpad' | 'locked', owed: boolean}> = [
        {name: 'ritual-0', offsetMs: 0, owed: true},
        {name: 'ritual-400', offsetMs: 400, owed: true},
        {name: 'ritual-1200', offsetMs: 1200, owed: true},
        {name: 'tail-2100', offsetMs: 2100, owed: true},
        {name: 'board', after: 'board', owed: false},
        {name: 'dpad', after: 'dpad', owed: false},
        {name: 'locked', after: 'locked', owed: false},
      ];
      const results: Array<string> = [];
      let owedSeen = 0;
      let owedWindows = 0;
      for (let round = 0; round < ROUNDS; round++) {
        for (const w of windows) {
          await openComposer(page, T15);
          await armBarProbe(page, 'Возвращаемся');
          const t0 = w.offsetMs !== undefined ? await pressPlayRaw(page) : 0;
          if (w.offsetMs === undefined) {
            await pressPlay(page);
          }
          if (w.offsetMs !== undefined) {
            const wait = t0 + w.offsetMs - Date.now();
            if (wait > 0) {
              await cinematicBeat(page, wait, 'a B pressed INSIDE the staged ritual / its tail — the window under test, timed from the raw press');
            }
            await page.keyboard.press('Escape');
          } else {
            await stagedBoard(page);
            if (w.after === 'dpad') {
              await press(page, 'ArrowRight', 300);
            }
            if (w.after === 'locked') {
              await pressUntil(page, 'Enter', async () => await placementState(page) === 'locked', {tries: 3, settleMs: 700});
              await press(page, 'Escape', 500);
              await expect.poll(() => placementState(page), {timeout: 5_000, message: 'B on a locked cell unlocks first'}).toBe('aiming');
            }
            await page.keyboard.press('Escape');
          }
          const landing = await bLanding(page);
          const back = landing === 'composer';
          const composerCard = back ? await page.locator('.con-composer--play').textContent() ?? '' : '';
          const probe = await barProbe(page);
          test.info().annotations.push({type: `bar:${w.name}`, description: probe.texts.join(' ⟶ ')});
          if (w.owed) {
            owedWindows++;
            owedSeen += probe.seen ? 1 : 0;
          }
          results.push(`${round}:${w.name}=${back && /Заповедник/.test(composerCard) ? 'ok' : `LOST(${landing})`}${w.owed ? (probe.seen ? '(shown)' : `(not shown: ${probe.texts.join(' ⟶ ')})`) : ''}`);
          if (!back) {
            await shot(page, preset.id, `C-lost-${w.name}`);
            // Recover for the next window: B on the standing board returns to the composer.
            for (let i = 0; i < 3 && await bLanding(page, 4_000) !== 'composer'; i++) {
              await press(page, 'Escape', 800);
            }
          }
          expect((await model(request, playerId)).game.gameAge, `${w.name}: B sent nothing`).toBe(age);
          // Back to the hand, ready for the next window.
          await press(page, 'Escape', 900);
        }
      }
      test.info().annotations.push({type: 'b-windows', description: results.join(' · ')});
      expect(results.filter((r) => r.includes('LOST')), results.join(' · ')).toEqual([]);
      expect(owedSeen, `a B owed to a hold is SHOWN on the bar (${results.join(' · ')})`).toBeGreaterThanOrEqual(Math.ceil(owedWindows / 2));
    });

    test(`D · the commit — one POST, the tile, +2 TR, the end on the board, no amber (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'wildlife-dome', {query: preset.query});
      const before = await model(request, playerId);
      const price = before.cardsInHand?.find((c) => c.name === T15)?.calculatedCost ?? 15;
      await openComposer(page, T15);
      await pressPlay(page);
      await stagedBoard(page);
      const cell = await focusedSpaceId(page);
      await pressUntil(page, 'Enter', async () => await placementState(page) === 'locked', {tries: 3, settleMs: 700});
      const bar = await barText(page);
      expect(bar, bar).toMatch(new RegExp(`Разыграть · ${price}`));
      if (STORY) {
        await shot(page, preset.id, 'D-locked');
      }
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /player\/input/.test(r.url())) {
          posts.push(r.url());
        }
      });
      await press(page, 'Enter', 600);
      await expect.poll(async () => (await model(request, playerId)).thisPlayer.tableau?.some((c) => c.name === T15) === true,
        {timeout: 30_000, message: 'the play reached the tableau'}).toBe(true);
      const after = await model(request, playerId);
      expect(posts, 'ONE POST for the play and its cell').toHaveLength(1);
      expect(after.game.spaces.find((s) => s.id === cell)?.color, 'the greenery is blue\'s, on the cell that was locked').toBe(before.thisPlayer.color);
      expect(after.game.oxygenLevel - before.game.oxygenLevel).toBe(1);
      expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating).toBe(2);
      await settle(page, {timeoutMs: 30_000});
      await expect(page.locator('.con-composer--play'), 'the flow ends on the board').toHaveCount(0);
      await expect(page.locator('.con-hand'), 'no hand comes back').toHaveCount(0);
      // PL-039: the held place lets go with the landing — no marker (and no legacy «selected» outline: it has no writer) stays.
      await expect(page.locator('[data-landing-marker]'), 'PL-039: the landing marker let go').toHaveCount(0);
      await shot(page, preset.id, 'D-landed');
    });

    test(`E · oxygen at its maximum — the tile's rating alone, still named (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId} = await bootFixtureSeats(page, request, 'wildlife-dome-o2max', {query: preset.query});
      const before = await model(request, playerId);
      await openComposer(page, T15);
      await pressPlay(page);
      await stagedBoard(page);
      const gain = page.locator('[data-dossier-section="gain"]');
      const tr = before.thisPlayer.terraformRating;
      await expect(gain).toContainText(new RegExp(`${tr}\\s*→\\s*${tr + 1}`), {timeout: 15_000});
      await expect(gain, 'the lone rating still names its cause').toContainText(/Тайл озеленения/);
      await expect(gain).not.toContainText(/Кислород/);
      await shot(page, preset.id, 'E-o2max');
    });

    test(`F · no free cell — the card is not playable, and the hand says why (${preset.id})`, async ({page, request}) => {
      test.setTimeout(150_000);
      await bootFixtureSeats(page, request, 'wildlife-dome-noroom', {query: preset.query});
      await focusInHand(page, T15);
      const slot = page.locator(`.con-hand__slot[data-zoom-slot="${T15}"]`);
      await expect(page.locator('.con-hand'), 'the refusal is named in the hand').toContainText(/Нет места для размещения тайла/, {timeout: 10_000});
      await press(page, 'Enter', 900);
      expect(await page.locator('[data-staged-plate]').count(), 'no staged board for a card that cannot be played').toBe(0);
      await shot(page, preset.id, 'F-noroom');
      expect(await slot.count()).toBe(1);
    });

    test(`G · one ocean left — the composer names the lost second ocean (PL-595) (${preset.id})`, async ({page, request}) => {
      test.setTimeout(150_000);
      await bootFixtureSeats(page, request, 'oceans-one-left', {query: preset.query});
      await openComposer(page, 'Ice Asteroid');
      const composer = page.locator('.con-composer--play');
      await expect(composer, 'the lost ocean is named before the press').toContainText(/Размещение океана/, {timeout: 10_000});
      await expect(composer).toContainText(/не все океаны карты будут размещены/);
      await shot(page, preset.id, 'G-oceans');
    });

    test(`H · a standard City with Pets on the table — the dossier names the table's answer (PL-078) (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'sp-city-pets', {query: preset.query});
      await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 3, settleMs: 1400});
      const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      const snake = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
      for (let i = 0; i < snake.length && !/город/i.test(await focused()); i++) {
        await press(page, snake[i], 240);
      }
      expect(await focused(), 'the City row is focused').toMatch(/город/i);
      await pressUntil(page, 'Enter', async () => await placementState(page) !== 'none', {tries: 3, settleMs: 1400});
      const answers = page.locator('[data-dossier-section="reactions"]');
      await expect(answers, '«Сработает» names the animal of Pets').toContainText(/Домашние любимцы/, {timeout: 15_000});
      await shot(page, preset.id, 'H-sp-city');
    });
  });
}
