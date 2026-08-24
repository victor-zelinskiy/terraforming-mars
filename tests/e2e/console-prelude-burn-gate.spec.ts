import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from '@playwright/test';
import {
  press, stepKind, stepSubject, waitPressable, summaryVisible, pickCards,
  submitSummary, queueCards, waitQueueIdle, focusCard, yieldToPurchase,
} from './consoleStart';

/**
 * THE ORDER-AWARE PRE-COMMIT GATE — «сначала другой пролог» must never sit over
 * a button that plays this one.
 *
 * The defect: a prelude whose effect could not resolve carried a flat «СГОРИТ»,
 * and pressing A armed a generic «A — Подтвердить». Two true sentences, one
 * screen: «Сначала разыграйте другой пролог» beside «нажмите ещё раз для
 * подтверждения» can only be read as «press A to go to the other prelude» — and
 * A discarded the card instead. The whole fix is that the warning and the verb
 * now come out of ONE server-computed verdict.
 *
 * The reference case is «Удвоение»: played first it has nothing to copy, and
 * playing ANY other prelude first makes it whole. So the probe walks exactly
 * that: the badge says what is wrong, the first A explains rather than commits,
 * B goes back, and once the other prelude is played the warning disappears on
 * its own — with no card-specific code anywhere in the path.
 */

const OUT_DIR = path.resolve('screenshots', 'console-prelude-burn-gate');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

const WAITING = 'Double Down';
// The enabler: playable with NOTHING else set up (it needs only M€), so the
// probe can buy zero projects and still have a real order to choose.
const ENABLER = 'Business Empire';

function cfg() {
  return {
    players: [{name: 'BurnGate', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    // FORCE the deal: the probe is about these two preludes and their order.
    customPreludes: [WAITING, ENABLER, 'Metal-Rich Asteroid', 'Mohole Excavation'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/**
 * The gate as the PLAYER meets it — the cards' own rings and pills, the stage's
 * words, the bar's verbs. Read structurally, never from component internals.
 */
async function gate(page: Page) {
  return page.evaluate(() => {
    const txt = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-start__qcard'));
    const named = (list: Element[]) => list.map((el) => el.getAttribute('data-queue-slot') ?? '');
    return {
      /** Every prelude still standing in the queue (the play is the removal). */
      queue: named(slots),
      /** Cards carrying a caution badge, and what those badges SAY. */
      badged: named(slots.filter((el) => el.querySelector('.con-cards__pickband--warn') !== null)),
      badgeText: txt(document.querySelector('.con-start__qcard .con-cards__pickband--warn')),
      /** …and the cards marked as a way OUT of the waiting one. */
      enablers: named(slots.filter((el) => el.classList.contains('con-start__qcard--enabler'))),
      /** The armed card (empty = the risk stage is not up). */
      armed: named(slots.filter((el) => el.classList.contains('con-start__qcard--armed')))[0] ?? '',
      /** The A pill under the focused card — it must name the LOSS while armed. */
      pill: txt(document.querySelector('.con-start__slot-a')),
      pillArmed: document.querySelector('.con-start__slot-a--armed') !== null,
      /** The inline risk stage (never a modal: no shade, no backdrop of its own). */
      stageUp: document.querySelector('[data-start-risk]') !== null,
      stageTitle: txt(document.querySelector('.con-start__risk-title')),
      stageBody: txt(document.querySelector('.con-start__risk-body')),
      /** The ordinary pre-press explanation, in the workspace's status rail. */
      railState: txt(document.querySelector('.con-start__status-state')),
      /** The result beat that follows a deliberate loss. */
      effectLost: document.querySelector('[data-start-effect-lost]') !== null,
      /** The ONE command bar (the scene renders no inline hints). */
      bar: Array.from(document.querySelectorAll('.con-cmdbar__label'))
        .map((el) => txt(el)).filter((s) => s !== ''),
      /** A held press advertises itself as held. */
      holdRing: document.querySelector('.con-cmdbar__hold') !== null,
      /** Nothing about a gate may reach for the legacy modal. */
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal').length,
      /** Everything the player can read, for the contradiction check. */
      screen: (document.body.textContent ?? '').replace(/\s+/g, ' ').toLowerCase(),
    };
  });
}

/**
 * Walk the setup wizard, taking BOTH subject preludes and buying NOTHING (the
 * purchase block is another queue item to drain and this probe is not about it
 * — `submitSummary` already answers the zero-buy confirmation), then commit.
 */
async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await page.waitForTimeout(250);
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      await press(page, 'Enter', 600);
    } else if (kind === 'prelude') {
      // THE SUBJECTS FIRST (the step has a pick LIMIT — filling first burns it
      // on cards nobody asked for; the driver documents this trap).
      const got = await pickCards(page, [WAITING, ENABLER]);
      expect(got, 'both subject preludes were offered and picked').toEqual(
        expect.arrayContaining([WAITING, ENABLER]));
    }
    await press(page, 'Period', 1600);
    for (let w = 0; w < 20 && !(await summaryVisible(page)) &&
         stepKind(await stepSubject(page)) === kind; w++) {
      await page.waitForTimeout(250);
    }
  }
  expect(await summaryVisible(page) || await page.locator('.con-start__queue').isVisible().catch(() => false),
    'reached the summary or its committed deployment').toBeTruthy();
  await submitSummary(page);
  await page.waitForSelector('.con-start__queue', {timeout: 45_000});
}

/**
 * THE RAIL IS LIVE — the server's prelude prompt has arrived and the queue has
 * published its verdicts.
 *
 * The badge is not a property of the card, it is a property of the PROMPT:
 * `ConsoleStartScene.queueCards` computes it only while
 * `startFlowPreludePrompt(playerView) !== undefined`, and a prelude with no
 * live prompt renders `--awaiting` with no band at all. `waitQueueIdle` cannot
 * see that — it asks whether anything is FLYING, and between the last setup
 * card's response and the prelude prompt's arrival nothing is. Reading the gate
 * in that window returned an honest, empty snapshot: `badged: []` on CI, twice
 * the wall time of a dev box, once per blue moon locally.
 *
 * So the walk ends on the rail's own signal. It is a bounded WAIT, never a
 * softened assertion: if the rail never goes live, or goes live with no badge,
 * the reads below still run and still fail with the real state.
 */
async function waitPreludeRailLive(page: Page, maxMs = 20_000): Promise<void> {
  await page.waitForFunction((names: Array<string>) => {
    const slots = Array.from(document.querySelectorAll('.con-start__qcard'));
    const subjects = slots.filter((el) =>
      names.includes(el.getAttribute('data-queue-slot') ?? ''));
    return subjects.length === names.length &&
      // Every subject is PRESSABLE (the prompt is live) …
      subjects.every((el) => !el.classList.contains('con-start__qcard--awaiting')) &&
      // … and the verdict that rides the same render has been published.
      document.querySelector('.con-start__qcard .con-cards__pickband--warn') !== null;
  }, [WAITING, ENABLER], {timeout: maxMs}).catch(() => { /* the gate read reports what it really is */ });
}

/** Drain the deployment down to the prelude rail (the corporation lands first). */
async function reachPreludeRail(page: Page): Promise<void> {
  for (let round = 0; round < 14; round++) {
    await waitQueueIdle(page);
    const queue = await queueCards(page);
    const setup = queue.filter((n) => n !== WAITING && n !== ENABLER);
    if (setup.length === 0) {
      if (queue.length > 0) {
        await waitPreludeRailLive(page);
        return;
      }
      await page.waitForTimeout(700);
      continue;
    }
    // ONE press at a time, and ONLY while the setup card is the focused one.
    // The generic driver's act→verify→RETRY is wrong here: the queue re-focuses
    // as it drains, so a retry that fires blind plays the very prelude this
    // probe came to look at (it did, once).
    if (!(await focusQueue(page, setup[0]))) {
      await page.waitForTimeout(500);
      continue;
    }
    await waitPressable(page);
    await press(page, 'Enter', 1500);
    await page.waitForTimeout(700);
  }
  expect(await queueCards(page), 'the deployment drained down to the preludes').toEqual(
    expect.arrayContaining([WAITING, ENABLER]));
}

/**
 * Move the queue focus onto `card`. The cursor CLAMPS at both ends (it does not
 * wrap), so walking one way only reaches the cards on that side — this turns
 * round at the wall instead, which is what a player does too.
 */
// ⚠️ THIS PROBE USED TO CARRY ITS OWN QUEUE WALKER, and that is precisely how
// it flaked: the local copy knew the queue CLAMPS (it turned around at the
// wall) but not that «ОПЛАТИТЬ» can own the ring, so on a run where the
// purchase item held the cursor every hop read '' and the walk reported «the
// prelude is not there» about a prelude standing in plain sight. The shared
// `focusCard` now carries BOTH lessons — a copy can only re-learn one of them.
const focusQueue = focusCard;

/**
 * Move the focus OFF the current card, in whichever direction is available.
 * The queue's cursor CLAMPS at both ends (it deliberately does not wrap), so a
 * blind ArrowRight/ArrowLeft round trip does not come back — it walks one way
 * and stays there, which once made this probe press A on the wrong card.
 */
async function moveFocusAway(page: Page): Promise<void> {
  const focused = async () => page.evaluate(() =>
    document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
  await yieldToPurchase(page);
  const from = await focused();
  await press(page, 'ArrowRight', 450);
  if (await focused() === from) {
    await press(page, 'ArrowLeft', 450);
  }
  expect(await focused(), 'the focus actually left the card').not.toBe(from);
}

/**
 * The risk stage AFTER a press, polled — never a single read behind a fixed
 * `press(..., 1200)` settle.
 *
 * ⚠️ A DURATION IS NOT A STATE (the lesson this suite keeps re-learning): the
 * press has to round-trip the arming through the workspace, and on a loaded
 * runner that lands after the settle a fast box always beat. The stage's own
 * marker is `[data-start-risk]`, so wait for THAT and read the gate once it
 * is really up — the assertions after it then describe the stage instead of
 * describing the machine's speed.
 */
async function gateWithStage(page: Page, timeoutMs = 15_000): Promise<Awaited<ReturnType<typeof gate>>> {
  await page.waitForSelector('[data-start-risk]', {timeout: timeoutMs}).catch(() => {});
  return gate(page);
}

/** Hold A for `ms` — the shared hold gate's real input. */
async function holdConfirm(page: Page, ms: number): Promise<void> {
  await page.keyboard.down('Enter');
  await page.waitForTimeout(ms);
  await page.keyboard.up('Enter');
}

test.describe('console — the prelude ORDER GATE', () => {
  // The fork's authoring baseline (1rem = 20px at 1920×1080) — geometry read at
  // the runner's default 1280×720 is a claim about a window nobody plays in.
  test.use({viewport: {width: 1920, height: 1080}});

  test('a fixable prelude explains the ORDER instead of offering a confirm', async ({page, request}) => {
    test.setTimeout(300_000); // the setup walk is SETUP, never the subject
    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok(), 'the server accepted the forced prelude deal').toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);
    await reachPreludeRail(page);

    // ── THE IDLE READ: an accurate badge, not a flat «СГОРИТ» ──────────────
    const idle = await gate(page);
    expect(idle.queue, 'both preludes stand in the deployment queue').toEqual(
      expect.arrayContaining([WAITING, ENABLER]));
    expect(idle.badged, 'the copier is the one that cannot resolve yet').toEqual([WAITING]);
    expect(idle.badgeText.toLowerCase(),
      'the badge names the ORDER, never a flat «сгорит» over a fixable card')
      .toContain('сначала другой пролог');
    expect(idle.armed, 'nothing is armed before a press').toBe('');
    expect(idle.stageUp, 'and no stage is open').toBeFalsy();

    expect(await focusQueue(page, WAITING), 'focused the waiting prelude').toBeTruthy();
    const focused = await gate(page);
    // The way OUT is marked — on the card that provides it, not chosen for the player.
    expect(focused.enablers, 'the enabling prelude wears the tie').toEqual([ENABLER]);
    // …and the explanation is readable BEFORE any press.
    expect(focused.railState.toLowerCase()).toContain('сначала разыграйте');

    // ── FIRST A: it EXPLAINS. Nothing is sent, nothing moves ──────────────
    await waitQueueIdle(page);
    await waitPressable(page);
    await shoot(page, 'before');
    await press(page, 'Enter', 1200);
    const armed = await gateWithStage(page);
    expect(armed.queue, 'the first press did not play the card').toContain(WAITING);
    expect(armed.armed, 'the pressed card entered the risk stage').toBe(WAITING);
    expect(armed.stageUp, 'and the stage is an INLINE state of this workspace').toBeTruthy();
    expect(armed.stageTitle.toLowerCase()).toContain('сейчас нечего повторять');
    expect(armed.stageBody.toLowerCase(),
      'the body names the enabling prelude, dynamically').toContain('бизнес-империя');
    expect(armed.effectLost, 'nothing has been lost yet').toBeFalsy();
    expect(armed.legacyModal, 'no legacy modal was pulled in').toBe(0);
    await shoot(page, 'armed');

    // ── THE CONTRADICTION IS GONE ─────────────────────────────────────────
    // The verb names the loss, and no generic confirmation is on screen beside
    // the order advice — that pairing IS the defect this test exists for.
    expect(armed.pillArmed).toBeTruthy();
    expect(armed.pill.toLowerCase()).toContain('разыграть без эффекта');
    expect(armed.bar.join(' | ').toLowerCase()).toContain('разыграть без эффекта');
    expect(armed.bar.join(' | ').toLowerCase()).toContain('вернуться к выбору');
    expect(armed.holdRing, 'the commit is HELD, and says so').toBeTruthy();
    for (const banned of ['нажмите ещё раз', 'подтвердить']) {
      expect(armed.screen,
        `«${banned}» beside «сначала разыграйте другой пролог» is the contradiction being removed`)
        .not.toContain(banned);
    }

    // ── A FAST DOUBLE PRESS CANNOT BURN THE EFFECT ────────────────────────
    await press(page, 'Enter', 120);
    await press(page, 'Enter', 400);
    const mashed = await gate(page);
    expect(mashed.queue, 'a reflex double tap must not reach the commit').toContain(WAITING);
    expect(mashed.effectLost).toBeFalsy();

    // ── B GOES BACK, and does not minimize the deployment ─────────────────
    await press(page, 'Escape', 800);
    const back = await gate(page);
    expect(back.armed, 'B left the risk stage').toBe('');
    expect(back.stageUp).toBeFalsy();
    expect(await page.locator('.con-start__queue').isVisible(),
      'B went back to CHOOSING, it did not minimize the workspace').toBeTruthy();
    expect(back.queue, 'and it certainly did not play anything').toContain(WAITING);

    // ── EVERY EXIT DISARMS: navigation, and the fullscreen inspect ────────
    await press(page, 'Enter', 700);
    expect((await gate(page)).armed, 're-armed').toBe(WAITING);
    await moveFocusAway(page);
    const walked = await gate(page);
    expect(walked.armed, 'walking away drops the stage by construction').toBe('');
    expect(walked.queue, 'and walking away is not a commit').toContain(WAITING);
    expect(await focusQueue(page, WAITING), 'walked back to the waiting prelude').toBeTruthy();
    expect((await gate(page)).armed, 'coming back NEVER inherits the stage').toBe('');

    await press(page, 'Enter', 700);
    expect((await gate(page)).armed, 're-armed').toBe(WAITING);
    await press(page, 'KeyX', 900); // inspect
    await press(page, 'Escape', 900); // close the viewer
    const read = await gate(page);
    expect(read.armed,
      'reading the card is stepping out of the decision — never back into it armed').toBe('');
    expect(read.queue, 'and inspecting is not a commit either').toContain(WAITING);

    // ── THE ADVICE WAS TRUE: play the enabler, the warning disappears ─────
    expect(await focusQueue(page, ENABLER), 'focused the enabling prelude').toBeTruthy();
    await waitQueueIdle(page);
    await waitPressable(page);
    await press(page, 'Enter', 2600);
    await page.waitForTimeout(1500);
    const played = await gate(page);
    expect(played.queue, 'an ordinary prelude still plays on ONE press').not.toContain(ENABLER);

    await waitPressable(page).catch(() => {});
    await page.waitForTimeout(1200);
    const after = await gate(page);
    if (after.queue.includes(WAITING)) {
      expect(after.badged, 'with a prelude played, the copier is a real prelude again').toEqual([]);
      expect(after.enablers, 'and nothing is waiting on anything').toEqual([]);
      await shoot(page, 'cleared');
    }
  });

  /**
   * The other half of the gate: when the player DOES choose to give the effect
   * up, it takes a deliberate HOLD — and the result says so once, plainly.
   */
  test('the loss is committed only by a HOLD, and names itself afterwards', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok()).toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);
    await reachPreludeRail(page);
    expect(await focusQueue(page, WAITING), 'focused the waiting prelude').toBeTruthy();

    await waitQueueIdle(page);
    await waitPressable(page);
    await press(page, 'Enter', 1000);
    expect((await gateWithStage(page)).stageUp, 'the risk stage is up').toBeTruthy();

    // A SHORT hold is not a hold: releasing early is a complete, safe cancel.
    await holdConfirm(page, 200);
    await page.waitForTimeout(600);
    expect((await gate(page)).queue, 'an interrupted hold commits nothing').toContain(WAITING);

    // …and the full hold does commit, through the ORDINARY play animation.
    await holdConfirm(page, 1100);
    await page.waitForTimeout(1200);
    // ONE press, ONE commit. The button was still down when the hold completed
    // and the server answered with the NEXT prelude — a second commit riding
    // that same press would silently play a card the player never chose.
    const justCommitted = await gate(page);
    expect(justCommitted.queue, 'the waiting prelude was played').not.toContain(WAITING);
    expect(justCommitted.queue,
      'and the press did NOT carry on into the prelude that followed it').toContain(ENABLER);

    await page.waitForTimeout(2500);
    const done = await gate(page);
    expect(done.queue, 'still exactly one card played').toContain(ENABLER);
    await shoot(page, 'committed');
  });
});
