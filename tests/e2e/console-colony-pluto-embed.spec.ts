import {test, expect, Page, APIRequestContext, Locator} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, finiteMotion, press, pressUntil, settle, takeRevealCard, walkFocusUntil} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, pageNow, Witness} from './witness';
import type {ObservedSample} from './observeCore';

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
 *
 * FLAKE ZERO: every window is RECORDED from before the press that opens it
 * (`armWitness` — the product's own writes, every state a task leaves) and
 * ends on a STATE of the product (the payout standing for the take, the
 * workspace's own leave), never on a sampler's budget; every geometry read is
 * at rest (`readSettled`); every press of a series is act → verify.
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
  await settle(page);
}

/**
 * RT wheel → the colonies (on the wheel the direction press IS the activation) — each round verified by the section
 * standing, which gets the press's WHOLE window before the round is repeated.
 */
async function openColoniesSection(page: Page, colonies: Locator): Promise<void> {
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await pressUntil(page, 'ArrowRight', async () => await colonies.count() > 0, {tries: 1, settleMs: 1300});
  }
}

/** The focused colony tile's identity ('' when none). */
async function focusedColony(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.con-coltile--focused')?.getAttribute('data-test') ?? '');
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  await openColoniesSection(page, colonies);
  await expect.poll(() => colonies.count(), {message: 'colonies section did not open'}).toBeGreaterThan(0);
  // The cursor WALKED onto the tile (`walkFocusUntil`: act → verify, turning round at a wall) along a row, a row down
  // when the row does not hold it.
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  const hit = async () => await focused.count() > 0;
  for (let row = 0; row < 5 && !await walkFocusUntil(page, hit, () => focusedColony(page), 10, 380); row++) {
    await press(page, 'ArrowDown', 380);
  }
  await expect.poll(() => focused.count(), {message: `could not focus ${target}`}).toBeGreaterThan(0);
}

/**
 * The Build Colony standard project → the colony pick → Pluto's build stage → the build confirmed, its two bonus cards
 * taken (the shared route of the owner-bonus tests). Every press verified by the surface it opens.
 */
async function buildOnPluto(page: Page): Promise<void> {
  await press(page, 'Comma', 1200);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 1, settleMs: 1400});
  await expect.poll(() => page.locator('.con-stdp').count(), {message: 'standard projects did not open'}).toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 1, settleMs: 1800});
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 1, settleMs: 2000});
  // A = build confirm — verified by the build's own draw standing (or the stage letting go).
  await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() > 0 ||
    await page.locator('.con-colfocus').count() === 0, {tries: 1, settleMs: 2600});
  // Collect the build's two bonus cards (A per focused card — each take act → verify on the reveal's own take state).
  await page.locator('.con-reveal').first().waitFor({timeout: 15_000}).catch(() => undefined);
  for (let i = 0; i < 4 && await page.locator('.con-reveal').count() > 0; i++) {
    if (!await takeRevealCard(page)) {
      break;
    }
  }
}

/** The width of the draw's first card in the focus stage's zone (-1 when none) — read through `readSettled`. */
async function readCardWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-colfocus__outcome .con-cards__slot :is(.card-container, .pcard)');
    return el === null ? -1 : Math.round(el.getBoundingClientRect().width);
  });
}

/** The motion of an arrival at rest (bounded — the end of a window, never a claim). */
async function motionAtRest(page: Page): Promise<void> {
  await expect.poll(() => finiteMotion(page), {timeout: 8_000}).toBe(0).catch(() => undefined);
}

/** The payout STANDS FOR THE TAKE: the reveal interactive (a focused slot) and its arrival at rest. */
async function payoutStands(page: Page): Promise<void> {
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000}).catch(() => undefined);
  await motionAtRest(page);
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
  /**
   * THE TRACK RESET RAN WHILE CARDS WERE STILL OWED. The marker's return is
   * the resolution's LAST beat: it may only start once every card has been
   * taken and the colony's own stage is back in front of the player. A glide
   * over an open reveal is the «сдвиг трека едет вместе с добором» break.
   */
  glideOverReveal: boolean;
  /**
   * THE MARKER FLEW OVER A HIDDEN TRACK. The payout pose (`--handing`) takes
   * the stage's working area — where the track is drawn — to `opacity: 0`, so
   * a reset started before it faded back is a white dot crossing an empty
   * panel.
   */
  glideOverBlankStage: boolean;
  /** The reset marker was seen at all — a fence over the two above is only
   *  worth anything on a watch where the glide really ran. */
  markerSeen: boolean;
  /** DIAGNOSTIC timeline (logged, not asserted): the colonies section went
   *  absent after it had been seen (ms into the watch), and the mandatory
   *  announcement card appeared (ms) — either mid-resolution is a lifecycle
   *  smell worth reading the log for. */
  coloniesGoneAtMs: number;
  announceAtMs: number;
  /** DIAGNOSTIC: a TRANSITION TIMELINE of the resolution's lifecycle bits — one entry per state change, so a wrong
   *  release names its exact moment and order. */
  timeline: Array<Record<string, unknown>>;
  /** DIAGNOSTIC: the first visible trade cover's pose + its landing slot — a mis-measured slot inflates the whole
   *  separation choreography. */
  proxyPose?: Record<string, number>;
};

/** One state of the payout as the page painted it — what the payout witness records. */
type PayoutState = {
  colonies: boolean,
  reveal: boolean,
  revealInStage: boolean,
  revealEmbedded: boolean,
  revealFullBleed: boolean,
  focusHand: boolean,
  emptyStage: boolean,
  marker: boolean,
  markerOutsideFocus: boolean,
  glideOverReveal: boolean,
  glideOverBlankStage: boolean,
  focus: boolean,
  split: boolean,
  standaloneHand: boolean,
  announce: boolean,
  /** The resolution's lifecycle bits (`__conColonyDiag`), as one string — the diagnostic timeline. */
  brief: string,
  /** The trade cover's pose and its landing slot while a cover stands posed (diagnostic). */
  proxyPose: {x: number, y: number, w: number, h: number, slotW: number, slotH: number} | null,
};

/** The reader of {@link PayoutState} — in the page, self-contained. */
function readPayout(): PayoutState {
  const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
  const colonies = document.querySelector('.con-colonies');
  const diagFn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
  const d = diagFn !== undefined ? diagFn() : {};
  const brief = JSON.stringify({
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
    scene: d.cardScene ?? '',
    staged: (d.stagedIds as ReadonlyArray<number> | undefined)?.join(',') ?? '',
    batches: (d.liveReveals as ReadonlyArray<string> | undefined)?.join(',') ?? '',
    glide: d.glideNonce ?? 0,
    marker: document.querySelector('.con-coltrade-marker') !== null,
  });
  const reveal = document.querySelector('.con-reveal');
  // A BLANK stage mid-flow — the «empty pause» class of break. The colonies stand, yet NOTHING of the flow is on them:
  // no focus stage, no reveal, no full-stage discard, no flying covers, and the browse grid is deliberately hidden
  // (parked/yielded).
  let emptyStage = false;
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
    emptyStage = !anyContent && !browseShowing;
  }
  const markerEl = document.querySelector('.con-coltrade-marker');
  const marker = markerEl !== null && visible(markerEl);
  const main = document.querySelector('.con-colfocus__main');
  let proxyPose: PayoutState['proxyPose'] = null;
  const p = document.querySelector('.con-coltrade-proxy');
  if (p !== null && (p as HTMLElement).getBoundingClientRect().width > 40 && getComputedStyle(p).visibility !== 'hidden') {
    const r = p.getBoundingClientRect();
    const slot = document.querySelector('.con-reveal [data-zoom-slot] :is(.card-container, .pcard)');
    const sr = slot?.getBoundingClientRect();
    proxyPose = {
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      slotW: sr === undefined ? -1 : Math.round(sr.width),
      slotH: sr === undefined ? -1 : Math.round(sr.height),
    };
  }
  const hand = document.querySelector('.con-hand.con-ws');
  return {
    colonies: colonies !== null,
    reveal: reveal !== null,
    revealInStage: reveal?.closest('.con-colfocus [data-outcome-zone]') !== null && reveal !== null,
    revealEmbedded: reveal?.classList.contains('con-reveal--embedded') === true,
    // Parented to <body> (or to the shell root) instead of a workspace zone = the standalone band the contract forbids
    // for a claimed payout. `[data-embed-slot]` is the only legitimate host.
    revealFullBleed: reveal !== null && reveal.closest('[data-embed-slot]') === null,
    // The REMOVED intermediate state: the hand inside the focus stage (its one home is the section's own
    // `colonies-hand` zone, beside the stage).
    focusHand: document.querySelector('.con-colfocus .con-hand') !== null,
    emptyStage,
    marker,
    // The track-reset glide must play on the colony's OWN focus track…
    markerOutsideFocus: marker && document.querySelector('.con-colfocus') === null,
    // …and it is the LAST beat: never while the player still owes a take…
    glideOverReveal: marker && document.querySelectorAll('.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length > 0,
    // …and never over a working area that has not come back yet.
    glideOverBlankStage: marker && main !== null && Number(getComputedStyle(main).opacity || '1') < 0.9,
    focus: document.querySelector('.con-colfocus') !== null,
    // ONE workspace root, ever. Two visible `.con-ws` roots is the reported hand+colonies split screen; a visible
    // STANDALONE hand root during a colony payout is the «COLONIES → HAND» flow break (the mandatory discard must run
    // EMBEDDED inside the colonies).
    split: Array.from(document.querySelectorAll('.con-ws')).filter(visible).length > 1,
    standaloneHand: hand !== null && visible(hand),
    announce: document.querySelector('.con-mandatory') !== null,
    brief,
    proxyPose,
  };
}

/** Arm the payout's record BEFORE the press that opens the window. `settled`: every claim here is coexistence or
 *  order («the marker while a card is owed», «two roots at once», «a stage with nothing on it»). */
async function armPayoutWitness(page: Page, key: string): Promise<Witness<PayoutState>> {
  return armWitness<PayoutState>(page, key, readPayout, {settled: true, max: 20_000});
}

/** What a window of the record says — the same per-state reading the old frame sampler made, on every state kept. */
function foldPayout(samples: ReadonlyArray<ObservedSample<PayoutState>>): Sighting {
  const seen: Sighting = {
    seen: false, inStage: false, embedded: false, fullBleed: false,
    workspaceSplit: false, standaloneHand: false,
    focusHandZone: false, emptyStage: false, markerOutsideFocus: false,
    focusSeen: false, glideOverReveal: false, glideOverBlankStage: false, markerSeen: false,
    coloniesGoneAtMs: -1, announceAtMs: -1, timeline: [],
  };
  const t0 = samples[0]?.t ?? 0;
  let coloniesSeen = false;
  let lastBrief = '';
  for (const {t, v} of samples) {
    if (v.brief !== lastBrief && seen.timeline.length < 60) {
      seen.timeline.push({t: t - t0, ...JSON.parse(v.brief) as Record<string, unknown>});
      lastBrief = v.brief;
    }
    if (v.colonies) {
      coloniesSeen = true;
    } else if (coloniesSeen && seen.coloniesGoneAtMs < 0) {
      seen.coloniesGoneAtMs = t - t0;
    }
    if (seen.announceAtMs < 0 && v.announce) {
      seen.announceAtMs = t - t0;
    }
    if (v.reveal) {
      seen.seen = true;
      seen.inStage ||= v.revealInStage;
      seen.embedded ||= v.revealEmbedded;
      seen.fullBleed ||= v.revealFullBleed;
    }
    seen.focusHandZone ||= v.focusHand;
    seen.emptyStage ||= v.emptyStage;
    seen.markerOutsideFocus ||= v.markerOutsideFocus;
    seen.glideOverReveal ||= v.glideOverReveal;
    seen.markerSeen ||= v.marker;
    seen.glideOverBlankStage ||= v.glideOverBlankStage;
    seen.focusSeen ||= v.focus;
    seen.workspaceSplit ||= v.split;
    seen.standaloneHand ||= v.standaloneHand;
    if (seen.proxyPose === undefined && v.proxyPose !== null) {
      seen.proxyPose = {t: t - t0, ...v.proxyPose};
    }
  }
  return seen;
}

/*
 * NOT `serial`. Each test boots its OWN game and drives its OWN page, so a
 * failure in one says nothing about the others — while `serial` marks every
 * later test «did not run» and removes it from the report. (Where serialising
 * IS the point — a shared resource two walks would race for — say so, as
 * `console-card-lore` does.)
 */

test('Pluto TRADE: the payout presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend into the focus stage (trade)
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the focus stage did not open'}).toBeGreaterThan(0);
  await shoot(page, '01-trade-stage');

  // The payout's window: RECORDED from before the confirm, closed once the payout stands for the take.
  const payout = await armPayoutWitness(page, 'pluto-trade-payout');
  await page.keyboard.press('KeyX'); // confirm the trade
  await cinematicBeat(page, 1800, 'the shot samples the trade handoff MID-flight');
  await shoot(page, '02-trade-handoff');
  await cinematicBeat(page, 2200, 'the shot samples the reveal as it opens');
  await shoot(page, '03-trade-reveal');
  await payoutStands(page);
  const seen = foldPayout(await payout.stop());
  console.log('── Pluto trade payout ──', JSON.stringify(seen));
  await shoot(page, '04-trade-end');

  expect(seen.seen, 'no payout reveal ever appeared').toBeTruthy();
  expect(seen.fullBleed, 'the payout mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the payout did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the payout did not open inside the colony FOCUS STAGE').toBeTruthy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone mounted').toBeFalsy();
  expect(seen.emptyStage, 'a BLANK colonies stage appeared mid-flow (the empty pause)').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();
  expect(seen.glideOverBlankStage, 'the track reset glided over a HIDDEN track (the payout pose was still up)').toBeFalsy();
  // THE LAST BEAT: this trade moves the track (1 → 0, no colonies built), and
  // the card is deliberately NOT taken up to here — so the marker must not
  // have moved at all yet.
  expect(seen.glideOverReveal, 'the track reset glided while the payout was still on the table').toBeFalsy();
  expect(seen.markerSeen, 'the reset ran before the card was taken').toBeFalsy();

  // ── THE CLOSING BEAT, recorded on its own. Taking the card ends the payout:
  //    the colony's working area comes BACK (the `--handing` pose releases —
  //    it is where the track is drawn), and only then does the white marker
  //    step home. A reset started inside that fade is the reported «трек бежит
  //    по пустому интерфейсу», so both halves are fenced here. The window ends
  //    with the workspace's own leave (bounded — the conclusion is asserted below).
  const closing = await armPayoutWitness(page, 'pluto-trade-closing');
  await press(page, 'Enter', 3200); // A = take the payout card
  await closing.waitFor((s) => !s.colonies, {timeoutMs: 24_000}).catch(() => undefined);
  const end = foldPayout(await closing.stop());
  console.log('── Pluto closing beat ──', JSON.stringify(end));
  await shoot(page, '04b-track-reset');
  expect(end.markerSeen, 'the track reset never played after the payout was collected').toBeTruthy();
  expect(end.glideOverReveal, 'the reset glided while a card was still owed').toBeFalsy();
  expect(end.glideOverBlankStage, 'the reset glided over a HIDDEN track (the payout pose was still up)').toBeFalsy();

  // ── THE FLOW LEAVES. A finished committed flow closes its workspace by
  //    itself (workspace-flow-conclusion) — within seconds of the settle,
  //    never on the 20 s claim safety. The wedge this pins: the ack's
  //    response is deliberately not applied, so the view kept listing the
  //    consumed batch, the release funnel refused `resolution-end` against
  //    that echo, the claim sat `presenting` (browse yielded EMPTY — the
  //    reported blank colony list after B) and the workspace never concluded.
  await expect(page.locator('.con-colonies'), 'the colony workspace did not conclude after the resolution')
    .toHaveCount(0, {timeout: 12_000});
  await shoot(page, '04c-concluded');
});

test('Pluto BUILD: the draw presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));

  // The Build Colony standard project → the colony pick → the focus stage.
  await press(page, 'Comma', 1200);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 1, settleMs: 1400});
  await expect.poll(() => page.locator('.con-stdp').count(), {message: 'standard projects did not open'}).toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  await expect.poll(async () => /колони/i.test(await focusedName()), {message: 'could not focus the colony standard project'}).toBeTruthy();
  await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 1, settleMs: 1800});

  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend — build intent
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the build stage did not open'}).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.con-colfocus').getAttribute('data-colony-intent')).toBe('build');
  await shoot(page, '05-build-stage');

  // The draw's window: RECORDED from before the confirm, closed once the draw stands for the take.
  const payout = await armPayoutWitness(page, 'pluto-build-payout');
  await page.keyboard.press('Enter'); // A = build confirm
  await cinematicBeat(page, 1800, 'the shot samples the build handoff MID-flight');
  await shoot(page, '06-build-handoff');
  await cinematicBeat(page, 2200, 'the shot samples the reveal as it opens');
  await shoot(page, '07-build-reveal');
  await payoutStands(page);
  const seen = foldPayout(await payout.stop());
  console.log('── Pluto build payout ──', JSON.stringify(seen));
  // The fit, read AT REST (`readSettled`; `settle: false` — the draw stands inside its chain, waiting for the take).
  console.log('── reveal fit inside the zone ──', JSON.stringify(await readSettled(page, () => page.evaluate(() => {
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
  }), {settle: false, message: 'the draw\'s fit inside the zone'})));
  await shoot(page, '08-build-end');

  expect(seen.seen, 'no draw reveal ever appeared for the build bonus').toBeTruthy();
  expect(seen.fullBleed, 'the draw mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the draw did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the draw did not open inside the colony FOCUS STAGE').toBeTruthy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone mounted').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();
  expect(seen.glideOverBlankStage, 'the track reset glided over a HIDDEN track (the payout pose was still up)').toBeFalsy();

  // ── NO SIZE JUMP WHEN A CARD IS TAKEN. The reveal's own contract says the
  //    card scale is FIXED for the batch — taking one must re-centre the row,
  //    never resize what is left. Inside a workspace zone that is doubly
  //    true: a resize here would move the whole stage under the player.
  //    BOTH widths are read AT REST (`readSettled`, inside the chain — `settle: false`).
  const before = await readSettled(page, () => readCardWidth(page), {settle: false, message: 'the card width before the take'});
  // Take one card — act → verify on the row's own taken mark (or the reveal gone).
  const taken = () => page.locator('.con-reveal .con-cards__slot--taken').count();
  const takenBefore = await taken();
  await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() === 0 || await taken() > takenBefore,
    {tries: 1, settleMs: 2200});
  const after = await readSettled(page, () => readCardWidth(page), {settle: false, message: 'the card width after the take'});
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
 *  · no board-level «Получены карты» band.
 */
test('Pluto TRADE with an OWN colony: the mandatory discard runs EMBEDDED in the same workspace', async ({page, request}) => {
  test.setTimeout(480_000);
  await boot(page, request, await createGame(request));

  // ── 1 · Build the colony (the test-2 route, condensed). ──────────────────
  await buildOnPluto(page);
  await cinematicBeat(page, 2500,
    'pacing INSIDE the mandatory chain — a blocking hold legitimately stands until the next answer');

  // ── 2 · Trade with Pluto — the full owner-bonus resolution. ─────────────
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend (trade intent)
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the trade stage did not open'}).toBeGreaterThan(0);
  // ONE record for the whole resolution, from before the confirm: the payout up to the discard press is the early
  // window, everything after it the return leg.
  const resolution = await armPayoutWitness(page, 'pluto-own-colony');
  await page.keyboard.press('KeyX'); // confirm the trade
  // The payout assembles through fleet → chips → covers: wait for the reveal
  // to become INTERACTIVE (a focused slot) instead of guessing a delay.
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
  await shoot(page, '10-own-colony-reveal');

  // ── 3 · Work the table with A: take the income card, let the bonus card's
  //    on-the-table flip play (a press mid-flip is swallowed by design), take
  //    it, then the SAME press on the closer opens the mandatory discard —
  //    which must appear EMBEDDED inside this very workspace. Each A gets its
  //    whole window before the next (act → verify on the discard standing).
  const embeddedHand = page.locator('.con-colonies .con-hand.con-hand--embedded');
  await pressUntil(page, 'Enter', async () => await embeddedHand.count() > 0, {tries: 14, settleMs: 2400});
  await shoot(page, '11-own-colony-taken');
  // The early window ends with the discard standing at rest.
  await embeddedHand.first().waitFor({state: 'visible', timeout: 12_000}).catch(() => undefined);
  await motionAtRest(page);
  const tDiscard = await pageNow(page);
  // The timeline is the diagnosis on a failure — dump it BEFORE asserting.
  const seenEarly = foldPayout((await resolution.samples()).filter((s) => s.t < tDiscard));
  console.log('── Pluto own-colony resolution ──', JSON.stringify(seenEarly));
  await expect(embeddedHand, 'the mandatory discard did not open EMBEDDED inside the colony workspace')
    .toBeVisible({timeout: 12_000});
  // The crumb still names the workspace root; the seat is standing.
  await expect.poll(() => page.locator('.con-colonies').count(), {message: 'the colony workspace was unmounted mid-resolution'}).toBeGreaterThan(0);
  // THE FULL-STAGE DISCARD: the colony context leads the hand's own ask
  // plate (the planet mini — iteration 4 replaced the separate chip row) —
  // asserted NOW, while the phase is live (it folds with it).
  await expect.poll(() => page.locator('.con-colonies .con-hand__discard-planet').count(), {message: 'the ask plate did not lead with the colony planet during the discard'}).toBeGreaterThan(0);
  // THE TONE IS THE NET OF THE BONUS (P51 · FG — the owner): «draw 1, then discard 1» closes a pair — the discard is a
  // choice of which card to keep, never «▼ УБЫТОК» and never «Принять убыток» on the bar.
  await expect(page.locator('[data-prompt-tag]'), 'Pluto\'s paired discard wears no loss tag').toHaveCount(0);
  await expect(page.locator('.con-cmdbar'), 'the bar never says «Принять убыток» for a paired discard').not.toContainText(/принять убыток/i);
  await shoot(page, '12-embedded-discard');
  // «СБРОШЕННЫЕ» is the TABLE's one pile beside the HUD deck (TR52, PL-264 — the workspace's own corner seat is
  // gone): the thrown card must land on it, its count ticking on the contact. RECORDED from before the press — the
  // pile stands only around the throw.
  const pile = await armWitness<boolean>(page, 'pluto-discard-pile', () => {
    const el = document.querySelector('[data-discard-pile]');
    return el !== null && Number(el.getAttribute('data-discard-pile-count')) >= 1;
  });

  // ── 4 · Discard (single-select: A submits the focused card) — with the
  //    RETURN LEG on the same record: the card flies to «СБРОШЕННЫЕ», the
  //    survivors gather into the dock, the colony FOCUS re-expands from the
  //    chip, and only then the workspace closes. No overview frame, no blank
  //    stage, no marker outside the focus — and the restore must be SEEN.
  await press(page, 'Enter', 3200);
  await cinematicBeat(page, 3200,
    'the discard flight paces the MANDATORY chain — card-discard[blocking] stands until the answer');
  await shoot(page, '13-after-discard');
  const pileTook = await pile.waitFor((took) => took, {timeoutMs: 16_000}).then(() => true, () => false);
  await pile.stop();
  expect(pileTook, 'the discarded card never landed on the table\'s discard pile').toBe(true);
  // The return leg ends with the workspace's own leave (bounded — the leg's claims say what stood).
  await expect.poll(async () => (await resolution.samples()).some((s) => s.t >= tDiscard && !s.v.colonies),
    {timeout: 16_000}).toBe(true).catch(() => undefined);
  const tail = foldPayout((await resolution.stop()).filter((s) => s.t >= tDiscard));
  console.log('── return leg ──', JSON.stringify(tail));
  expect(tail.emptyStage, 'a BLANK stage appeared on the return leg').toBeFalsy();
  expect(tail.focusHandZone, 'the focus-stage hand zone mounted on the return leg').toBeFalsy();
  expect(tail.markerOutsideFocus, 'the track marker flew OUTSIDE the focus on the return leg').toBeFalsy();
  // The RETURN LEG is where the reset finally plays — on a track that is back.
  expect(tail.glideOverReveal, 'the reset glided while a card was still owed on the return leg').toBeFalsy();
  expect(tail.glideOverBlankStage, 'the reset glided over a HIDDEN track on the return leg').toBeFalsy();
  expect(tail.focusSeen, 'the colony FOCUS was never restored after the discard').toBeTruthy();

  const seen = seenEarly;
  expect(seen.fullBleed, 'a payout mounted OUTSIDE a workspace zone during the resolution').toBeFalsy();
  expect(seen.workspaceSplit, 'TWO workspace roots were visible at once').toBeFalsy();
  expect(seen.standaloneHand, 'the discard opened a STANDALONE hand workspace').toBeFalsy();
  expect(seen.focusHandZone, 'the removed focus-stage hand zone (the B-only intermediate) mounted').toBeFalsy();
  expect(seen.emptyStage, 'a BLANK colonies stage appeared mid-flow (the empty pause)').toBeFalsy();
  expect(seen.markerOutsideFocus, 'the track-reset marker flew OUTSIDE the colony focus').toBeFalsy();
  expect(seen.glideOverBlankStage, 'the track reset glided over a HIDDEN track (the payout pose was still up)').toBeFalsy();
});

/**
 * «СВЕРНУТЬ» IS A PLACE THE PLAYER CAN GO AND COME BACK FROM — iteration 4.
 *
 * Park the resolution AT the mandatory discard, then:
 *  · the collapse plays the hand's physical GATHER (grid → dock proxies),
 *    never a one-frame pop of the dock backs;
 *  · a wheel visit to the colonies shows the PLAIN BROWSE grid — never the
 *    parked flow's crumb over a yielded (blank) stage;
 *  · the restore replays the dock → grid reveal and NEVER paints the colony
 *    focus stage over the discard grid (the reported two-screen overlay);
 *  · the flow then completes normally (discard → focus restore → close).
 */
test('Pluto DISCARD parked: gather on collapse, plain browse on a visit, clean restore', async ({page, request}) => {
  test.setTimeout(480_000);
  await boot(page, request, await createGame(request));

  // ── 1 · Reach the embedded discard (the test-3 route, condensed). ────────
  await buildOnPluto(page);
  await cinematicBeat(page, 2500,
    'pacing INSIDE the mandatory chain — a blocking hold legitimately stands until the next answer');
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000);
  await page.keyboard.press('KeyX'); // confirm the trade
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
  const embeddedHand = page.locator('.con-colonies .con-hand.con-hand--embedded');
  await pressUntil(page, 'Enter', async () => await embeddedHand.count() > 0, {tries: 14, settleMs: 2400});
  await expect(embeddedHand, 'the mandatory discard did not open embedded').toBeVisible({timeout: 12_000});
  await cinematicBeat(page, 1200, 'the hand-open reveal inside the mandatory chain');

  // ── 2 · COLLAPSE (B) — the gather must physically play: RECORDED from before the press (the proxies are a short
  //    flight — a poll after the press can sleep through it).
  const gather = await armWitness<boolean>(page, 'pluto-collapse-gather',
    () => document.querySelector('.con-handreveal-layer .con-deal-proxy') !== null);
  await page.keyboard.press('Escape');
  const gatherSeen = await gather.waitFor((up) => up, {timeoutMs: 5_000}).then(() => true, () => false);
  await gather.stop();
  await shoot(page, '14-collapse-gather');
  expect(gatherSeen, 'the collapse did not play the hand GATHER (dock backs popped in one frame)').toBeTruthy();
  await expect(page.locator('.con-colonies'), 'the workspace did not park on collapse').toHaveCount(0, {timeout: 6_000});
  await expect(page.locator('.con-mandatory'), 'no return card after the park').toHaveCount(1, {timeout: 6_000});

  // ── 3 · A WHEEL VISIT shows the PLAIN browse — never the parked flow. ───
  await openColoniesAndFocus(page, 'Pluto');
  await shoot(page, '15-parked-browse-visit');
  const browse = page.locator('.con-colonies__browse');
  await expect.poll(() => browse.count(), {message: 'the browse layer did not mount on the visit'}).toBeGreaterThan(0);
  await expect(browse, 'the visit adopted the parked flow (browse yielded → blank stage)')
    .not.toHaveClass(/con-colonies__browse--yield/);
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the parked focus stage leaked into the visit'}).toBe(0);
  await expect.poll(() => page.locator('.con-colonies .con-hand').count(), {message: 'the parked hand step leaked into the visit'}).toBe(0);
  await expect.poll(() => page.locator('.con-reveal').count(), {message: 'the parked reveal leaked into the visit'}).toBe(0);

  // ── 4 · Leave the visit (B) and RESTORE (B on the board home). The restore
  //    is RECORDED from before its press (`settled` — «the focus OVER the
  //    discard grid» is a coexistence claim).
  await press(page, 'Escape', 1200);
  const restoreWatch = await armWitness<{overlay: boolean, fan: boolean}>(page, 'pluto-restore', () => ({
    // the reported two-screen overlay
    overlay: document.querySelector('.con-colonies__embed--hand') !== null && document.querySelector('.con-colfocus') !== null,
    // the replayed dock → grid reveal
    fan: document.querySelector('.con-handreveal-layer .con-deal-proxy') !== null,
  }), {settled: true});
  await page.keyboard.press('Escape'); // restore the deferred discard
  await expect(embeddedHand, 'the discard did not come back on restore').toBeVisible({timeout: 8_000});
  await cinematicBeat(page, 4200, 'the restore replays the gather inside the mandatory chain');
  const restoreStates = (await restoreWatch.stop()).map((s) => s.v);
  const restore = {overlay: restoreStates.some((s) => s.overlay), fanSeen: restoreStates.some((s) => s.fan)};
  await shoot(page, '16-restored-discard');
  expect(restore?.overlay, 'the colony FOCUS painted OVER the restored discard grid').toBeFalsy();
  expect(restore?.fanSeen, 'the restore did not replay the dock → grid reveal').toBeTruthy();

  // ── 5 · Finish: discard → focus restore → the ordered close. ────────────
  await press(page, 'Enter', 3200);
  await cinematicBeat(page, 3200, 'the discard flight inside the mandatory chain');
  await expect(page.locator('.con-colonies'), 'the workspace never closed after the resolution')
    .toHaveCount(0, {timeout: 20_000});
});

/** One body / delivery proxy that reads SUSPICIOUS in one state: visible, back toward the player, where a back may
 *  not stand (the album area for a body, anywhere for a proxy). */
type FacingSuspect = {key: string, mode: string, x: number, y: number, m11: number};
type FacingViolation = {name: string, mode: string, ms: number, x: number, y: number, m11: number};

/**
 * The reader of the facing probe — in the page, self-contained: every suspicious body / proxy of THIS state, with its
 * position (so the Node side can tell a card that STANDS from one that is moving).
 */
function readFacing(): Array<FacingSuspect> {
  const out: Array<FacingSuspect> = [];
  const judge = (key: string, el: HTMLElement, mode: string, suspiciousWhen: (m11: number, r: DOMRect) => boolean) => {
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip') ?? el;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = Number(cs.opacity || '1') > 0.5 && cs.visibility !== 'hidden' && r.width > 40;
    // m11 < 0 ⇔ the back faces the viewer (rotationY past 90°).
    let m11 = 1;
    const t = getComputedStyle(flip).transform;
    const m = t !== 'none' ? t.match(/matrix(?:3d)?\(([^)]+)\)/) : null;
    if (m !== null) {
      m11 = Number(m[1].split(',')[0]);
    }
    if (visible && suspiciousWhen(m11, r)) {
      out.push({key, mode, x: Math.round(r.left), y: Math.round(r.top), m11: Math.round(m11 * 100) / 100});
    }
  };
  document.querySelectorAll<HTMLElement>('.con-handbody').forEach((el) => {
    const name = el.getAttribute('data-hand-dock-card') ?? '';
    const mode = el.getAttribute('data-hand-body-mode') ?? '';
    if (name === '') {
      return;
    }
    // The ALBUM AREA: well above the dock tray. The docked pack at the
    // tray is legally backs; a «docked» body standing high in the album
    // is the missed-seize class and counts.
    judge(`body:${name}`, el, mode, (m11, r) =>
      m11 < -0.5 && r.top < window.innerHeight * 0.6 && (mode === 'flying' || mode === 'docked'));
  });
  // …and the DELIVERY PROXIES. An intake flight rides the GLOBAL gsap
  // ticker, which the album's mount storm can starve — a proxy frozen
  // mid-carry shows the back it turned to for the dock («Рубашкой») and
  // reads exactly as «карта в руке стоит рубашкой». A proxy standing
  // still ANYWHERE for >600 ms is a stalled flight, back or not — but
  // the back is what the player reported, so it is what is recorded.
  document.querySelectorAll<HTMLElement>('[data-delivery-card]').forEach((el) => {
    const name = el.getAttribute('data-delivery-card') ?? '';
    judge(`proxy:${name}`, el, 'delivery', (m11) => m11 < -0.5);
  });
  return out;
}

/**
 * THE STANDING JUDGEMENT, folded over the record: a suspect STANDS when it reads suspicious at one spot (±2 px of
 * where its stand began) across more than 600 ms of the page's clock — read at a LATER recorded state that still shows
 * it there, or at the end of the record (`endT`). A record keeps a state only when it changes, so a suspect that MOVED
 * at the next state was travelling, never standing.
 */
function facingViolations(samples: ReadonlyArray<ObservedSample<Array<FacingSuspect>>>, endT: number): Array<FacingViolation> {
  type Stand = {x: number, y: number, since: number, last: FacingSuspect};
  const standing = new Map<string, Stand>();
  const violations: Array<FacingViolation> = [];
  const note = (key: string, s: Stand, now: number) => {
    if (now - s.since <= 600) {
      return;
    }
    const existing = violations.find((v) => v.name === key);
    if (existing === undefined) {
      violations.push({name: key, mode: s.last.mode, ms: now - s.since, x: s.last.x, y: s.last.y, m11: s.last.m11});
    } else {
      existing.ms = Math.max(existing.ms, now - s.since);
    }
  };
  for (const {t, v} of samples) {
    const now = new Set<string>();
    for (const suspect of v) {
      now.add(suspect.key);
      const s = standing.get(suspect.key);
      if (s === undefined || Math.abs(s.x - suspect.x) > 2 || Math.abs(s.y - suspect.y) > 2) {
        standing.set(suspect.key, {x: suspect.x, y: suspect.y, since: t, last: suspect});
        continue;
      }
      s.last = suspect;
      note(suspect.key, s, t);
    }
    for (const key of [...standing.keys()]) {
      if (!now.has(key)) {
        standing.delete(key); // turned face-up / moved out of the album area / gone
      }
    }
  }
  for (const [key, s] of standing) {
    note(key, s, endT); // the record ends with it still standing back-side-out
  }
  return violations;
}

/**
 * THE FACING PROBE — «карта стояла рубашкой в альбоме» (reported on the Pluto
 * discard with the LARGE album layout: the first card of the hand stood
 * back-side-out for a couple of seconds and then turned normal).
 *
 * The album's physical model lays EVERY card face-up (rev 15): a body that
 * has come to REST somewhere inside the album area may never keep showing its
 * back. Backs in motion are legal (the dock's «Рубашкой» presentation means
 * every open flight STARTS as a back and turns mid-flight), and the docked
 * pack at the tray is legally backs — so the violation is precisely «standing
 * still, in the album area, back toward the player, for longer than a turn
 * could take».
 *
 * The probe is a WITNESS (`armWitness` — the product's own writes, a mount storm
 * included, every state kept with the page's time), never a timer sampler; the
 * «stands for > 600 ms» judgement is folded on the Node side.
 */
test('Pluto DISCARD, LARGE album: no card ever STANDS back-side-out in the album', async ({page, request}) => {
  test.setTimeout(480_000);
  await page.addInitScript(() => {
    window.localStorage.setItem('tm_console_album', 'large');
  });
  // THE SLOW RIG (hunt mode, opt-in): the reported flake is a paint race, and
  // paint races live on loaded machines — an unthrottled dev box out-paints
  // them. `FACING_RIG=throttle` runs the same probe at 4× CPU throttling on
  // the 4K couch profile (bigger mount storm, the player's real rig shape).
  const slowRig = process.env.FACING_RIG === 'throttle';
  if (slowRig) {
    await page.setViewportSize({width: 3840, height: 2160});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
  }
  // A REAL hand: several pages of the large album (4/page), so the discard
  // opens with page packets on both sides — the player's actual shape.
  await bootSeededGame(page, request, await createGame(request), {buy: 6, keepColony: 'Pluto'});
  await settle(page);

  // ── 1 · Reach the payout (the test-3 route, condensed): build, then trade.
  await buildOnPluto(page);
  await cinematicBeat(page, 2500,
    'pacing INSIDE the mandatory chain — a blocking hold legitimately stands until the next answer');
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000);

  // ── 2 · Arm the facing witness BEFORE anything can open the hand. ────────
  const facingWitness = await armWitness<Array<FacingSuspect>>(page, 'pluto-facing', readFacing, {max: 20_000});

  // ── 3 · Trade → take the payout → the embedded discard opens the album.
  //    The take cadence is deliberately QUICK: a player presses the closer
  //    right behind the last take, so the album's mount storm lands while the
  //    taken card's intake proxy is still mid-carry — exactly the overlap the
  //    reported back-side stall needs. Swallowed presses (mid-flip, by
  //    design) are covered by the retry (each A act → verify on the discard).
  await page.keyboard.press('KeyX');
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
  const embeddedHand = page.locator('.con-colonies .con-hand.con-hand--embedded');
  await pressUntil(page, 'Enter', async () => await embeddedHand.count() > 0, {tries: 30, settleMs: 850});
  await expect(embeddedHand, 'the mandatory discard did not open embedded').toBeVisible({timeout: 12_000});
  await cinematicBeat(page, 2600, 'the large-album open inside the mandatory chain + a standing read');
  await shoot(page, '17-large-album-discard');

  // ── 4 · Discard and let the return leg play under the same witness. ─────
  await press(page, 'Enter', 3200);
  await cinematicBeat(page, 3200, 'the discard flight inside the mandatory chain');

  const endT = await pageNow(page);
  const samples = await facingWitness.stop();
  const facing = {samples: samples.length, violations: facingViolations(samples, endT)};
  console.log('── facing probe ──', JSON.stringify(facing));
  // A dead witness must never pass: it recorded at least the state it was armed in.
  expect(facing.samples > 0, `the facing sampler barely ran (${facing.samples} samples)`).toBeTruthy();
  expect(facing.violations, 'a card STOOD back-side-out inside the album').toEqual([]);
});
