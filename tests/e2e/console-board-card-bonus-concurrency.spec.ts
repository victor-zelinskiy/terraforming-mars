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
 * The contract these probes pin, state by state (a WITNESS armed BEFORE the
 * commit — FLAKE ZERO, `armWitness`: every state the product writes is
 * recorded in the task that writes it, `settled` because «the card is there
 * CONTINUOUSLY», «chip and card at once» and «the chips gone BEFORE the scene»
 * are claims about coexistence and order — never a sampler that sleeps):
 *   · the card cover/proxy exists CONTINUOUSLY from its first frame until
 *     the received-cards SCENE stands around it (TR57: one card and two
 *     cards are one scene — the lone card lands in its own slot, the
 *     fullscreen viewer is never opened for a reward);
 *   · the resource chips fly CONCURRENTLY with the card and are gone —
 *     absorb tails included — before the scene unveils;
 *   · a multi batch animates EXACTLY as many covers as cards received.
 *
 * Each state also records the coordination seam's own truth
 * (`window.__rewardPayoutDiag` — the read-only diagnostics idiom), so a
 * failure names WHICH gate misread rather than just the symptom.
 */
import {expect, test, Page} from './consoleTest';
import * as fs from 'fs';
import * as path from 'path';
import {bootSeededGame, cinematicBeat, forceSwiftPlacement, press, takeRevealCard} from './consoleStart';
import {STEEL_CARD_CELL, TWO_CARDS_CELL, createCleanTcnGame, openConvertPlants, walkBoardCursorTo} from './boardCellBonus';
import {armWitness, Witness} from './witness';
import type {ObservedSample} from './observeCore';

const OUT = path.resolve('screenshots', 'card-bonus-concurrency');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** One state of the reward as the page painted it (the witness stamps its time — the PAGE's clock). */
type BonusState = {
  /** The hero cover (the lifted board icon) is painted. */
  cover: boolean,
  /** How many card proxies (covers→cards) are painted. */
  proxies: number,
  /** Resource-transfer chips in the DOM (absorb tails included). */
  chips: number,
  /** …of which visibly painted. */
  chipsShown: number,
  /** WHICH chips — their kind classes and direction, so a red names the chip, never only its count. */
  chipKinds: string,
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
type Sample = ObservedSample<BonusState>;

/** The reader of {@link BonusState} — in the page, self-contained. */
function readBonus(): BonusState {
  const shown = (el: Element | null): boolean => {
    if (el === null) {
      return false;
    }
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02;
  };
  const chips = Array.from(document.querySelectorAll('.con-transfer__chip'));
  const diagFn = (window as unknown as {__rewardPayoutDiag?: () => {
    settling: boolean, tilePhase: string, flights: number,
    scene: {active: boolean, phase: string, zoomReady: boolean},
  }}).__rewardPayoutDiag;
  const d = diagFn?.();
  return {
    cover: shown(document.querySelector('.con-bonusfly-cover')),
    proxies: Array.from(document.querySelectorAll('.con-bonusfly-proxy')).filter(shown).length,
    chips: chips.length,
    chipsShown: chips.filter(shown).length,
    chipKinds: chips.map((c) => `${c.className.replace(/con-transfer__chip(--)?/g, '').trim() || 'stock'}:${c.getAttribute('data-transfer-direction') ?? ''}:${c.querySelector('.con-transfer__icon')?.className.replace('con-transfer__icon', '').trim() ?? ''}${c.textContent?.trim() ?? ''}`).join(','),
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
  };
}

/** Arm the reward's witness BEFORE the commit press — `settled`: the claims below are coexistence and order. */
async function armBonusWitness(page: Page): Promise<Witness<BonusState>> {
  return armWitness<BonusState>(page, 'card-bonus-concurrency', readBonus, {settled: true});
}

/** The scene stands around the card: the reveal is up, unveiled, with its slots. */
const standing = (s: BonusState) => s.reveal && !s.veiled && s.slots > 0;

/**
 * Longest run of consecutive recorded states failing `ok` inside [from, to]. The record keeps a state only when it
 * CHANGES, and `settled`: a state the product left between two tasks — so a run here is a state the page really
 * stood in, never a sampler's paint race.
 */
function longestGap(samples: Array<Sample>, from: number, to: number, ok: (s: BonusState) => boolean): number {
  let gap = 0;
  let worst = 0;
  for (let i = from; i <= to; i++) {
    gap = ok(samples[i].v) ? 0 : gap + 1;
    worst = Math.max(worst, gap);
  }
  return worst;
}

function dumpSamples(tag: string, samples: Array<Sample>): void {
  const t0 = samples[0]?.t ?? 0;
  console.log(`[${tag}] ${samples.length} states over ${(samples[samples.length - 1]?.t ?? t0) - t0}ms\n` +
    samples.map(({t, v: s}) =>
      `${t - t0} cov:${s.cover ? 1 : 0} prx:${s.proxies} chip:${s.chips}/${s.chipsShown}${s.chipKinds ? `[${s.chipKinds}]` : ''} ` +
      `zoom:${s.zoom ? 1 : 0} rev:${s.reveal ? 1 : 0}${s.veiled ? 'v' : ''} slots:${s.slots} ` +
      `| set:${s.settling ? 1 : 0} tile:${s.tilePhase} fl:${s.flights} ` +
      `scene:${s.sceneActive ? '' : '!'}${s.scenePhase}${s.zoomReady ? '+zr' : ''}`).join('\n'));
}

/** Take every card of the standing reveal — each take act → verify on the reveal's own `data-take`. */
async function takeAll(page: Page, maxTakes: number): Promise<void> {
  for (let i = 0; i < maxTakes && await page.locator('.con-reveal').count() > 0; i++) {
    if (!await takeRevealCard(page)) {
      return;
    }
  }
}

test.describe('board card-bonus × resource payout — one coordinated reward', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});
  test.setTimeout(300_000);

  test('one cell pays STEEL + a CARD: chips land first, the card never vanishes, it lands in the scene (no viewer)', async ({page, request}) => {
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    const playerId = await createCleanTcnGame(request, STEEL_CARD_CELL);
    await forceSwiftPlacement(page); // a timing measurement over the landing, not a confirm-flow spec
    await bootSeededGame(page, request, playerId, {});

    await openConvertPlants(page);
    expect(await walkBoardCursorTo(page, STEEL_CARD_CELL),
      `the board cursor never reached cell ${STEEL_CARD_CELL}`).toBeTruthy();
    await shoot(page, 'single-1-cell-picked');

    const bonus = await armBonusWitness(page);
    await press(page, 'Enter', 300);
    // Landing + printed-bonus beat + the card's flight into the scene: each screenshot is taken where the RECORD shows
    // its moment (diagnostic only — every claim below is judged on the record).
    if (await bonus.waitFor((s) => s.chipsShown > 0 && (s.cover || s.proxies > 0), {timeoutMs: 20_000}).catch(() => undefined) !== undefined) {
      await shoot(page, 'single-2-concurrent-flights');
    }
    if (await bonus.waitFor(standing, {timeoutMs: 30_000}).catch(() => undefined) !== undefined) {
      await shoot(page, 'single-3-card-standing');
    }
    // …and PAST the board-beat drain's 8 s quiet cap: the greenery raised the oxygen, and the scales' story (its TR
    // token) may not play under the scene that stands for the player (PL-489 — it did, at ~14 s, since before TR57).
    await cinematicBeat(page, 15_000, 'the scene stands past the board-beat drain\'s 8 s quiet cap (PL-489 flew at ~14 s) — ' +
      'the window in which no rating token may fly under it');
    const samples = await bonus.stop();
    await shoot(page, 'single-4-scene-standing');
    dumpSamples('single', samples);

    const first = (pred: (s: BonusState) => boolean) => samples.findIndex((s) => pred(s.v));
    const last = (pred: (s: BonusState) => boolean) => {
      for (let i = samples.length - 1; i >= 0; i--) {
        if (pred(samples[i].v)) {
          return i;
        }
      }
      return -1;
    };
    const cardAt = first((s) => s.cover || s.proxies > 0);
    const standAt = first(standing);
    const chipSeenAt = first((s) => s.chipsShown > 0);
    const lastChipAt = last((s) => s.chips > 0);

    // A dead witness must never pass: it recorded at least the state it was armed in.
    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(0);
    expect(cardAt, 'the card cover must lift off the cell (the pad submit arms the scene)')
      .toBeGreaterThanOrEqual(0);
    expect(chipSeenAt, 'the printed STEEL must fly as a physical chip').toBeGreaterThanOrEqual(0);
    expect(standAt, 'the received card must land in the scene\'s own slot').toBeGreaterThanOrEqual(0);
    expect(samples.some((s) => s.v.zoom), 'a lone reward card is the SAME scene — the fullscreen viewer never opens for it').toBe(false);
    expect(Math.max(...samples.map((s) => s.v.slots)), 'the scene offers exactly the one received card').toBe(1);
    // THE BUG: the standing card was destroyed while the reveal was parked
    // behind the payout. The card must exist continuously from its first
    // frame until the scene stands around it — in EVERY state the page stood
    // in (the record is `settled`: the cover's takeover by the proxies is one
    // task, so there is no paint race left to allow for).
    expect(longestGap(samples, cardAt, standAt, (s) => s.cover || s.proxies > 0),
      'the flying/standing card disappeared mid-story').toBe(0);
    // The CONCURRENCY is real: at some instant a chip and the card are BOTH in the air.
    expect(samples.some((s) => s.v.chipsShown > 0 && (s.v.cover || s.v.proxies > 0)),
      'chip and card were never concurrently on screen — the scenario degenerated').toBeTruthy();
    // The covering surface waits for the money: every chip (absorb tail
    // included) is gone before the scene unveils.
    expect(lastChipAt, 'the steel chip must finish BEFORE the scene unveils')
      .toBeLessThan(standAt);
    // THE SCALES WAIT FOR THE TAKE (PL-489): no rating token while the scene stands — a story drained past the cap
    // was born on the oxygen marker UNDER the scene and flew over it.
    expect(samples.filter((s) => s.v.chipKinds.includes('rating')).map((s) => `${s.t - (samples[0]?.t ?? 0)}ms`),
      "the oxygen step's TR token flew while the received-cards scene stood").toEqual([]);

    // Take the card (A in the scene) — and the uncovered board tells the scales' story: the TR token flies NOW
    // (RECORDED from before the take: the token is a flight, short on a fast frame).
    const rating = await armWitness<boolean>(page, 'card-bonus-rating',
      () => document.querySelector('.con-transfer__chip .resource_icon--rating') !== null);
    await takeAll(page, 5);
    await expect.poll(() => rating.ever((seen) => seen),
      {timeout: 20_000, message: "the scales' story never played on the board the take uncovered"}).toBe(true);
    await rating.stop();
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

    const bonus = await armBonusWitness(page);
    await press(page, 'Enter', 300);
    if (await bonus.waitFor((s) => s.proxies > 0, {timeoutMs: 20_000}).catch(() => undefined) !== undefined) {
      await shoot(page, 'multi-2-covers-travelling');
    }
    // The whole scene: the covers land, the scene unveils, the hand-off dissolves the proxies and the scene ENDS (its
    // own fact — `__rewardPayoutDiag().scene.active`) with the reveal standing for the take.
    await bonus.waitFor((s) => standing(s) && !s.sceneActive, {timeoutMs: 30_000}).catch(() => undefined);
    const samples = await bonus.stop();
    await shoot(page, 'multi-3-reveal-open');
    dumpSamples('multi', samples);

    const first = (pred: (s: BonusState) => boolean) => samples.findIndex((s) => pred(s.v));
    const proxiesAt = first((s) => s.proxies > 0);
    const unveiledAt = first(standing);
    const maxProxies = Math.max(...samples.map((s) => s.v.proxies));
    const maxSlots = Math.max(...samples.map((s) => s.v.slots));

    // A dead witness must never pass: it recorded at least the state it was armed in.
    expect(samples.length, 'the in-page sampler never ran').toBeGreaterThan(0);
    expect(proxiesAt, 'the covers must physically travel (the pad submit arms the scene)')
      .toBeGreaterThanOrEqual(0);
    // The count is the batch: two cards → exactly two covers, no duplicates.
    expect(maxProxies, 'the animated cover count must equal the received card count').toBe(2);
    expect(maxSlots, 'the reveal must offer exactly the two received cards').toBe(2);
    expect(unveiledAt, 'the scene must unveil with its landing covers')
      .toBeGreaterThanOrEqual(0);
    // No cover may vanish before the scene stands around them (the multi
    // degrade destroyed them outright when the overlay was parked) — in any
    // state the page stood in (`settled` — no paint race to allow for).
    expect(longestGap(samples, proxiesAt, unveiledAt, (s) => s.proxies > 0),
      'a cover disappeared before the scene took over').toBe(0);

    // Take both cards (A per card, each take verified; the last take closes the reveal).
    await takeAll(page, 8);
  });
});
