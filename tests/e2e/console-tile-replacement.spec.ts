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
import {expect, test, Page} from './consoleTest';
import * as fs from 'fs';
import * as path from 'path';
import {bootIntoGame, cinematicBeat, forceSwiftPlacement, openHandPlayComposer, placeTile, soloGameConfig, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {expectSeeThrough, expectUncovers} from './peekWitness';
import {armWitness} from './witness';

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
  // The shared placement driver: walk until a press RESOLVES the placement — the server's question moving on
  // (`promptId`), never only «the kicker left».
  await placeTile(page);
  // The greenery's own landing hero runs here — let it finish before reading: the console at rest, the tile on the
  // board (a poll — the cell paints a beat after the landing).
  await settle(page, {timeoutMs: 30_000});
  await expect.poll(async () => (await greeneries(page)).filter((id) => !before.has(id)),
    {message: 'convert-plants did not leave a greenery on the board'}).toHaveLength(1);
  const grown = (await greeneries(page)).filter((id) => !before.has(id));
  return grown[0];
}

/** Answer whatever the play raised (the drawn card's reveal) until the board
 *  placement stands. A single response carries the finished draw AND the
 *  `SelectSpace`, and the console admits the placement only once every card
 *  has been TAKEN — so this is «press A until the board is asking» (act →
 *  verify: each press gets its whole window before the next). */
async function reachPlacement(page: Page, maxPresses = 20): Promise<void> {
  const kicker = page.locator('.con-context__task-kicker');
  await pressUntil(page, 'Enter', async () => await kicker.count() > 0, {tries: maxPresses, settleMs: 1300});
}

/** Open the hand album, select the card, and confirm the play — the shared, verified opener (the hand's own «input
 *  released» signal, the focus walk turning at a wall, the composer LOADED), then the commit once it is ready. */
async function playFromHand(page: Page, card: string): Promise<void> {
  await openHandPlayComposer(page, card);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
  await settle(page);
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

    // ── The pick. The doomed greenery must be STANDING here: the player is
    //    choosing which of their tiles to sacrifice, and it is also what the
    //    removal beat has to carry away. (Pre-hiding it — the old behaviour —
    //    made every candidate an identical bare hex.)
    const cell = page.locator(`.board-space[data_space_id="${greenery}"]`);
    await expect(page.locator('.con-context__task-kicker'),
      'the Kaguya placement never opened').toHaveCount(1, {timeout: 30_000});
    await expect(cell).toHaveClass(/board-space--available/, {timeout: 15_000});
    await settle(page); // the placement's entrance (the camera, the grid) is over before the pick is read
    await expect.poll(async () => (await readCell(page, greenery)).tile,
      {message: 'the greenery must be VISIBLE while it is being chosen'}).toBe('greenery');
    await expect.poll(async () => (await readCell(page, greenery)).cleared,
      {message: 'nothing is removed yet — the window opens at the commit'}).toBeFalsy();
    // THE SEE-THROUGH («ПРОСВЕТ», TR47 — a remove-and-replace lifts a piece too): with the cursor on the doomed
    // greenery it goes translucent with its cube, the cell's printed bonus (if any) is painted under it, and the
    // dossier says the bonus is uncovered AND collected at once — the commit pays it, so the peek promises nothing else.
    await walkToSpace(page, greenery);
    const peek = await expectSeeThrough(page, greenery, 'top', 'the Kaguya pick', {reticle: 'projection'});
    await expectUncovers(page, [peek.bonusIcons > 0 ? /Откроется — и сразу будет получено/ : /Бонуса нет — открывать нечего/], 'the Kaguya pick');
    await expect.poll(async () => (await readCell(page, greenery)).cleared, {message: 'the see-through is not the removal window'})
      .toBeFalsy();
    await shoot(page, '2-picking-the-greenery');

    // ── CONFIRM, and watch the order of the beats. ──
    //
    // The scene is RECORDED from before the press (`armWitness` — the
    // product's own writes observed in the task that makes them, plus a frame
    // tick for what only a computed style moves; replace-proof): the tile
    // confirmation dialog is off by default (`hide_tile_confirmation`), so the
    // click IS the commit, and the whole removal + landing is over in about a
    // second — a Node-side loop of `page.evaluate` round trips samples it
    // three beats late and sees only the end state, and a page-side timer
    // sampler sleeps through a short pose on a starved renderer.
    //
    // Both proxies are MOUNTED for the whole transaction (the layer renders on
    // `active`, which is set at the arm), so presence proves nothing — each is
    // judged by what the director actually posed on it (`autoAlpha` writes
    // visibility + opacity).
    //
    // The record is `settled` — every state a task LEAVES, i.e. every state a
    // frame can paint (what the old timer sampler, itself a task of its own,
    // could see — minus its gaps): the claims are ORDER and COEXISTENCE («one
    // leaves, THEN the other arrives», «never the city while the old tile
    // still leaves») as much as «did it happen», and all of them are about
    // what the player could see.
    type Beat = {
      depart: boolean, landing: boolean, departCube: boolean,
      tile: string | null, cleared: boolean, bonusIcons: number, uncovering: boolean,
    };
    const beats = await armWitness<Beat, string>(page, 'kaguya-beats', (spaceId) => {
      const shown = (el: Element | null): boolean => {
        if (el === null) {
          return false;
        }
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02;
      };
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
      return {
        departCube: shown(cubeEl) && inside(departEl, cubeEl),
        depart: shown(departEl),
        landing: shown(document.querySelector(
          '.con-tileplace__tile:not(.con-tileplace__tile--depart):not(.con-tileplace__tile--remote)')),
        tile: cleared || match === null ? null : match[1],
        cleared,
        bonusIcons: cell?.querySelectorAll('.board-space-bonus').length ?? 0,
        uncovering: cell?.querySelector('.board-space-bonuses.con-tileplace-reveal') !== null &&
          cell?.querySelector('.board-space-bonuses.con-tileplace-reveal') !== undefined,
      };
    }, {args: greenery, settled: true});

    await cell.click();
    // The scene: removal (≈0.5 s) → flight + settle (≈0.7 s) → reward beat.
    // The stills are EVIDENCE, not assertions (a screenshot is slow enough to
    // drift a beat); the record above is what the claims are made against.
    await cinematicBeat(page, 120, 'a still of the greenery departing — evidence only');
    await shoot(page, '3-greenery-departing');
    await cinematicBeat(page, 430, 'a still of the uncovered cell — evidence only');
    await shoot(page, '4-cell-uncovered');
    await cinematicBeat(page, 350, 'a still of the city flying in — evidence only');
    await shoot(page, '5-city-flying-in');
    await cinematicBeat(page, 1100, 'a still of the bonus paying out — evidence only');
    await shoot(page, '6-bonus-paying-out');
    // The scene's END is a state: the city stands on the cell (bounded), then the console's own quiet (the reward
    // beat, the landing's holds) — the verdict below reads the record, whatever it holds.
    await beats.waitFor((b) => b.tile === 'city', {timeoutMs: 30_000}).catch(() => undefined);
    await settle(page, {timeoutMs: 30_000});
    const recorded = await beats.stop();
    const samples = recorded.map((s) => s.v);
    await shoot(page, '7-city-landed');

    const departAt = samples.findIndex((s) => s.depart);
    const clearedAt = samples.findIndex((s) => s.cleared);
    const uncoveredAt = samples.findIndex((s) => s.cleared && s.bonusIcons > 0);
    const landingAt = samples.findIndex((s) => s.landing);
    const cityAt = samples.findIndex((s) => s.tile === 'city');
    const cityWhileLeaving = samples.filter((s) => s.tile === 'city' && s.depart).length;
    const cubeRodeAlong = samples.filter((s) => s.depart && s.departCube).length;
    const t0 = recorded[0]?.t ?? 0;
    console.log(`[replacement] ${samples.length} recorded states over ${(recorded.at(-1)?.t ?? t0) - t0}ms\n` +
      recorded.map(({t, v: s}) =>
        `${t - t0} dep:${s.depart ? 1 : 0}${s.departCube ? '+cube' : ''} ` +
        `land:${s.landing ? 1 : 0} clr:${s.cleared ? 1 : 0} ` +
        `bon:${s.bonusIcons} unc:${s.uncovering ? 1 : 0} tile:${s.tile ?? '-'}`).join('\n'));

    // A dead recorder must fail loudly rather than pass every claim vacuously (it recorded at all — a count of
    // recorded STATES is no statement about the machine, so the floor is only «not dead»).
    expect(samples.length, 'the scene recorder never ran').toBeGreaterThan(0);
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
