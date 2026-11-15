/*
 * A PLAY'S DRAW BELONGS TO THE WORKSPACE THE PLAY WAS MADE IN.
 *
 * Two reported bugs, one contract, one probe:
 *
 *  1. THE HAND WORKSPACE. Playing a card that draws cards (Lagrange
 *     Observatory — «Возьмите 1 карту») folded the workspace on the landing
 *     beat and the batch then arrived as a full-bleed reveal over the board:
 *     the player pressed «Разыграть» inside a screen and the result of that
 *     press appeared somewhere else. The reveal must present INSIDE
 *     `.con-hand__outcome`, and the workspace must stand until every card has
 *     been taken.
 *
 *  2. THE GAME START WORKSPACE (Point Luna). Its draw comes from a TRIGGERED
 *     effect on its own play (`onCardPlayed`, the Earth tag), so no `behavior`
 *     preview advertises it and the server attributes the batch to POINT LUNA
 *     rather than to the pressed card. Claimed by nobody, it opened the
 *     fullscreen viewer as though the card had come off the board. It must
 *     present in the deployment's own embed zone, with no viewer at all.
 *
 * Both are observed FRAME BY FRAME, because both bugs are one-frame
 * ownership questions: «did the workspace let go before the cards arrived?».
 * The frames are RECORDED (`armWitness`, `settled` — every state a task
 * leaves, i.e. every state a frame can paint; replace-proof) from before the
 * press, and the driver only DRIVES (each move waits for the state it acts
 * on) — a press-and-sample loop slept through what it was there to see.
 */
import {expect, test, Page, APIRequestContext} from './consoleTest';
import {openHandPlayComposer, press, pressUntil, settle} from './consoleStart';
import {armWitness} from './witness';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'play-draw-embed');

/** Base, AUTOMATED, `drawCard: 1` and nothing else — the whole follow-up is
 *  the card it draws. */
const DRAW_CARD = 'Lagrange Observatory';
/** Filler so the starting hand is not a single card (the cursor walk needs
 *  somewhere to walk, and the batch must not be the hand's only content). */
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

function newGameConfig(corps: ReadonlyArray<string>) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'DrawEmbed', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of everything → the card is always affordable
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: corps.length,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [...corps],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    // Guaranteed first-hand project cards (dealt off the top of the deck).
    customProjectCards: [DRAW_CARD, ...FILLER],
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

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await press(page, code, settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function createAndOpenConsole(page: Page, request: APIRequestContext, corps: ReadonlyArray<string>): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig(corps)});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  // The deal cinematic settles — the console's own quiet, not a pause (the wizard walk reads what stands either way).
  await settle(page, {timeoutMs: 30_000}).catch(() => { /* the walk reads what stands */ });
}

/**
 * A on the batch standing in `zone` — act → verify: the take's own edge (the reveal turns `busy`, a slot is marked
 * taken, or the batch is gone), the press repeated only when it changed nothing for its whole window. (The shared
 * `takeRevealCard` presses only a `ready` reveal — and a single drawn card's reveal may stand `held`, A taking it all
 * the same.)
 */
async function takeEmbeddedCard(page: Page, zone: string): Promise<boolean> {
  const tookOrGone = () => page.evaluate((sel) => {
    const reveal = document.querySelector(`${sel} .con-reveal`);
    return reveal === null || reveal.getAttribute('data-take') === 'busy' ||
      reveal.querySelectorAll('.con-cards__slot:not(.con-cards__slot--taken)').length === 0;
  }, zone);
  return pressUntil(page, 'Enter', tookOrGone, {tries: 3, settleMs: 3_000});
}

/**
 * Drive the START out: A on its CTA whenever one stands (and, with `takeEmbedded`, the batch embedded in its zone is
 * TAKEN — verified, `takeEmbeddedCard`), until the start releases or a mandatory plate takes the screen. Every move
 * waits for the STATE it acts on (bounded), never a pause; nothing here observes — the recording does.
 */
async function pressThroughStart(page: Page, opts: {takeEmbedded?: boolean, onEmbedded?: () => Promise<void>, maxMs?: number} = {}): Promise<void> {
  const deadline = Date.now() + (opts.maxMs ?? 150_000);
  while (Date.now() < deadline) {
    await page.waitForFunction((take) => document.querySelector('.con-start') === null ||
      document.querySelector('.con-mandatory') !== null ||
      document.querySelector('.con-start__slot-a') !== null ||
      (take && document.querySelector('.con-start__embed .con-reveal') !== null), opts.takeEmbedded === true,
    {timeout: Math.max(1, Math.min(30_000, deadline - Date.now())), polling: 100}).catch(() => undefined);
    const s = await page.evaluate(() => ({
      start: document.querySelector('.con-start') !== null,
      mandatory: document.querySelector('.con-mandatory') !== null,
      cta: document.querySelector('.con-start__slot-a') !== null,
      embedded: document.querySelector('.con-start__embed .con-reveal') !== null,
    }));
    if (!s.start || s.mandatory) {
      return;
    }
    if (opts.takeEmbedded === true && s.embedded) {
      await opts.onEmbedded?.();
      await takeEmbeddedCard(page, '.con-start__embed');
      // The take's flight and the collect run on; the next round waits for the next actionable state.
      await page.locator('.con-start__embed .con-reveal').first().waitFor({state: 'detached', timeout: 15_000}).catch(() => undefined);
      continue;
    }
    if (s.cta) {
      await key(page, 'Enter', 700); // A — play the queued card
    }
  }
}

/**
 * Drive the start WIZARD (corp → project buy → summary) to its commit. Pure
 * state-driven walking — a blind key sequence drifts, because the deal
 * cinematic swallows the first presses (the landing probe paid for this).
 */
async function runWizard(page: Page, corp: string, buy: ReadonlyArray<string> = []): Promise<void> {
  const frame = page.locator('.con-start__frame');
  let lastFocused = '';
  let stalls = 0;
  const walk = async (focused: string) => {
    if (focused === '') {
      // The deal cinematic owns the row — wait for the STATE a walk needs (a focused card; bounded), never a pause.
      await page.locator('.con-cards__slot--focused, .con-start--ceremony').first()
        .waitFor({state: 'attached', timeout: 5_000}).catch(() => undefined);
      return;
    }
    stalls = focused === lastFocused ? stalls + 1 : 0;
    await key(page, stalls >= 1 ? 'ArrowDown' : 'ArrowRight', 240);
    lastFocused = focused;
  };
  for (let i = 0; i < 220 && await frame.count() > 0; i++) {
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    if (s.ceremony) {
      return; // the wizard flowed into the deployment inside the same root
    }
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes(corp)) {
        await key(page, 'Period', 1100);
        lastFocused = '';
      } else if (s.focused === corp) {
        await key(page, 'Enter', 600);
        lastFocused = '';
      } else {
        await walk(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      // The starting hand IS this step's purchase (testMode gives 500 M€, so
      // everything is affordable). Buying nothing leaves an empty hand — which
      // is exactly how this probe first failed.
      const missing = buy.filter((c) => !s.picked.includes(c));
      if (missing.length === 0) {
        await key(page, 'Period', 1100);
        lastFocused = '';
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = '';
      } else {
        await walk(s.focused);
      }
      continue;
    }
    await key(page, 'Enter', 1200); // the summary commits
  }
}

test.describe('a play\'s DRAW presents inside the workspace the play was made in', () => {
  test.setTimeout(300_000);

  /**
   * POINT LUNA — the corporation's own Earth tag draws a card as it is played,
   * in the middle of the deployment. Watched frame by frame from the commit
   * to the release.
   */
  test('the start workspace hosts a TRIGGERED draw (Point Luna), never a fullscreen viewer', async ({page, request}) => {
    await createAndOpenConsole(page, request, ['Point Luna', 'CrediCor']);
    await runWizard(page, 'Point Luna');

    // RECORDED from here to the release — every paintable state (`settled`: the claims are «never at the same time»).
    type StartDrawSeen = {start: boolean, reveal: boolean, embedded: boolean, viewer: boolean, standalone: boolean};
    const draw = await armWitness<StartDrawSeen>(page, 'pointluna-draw', () => {
      const start = document.querySelector('.con-start');
      const reveal = document.querySelector('.con-reveal');
      // The reveal re-homed into the deployment's own zone…
      const embedded = document.querySelector('.con-start__embed .con-reveal') !== null;
      return {
        start: start !== null,
        reveal: reveal !== null,
        embedded,
        // …and the two failure shapes.
        viewer: document.querySelector('.con-zoom') !== null,
        // A FULL-BLEED band is the overlay in its own standalone mode — never the embedded one caught between two tasks
        // of its host's teardown (the frame leaves a task before its teleported stage does).
        standalone: document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
      };
    }, {settled: true});
    // A = play the queued corporation, then take the drawn card — until the start lets go.
    let shotEmbed = false;
    await pressThroughStart(page, {
      takeEmbedded: true,
      onEmbedded: async () => {
        if (!shotEmbed) {
          shotEmbed = true;
          await shoot(page, 'pointluna-embedded-draw');
        }
      },
    });
    // The record runs to the release and past it, until the console is at rest (bounded).
    await expect.poll(() => page.locator('.con-start').count(), {timeout: 60_000}).toBe(0).catch(() => undefined);
    await settle(page, {timeoutMs: 30_000}).catch(() => { /* the record is judged either way */ });
    const recorded = await draw.stop();
    const t0 = recorded[0]?.t ?? 0;
    const log = {
      /** The drawn card presented INSIDE the deployment's embed zone. */
      embedded: recorded.some((r) => r.v.embedded),
      /** The fullscreen viewer opened while the batch was on screen (the bug) — recorded states. */
      viewerFrames: recorded.filter((r) => r.v.reveal && r.v.viewer).length,
      /** A full-bleed standalone reveal stood outside the workspace (the bug). */
      standaloneFrames: recorded.filter((r) => r.v.standalone).length,
      /** The workspace was gone while the batch was still on screen (the bug). */
      orphanFrames: recorded.filter((r) => r.v.reveal && !r.v.start).length,
      trace: recorded.map(({t, v: s}) => `${t - t0} s:${s.start ? 1 : 0} r:${s.reveal ? 1 : 0} e:${s.embedded ? 1 : 0} z:${s.viewer ? 1 : 0}`),
    };
    console.log(`[point luna trace]\n${log.trace.join('\n')}`);
    expect(log.embedded, 'the triggered draw presented INSIDE the start workspace').toBeTruthy();
    expect(log.viewerFrames, 'no fullscreen viewer — the card is the workspace\'s, not the board\'s').toBe(0);
    expect(log.standaloneFrames, 'the batch never stood outside the workspace that produced it').toBe(0);
    expect(log.orphanFrames, 'the workspace never let go while its own cards were on screen').toBe(0);
    // …and the card really did reach the hand (the flow completed, not stalled).
    await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * THE HAND WORKSPACE — «КАРТЫ В РУКЕ › ЛАГРАНЖЕВА ОБСЕРВАТОРИЯ › ДОБОР КАРТ».
   */
  test('the hand workspace holds its play\'s drawn card and leaves only once it is taken', async ({page, request}) => {
    await createAndOpenConsole(page, request, ['CrediCor']);
    await runWizard(page, 'CrediCor', [DRAW_CARD, ...FILLER]);
    // The deployment plays the corporation on its own (CrediCor draws nothing);
    // press A through whatever CTA stands until the workspace releases.
    await pressThroughStart(page);
    await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000}); // the starting hand's intake settles

    // ── into the hand workspace, onto the card, and one level deeper — the shared, verified opener (the hand's own
    //    «input released» signal, the focus walk that turns at a wall, the composer LOADED). ──
    await openHandPlayComposer(page, DRAW_CARD);
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    await settle(page);
    await shoot(page, 'hand-composer');

    // ── CONFIRM, and watch the whole episode — RECORDED from before the press (`settled`: every paintable state; the
    //    claims are coexistence and order — «never the card without its workspace», «the landing lets go as the deal
    //    begins»). The driver below only drives. ──
    type HandDrawSeen = {
      hand: boolean, reveal: boolean, embedded: boolean, standalone: boolean, landing: boolean, landingOpacity: number, dealing: boolean,
      viewer: boolean, untaken: number, head: boolean, status: boolean, crumb: string, browseParked: boolean,
    };
    const draw = await armWitness<HandDrawSeen>(page, 'hand-draw', () => {
      const reveal = document.querySelector('.con-reveal');
      const embedded = document.querySelector('.con-hand__outcome .con-reveal');
      const stage = document.querySelector('.con-composer__playstage--up');
      return {
        hand: document.querySelector('.con-hand') !== null,
        reveal: reveal !== null,
        embedded: embedded !== null,
        standalone: document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
        landing: stage !== null,
        // The tableau's own dissolve writes its opacity (a recede to 0) — below 1 is «it has begun to let go».
        landingOpacity: stage === null ? 0 : Number(getComputedStyle(stage).opacity),
        // The deck is PHYSICALLY dealing — a flyer exists. Deliberately not
        // `.con-deckdraw`: that layer mounts when the batch is CLAIMED (at
        // the response) and then waits for whatever earned the draw to
        // finish its own scene, so it is up for a second while nothing has
        // moved yet — and the landing tableau is right to hold the stage
        // through exactly that window.
        dealing: document.querySelector('.con-deckdraw-proxy') !== null,
        viewer: document.querySelector('.con-zoom') !== null,
        untaken: document.querySelectorAll('.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length,
        // The stage's own chassis (title row + status line) and the
        // workspace crumb ABOVE it — the four-condition contract's «one
        // continuous line, only the tail advances».
        head: embedded !== null && embedded.querySelector('.con-ws-stage-head') !== null,
        status: embedded !== null && embedded.querySelector('.con-ws-stage-status') !== null,
        crumb: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        // The browse shelf must stay PARKED behind the stage.
        browseParked: document.querySelector('.con-hand__browse--parked') !== null,
      };
    }, {settled: true});
    await page.keyboard.press('Enter');
    // THE DRIVER. A takes the card once the batch has arrived AND the landing
    // tableau has let go of the stage — the STATE is waited for (bounded),
    // then the take is verified by the reveal's own `data-take`; the workspace
    // must then leave on its own. Taking on the FIRST sight of the batch raced
    // the tableau's dissolve (it may legitimately overlap the deal while it
    // fades); a tableau that never lets go still fails — as an overstay,
    // which is what it would be.
    let shotEmbed = false;
    await draw.waitFor((v) => !v.landing && (v.dealing || (v.embedded && v.untaken > 0)), {timeoutMs: 60_000})
      .then(() => shoot(page, 'hand-stage-freed'), () => undefined);
    const takeable = await page.waitForFunction(() =>
      document.querySelector('.con-hand__outcome .con-reveal') !== null &&
      document.querySelectorAll('.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length > 0 &&
      document.querySelector('.con-composer__playstage--up') === null, undefined, {timeout: 60_000, polling: 100})
      .then(() => true, () => false);
    if (takeable) {
      // The batch has landed and the tableau has gone — the stage the player reads.
      shotEmbed = true;
      await shoot(page, 'hand-embedded-draw');
      await takeEmbeddedCard(page, '.con-hand__outcome');
    }
    // The flow ENDS by itself once the card is taken (bounded); the record runs to the console's rest.
    await expect.poll(() => page.locator('.con-hand').count(), {timeout: 30_000}).toBe(0).catch(() => undefined);
    await settle(page, {timeoutMs: 30_000}).catch(() => { /* the record is judged either way */ });
    const recorded = await draw.stop();
    const states = recorded.map((r) => r.v);
    const t0 = recorded[0]?.t ?? 0;

    // THE FOLD — every claim over the recorded states (each one a state a frame could paint).
    const landingAt = states.findIndex((s) => s.landing);
    // THE HANDOVER between the two scenes. The landing tableau holds the
    // stage while nothing else needs it — and lets go the moment the DECK
    // BEGINS DEALING, so the room is free for what is arriving. Both halves
    // are asserted: it must not overstay into the deal, and the stage must
    // actually be freed for the draw. «Freed» accepts EITHER shape of the
    // free stage: a flyer still in the air with the tableau gone, or the
    // arrived, untaken batch standing where the tableau used to be. (The
    // reveal is allowed in the DOM during the flight — a plain batch mounts
    // it VEILED first, because its slots are the flight's real destinations.)
    // OVERSTAY, as an ORDER: the tableau's exit (it is gone, or its dissolve
    // has begun — the opacity below its resting value) must begin no later
    // than the deal is over. A dissolve that overlaps the flight is the exit
    // itself; a tableau still standing whole once the flyer has landed sat
    // through the flight — the shape the release replaced. (The dissolve and
    // the flight tick on one clock, so «no later» holds at any frame rate.)
    const dealStart = landingAt < 0 ? -1 : states.findIndex((s, i) => i > landingAt && s.dealing);
    const restingOpacity = Math.max(0, ...states.slice(landingAt < 0 ? 0 : landingAt, dealStart < 0 ? undefined : dealStart)
      .filter((s) => s.landing).map((s) => s.landingOpacity));
    const releaseAt = dealStart < 0 ? -1 :
      states.findIndex((s, i) => i >= dealStart && (!s.landing || s.landingOpacity < restingOpacity - 0.001));
    const dealEnd = dealStart < 0 ? -1 : states.findIndex((s, i) => i > dealStart && !s.dealing);
    const overstayed = dealStart >= 0 && (releaseAt < 0 || (dealEnd >= 0 && releaseAt > dealEnd));
    const embeddedStates = states.filter((s) => s.embedded);
    const log = {
      embedded: embeddedStates.length > 0,
      /** The workspace was gone while the drawn card was on screen — an UNTAKEN card (the bug); the emptied stage's own
       *  leave, a task behind its frame's, holds no card. */
      orphanFrames: states.filter((s) => s.untaken > 0 && !s.hand).length,
      /** The reveal stood as a full-bleed band outside the workspace (the bug) — the overlay in its standalone mode. */
      standaloneFrames: states.filter((s) => s.standalone).length,
      /** The fullscreen viewer took the single drawn card (the bug's 1-card shape). */
      viewerFrames: states.filter((s) => s.reveal && s.viewer).length,
      /** The landing scene presented at all. */
      sawLanding: landingAt >= 0,
      /** The states where the stage stood FREE for what is arriving (the point of the release). */
      freedFrames: landingAt < 0 ? 0 :
        states.filter((s, i) => i > landingAt && !s.landing && (s.dealing || (s.embedded && s.untaken > 0))).length,
      /** The stage names itself in the SHARED chassis head + status line. */
      sawHead: embeddedStates.some((s) => s.head),
      sawStatus: embeddedStates.some((s) => s.status),
      /** States where the hand shelf stood LIT behind the embedded stage. */
      unparkedFrames: embeddedStates.filter((s) => !s.browseParked).length,
      /** The workspace crumb grew a tail instead of restarting a screen — read while the drawn card STOOD on the
       *  stage for the player (the record also holds the workspace's own leave, which is not the stage he reads). */
      crumb: (embeddedStates.some((s) => s.untaken > 0 && s.crumb !== '') ?
        embeddedStates.filter((s) => s.untaken > 0 && s.crumb !== '') :
        embeddedStates.filter((s) => s.crumb !== '')).at(-1)?.crumb ?? '',
      trace: recorded.map(({t, v: s}) => `${t - t0} h:${s.hand ? 1 : 0} r:${s.reveal ? 1 : 0} e:${s.embedded ? 1 : 0} l:${s.landing ? 1 : 0}` +
        `@${s.landingOpacity.toFixed(2)} d:${s.dealing ? 1 : 0} z:${s.viewer ? 1 : 0} u:${s.untaken} p:${s.browseParked ? 1 : 0} | ${s.crumb}`),
    };
    console.log(`[hand draw trace] (shot the stage: ${shotEmbed}; deal ${dealStart}…${dealEnd}, release ${releaseAt})\n${log.trace.join('\n')}`);
    expect(log.embedded, 'the drawn card presented INSIDE the hand workspace').toBeTruthy();
    expect(log.standaloneFrames, 'never a full-bleed band outside the workspace that drew it').toBe(0);
    expect(log.orphanFrames, 'the workspace never let go while its own card was on screen').toBe(0);
    expect(log.viewerFrames, 'a single drawn card is the workspace\'s stage, not a fullscreen hand-over').toBe(0);
    expect(log.sawLanding, 'the landing scene held the stage after the play').toBeTruthy();
    // ONE SURFACE HANDS OVER TO THE NEXT. The tableau holds the stage while
    // nothing else needs it, and LETS GO the moment the deck starts dealing —
    // a scene still standing over the cards it produced is the previous beat
    // refusing to end.
    // …and PROMPTLY: overlap with the deal is the dissolve itself (it lets go
    // with a fade, never a cut — demanding none would forbid the very
    // animation this asserts), but it must not sit there through the flight,
    // which is the shape the release replaced.
    expect(overstayed, `the landing lets go as the deal begins (deal ${dealStart}…${dealEnd}, its exit began at ${releaseAt})`)
      .toBe(false);
    expect(log.freedFrames, 'the stage is freed for the arriving draw').toBeGreaterThan(0);
    expect(log.unparkedFrames, 'the hand shelf stays PARKED behind the stage — never a surface floating over its own screen').toBe(0);
    expect(log.sawHead, 'the stage wears the shared chassis head (it names itself once, in the stage)').toBeTruthy();
    expect(log.sawStatus, 'the stage carries the shared status line («A Взять»)').toBeTruthy();
    // ONE CONTINUOUS LINE: root › the played card › the stage. The workspace
    // name and the card name never restart, and only the tail advances.
    expect(log.crumb.toUpperCase(), `the crumb kept its context and gained a tail (got «${log.crumb}»)`)
      .toContain('ДОБОР КАРТ');
    expect(log.crumb.toUpperCase()).toContain('ЛАГРАНЖА');
    // …and the flow ENDS: the workspace leaves once the card is taken.
    await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
    await shoot(page, 'hand-after-take');
  });
});
