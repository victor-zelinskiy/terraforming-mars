import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from '@playwright/test';
import {
  press, stepKind, stepSubject, waitPressable, summaryVisible, pickCards,
  submitSummary, queueCards, waitQueueIdle, playQueueCard,
} from './consoleStart';

/**
 * THE BURN GATE — «СГОРИТ» asks before it burns.
 *
 * A prelude the server flagged `preludeFizzle` does NOT do what its face says:
 * played right now it is discarded for 15 M€, and that cannot be unmade. In
 * the reference case it is only a matter of ORDER — «Двойная ставка» copies an
 * ALREADY-PLAYED prelude, so with nothing played yet it burns, and one press
 * later (after the other prelude) it is a full second prelude.
 *
 * The badge alone could not prevent that: it explains a press the player has
 * already made. So the press ARMS and the second A commits — and this probe
 * defends the three things that make the gate readable rather than merely
 * present:
 *   · the first A does NOT play the card (the rail stays, the card stays);
 *   · the armed state SAYS what confirming costs and asks for the press;
 *   · B takes it back, and a d-pad move disarms it by construction;
 *   · a NON-burning prelude keeps its one-press play (the gate is scoped to
 *     the badge, never a tax on every prelude).
 *
 * It also watches the one geometric risk of putting the caution in the status
 * rail: that rail has a RESERVED height (`--con-start-rail-h`) with
 * `overflow: hidden`, so the deployment above it never reflows — an armed gate
 * must not push its own text out of the box it lives in.
 */

const OUT_DIR = path.resolve('screenshots', 'console-prelude-burn-gate');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

const BURNING = 'Double Down';
// A partner that is playable with NOTHING else set up — it needs only M€, so
// the probe can buy zero projects. («Эксперты-экологи» would fizzle too on an
// empty hand, and that is a second fizzle, not a control.)
const PARTNER = 'Business Empire';

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
    customPreludes: [BURNING, PARTNER, 'Metal-Rich Asteroid', 'Mohole Excavation'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/**
 * The gate as the PLAYER meets it — the card's own ring and pill, the rail's
 * words, the bar's verbs. Read structurally (classes + text), never from
 * component internals.
 */
async function gate(page: Page) {
  return page.evaluate(() => {
    const txt = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-start__qcard'));
    const armed = slots.find((el) => el.classList.contains('con-start__qcard--armed'));
    const rail = document.querySelector<HTMLElement>('.con-start__statusrail');
    const railBox = rail?.getBoundingClientRect();
    const inner = rail?.querySelector<HTMLElement>('.con-start__status-inner')?.getBoundingClientRect();
    return {
      /** Every prelude still standing in the queue (the play is the removal). */
      queue: slots.map((el) => el.getAttribute('data-queue-slot') ?? ''),
      /** Which cards carry the «СГОРИТ» pickband. */
      burnBadges: slots
        .filter((el) => el.querySelector('.con-cards__pickband--warn') !== null)
        .map((el) => el.getAttribute('data-queue-slot') ?? ''),
      /**
       * The «СГОРИТ» badge is the PRE-press warning — the only thing that
       * speaks before the player commits — and it hangs ABOVE its card
       * (`top: -.6rem`) inside a deployment that clips (`overflow: hidden`).
       * So measure how much of it the clip eats: anything above ~1px means
       * the warning the gate is named after is not actually readable.
       */
      badgeHidden: (() => {
        const badge = document.querySelector<HTMLElement>('.con-start__qcard .con-cards__pickband--warn');
        const clip = document.querySelector<HTMLElement>('.con-start__ceremony');
        if (badge === null || clip === null) {
          return -1;
        }
        const b = badge.getBoundingClientRect();
        const c = clip.getBoundingClientRect();
        return Math.round(Math.max(0, c.top - b.top) + Math.max(0, b.bottom - c.bottom));
      })(),
      badgeH: Math.round(document.querySelector('.con-start__qcard .con-cards__pickband--warn')
        ?.getBoundingClientRect().height ?? -1),
      /** The armed card, by name (empty = the gate is not up). */
      armedCard: armed?.getAttribute('data-queue-slot') ?? '',
      /** …and the A pill under it, which must relabel IN PLACE. */
      pill: txt(document.querySelector('.con-start__slot-a')),
      pillArmed: document.querySelector('.con-start__slot-a--armed') !== null,
      /** The rail's caution + instruction (the reason leads). */
      railBurn: rail?.classList.contains('con-start__statusrail--burn') ?? false,
      railWhy: txt(document.querySelector('.con-start__status-burn-why')),
      railCta: txt(document.querySelector('.con-start__status-burn-cta')),
      railState: txt(document.querySelector('.con-start__status-state')),
      /** The rail's reserved box must still CONTAIN its content. */
      railH: Math.round(railBox?.height ?? -1),
      railOverflow: railBox === undefined || inner === undefined ? -1 :
        Math.round(inner.height - railBox.height),
      /** The ONE command bar (the scene renders no inline hints). */
      bar: Array.from(document.querySelectorAll('.con-cmdbar__label'))
        .map((el) => txt(el)).filter((s) => s !== ''),
      /** Nothing about a gate may reach for the legacy modal. */
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal').length,
    };
  });
}

/**
 * Walk the setup wizard, taking BOTH subject preludes and buying NOTHING (the
 * purchase block is another queue item to drain, and this probe is not about
 * it — `submitSummary` already answers the zero-buy confirmation), then commit.
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
      const got = await pickCards(page, [BURNING, PARTNER]);
      expect(got, 'both subject preludes were offered and picked').toEqual(
        expect.arrayContaining([BURNING, PARTNER]));
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
 * Drain the deployment down to the prelude rail: the corporation lands first
 * (its own beat), and only then is the prelude prompt the live ask. Anything
 * in the queue that is not one of the two subjects is that setup.
 */
async function reachPreludeRail(page: Page): Promise<void> {
  for (let round = 0; round < 10; round++) {
    await waitQueueIdle(page);
    const queue = await queueCards(page);
    const setup = queue.filter((n) => n !== BURNING && n !== PARTNER);
    if (setup.length === 0 && queue.length > 0) {
      return;
    }
    if (setup.length > 0) {
      await playQueueCard(page, setup[0]);
      continue;
    }
    await page.waitForTimeout(700);
  }
  expect(await queueCards(page), 'the deployment drained down to the preludes').toEqual(
    expect.arrayContaining([BURNING, PARTNER]));
}

/** Move the queue focus onto `card` (the rail names the focused card). */
async function focusQueue(page: Page, card: string, maxMoves = 8): Promise<boolean> {
  for (let i = 0; i < maxMoves; i++) {
    const focused = await page.evaluate(() =>
      document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    if (focused === card) {
      return true;
    }
    await press(page, 'ArrowRight', 260);
  }
  return (await page.evaluate(() =>
    document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '')) === card;
}

test.describe('console — the prelude BURN GATE', () => {
  test('«СГОРИТ» arms on the first A, states its cost, and only the second A burns it', async ({page, request}) => {
    test.setTimeout(300_000); // the setup walk is SETUP, never the subject
    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok(), 'the server accepted the forced prelude deal').toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);
    await reachPreludeRail(page);

    // The rail holds both preludes and the server has flagged the copier.
    const idle = await gate(page);
    expect(idle.queue, 'both preludes stand in the deployment queue').toEqual(
      expect.arrayContaining([BURNING, PARTNER]));
    expect(idle.burnBadges, 'the copier carries «СГОРИТ» with nothing yet to copy').toContain(BURNING);
    expect(idle.burnBadges, 'the ordinary prelude carries no badge').not.toContain(PARTNER);
    expect(idle.armedCard, 'nothing is armed before a press').toBe('');
    // The badge is the ONLY voice before the press — it must be READABLE, not
    // a sliver poking out of the deployment's clip.
    expect(idle.badgeHidden,
      `the «СГОРИТ» badge is clipped by the deployment (badge ${idle.badgeH}px)`).toBeLessThanOrEqual(1);

    expect(await focusQueue(page, BURNING), 'focused the burning prelude').toBeTruthy();

    // ── FIRST A: arms, plays NOTHING ──────────────────────────────────────
    // The queue absorbs presses while anything is still arriving (the scene's
    // own readiness guard), so wait for it to take input before pressing —
    // a swallowed press is not a gate that failed to arm.
    await waitQueueIdle(page);
    await waitPressable(page);
    await shoot(page, 'before');
    await press(page, 'Enter', 1200);
    const armed = await gate(page);
    expect(armed.queue, 'the first press did not play the card').toContain(BURNING);
    expect(armed.armedCard, 'the pressed card is the armed one').toBe(BURNING);
    expect(armed.pillArmed, 'its A pill turned into the confirm').toBeTruthy();
    expect(armed.pill.toLowerCase(), 'and says so').toContain('подтвердить');
    expect(armed.railBurn, 'the rail took the caution state').toBeTruthy();
    expect(armed.railWhy, 'the REASON leads — the real advice, not a bare demand').not.toBe('');
    expect(armed.railWhy.toLowerCase()).toContain('пролог');
    expect(armed.railCta.toLowerCase(), 'the instruction follows it').toContain('ещё раз');
    expect(armed.legacyModal, 'no legacy modal was pulled in').toBe(0);
    // The bar is the ONE hint surface: A confirms, B takes it back.
    expect(armed.bar.join(' | ').toLowerCase()).toContain('подтвердить');
    expect(armed.bar.join(' | ').toLowerCase()).toContain('отмена');
    // The caution fits the rail's RESERVED box — the deployment never reflows.
    expect(armed.railOverflow, 'the armed rail does not overflow its reserved height').toBeLessThanOrEqual(0);
    await shoot(page, 'armed');

    // ── B TAKES IT BACK (and does not minimize the deployment) ────────────
    await press(page, 'Escape', 800);
    const cancelled = await gate(page);
    expect(cancelled.armedCard, 'B disarmed the gate').toBe('');
    expect(cancelled.railBurn, 'the rail returned to its calm state').toBeFalsy();
    expect(await page.locator('.con-start__queue').isVisible(), 'B cancelled the gate, it did not minimize the workspace').toBeTruthy();

    // ── A NAVIGATION DISARMS BY CONSTRUCTION ──────────────────────────────
    await press(page, 'Enter', 800);
    expect((await gate(page)).armedCard, 're-armed').toBe(BURNING);
    await press(page, 'ArrowRight', 500);
    await press(page, 'ArrowLeft', 500);
    expect((await gate(page)).armedCard, 'walking away and back disarms — the second A is never inherited').toBe('');

    // ── THE ORDINARY PRELUDE IS UNTAXED: one press plays it ───────────────
    expect(await focusQueue(page, PARTNER), 'focused the ordinary prelude').toBeTruthy();
    await press(page, 'Enter', 2600);
    await page.waitForTimeout(1500);
    const played = await gate(page);
    expect(played.queue, 'a prelude with no badge still plays on ONE press').not.toContain(PARTNER);

    // ── …AND THE ADVICE WAS TRUE: the copier no longer burns ──────────────
    await waitPressable(page).catch(() => {});
    await page.waitForTimeout(1200);
    const after = await gate(page);
    if (after.queue.includes(BURNING)) {
      expect(after.burnBadges, 'with a prelude played, the copier is a real prelude again').not.toContain(BURNING);
      await shoot(page, 'cleared');
    }
  });
});
