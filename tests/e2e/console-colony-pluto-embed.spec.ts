import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, press} from './consoleStart';

/**
 * PLUTO — THE EMBEDDED FOLLOW-UP GUARD.
 *
 * Pluto is the colony whose trade AND build deal CARDS, so both paths end in a
 * `CardDrawReveal`. The contract is that the payout presents INSIDE the colony
 * workspace — the focus stage hands its working area over and the reveal opens
 * there — and NEVER as a full-bleed band over the still-standing colony
 * screen (which is what «Плутон открывает модалку» actually was: not a legacy
 * component, but the console's own reveal teleported to `body` because the
 * claim was missing on the build path and the withhold arm knew only the card
 * claim).
 *
 * These two tests are the reason that can never come back silently.
 */

const OUT = path.resolve('screenshots', 'colony-pluto');

function newGameConfig() {
  return {
    players: [{name: 'PlutoEmbed', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    // Pluto plus three resource colonies: the setup removal can take one and
    // Pluto still survives into the action phase (`keepColony`).
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function boot(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  // A real hand (`buy`): the board home's dock only reads LIVE with cards in it.
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: 'Pluto'});
  await page.waitForTimeout(1500);
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

type Sighting = {
  /** The reveal was on screen at all. */
  seen: boolean;
  /** …and it was INSIDE the colony focus stage's outcome zone. */
  inStage: boolean;
  /** …and it carried the embedded skin (no own band / plate / header). */
  embedded: boolean;
  /** A full-bleed reveal parented straight to <body> — the reported bug. */
  fullBleed: boolean;
  /** Any legacy modal-input surface, ever. */
  legacyModal: boolean;
  /** TWO workspace roots visible at once (`.con-ws` ×2) — the split screen. */
  workspaceSplit: boolean;
  /** A STANDALONE hand workspace root during the payout — the flow break. */
  standaloneHand: boolean;
  /** The REMOVED intermediate: a hand squeezed into the focus stage's zone
   *  (planet left, cards right, B-only). It must never mount again. */
  focusHandZone: boolean;
  /** A BLANK colonies stage mid-flow: the section is up but nothing of the
   *  flow is — no focus stage, no reveal, no discard stage, no flying
   *  covers, browse hidden. The reported «пустая пауза». */
  emptyStage: boolean;
  /** The track-reset marker proxy flew while the FOCUS stage was down — the
   *  final commit beat must play on the colony's own big track. */
  markerOutsideFocus: boolean;
  /** The colony FOCUS stage stood at some point of the watch (the
   *  post-discard restore's proof on the return leg). */
  focusSeen: boolean;
  /** DIAGNOSTIC timeline (logged, not asserted): the colonies section went
   *  absent after it had been seen (ms into the watch), and the mandatory
   *  announcement card appeared (ms) — either mid-resolution is a lifecycle
   *  smell worth reading the log for. */
  coloniesGoneAtMs: number;
  announceAtMs: number;
};

/** Watch the whole payout window from inside the page (a poll from the test
 *  runner would miss the frames that matter). */
async function watchPayout(page: Page, ms: number): Promise<Sighting> {
  await page.evaluate((budget) => {
    const w = window as unknown as {__pluto?: Sighting};
    const seen: Sighting = {
      seen: false, inStage: false, embedded: false, fullBleed: false,
      legacyModal: false, workspaceSplit: false, standaloneHand: false,
      focusHandZone: false, emptyStage: false, markerOutsideFocus: false,
      focusSeen: false,
      coloniesGoneAtMs: -1, announceAtMs: -1,
    };
    w.__pluto = seen;
    let coloniesSeen = false;
    // A TRANSITION TIMELINE of the resolution's lifecycle bits — one entry per
    // state change, so a wrong release names its exact moment and order.
    const timeline: Array<Record<string, unknown>> = [];
    let lastKey = '';
    (seen as unknown as Record<string, unknown>).timeline = timeline;
    const t0 = performance.now();
    const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
    const tick = () => {
      const colonies = document.querySelector('.con-colonies');
      const diagFn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
      const d = diagFn !== undefined ? diagFn() : {};
      const brief = {
        colonies: colonies !== null,
        stack: (d.stack as Array<{kind: string}> | undefined)?.map((f) => f.kind).join('>') ?? '',
        host: d.outcomeHost ?? null,
        stage: d.outcomeStage ?? '',
        trade: d.tradeActive === true,
        live: d.resolutionLive === true,
        deferred: d.taskDeferred === true,
        wf: d.wfType ?? null,
        reveal: document.querySelector('.con-reveal') !== null,
        announce: document.querySelector('.con-mandatory') !== null,
        rel: d.lastRelease ?? '',
      };
      const key = JSON.stringify(brief);
      if (key !== lastKey && timeline.length < 60) {
        timeline.push({t: Math.round(performance.now() - t0), ...brief});
        lastKey = key;
      }
      if (colonies !== null) {
        coloniesSeen = true;
      } else if (coloniesSeen && seen.coloniesGoneAtMs < 0) {
        seen.coloniesGoneAtMs = Math.round(performance.now() - t0);
      }
      if (seen.announceAtMs < 0 && document.querySelector('.con-mandatory') !== null) {
        seen.announceAtMs = Math.round(performance.now() - t0);
      }
      const reveal = document.querySelector('.con-reveal');
      if (reveal !== null) {
        seen.seen = true;
        if (reveal.closest('.con-colfocus [data-outcome-zone]') !== null) {
          seen.inStage = true;
        }
        if (reveal.classList.contains('con-reveal--embedded')) {
          seen.embedded = true;
        }
        // Parented to <body> (or to the shell root) instead of a workspace
        // zone = the standalone band the contract forbids for a claimed
        // payout. `[data-embed-slot]` is the only legitimate host.
        if (reveal.closest('[data-embed-slot]') === null) {
          seen.fullBleed = true;
        }
      }
      if (document.querySelector('.mandatory-input-modal, .modal-input-root') !== null) {
        seen.legacyModal = true;
      }
      // The REMOVED intermediate state: a hand zone inside the focus stage.
      if (document.querySelector('.con-colfocus__handzone, .con-colfocus [data-hand-zone]') !== null) {
        seen.focusHandZone = true;
      }
      // A BLANK stage mid-flow — the «empty pause» class of break. The
      // colonies stand, yet NOTHING of the flow is on them: no focus stage,
      // no reveal, no full-stage discard, no flying covers, and the browse
      // grid is deliberately hidden (parked/yielded).
      if (colonies !== null && visible(colonies)) {
        const anyContent =
          document.querySelector('.con-colfocus') !== null ||
          document.querySelector('.con-reveal') !== null ||
          document.querySelector('.con-colonies__embed--hand') !== null ||
          document.querySelector('.con-coltrade-proxy, .con-deal-proxy, .con-discard-proxy') !== null;
        const browse = document.querySelector('.con-colonies__browse');
        const browseShowing = browse !== null &&
          !browse.classList.contains('con-colonies__browse--parked') &&
          !browse.classList.contains('con-colonies__browse--yield');
        if (!anyContent && !browseShowing) {
          seen.emptyStage = true;
        }
      }
      // The track-reset glide must play on the colony's OWN focus track.
      const marker = document.querySelector('.con-coltrade-marker');
      if (marker !== null && visible(marker) && document.querySelector('.con-colfocus') === null) {
        seen.markerOutsideFocus = true;
      }
      if (document.querySelector('.con-colfocus') !== null) {
        seen.focusSeen = true;
      }
      // DIAGNOSTIC: the first visible trade cover's pose + its landing slot —
      // a mis-measured slot inflates the whole separation choreography.
      const s0 = seen as unknown as Record<string, unknown>;
      if (s0.proxyPose === undefined) {
        const p = document.querySelector('.con-coltrade-proxy');
        const posed = p !== null && (p as HTMLElement).getBoundingClientRect().width > 40 &&
          getComputedStyle(p).visibility !== 'hidden';
        if (p !== null && posed) {
          const r = p.getBoundingClientRect();
          const slot = document.querySelector('.con-reveal [data-zoom-slot] :is(.card-container, .pcard)');
          const sr = slot?.getBoundingClientRect();
          s0.proxyPose = {
            t: Math.round(performance.now() - t0),
            x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
            slotW: sr === undefined ? -1 : Math.round(sr.width),
            slotH: sr === undefined ? -1 : Math.round(sr.height),
          };
        }
      }
      // ONE workspace root, ever. Two visible `.con-ws` roots is the reported
      // hand+colonies split screen; a visible STANDALONE hand root during a
      // colony payout is the «COLONIES → HAND» flow break (the mandatory
      // discard must run EMBEDDED inside the colonies).
      const roots = Array.from(document.querySelectorAll('.con-ws')).filter(visible);
      if (roots.length > 1) {
        seen.workspaceSplit = true;
      }
      const hand = document.querySelector('.con-hand.con-ws');
      if (hand !== null && visible(hand)) {
        seen.standaloneHand = true;
      }
      if (performance.now() - t0 < budget) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, ms);
  await page.waitForTimeout(ms + 300);
  return page.evaluate(() => (window as unknown as {__pluto?: Sighting}).__pluto as Sighting);
}

test.describe.configure({mode: 'serial'});

test('Pluto TRADE: the payout presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend into the focus stage (trade)
  expect(await page.locator('.con-colfocus').count(), 'the focus stage did not open').toBeGreaterThan(0);
  await shoot(page, '01-trade-stage');

  const watching = watchPayout(page, 11_000);
  await page.keyboard.press('KeyX'); // confirm the trade
  await page.waitForTimeout(1800);
  await shoot(page, '02-trade-handoff');
  await page.waitForTimeout(2200);
  await shoot(page, '03-trade-reveal');
  const seen = await watching;
  console.log('── Pluto trade payout ──', JSON.stringify(seen));
  await shoot(page, '04-trade-end');

  expect(seen.seen, 'no payout reveal ever appeared').toBeTruthy();
  expect(seen.legacyModal, 'a LEGACY modal opened for the Pluto payout').toBeFalsy();
  expect(seen.fullBleed, 'the payout mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the payout did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the payout did not open inside the colony FOCUS STAGE').toBeTruthy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone mounted').toBeFalsy();
  expect(seen.emptyStage, 'a BLANK colonies stage appeared mid-flow (the empty pause)').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();
});

test('Pluto BUILD: the draw presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));

  // The Build Colony standard project → the colony pick → the focus stage.
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);

  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend — build intent
  expect(await page.locator('.con-colfocus').count(), 'the build stage did not open').toBeGreaterThan(0);
  expect(await page.locator('.con-colfocus').getAttribute('data-colony-intent')).toBe('build');
  await shoot(page, '05-build-stage');

  const watching = watchPayout(page, 11_000);
  await page.keyboard.press('Enter'); // A = build confirm
  await page.waitForTimeout(1800);
  await shoot(page, '06-build-handoff');
  await page.waitForTimeout(2200);
  await shoot(page, '07-build-reveal');
  const seen = await watching;
  console.log('── Pluto build payout ──', JSON.stringify(seen));
  console.log('── reveal fit inside the zone ──', JSON.stringify(await page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height)};
    };
    return {
      zone: box('.con-colfocus__outcome'),
      reveal: box('.con-colfocus__outcome .con-reveal'),
      strip: box('.con-colfocus__outcome .con-reveal__strip'),
      slot: box('.con-colfocus__outcome .con-cards__slot'),
      card: box('.con-colfocus__outcome .con-cards__slot :is(.card-container, .pcard)'),
      zoom: getComputedStyle(document.querySelector('.con-colfocus__outcome .con-reveal__strip') ?? document.body).getPropertyValue('--con-cards-zoom'),
    };
  })));
  await shoot(page, '08-build-end');

  expect(seen.seen, 'no draw reveal ever appeared for the build bonus').toBeTruthy();
  expect(seen.legacyModal, 'a LEGACY modal opened for the Pluto build draw').toBeFalsy();
  expect(seen.fullBleed, 'the draw mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the draw did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the draw did not open inside the colony FOCUS STAGE').toBeTruthy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone mounted').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();

  // ── NO SIZE JUMP WHEN A CARD IS TAKEN. The reveal's own contract says the
  //    card scale is FIXED for the batch — taking one must re-centre the row,
  //    never resize what is left. Inside a workspace zone that is doubly
  //    true: a resize here would move the whole stage under the player.
  const cardW = () => page.evaluate(() => {
    const el = document.querySelector('.con-colfocus__outcome .con-cards__slot :is(.card-container, .pcard)');
    return el === null ? -1 : Math.round(el.getBoundingClientRect().width);
  });
  const before = await cardW();
  await press(page, 'Enter', 2200); // take one card
  const after = await cardW();
  console.log(`── card width across a take: ${before} → ${after}`);
  await shoot(page, '09-build-after-take');
  if (before > 0 && after > 0) {
    expect(Math.abs(after - before), `the card resized when one was taken (${before} → ${after})`)
      .toBeLessThanOrEqual(2);
  }
});

/**
 * THE WHOLE RESOLUTION IS ONE WORKSPACE — the definition-of-done guard.
 *
 * Build a colony on Pluto, then TRADE with it: the payout now owes the OWNER
 * BONUS cycle (draw 1 → MANDATORY discard 1). The contract under test:
 *  · the colony workspace stays mounted from the confirm to the last settle;
 *  · the mandatory discard runs on the REAL hand EMBEDDED inside it
 *    (`.con-colonies .con-hand--embedded`), never as a standalone root;
 *  · no second workspace root is ever visible (the split screen);
 *  · no board-level «Получены карты» band, no legacy modal.
 */
test('Pluto TRADE with an OWN colony: the mandatory discard runs EMBEDDED in the same workspace', async ({page, request}) => {
  test.setTimeout(480_000);
  await boot(page, request, await createGame(request));

  // ── 1 · Build the colony (the test-2 route, condensed). ──────────────────
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000);
  await press(page, 'Enter', 2600); // A = build confirm
  // Collect the build's two bonus cards (A per focused card).
  for (let i = 0; i < 4 && await page.locator('.con-reveal').count() > 0; i++) {
    await press(page, 'Enter', 2400);
  }
  await page.waitForTimeout(2500);

  // ── 2 · Trade with Pluto — the full owner-bonus resolution. ─────────────
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend (trade intent)
  expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
  const watching = watchPayout(page, 60_000);
  await page.keyboard.press('KeyX'); // confirm the trade
  // The payout assembles through fleet → chips → covers: wait for the reveal
  // to become INTERACTIVE (a focused slot) instead of guessing a delay.
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
  await shoot(page, '10-own-colony-reveal');

  // ── 3 · Work the table with A: take the income card, let the bonus card's
  //    on-the-table flip play (a press mid-flip is swallowed by design), take
  //    it, then the SAME press on the closer opens the mandatory discard —
  //    which must appear EMBEDDED inside this very workspace.
  const embeddedHand = page.locator('.con-colonies .con-hand.con-hand--embedded');
  for (let i = 0; i < 14 && await embeddedHand.count() === 0; i++) {
    await press(page, 'Enter', 2400);
  }
  await shoot(page, '11-own-colony-taken');
  // The timeline is the diagnosis on a failure — dump it BEFORE asserting.
  const seenEarly = await watching;
  console.log('── Pluto own-colony resolution ──', JSON.stringify(seenEarly));
  await expect(embeddedHand, 'the mandatory discard did not open EMBEDDED inside the colony workspace')
    .toBeVisible({timeout: 12_000});
  // The crumb still names the workspace root; the seat is standing.
  expect(await page.locator('.con-colonies').count(), 'the colony workspace was unmounted mid-resolution').toBeGreaterThan(0);
  // THE FULL-STAGE DISCARD: the source chip stands (the colony's compact
  // context), and the «СБРОШЕННЫЕ» seat belongs to the workspace — asserted
  // NOW, while the phase is live (both fold with it).
  expect(await page.locator('.con-colonies .con-colonies__srcchip').count(),
    'the source chip did not stand during the discard').toBeGreaterThan(0);
  expect(await page.locator('.con-colonies [data-colony-discard-seat]').count(),
    'the discard seat did not stand inside the workspace').toBeGreaterThan(0);
  await shoot(page, '12-embedded-discard');

  // ── 4 · Discard (single-select: A submits the focused card) — with the
  //    RETURN LEG under its own watch: the card flies to «СБРОШЕННЫЕ», the
  //    survivors gather into the dock, the colony FOCUS re-expands from the
  //    chip, and only then the workspace closes. No overview frame, no blank
  //    stage, no marker outside the focus — and the restore must be SEEN.
  const returnWatch = watchPayout(page, 16_000);
  await press(page, 'Enter', 3200);
  await page.waitForTimeout(3200); // the discard flight + settle
  await shoot(page, '13-after-discard');
  const tail = await returnWatch;
  console.log('── return leg ──', JSON.stringify(tail));
  expect(tail.emptyStage, 'a BLANK stage appeared on the return leg').toBeFalsy();
  expect(tail.focusHandZone, 'the focus-stage hand zone mounted on the return leg').toBeFalsy();
  expect(tail.markerOutsideFocus, 'the track marker flew OUTSIDE the focus on the return leg').toBeFalsy();
  expect(tail.focusSeen, 'the colony FOCUS was never restored after the discard').toBeTruthy();

  const seen = seenEarly;
  expect(seen.legacyModal, 'a LEGACY modal opened during the resolution').toBeFalsy();
  expect(seen.fullBleed, 'a payout mounted OUTSIDE a workspace zone during the resolution').toBeFalsy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.standaloneHand, 'the discard opened a STANDALONE hand workspace').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone (the B-only intermediate) mounted').toBeFalsy();
  expect(seen.emptyStage, 'a BLANK colonies stage appeared mid-flow (the empty pause)').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();
});
