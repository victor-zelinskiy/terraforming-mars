/*
 * A PLACEMENT THAT PAYS A CARD *AND* RESOURCES IS ONE COORDINATED REWARD.
 *
 * Terra Cimmeria Nova prints exactly this: cell '36' is STEEL + DRAW_CARD
 * (one landing → a resource chip AND a card cover in the air at once) and
 * cell '38' is DRAW_CARD + DRAW_CARD (a multi-card fan). Before the fix the
 * two systems ran uncoordinated: the reveal overlay is PARKED while the
 * placement's reward beat plays, and the card-bonus scene destroyed itself
 * on a fixed post-arrival timer (single) or degraded when the parked
 * overlay's slots never became measurable (multi) — the flying card simply
 * VANISHED mid-story and the fullscreen later rose out of nothing.
 *
 * The contract these probes pin, frame by frame (an in-page sampler armed
 * BEFORE the commit — `setInterval`, never rAF):
 *   · the card cover/proxy exists CONTINUOUSLY from its first frame until
 *     the fullscreen viewer has taken over (single) / the reveal frame has
 *     unveiled around the landed covers (multi);
 *   · the resource chips fly CONCURRENTLY with the card and are gone —
 *     absorb tails included — before the covering surface opens;
 *   · a multi batch animates EXACTLY as many covers as cards received.
 *
 * Each sample also records the coordination seam's own truth
 * (`window.__rewardPayoutDiag` — the read-only diagnostics idiom), so a
 * failure names WHICH gate misread rather than just the symptom.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  bootSeededGame, createGameWithCards, fetchPlayerModel, forceSwiftPlacement, press, soloGameConfig,
} from './consoleStart';

const OUT = path.resolve('screenshots', 'card-bonus-concurrency');

/** STEEL + DRAW_CARD — the single-card + resource cell (y=4, 8th space). */
const STEEL_CARD_CELL = '36';
/** DRAW_CARD + DRAW_CARD — the multi-card cell (y=5, 1st space). */
const TWO_CARDS_CELL = '38';

const CONFIG = soloGameConfig({board: 'terra cimmeria nova'});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * Create games until the target cell is untiled. The solo neutral setup
 * (2 cities + 2 greeneries) lands RANDOMLY — the create-config seed is
 * ignored by the server — so the board is re-rolled over the API (cheap)
 * rather than asserted against luck.
 */
async function createCleanTcnGame(request: APIRequestContext, cellId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const playerId = await createGameWithCards(request, [], {config: CONFIG});
    const model = await fetchPlayerModel(request, playerId) as unknown as {
      game: {spaces: Array<{id: string, tileType?: unknown}>},
    };
    const target = model.game.spaces.find((s) => s.id === cellId);
    if (target !== undefined && target.tileType === undefined) {
      return playerId;
    }
  }
  throw new Error(`10 boards in a row had a neutral tile on cell ${cellId}`);
}

/** The pad cursor's current cell (the spotlight class the board section applies). */
async function cursorCell(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.querySelector('.board-space.con-cell-sel')?.getAttribute('data_space_id') ?? '');
}

/**
 * Walk the board cursor to `target` with the d-pad — the PAD path is the
 * point: `handleSectionConfirm` is where the card-bonus cover ARMS at
 * submit. Greedy per-axis walk with a stuck-detector (rows clamp at their
 * ends; a wall means «switch axis», never «press harder»).
 */
async function walkBoardCursorTo(page: Page, target: string, maxSteps = 70): Promise<boolean> {
  let lastCur = '';
  let stuck = 0;
  for (let i = 0; i < maxSteps; i++) {
    const cur = await cursorCell(page);
    if (cur === target) {
      return true;
    }
    if (cur === '') {
      await page.waitForTimeout(300);
      continue;
    }
    const centers = await page.evaluate(([a, b]) => {
      const centerOf = (id: string) => {
        const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
        if (el === null) {
          return null;
        }
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      };
      return [centerOf(a), centerOf(b)];
    }, [cur, target] as const);
    const [c, t] = centers;
    if (c === null || t === null) {
      return false;
    }
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    const vertical = Math.abs(dy) > 18;
    let key = vertical ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    stuck = cur === lastCur ? stuck + 1 : 0;
    if (stuck >= 1) {
      key = vertical ?
        (Math.abs(dx) < 2 ? 'ArrowRight' : (dx > 0 ? 'ArrowRight' : 'ArrowLeft')) :
        (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    lastCur = cur;
    await press(page, key, 240);
  }
  return (await cursorCell(page)) === target;
}

/** Open the basic convert-plants placement (LT wheel, LEFT slot). */
async function openConvertPlants(page: Page): Promise<void> {
  await press(page, 'Comma', 1400);
  await press(page, 'ArrowLeft', 2600);
  await expect(page.locator('.con-context__task-kicker'),
    'the convert-plants placement never opened').toHaveCount(1, {timeout: 20_000});
}

type Sample = {
  t: number,
  /** The hero cover (the lifted board icon) is painted. */
  cover: boolean,
  /** How many card proxies (covers→cards) are painted. */
  proxies: number,
  /** Resource-transfer chips in the DOM (absorb tails included). */
  chips: number,
  /** …of which visibly painted. */
  chipsShown: number,
  /** The fullscreen viewer is open. */
  zoom: boolean,
  /** The reveal overlay is mounted / still veiled (multi). */
  reveal: boolean,
  veiled: boolean,
  /** Cards offered in the reveal strip (multi slot count). */
  slots: number,
  /** The coordination seam's own truth (`__rewardPayoutDiag`). */
  settling: boolean,
  tilePhase: string,
  flights: number,
  scenePhase: string,
  sceneActive: boolean,
  zoomReady: boolean,
};

/** Arm the in-page sampler BEFORE the commit press (30 ms cadence). */
async function armSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__bonus?: {samples: Array<unknown>, stop: () => void}};
    const samples: Array<unknown> = [];
    const shown = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02;
    };
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      const chips = Array.from(document.querySelectorAll('.con-transfer__chip'));
      const diagFn = (window as unknown as {__rewardPayoutDiag?: () => {
        settling: boolean, tilePhase: string, flights: number,
        scene: {active: boolean, phase: string, zoomReady: boolean},
      }}).__rewardPayoutDiag;
      const d = diagFn?.();
      samples.push({
        t: Math.round(performance.now() - t0),
        cover: shown(document.querySelector('.con-bonusfly-cover')),
        proxies: Array.from(document.querySelectorAll('.con-bonusfly-proxy')).filter(shown).length,
        chips: chips.length,
        chipsShown: chips.filter(shown).length,
        zoom: document.querySelector('.con-zoom') !== null,
        reveal: document.querySelector('.con-reveal') !== null,
        veiled: document.querySelector('.con-reveal--bonus-veiled') !== null,
        slots: document.querySelectorAll('.con-reveal [data-zoom-slot]').length,
        settling: d?.settling ?? false,
        tilePhase: d?.tilePhase ?? '?',
        flights: d?.flights ?? -1,
        scenePhase: d?.scene.phase ?? '?',
        sceneActive: d?.scene.active ?? false,
        zoomReady: d?.scene.zoomReady ?? false,
      });
    }, 30);
    w.__bonus = {samples, stop: () => window.clearInterval(timer)};
  });
}

async function readSampler(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => {
    const w = window as unknown as {__bonus: {samples: Array<unknown>, stop: () => void}};
    w.__bonus.stop();
    return w.__bonus.samples;
  }) as Array<Sample>;
}

/** Longest run of consecutive samples failing `ok` inside [from, to]. */
function longestGap(samples: Array<Sample>, from: number, to: number, ok: (s: Sample) => boolean): number {
  let gap = 0;
  let worst = 0;
  for (let i = from; i <= to; i++) {
    gap = ok(samples[i]) ? 0 : gap + 1;
    worst = Math.max(worst, gap);
  }
  return worst;
}

function dumpSamples(tag: string, samples: Array<Sample>): void {
  console.log(`[${tag}] ${samples.length} samples over ${samples[samples.length - 1]?.t}ms\n` +
    samples.map((s) =>
      `${s.t} cov:${s.cover ? 1 : 0} prx:${s.proxies} chip:${s.chips}/${s.chipsShown} ` +
      `zoom:${s.zoom ? 1 : 0} rev:${s.reveal ? 1 : 0}${s.veiled ? 'v' : ''} slots:${s.slots} ` +
      `| set:${s.settling ? 1 : 0} tile:${s.tilePhase} fl:${s.flights} ` +
      `scene:${s.sceneActive ? '' : '!'}${s.scenePhase}${s.zoomReady ? '+zr' : ''}`).join('\n'));
}

test.describe('board card-bonus × resource payout — one coordinated reward', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});
  test.setTimeout(300_000);

  test('one cell pays STEEL + a CARD: chips land first, the card never vanishes, the viewer waits', async ({page, request}) => {
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    const playerId = await createCleanTcnGame(request, STEEL_CARD_CELL);
    await forceSwiftPlacement(page); // a timing measurement over the landing, not a confirm-flow spec
    await bootSeededGame(page, request, playerId, {});

    await openConvertPlants(page);
    expect(await walkBoardCursorTo(page, STEEL_CARD_CELL),
      `the board cursor never reached cell ${STEEL_CARD_CELL}`).toBeTruthy();
    await shoot(page, 'single-1-cell-picked');

    await armSampler(page);
    await press(page, 'Enter', 300);
    // Landing (~1.2s) + printed-bonus beat + card flight + the viewer.
    await page.waitForTimeout(1600);
    await shoot(page, 'single-2-concurrent-flights');
    await page.waitForTimeout(1400);
    await shoot(page, 'single-3-card-standing');
    await page.waitForTimeout(9000);
    const samples = await readSampler(page);
    await shoot(page, 'single-4-viewer-open');
    dumpSamples('single', samples);

    const first = (pred: (s: Sample) => boolean) => samples.findIndex(pred);
    const last = (pred: (s: Sample) => boolean) => {
      for (let i = samples.length - 1; i >= 0; i--) {
        if (pred(samples[i])) {
          return i;
        }
      }
      return -1;
    };
    const cardAt = first((s) => s.cover || s.proxies > 0);
    const zoomAt = first((s) => s.zoom);
    const chipSeenAt = first((s) => s.chipsShown > 0);
    const lastChipAt = last((s) => s.chips > 0);

    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(60);
    expect(cardAt, 'the card cover must lift off the cell (the pad submit arms the scene)')
      .toBeGreaterThanOrEqual(0);
    expect(chipSeenAt, 'the printed STEEL must fly as a physical chip').toBeGreaterThanOrEqual(0);
    expect(zoomAt, 'the received card must reach the fullscreen viewer').toBeGreaterThanOrEqual(0);
    // THE BUG: the standing card was destroyed while the reveal was parked
    // behind the payout. The card must exist continuously from its first
    // frame until the viewer has taken over (≤2 samples of paint-race slack).
    expect(longestGap(samples, cardAt, zoomAt, (s) => s.cover || s.proxies > 0 || s.zoom),
      'the flying/standing card disappeared mid-story').toBeLessThanOrEqual(2);
    // The CONCURRENCY is real: at some instant a chip and the card are BOTH in the air.
    expect(samples.some((s) => s.chipsShown > 0 && (s.cover || s.proxies > 0)),
      'chip and card were never concurrently on screen — the scenario degenerated').toBeTruthy();
    // The covering surface waits for the money: every chip (absorb tail
    // included) is gone before the fullscreen viewer opens.
    expect(lastChipAt, 'the steel chip must finish BEFORE the fullscreen viewer opens')
      .toBeLessThan(zoomAt);

    // Take the card so the game is left clean (A in the viewer).
    for (let i = 0; i < 5 && await page.locator('.con-zoom').count() > 0; i++) {
      await press(page, 'Enter', 1500);
    }
  });

  test('one cell pays TWO CARDS: exactly two covers fan out and never vanish before the frame', async ({page, request}) => {
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    const playerId = await createCleanTcnGame(request, TWO_CARDS_CELL);
    await forceSwiftPlacement(page); // a timing measurement over the landing, not a confirm-flow spec
    await bootSeededGame(page, request, playerId, {});

    await openConvertPlants(page);
    expect(await walkBoardCursorTo(page, TWO_CARDS_CELL),
      `the board cursor never reached cell ${TWO_CARDS_CELL}`).toBeTruthy();
    await shoot(page, 'multi-1-cell-picked');

    await armSampler(page);
    await press(page, 'Enter', 300);
    await page.waitForTimeout(1800);
    await shoot(page, 'multi-2-covers-travelling');
    await page.waitForTimeout(9000);
    const samples = await readSampler(page);
    await shoot(page, 'multi-3-reveal-open');
    dumpSamples('multi', samples);

    const first = (pred: (s: Sample) => boolean) => samples.findIndex(pred);
    const proxiesAt = first((s) => s.proxies > 0);
    const unveiledAt = first((s) => s.reveal && !s.veiled && s.slots > 0);
    const maxProxies = Math.max(...samples.map((s) => s.proxies));
    const maxSlots = Math.max(...samples.map((s) => s.slots));

    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(60);
    expect(proxiesAt, 'the covers must physically travel (the pad submit arms the scene)')
      .toBeGreaterThanOrEqual(0);
    // The count is the batch: two cards → exactly two covers, no duplicates.
    expect(maxProxies, 'the animated cover count must equal the received card count').toBe(2);
    expect(maxSlots, 'the reveal must offer exactly the two received cards').toBe(2);
    expect(unveiledAt, 'the reveal frame must unveil around the landed covers')
      .toBeGreaterThanOrEqual(0);
    // No cover may vanish before the frame stands around them (the multi
    // degrade destroyed them outright when the overlay was parked).
    expect(longestGap(samples, proxiesAt, unveiledAt, (s) => s.proxies > 0),
      'a cover disappeared before the reveal frame took over').toBeLessThanOrEqual(2);

    // Take both cards (A per card; the last take closes the reveal).
    for (let i = 0; i < 8 && await page.locator('.con-reveal').count() > 0; i++) {
      await press(page, 'Enter', 1500);
    }
  });
});
