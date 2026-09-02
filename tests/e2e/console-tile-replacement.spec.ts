/*
 * A TILE THAT REPLACES ANOTHER TILE STILL HAS TO BE PLACED.
 *
 * «Технологии Кагуя» (Kaguya Tech) is the one Mars card that operates on a cell
 * you already own: "remove 1 of your greenery tiles and place a city there.
 * Gain placement bonuses as usual." The console's landing hero refused it
 * outright — `verifyPlacement` only ever accepted EMPTY → TILED (plus the Ares
 * ocean cover) — so the whole placement was a SWAP: the greenery's sprite
 * became a city's between two frames, with no flight, no removal and no reward
 * beat. `observeTilePlacement` cannot rescue it either: a tile type that
 * changes without passing through `undefined` is deliberately silent there.
 *
 * The scene now opens with a REMOVAL and then does exactly what it does for any
 * other cell. This probe watches that order frame by frame:
 *
 *   the greenery STANDS while the player picks it (it is the object being
 *     sacrificed — it may not be pre-hidden);
 *   confirm → a DEPARTURE proxy carries it off;
 *   the emptied cell reads as a bare hex WITH its printed bonus;
 *   the replacement FLIES in (the ordinary landing proxy);
 *   and only then is the city on the board.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {bootIntoGame, forceSwiftPlacement, soloGameConfig, press} from './consoleStart';

const OUT = path.resolve('screenshots', 'tile-replacement');

/** Promo X58 — the card under test. */
const KAGUYA = 'Kaguya Tech';
/** Cheap, harmless company for the rest of the buy (the deal must offer them). */
const FILLER = ['Acquired Company', 'Rover Construction'];

const CONFIG = soloGameConfig({
  expansions: {promo: true},
  seed: 0.31,
  customProjectCards: [KAGUYA, ...FILLER],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** How a cell currently READS — the three states the whole probe is about. */
type CellRead = {
  /** A tile sprite is painted (and not blanked by the removal window). */
  tile: string | undefined,
  /** The removal window is open on it: no sprite, printed bonus showing. */
  cleared: boolean,
  /** The printed bonus icons are in the DOM (only an empty-reading cell has them). */
  bonusIcons: number,
};

async function readCell(page: Page, id: string): Promise<CellRead> {
  return page.evaluate((spaceId) => {
    const cell = document.querySelector(`.board-space[data_space_id="${spaceId}"]`);
    const tileEl = cell?.querySelector('[class*="board-space-tile--"]') ?? null;
    const cleared = tileEl !== null && tileEl.className.includes('board-space-tile--placement-cleared');
    const match = /board-space-tile--([a-z0-9-]+)/.exec(tileEl?.className ?? '');
    return {
      tile: cleared || match === null || match[1] === 'placement' ? undefined : match[1],
      cleared,
      bonusIcons: cell?.querySelectorAll('.board-space-bonus').length ?? 0,
    };
  }, id);
}

/** Every cell currently painting a greenery. In a solo game the neutral player
 *  owns some of them, so the viewer's own is identified by DIFFERENCE (which
 *  one appeared) rather than by reading a cube colour off the DOM. */
async function greeneries(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('.board-space [class*="board-space-tile--greenery"]'))
    .map((el) => el.parentElement?.getAttribute('data_space_id') ?? '')
    .filter((id) => id !== ''));
}

/** Put ONE greenery of the viewer's on the board: the basic convert-plants
 *  action (test mode starts the player with plants to spare). */
async function growAGreenery(page: Page): Promise<string> {
  const before = new Set(await greeneries(page));
  // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» is the LEFT slot. The wheel is
  // press→release: the direction ARMS the slot and firing it opens the
  // placement, so the arrow alone is the whole activation.
  await press(page, 'Comma', 1400);
  await press(page, 'ArrowLeft', 2600);
  const kicker = page.locator('.con-context__task-kicker');
  await expect(kicker, 'the convert-plants placement never opened').toHaveCount(1, {timeout: 20_000});
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 24 && await kicker.count() > 0; i++) {
    await press(page, 'Enter', 1200);
    if (await kicker.count() === 0) {
      break;
    }
    await press(page, dirs[i % dirs.length], 350);
  }
  // The greenery's own landing hero runs here — let it finish before reading.
  await page.waitForTimeout(4000);
  const grown = (await greeneries(page)).filter((id) => !before.has(id));
  expect(grown, 'convert-plants did not leave a greenery on the board').toHaveLength(1);
  return grown[0];
}

/** Answer whatever the play raised (the drawn card's reveal) until the board
 *  placement stands. A single response carries the finished draw AND the
 *  `SelectSpace`, and the console admits the placement only once every card
 *  has been TAKEN — so this is «press A until the board is asking». */
async function reachPlacement(page: Page, maxPresses = 20): Promise<void> {
  const kicker = page.locator('.con-context__task-kicker');
  for (let i = 0; i < maxPresses && await kicker.count() === 0; i++) {
    await press(page, 'Enter', 1300);
  }
}

/** Open the hand album, select the card, and confirm the play. */
async function playFromHand(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
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
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
  await page.waitForTimeout(1000);
  await press(page, 'Enter', 2500);
}

test.describe('a tile that REPLACES one of yours is placed, not swapped', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});
  test.setTimeout(400_000);

  test('Kaguya Tech: the greenery LEAVES, its bonus surfaces, the city LANDS', async ({page, request}) => {
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await forceSwiftPlacement(page); // the removal cinematic is the subject; click = commit
    await bootIntoGame(page, request, {config: CONFIG, cards: [KAGUYA, ...FILLER], buy: 3});

    const greenery = await growAGreenery(page);
    await shoot(page, '1-greenery-on-board');

    await playFromHand(page, KAGUYA);
    // The card draws as it resolves; that reveal stands between the play and
    // the placement (a prompt is admitted only once the arrival chain is done).
    await reachPlacement(page);
    await page.waitForTimeout(1500);

    // ── The pick. The doomed greenery must be STANDING here: the player is
    //    choosing which of their tiles to sacrifice, and it is also what the
    //    removal beat has to carry away. (Pre-hiding it — the old behaviour —
    //    made every candidate an identical bare hex.)
    const cell = page.locator(`.board-space[data_space_id="${greenery}"]`);
    await expect(page.locator('.con-context__task-kicker'),
      'the Kaguya placement never opened').toHaveCount(1, {timeout: 30_000});
    await expect(cell).toHaveClass(/board-space--available/, {timeout: 15_000});
    const atPick = await readCell(page, greenery);
    await shoot(page, '2-picking-the-greenery');
    expect(atPick.tile, 'the greenery must be VISIBLE while it is being chosen').toBe('greenery');
    expect(atPick.cleared, 'nothing is removed yet — the window opens at the commit').toBeFalsy();

    // ── CONFIRM, and watch the order of the beats. ──
    //
    // The sampler is armed IN THE PAGE and BEFORE the press: the tile
    // confirmation dialog is off by default (`hide_tile_confirmation`), so the
    // click IS the commit, and the whole removal + landing is over in about a
    // second — a Node-side loop of `page.evaluate` round trips samples it
    // three beats late and sees only the end state. `setInterval`, never
    // `requestAnimationFrame`: headless Chromium drives rAF off the compositor
    // and stops it exactly when the screen goes quiet.
    //
    // Both proxies are MOUNTED for the whole transaction (the layer renders on
    // `active`, which is set at the arm), so presence proves nothing — each is
    // judged by what the director actually posed on it (`autoAlpha` writes
    // visibility + opacity).
    await page.evaluate((spaceId) => {
      type Sample = {
        t: number, depart: boolean, landing: boolean, departCube: boolean,
        tile: string | undefined, cleared: boolean, bonusIcons: number, uncovering: boolean,
      };
      const w = window as unknown as {__repl?: {samples: Array<Sample>, stop: () => void}};
      const samples: Array<Sample> = [];
      const shown = (el: Element | null): boolean => {
        if (el === null) {
          return false;
        }
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02;
      };
      const t0 = performance.now();
      const timer = window.setInterval(() => {
        const cell = document.querySelector(`.board-space[data_space_id="${spaceId}"]`);
        const tileEl = cell?.querySelector('[class*="board-space-tile--"]') ?? null;
        const cleared = tileEl !== null && tileEl.className.includes('board-space-tile--placement-cleared');
        const match = /board-space-tile--([a-z0-9-]+)/.exec(tileEl?.className ?? '');
        const departEl = document.querySelector('.con-tileplace__tile--depart');
        // The owner marker LEAVES ON the tile it was marking: a cube twin rides
        // the proxy, and it must sit INSIDE the proxy's own box (the board
        // authors that socket in px against an unscaled hex, so a proxy posed
        // at the measured — already zoomed — rect has to re-derive it).
        const cubeEl = departEl?.querySelector('.player-cube') ?? null;
        const inside = (outer: Element | null, inner: Element | null): boolean => {
          if (outer === null || inner === null) {
            return false;
          }
          const o = outer.getBoundingClientRect();
          const i = inner.getBoundingClientRect();
          return i.width > 2 && i.left >= o.left - 1 && i.right <= o.right + 1 &&
            i.top >= o.top - 1 && i.bottom <= o.bottom + 1;
        };
        samples.push({
          t: Math.round(performance.now() - t0),
          departCube: shown(cubeEl) && inside(departEl, cubeEl),
          depart: shown(departEl),
          landing: shown(document.querySelector(
            '.con-tileplace__tile:not(.con-tileplace__tile--depart):not(.con-tileplace__tile--remote)')),
          tile: cleared || match === null ? undefined : match[1],
          cleared,
          bonusIcons: cell?.querySelectorAll('.board-space-bonus').length ?? 0,
          uncovering: cell?.querySelector('.board-space-bonuses.con-tileplace-reveal') !== null &&
            cell?.querySelector('.board-space-bonuses.con-tileplace-reveal') !== undefined,
        });
      }, 30);
      w.__repl = {samples, stop: () => window.clearInterval(timer)};
    }, greenery);

    await cell.click();
    // The scene: removal (≈0.5 s) → flight + settle (≈0.7 s) → reward beat.
    // The stills are EVIDENCE, not assertions (a screenshot is slow enough to
    // drift a beat); the sampler above is what the claims are made against.
    await page.waitForTimeout(120);
    await shoot(page, '3-greenery-departing');
    await page.waitForTimeout(430);
    await shoot(page, '4-cell-uncovered');
    await page.waitForTimeout(350);
    await shoot(page, '5-city-flying-in');
    await page.waitForTimeout(1100);
    await shoot(page, '6-bonus-paying-out');
    await page.waitForTimeout(7000);
    const samples = await page.evaluate(() => {
      const w = window as unknown as {__repl: {samples: Array<Record<string, unknown>>, stop: () => void}};
      w.__repl.stop();
      return w.__repl.samples;
    }) as Array<{
      t: number, depart: boolean, landing: boolean, departCube: boolean,
      tile: string | undefined, cleared: boolean, bonusIcons: number, uncovering: boolean,
    }>;
    await shoot(page, '7-city-landed');

    const first = (pred: (s: typeof samples[number]) => boolean) => samples.findIndex(pred);
    const departAt = first((s) => s.depart);
    const clearedAt = first((s) => s.cleared);
    const uncoveredAt = first((s) => s.cleared && s.bonusIcons > 0);
    const landingAt = first((s) => s.landing);
    const cityAt = first((s) => s.tile === 'city');
    const cityWhileLeaving = samples.filter((s) => s.tile === 'city' && s.depart).length;
    const cubeRodeAlong = samples.filter((s) => s.depart && s.departCube).length;
    console.log(`[replacement] ${samples.length} samples over ${samples[samples.length - 1]?.t}ms\n` +
      samples.map((s) =>
        `${s.t} dep:${s.depart ? 1 : 0}${s.departCube ? '+cube' : ''} ` +
        `land:${s.landing ? 1 : 0} clr:${s.cleared ? 1 : 0} ` +
        `bon:${s.bonusIcons} unc:${s.uncovering ? 1 : 0} tile:${s.tile ?? '-'}`).join('\n'));

    // A dead sampler must fail loudly rather than pass every claim vacuously.
    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(30);
    expect(departAt, 'the doomed greenery must physically LEAVE the cell').toBeGreaterThanOrEqual(0);
    expect(clearedAt, 'the emptied cell must read as a bare hex between the two tiles')
      .toBeGreaterThanOrEqual(0);
    expect(uncoveredAt, 'the removal must uncover the printed bonus the card then pays out')
      .toBeGreaterThanOrEqual(0);
    expect(landingAt, 'the replacement must FLY in like any other tile').toBeGreaterThanOrEqual(0);
    // ORDER is the whole point: one tile leaves, THEN the other arrives.
    expect(departAt, 'the removal must come first').toBeLessThan(landingAt);
    expect(cityWhileLeaving, 'the city must not be on the board while the old tile is still leaving').toBe(0);
    // The plot stays yours: the marker leaves with the tile it was marking and
    // the landing's own cube drop puts a fresh one on the city.
    expect(cubeRodeAlong, 'the owner marker must ride the departing tile, in its socket')
      .toBeGreaterThan(0);
    expect(cityAt, 'the city must end up on the board').toBeGreaterThanOrEqual(0);
    expect(samples[samples.length - 1].tile, 'and stay there').toBe('city');
  });
});
