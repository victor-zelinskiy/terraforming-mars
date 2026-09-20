import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {
  press, settle, waitPressable, summaryVisible, pickCards, submitSummary,
  queueCards, waitQueueIdle, focusCard, stepKind, stepSubject, cinematicBeat,
} from './consoleStart';

/**
 * THE OPENING NEVER HOLDS A PAD IT CANNOT USE.
 *
 * The defect, as reported: Helion + «Огромный астероид». The prelude has a
 * price, Helion can pay it with heat, so the server raises a `SelectPayment`
 * — and the console shows it INSIDE the start workspace («СТАРТ ПАРТИИ ›
 * ОГРОМНЫЙ АСТЕРОИД › ОПЛАТА»), exact and valid, «ОПЛАЧЕНО 5 / 5 · ТОЧНАЯ
 * ОПЛАТА». Nothing could answer it: the command bar still read «A РАЗЫГРАТЬ ·
 * X ОСМОТРЕТЬ · B СВЕРНУТЬ» (the deployment queue's verbs, one layer behind
 * the panel), A re-pressed the queue and LB/RB never reached the heat lane.
 *
 * The cause was OWNERSHIP, not payment: the start workspace holds the pad for
 * the WHOLE opening (its lifetime hold spans every gap between beats), so it
 * kept the pad and the bar over a surface it does not serve. That is a CLASS
 * — every host-served family can arrive during the opening (an OrOptions a
 * prelude asks, an amount, a resource pick, a target player, a card buy) and
 * every one of them was deaf the same way. The rule now lives in ONE pure
 * place (`promptOutranksStartScene`, unit-guarded over every TaskKind); this
 * probe is the other half: the player really can pay, with the pad they have.
 *
 * ⚠️ The SUBJECT is the pregame, so the walk is the UI road by contract — the
 * API one would hand out a board with the opening already over.
 */

const OUT_DIR = path.resolve('screenshots', 'console-start-prompt-pad');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The corporation that turns a printed price into a real CHOICE of currency. */
const CORP = 'Helion';
/** Played FIRST — «+3 теплоотдача, +3 тепла»: the heat that makes the choice exist. */
const HEATER = 'Mohole';
/** The priced prelude: «поднимите температуру на 3 шага, заплатите 5 M€». */
const PRICED = 'Huge Asteroid';

function cfg() {
  return {
    players: [{name: 'PromptPad', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
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
    // FORCE both sides of the case: the corporation with the alternative
    // currency, and a prelude deal that certainly contains the heat and the
    // bill. (Four dealt, two picked — the probe picks its two by name.)
    customCorporationsList: [CORP, 'Teractor'],
    customPreludes: [HEATER, PRICED, 'Metal-Rich Asteroid', 'Business Empire'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/**
 * The screen as the PLAYER meets it, read structurally: the payment's rows
 * carry their unit in `data-pay-unit`, the ONE command bar carries the verbs,
 * the workspace carries the crumb. No component internals.
 */
async function screen(page: Page) {
  return page.evaluate(() => {
    const txt = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const used = (unit: string): number => {
      const n = document.querySelector(`[data-pay-unit="${unit}"] .con-payrow__used`);
      return n === null ? -1 : Number(txt(n));
    };
    return {
      /** The payment block is on screen at all. */
      payUp: document.querySelector('.con-pay') !== null,
      /** …and it is standing INSIDE the opening, not instead of it. */
      startUp: document.querySelector('.con-start') !== null,
      /** Every payment lane the panel offers (the heat lane is the subject). */
      lanes: Array.from(document.querySelectorAll('[data-pay-unit]'))
        .map((el) => el.getAttribute('data-pay-unit') ?? ''),
      heatUsed: used('heat'),
      mcUsed: used('megacredits'),
      /** The verdict line («ОПЛАЧЕНО 5 / 5 · ТОЧНАЯ ОПЛАТА»). */
      status: txt(document.querySelector('.con-paystatus')).toLowerCase(),
      /** The breadcrumb — the opening's own, with the stage on its tail. */
      crumb: txt(document.querySelector('.con-wshead')).toLowerCase(),
      /** The ONE command bar. */
      bar: Array.from(document.querySelectorAll('.con-cmdbar__label'))
        .map((el) => txt(el)).filter((s) => s !== ''),
      /** The deployment queue still standing behind it. */
      queue: Array.from(document.querySelectorAll('.con-start__queue [data-queue-slot]'))
        .map((el) => el.getAttribute('data-queue-slot') ?? ''),
      /** Nothing about this may reach for a legacy modal. */
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal').length,
    };
  });
}

/** Walk the setup wizard taking the corporation and the two subject preludes. */
async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 10 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* the walk reports what it reached */ });
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      expect(await pickCards(page, [CORP]),
        'the forced corporation deal contained Helion').toContain(CORP);
    } else if (kind === 'prelude') {
      // THE SUBJECTS FIRST — the step has a pick LIMIT, so filling first burns
      // it on cards nobody asked for (the driver documents this trap).
      expect(await pickCards(page, [HEATER, PRICED]),
        'both subject preludes were offered and picked')
        .toEqual(expect.arrayContaining([HEATER, PRICED]));
    }
    await press(page, 'Period', 1600); // RT — advance with the physical collect
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* ditto */ });
  }
  await submitSummary(page);
  await page.waitForSelector('.con-start__queue', {timeout: 45_000});
}

/** Play `card` from the deployment queue: focus it, wait until presses act, A. */
async function playQueued(page: Page, card: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await waitQueueIdle(page);
    if (!(await queueCards(page)).includes(card)) {
      return;
    }
    if (!(await focusCard(page, card))) {
      await settle(page, {timeoutMs: 10_000}).catch(() => { /* retried below */ });
      continue;
    }
    await waitPressable(page);
    // ACT → VERIFY → RETRY: the queue absorbs presses while it commits, so a
    // blind press silently loses the move (the driver's own law).
    await press(page, 'Enter', 1800);
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* verified below */ });
    if (!(await queueCards(page)).includes(card)) {
      return;
    }
  }
  expect(await queueCards(page), `«${card}» left the queue`).not.toContain(card);
}

/** Drain every non-subject item (the corporation press, the purchase block). */
async function drainToPreludes(page: Page): Promise<void> {
  for (let round = 0; round < 12; round++) {
    await waitQueueIdle(page);
    const rest = (await queueCards(page)).filter((n) => n !== HEATER && n !== PRICED);
    if (rest.length === 0) {
      return;
    }
    await playQueued(page, rest[0]);
  }
}

test.describe('console — the opening yields the pad to the prompt it is showing', () => {
  // The fork's authoring baseline (1rem = 20px at 1920×1080).
  test.use({viewport: {width: 1920, height: 1080}});

  test('a priced prelude paid in heat: the bar, LB/RB and the confirm all reach the payment', async ({page, request}) => {
    test.setTimeout(300_000); // the walk is SETUP, never the subject
    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok(), 'the server accepted the forced deal').toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);

    await reachDeployment(page);
    await drainToPreludes(page);

    // ── THE HEAT FIRST: without it the bill is auto-paid in M€ and there is
    //    no choice to make (SelectPaymentDeferred.mustPayWithMegacredits).
    await playQueued(page, HEATER);
    await cinematicBeat(page, 1200, 'the heat lands before the bill is raised');

    // ── THE BILL ──────────────────────────────────────────────────────────
    await playQueued(page, PRICED);
    await page.waitForSelector('.con-pay', {timeout: 30_000});
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* read below either way */ });
    const standing = await screen(page);
    await shoot(page, 'payment-standing');

    expect(standing.payUp, 'the payment panel is up').toBeTruthy();
    expect(standing.legacyModal, 'no legacy modal was pulled in').toBe(0);
    // NORTH STAR: it is a STAGE of the opening, not a screen that replaced it.
    expect(standing.startUp, 'the workspace still stands around it').toBeTruthy();
    expect(standing.crumb, 'the crumb keeps the opening as its root').toContain('старт партии');
    // The choice of currency is really offered (the whole reason for a prompt).
    expect(standing.lanes, 'the heat lane is offered').toContain('heat');

    // ── THE BAR BELONGS TO THE SURFACE THE PLAYER IS DRIVING ──────────────
    const bar = standing.bar.join(' | ').toLowerCase();
    expect(bar, 'the payment publishes its dial (LB/RB) to the ONE bar').toContain('−1');
    expect(bar, 'the payment publishes its dial (LB/RB) to the ONE bar').toContain('+1');
    expect(bar,
      'the deployment queue must not advertise its verb over a decision it cannot take')
      .not.toContain('разыграть');

    // ── LB/RB REACH THE HEAT LANE ─────────────────────────────────────────
    expect(standing.heatUsed, 'the heat lane starts at nothing spent').toBe(0);
    await press(page, 'KeyE', 600); // RB → +1
    expect((await screen(page)).heatUsed, 'RB spent one heat').toBe(1);
    await press(page, 'KeyE', 600);
    expect((await screen(page)).heatUsed, 'RB spent a second heat').toBe(2);
    await press(page, 'KeyQ', 600); // LB → −1
    const dialled = await screen(page);
    expect(dialled.heatUsed, 'LB gave one back').toBe(1);
    // The M€ lane balances itself around the dial — the bill is still exactly met.
    expect(dialled.mcUsed, 'the auto lane covers the rest of the 5 M€').toBe(4);
    await shoot(page, 'payment-dialled');

    // ── AND THE CONFIRM LANDS ─────────────────────────────────────────────
    await press(page, 'Enter', 2000);
    await page.waitForSelector('.con-pay', {state: 'detached', timeout: 30_000});
    await cinematicBeat(page, 1500, 'the bill resolves and the opening carries on');
    const paid = await screen(page);
    await shoot(page, 'paid');
    expect(paid.payUp, 'the payment was answered').toBeFalsy();
    expect(paid.queue, 'the priced prelude really played').not.toContain(PRICED);
  });
});
