import {APIRequestContext, Locator, Page, expect} from '@playwright/test';
/**
 * THE ONLY PROMPT TITLES THIS FILE IS ALLOWED TO MATCH, and the reason they are
 * safe (every other prompt is identified structurally — see the invariant in
 * CLAUDE.md: «Never detect a prompt by its title text»).
 *
 * These are SHARED CONTRACT CONSTANTS: the server SETS the title from them and
 * the client DETECTS it from the same module, so the literal lives in exactly
 * one place. They are plain strings (never a `Message`), so — unlike every
 * other title — the serialized value is never rewritten in place by i18n, and
 * matching it is language-independent. `actionMenuTitles.ts` states that
 * contract in full; `SelectInitialCards.ts` is the same shape.
 */
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';
import {
  SELECT_CEO_TITLE, SELECT_CORPORATION_TITLE, SELECT_PRELUDE_TITLE, SELECT_PROJECTS_TITLE,
} from '../../src/common/inputs/SelectInitialCards';

/**
 * THE SHARED CONSOLE START DRIVER — the ONE place e2e specs get a live game
 * from.
 *
 * Every probe used to hand-roll its own pregame walk, so each start-scene
 * rework silently broke half the suite in ways that looked like product bugs
 * (a spec waiting on `.con-start__step--active`, or advancing steps with RB
 * after the wizard moved to RT). The walk is SETUP, never the subject: a
 * spec should fail on ITS OWN claim, not on the road to it.
 *
 * ⭐ THERE ARE TWO ROADS, and the DEFAULT is the API one (`BootVia`):
 *
 *   · `via: 'api'` — the pregame is ANSWERED over `player/input`, the same
 *     endpoint and the same `InputResponse`s the real client posts, and the
 *     console then opens on an already-playable board. Seconds instead of
 *     minutes, and none of the walk's load-sensitivity. Everything from
 *     «THE API PATH» downward.
 *   · `via: 'ui'` — the wizard is WALKED with the keyboard, by the primitives
 *     below. The ONLY correct mode when the SUBJECT is the pregame itself —
 *     the start scene, the deal cinematic, the summary, the deployment queue,
 *     the delivery beat. If a spec asserts on any of those it belongs here.
 *
 * Taking the walk seriously as SETUP eventually means not walking it at all:
 * simulating a keyboard for minutes to reach a state the server hands out in
 * one request bought nothing but false failures (the 2026-08-07 repair found
 * the boot, not the product, behind nearly every one).
 *
 * The walk's primitives are deliberately structural — they read the same
 * signals the UI itself is built on, so they survive cosmetic change:
 *
 *   · the live step   → the workspace breadcrumb's SUBJECT (ConsoleWsHead),
 *                       never a step-list class;
 *   · "presses act now" → the pinned status rail's inner is no longer
 *                       `--held` (the deal cinematic's own release), and a
 *                       press skips the cinematic, so waiting NUDGES;
 *   · the focused card → the status rail's NAME (one line, both phases);
 *   · the summary     → VISIBILITY (it is a parked `v-show` layer, so a
 *                       count check reads "present" forever);
 *   · advance / back  → RT (`Period`) / LT (`Comma`) — the console contract.
 *
 * When the start flow changes again: fix it HERE, once.
 */

/** A press + its settle. The one place a spec's cadence is defined. */
export async function press(page: Page, code: string, settleMs = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** The live wizard step, lower-cased ('' while the deal cinematic owns it). */
export async function stepSubject(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-wshead__layer--deep .con-wshead__subject');
    return (el?.textContent ?? '').trim().toLowerCase();
  });
}

/**
 * The focused card's RENDERED name (the pinned status rail). Localised —
 * use `focusedCard` when you mean a specific card.
 *
 * TWO elements can carry it, and which one does is a property of the STEP:
 * a step whose cards have a requirement to report hands the whole rail to
 * the shared availability block (`.con-cardavail`, name included), the rest
 * keep the plain one-row name. Reading only the first is how this primitive
 * would silently start returning '' on the project buy.
 */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-start__statusrail .con-start__status-name') ??
      document.querySelector('.con-start__statusrail .con-cardavail__name');
    return (el?.textContent ?? '').trim();
  });
}

/**
 * The focused card's IDENTITY — the English `CardName` the slot carries in
 * its own data attribute, in BOTH phases (wizard strip / deployment queue).
 *
 * This is what a spec must key on: the visible label is a translation (the
 * RU name of «Acquired Space Agency» is not a transliteration, and every
 * label can be re-worded), while the attribute IS the card. Matching on text
 * is how a locale tweak turns into a mystery test failure.
 */
export async function focusedCard(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector(
      '.con-cards__slot--focused[data-zoom-slot], .con-start__qcard--focused[data-queue-slot], ' +
      '.con-hand__slot--selected[data-zoom-slot]');
    return el?.getAttribute('data-zoom-slot') ?? el?.getAttribute('data-queue-slot') ?? '';
  });
}

/** The summary pane is SHOWN (parked `v-show` — visibility, never count). */
export async function summaryVisible(page: Page): Promise<boolean> {
  return page.locator('.con-start > .con-start__frame .con-start__summary').isVisible().catch(() => false);
}

/**
 * The start workspace no longer owns the screen — VISIBILITY, never count.
 *
 * MOUNTED != VISIBLE is the app's explicit contract, not an accident:
 * `ConsoleShell.vue:2395` — «The scene owns the start's lifetime (its hold, its
 * claims, its release beat), so it stays mounted through a yield and only stops
 * painting», and `ConsoleStartScene.vue:26` — «ONE PERSISTENT FRAME. Never
 * keyed, never out-in-swapped», with `v-show` panes throughout.
 *
 * So a node count can never answer «is the wizard done». It used to, and that
 * one line failed 13 e2e tests at once: the game had booted (the snapshots show
 * a live hand dock and a full board) while the specs read a parked frame as a
 * running wizard. `console-planet-focus` was fail-by-design — `startSceneVisible`
 * is `startSceneMounted && !placementActive` (`ConsoleShell.vue:2393`), so during
 * a board placement the scene is GUARANTEED mounted-and-hidden, which is exactly
 * when that spec asserted a count of zero.
 *
 * `checkVisibility` (not `.isVisible()`) because the scene yields by opacity as
 * well as by `display` — the same predicate `visibleSurfaces()` uses, so the two
 * diagnostics can never disagree.
 */
export async function startSceneGone(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-start');
    return el === null ||
      !(el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
  }).catch(() => false);
}

/**
 * Wait until presses ACT: the status rail's inner drops `--held` when the
 * deal cinematic ends. A press SKIPS that cinematic, so this nudges while it
 * waits instead of staring at a budget that a loaded machine will blow.
 */
export async function waitPressable(page: Page, maxMs = 20_000): Promise<void> {
  const ready = page.locator('.con-start__status-inner:not(.con-start__status-inner--held)');
  const started = Date.now();
  for (let i = 0; Date.now() - started < maxMs; i++) {
    if (await ready.count() > 0) {
      return;
    }
    // THE NUDGE IS AN «A», AND ON THE SUMMARY «A» IS SUBMIT. The press exists
    // to skip a cinematic that is holding the rail — but the summary's OWN
    // arrival cinematic holds it too, so a nudge fired there submits the very
    // screen the caller was waiting to see. That is not theoretical: it is the
    // «the wizard is BEHIND us» escape in `walkToSummary`, and it is what made
    // `console-start-summary-fit` flaky at 4K, where the arrival is slow enough
    // for the nudge to land inside it. Callers that WANT the summary sent have
    // `submitSummary`; nothing here may send it on their behalf.
    if (i % 4 === 3 && !(await summaryVisible(page))) {
      await page.keyboard.press('Enter'); // skip the cinematic
    }
    await page.waitForTimeout(400);
  }
}

/**
 * Move the focus onto `card` (an English `CardName`) and report whether it
 * got there. Walks right — the row wraps — and never presses A.
 */
export async function focusCard(page: Page, card: string, maxMoves = 14): Promise<boolean> {
  for (let i = 0; i < maxMoves; i++) {
    if (await focusedCard(page) === card) {
      return true;
    }
    await press(page, 'ArrowRight', 260);
  }
  return await focusedCard(page) === card;
}

/**
 * Pick `cards` (English `CardName`s) on the CURRENT step. Returns the names
 * it actually picked, so a spec asserts exactly what it needs — and reads
 * what was offered when the deal didn't contain it.
 */
export async function pickCards(page: Page, cards: ReadonlyArray<string>, maxMoves = 20): Promise<Array<string>> {
  await waitStepDealSettled(page);

  const hit = new Set<string>();
  for (let i = 0; i < maxMoves && hit.size < cards.length; i++) {
    const focused = await focusedCard(page);
    if (cards.includes(focused) && !hit.has(focused)) {
      // ACT → VERIFY, never «pressed = picked». This is rule 4 of this very
      // file — a press is SWALLOWED by design often enough (an arriving card,
      // a commit gate, a step that has just changed) — and this function was
      // the one place that broke it: it recorded the INTENT. A spec then
      // asserted on a deal it never took, and the failure surfaced two screens
      // later as «the card must still be queued», naming the wrong thing.
      //
      // ONE PRESS PER LAP, and the «already picked» test FIRST: A is a TOGGLE,
      // so a second press inside the same lap would UNDO a pick that merely
      // confirmed slower than the poll waited. The walk comes back round, so a
      // swallowed press is retried on the next lap — the self-healing lives
      // HERE, in the primitive. It used to live in the caller's luck: the old
      // blind version returned success, the step stayed unsatisfied, and
      // `walkToSummary`'s outer loop happened to re-enter the same step and
      // pick the card properly. A spec asserting INSIDE its `onStep` hook does
      // not get that second chance.
      if ((await pickedCards(page)).includes(focused)) {
        hit.add(focused);
      } else {
        await press(page, 'Enter', 520);
        if (await pickRegistered(page, focused)) {
          hit.add(focused);
        }
      }
    }
    if (hit.size < cards.length) {
      await press(page, 'ArrowRight', 280);
    }
  }
  return [...hit];
}

/**
 * The step's deal is ON SCREEN and has stopped moving.
 *
 * Two structural facts. Only the LIVE pane carries `data-zoom-slot`
 * (`ConsoleStartScene.vue:123`), so before it is live every focus probe reads
 * '' and a walk spends its whole move budget going nowhere — which is exactly
 * how a deal that DID contain the subject card was reported as one that did
 * not. And a card still ARRIVING wears `con-deal-hold`: it is being drawn by a
 * flying proxy, and an A aimed at it is the press this driver documents as
 * swallowed by design.
 *
 * Bounded, and never an assertion: whatever the walk then finds is what gets
 * returned, and the caller is the one that reports it.
 */
async function waitStepDealSettled(page: Page, maxMs = 15_000): Promise<void> {
  await page.waitForFunction(() =>
    document.querySelector('.con-cards__slot--focused[data-zoom-slot]') !== null &&
    document.querySelectorAll('.con-cards__slot[data-zoom-slot].con-deal-hold').length === 0,
  undefined, {timeout: maxMs}).catch(() => { /* reported by the caller */ });
}

/**
 * Did the STEP register the pick? Polled, because the answer arrives with the
 * step's own render — and bounded, because the caller must be free to come
 * round and try again rather than press twice into the same lap.
 */
async function pickRegistered(page: Page, card: string, maxMs = 1_800): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if ((await pickedCards(page)).includes(card)) {
      return true;
    }
    await page.waitForTimeout(150);
  }
  return false;
}

/** What the CURRENT step is offering (English `CardName`s) — for a failure
 *  message that names the deal instead of "not found". */
export async function offeredCards(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('.con-start__steppane:not([style*="display: none"]) [data-step-slot]'))
    .map((el) => (el.getAttribute('data-step-slot') ?? '').split('|')[1] ?? '')
    .filter((n) => n !== ''));
}

/** How many cards the CURRENT step has picked (the slots say so). */
export async function pickedCards(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('.con-cards__slot--picked[data-zoom-slot]'))
    .map((el) => el.getAttribute('data-zoom-slot') ?? '')
    .filter((n) => n !== ''));
}

/**
 * Fill the step up to `total` picks with whatever is still unpicked. Use it
 * AFTER picking the cards the spec actually needs: a step with a pick LIMIT
 * (two preludes) silently refuses further picks, so the subject card must be
 * picked first and the filler second — the reverse burns the limit on cards
 * nobody asked for (that is exactly how this spec used to lose its prelude).
 */
export async function fillPicks(page: Page, total: number, maxMoves = 20): Promise<Array<string>> {
  for (let i = 0; i < maxMoves && (await pickedCards(page)).length < total; i++) {
    const focused = await focusedCard(page);
    const picked = await pickedCards(page);
    if (focused !== '' && !picked.includes(focused)) {
      await press(page, 'Enter', 500);
    }
    if ((await pickedCards(page)).length < total) {
      await press(page, 'ArrowRight', 280);
    }
  }
  return pickedCards(page);
}

export type StepKind = 'corporation' | 'prelude' | 'project' | 'other';

/** Classify the live step from the breadcrumb subject (RU labels). */
export function stepKind(subject: string): StepKind {
  if (/корпорац|директор/.test(subject)) {
    return 'corporation';
  }
  if (/пролог/.test(subject)) {
    return 'prelude';
  }
  if (/проект/.test(subject)) {
    return 'project';
  }
  return 'other';
}

export type WalkOptions = {
  /**
   * Per-step hook: pick what this spec needs and return. The default picks
   * ONE corporation and nothing else — the cheapest game that starts.
   * Advancing is the driver's job; a hook must not press RT itself.
   */
  onStep?: (page: Page, kind: StepKind) => Promise<void>,
  /** Rounds budget (a step = one round). */
  maxSteps?: number,
};

/**
 * The DEPLOYMENT owns the screen: the wizard is behind us and the start is
 * now playing the cards it dealt. Its own two items ARE the marker — a queue
 * card (`[data-queue-slot]`) or the purchase block (`.con-start__buy`).
 *
 * Needed because the phases SHARE their vocabulary: the deployment's crumb
 * still reads «Проекты › Покупка», so `stepKind` keeps answering `project`
 * long after the last step pane is gone. A hook that trusts that word alone
 * asks an empty screen what it is offering and reports «the deal did not
 * contain X» about a card the player has already bought.
 */
export async function deploymentActive(page: Page): Promise<boolean> {
  return (await page.locator('.con-start__queue [data-queue-slot], .con-start__buy').count()) > 0;
}

/**
 * Walk the setup wizard to the SUMMARY. Adaptive: it reads the live step
 * every round instead of replaying a fixed key script, so a new step (or a
 * different step order) changes nothing here.
 */
export async function walkToSummary(page: Page, opts: WalkOptions = {}): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  const onStep = opts.onStep ?? (async (p: Page, kind: StepKind) => {
    if (kind === 'corporation') {
      await press(p, 'Enter', 600);
    }
  });
  for (let round = 0; round < (opts.maxSteps ?? 12); round++) {
    if (await summaryVisible(page)) {
      return;
    }
    // The wizard is BEHIND us: on a slow profile an advance press can land on
    // the just-arrived summary and submit it (the same A) — and `waitPressable`
    // nudges with that same A while the summary's own arrival cinematic holds
    // the rail, so this is routine rather than rare. The next thing on screen
    // is then already the DEPLOYMENT (its queue / purchase block), or a hosted
    // SelectColony step (`.con-colonies` inside the start). Not an error:
    // bootToBoard's later stages drive the deployment home.
    if (await page.locator('.con-colonies').count() > 0 || await deploymentActive(page)) {
      return;
    }
    await waitPressable(page);
    await page.waitForTimeout(300);
    const kind = stepKind(await stepSubject(page));
    await onStep(page, kind);
    await press(page, 'Period', 1400); // RT — advance with the physical collect
    // Let the step actually change before looking again.
    for (let w = 0; w < 16 && !(await summaryVisible(page)) && stepKind(await stepSubject(page)) === kind; w++) {
      await page.waitForTimeout(250);
    }
  }
  // The same «the wizard is BEHIND us» escape, one stage further out: on a 4K
  // viewport under a loaded parallel run the whole start can go by inside the
  // round budget (every nudge is an A, and A submits the summary AND plays the
  // deployment queue), leaving the shell on a plain screen — a standalone hand,
  // say. The start workspace is UNMOUNTED by then, so this is not a stall; the
  // later stages own it (`waitForBoardHome` closes a standalone hand and drives
  // whatever else is standing). Failing here would blame the wizard for a game
  // that has already started. PAINT, never the count — `startSceneGone`.
  //
  // Deliberately only in the FINAL verdict, never as a loop early-return: the
  // scene fades IN, so a mid-transition frame reads as "gone" and would abort
  // the walk on its very first round.
  expect(await summaryVisible(page) || await page.locator('.con-colonies').count() > 0 ||
    await deploymentActive(page) || await startSceneGone(page),
  `the wizard reached its summary — still showing ${JSON.stringify(await visibleSurfaces(page))}`).toBeTruthy();
}

/**
 * Submit the summary. A zero-projects buy ARMS an amber warning first and
 * only the second A submits, so this is press-verify-retry: it presses until
 * the surface actually reacts, never a fixed number of blind presses (a
 * press that lands inside the summary's reveal convoy is absorbed by the
 * flow gate BY DESIGN — the double-submit guard).
 */
export async function submitSummary(page: Page, maxMs = 60_000): Promise<void> {
  const warn = page.locator('.con-start__skipwarn');
  // ACCEPTED means one of TWO honest outcomes: the deployment took the screen
  // (solo / everyone ready), or the summary STAYS in its waiting state
  // because the table is still confirming — the multiplayer hand-over is
  // simultaneous by design, so «the summary disappeared» is not the contract.
  //
  // ⚠️ IT ALSO MEANS «THE DEPLOYMENT ALREADY HAS THE SCREEN». Leaving that out
  // cost three specs: this loop nudges, and once the wizard had handed over
  // while the parked summary pane was still reported visible for a beat, every
  // further Enter LANDED ON THE DEPLOYMENT QUEUE AND PLAYED A PRELUDE. The
  // symptom was «the OTHER prelude must still be queued — expected Donation,
  // got Great Aquifer»: a spec blamed for a card the driver played behind it.
  // The previous version capped itself at 6 presses, which merely BOUNDED that
  // damage rather than preventing it.
  const accepted = async (): Promise<boolean> =>
    !(await summaryVisible(page)) || await awaitingOthers(page) ||
    await deploymentActive(page) || await startSceneGone(page);

  // KEEP NUDGING WHILE WAITING — but only while the summary is genuinely still
  // the surface in front of us. A press absorbed by the flow gate leaves
  // nothing to wait FOR, so a passive wait after a fixed press budget could
  // only ever time out; that is what failed `console-blue-action-purchase ·
  // tv4k` inside the BOOT, several screens before its actual subject. Same
  // «nudge, don't stare» discipline as `waitPressable` — bounded by the state
  // check above, never by a press count.
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await accepted()) {
      return;
    }
    await press(page, 'Enter', 900);
    if (await accepted()) {
      return; // the press landed — never send the confirmation into what follows
    }
    if (await warn.count() > 0) {
      await press(page, 'Enter', 1400); // the zero-buy confirmation press
    }
  }
  expect(await accepted(),
    `the summary was never accepted — still showing ${JSON.stringify(await visibleSurfaces(page))}`)
    .toBeTruthy();
}

/** The setup is SENT and the table is still confirming (the waiting summary). */
export async function awaitingOthers(page: Page): Promise<boolean> {
  return page.locator('.con-start__await').isVisible().catch(() => false);
}

/**
 * The DEPLOYMENT queue: play the cards the start dealt. `first` (name
 * synonyms) is focused and played FIRST when given — a spec that needs a
 * specific card's effect drives it that way; everything else is played in
 * whatever order the queue offers.
 *
 * Stops when the start workspace releases (the board takes over) or the
 * budget runs out; a reveal opened by a play is taken along the way, so the
 * queue can always continue.
 */
export async function playStartQueue(page: Page, opts: {first?: string, plays?: number} = {}): Promise<void> {
  await page.waitForSelector('.con-start__queue [data-queue-slot], .con-start', {timeout: 30_000}).catch(() => {});
  if (opts.first !== undefined) {
    await playQueueUntil(page, opts.first);
    await playQueueCard(page, opts.first);
  }
  for (let i = 0; i < (opts.plays ?? 8); i++) {
    if (await startSceneGone(page)) {
      return;
    }
    if (await page.locator('.con-reveal').count() > 0) {
      await takeRevealCards(page);
      continue;
    }
    if (await buyFocused(page)) {
      await payStartPurchase(page);
      continue;
    }
    const queue = await queueCards(page);
    if (queue.length === 0) {
      // The purchase block is a queue ITEM too — pay it, or the deployment
      // never finishes and every later assertion blames the wrong screen.
      if (await payStartPurchase(page)) {
        continue;
      }
      await page.waitForTimeout(800);
      continue;
    }
    // ACT → VERIFY → RETRY per card (playQueueCard) — never a blind press:
    // the queue absorbs presses while it commits, and a lost play used to
    // strand the whole boot in the ceremony.
    const target = await focusedCard(page) === '' ? queue[0] : await focusedCard(page);
    await playQueueCard(page, target);
  }
}

/** What the deployment queue still holds (English `CardName`s). */
export async function queueCards(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.con-start__queue [data-queue-slot]'))
    .map((el) => el.getAttribute('data-queue-slot') ?? '')
    .filter((n) => n !== ''));
}

/**
 * Wait until the deployment queue is IDLE and takes presses: cards are
 * standing, no hero flight / arrival is in the air, the status rail is
 * released. Anything driving the queue must wait for this — presses during a
 * flight are absorbed by design, so a blind key script silently loses moves.
 */
export async function waitQueueIdle(page: Page, maxMs = 25_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const busy = await page.evaluate(() =>
      // Scope the "something is flying" check to the START scene: a
      // `con-deal-hold` elsewhere (a dock face away for an unrelated beat)
      // would keep this spinning until the budget dies.
      document.querySelectorAll('.con-played-hero__proxy, .con-startdock-proxy, .con-start__queue .con-deal-hold').length > 0 ||
      // A DECK-DRAW SCENE IS THE QUEUE STILL WORKING. It is armed a beat after
      // the play it belongs to, so without this term «idle» can be true in the
      // window between the response and the scene's first proxy — and the
      // reveal it hands off to then lands ON TOP of the next press.
      document.querySelector('.con-deckdraw') !== null ||
      document.querySelector('.con-start__status-inner--held') !== null);
    // The queue's items are the CARDS *and* the purchase block — a
    // deployment whose only remaining item is «ОПЛАТИТЬ» is idle, not empty.
    const items = (await queueCards(page)).length + (await page.locator('.con-start__buy').count());
    if (!busy && items > 0) {
      await page.waitForTimeout(400);
      return;
    }
    await page.waitForTimeout(300);
  }
}

/**
 * Pay for the bought projects — the deployment's OWN queue item («ОПЛАТИТЬ»),
 * which is not a card slot and therefore invisible to `queueCards`. Returns
 * false when there is nothing to pay. Act → verify → retry, like every other
 * press here.
 */
export async function payStartPurchase(page: Page): Promise<boolean> {
  const buy = page.locator('.con-start__buy');
  if (await buy.count() === 0) {
    return false;
  }
  await waitQueueIdle(page);
  for (let attempt = 0; attempt < 4 && await buy.count() > 0; attempt++) {
    // Already focused (the queue puts the purchase in the ring as it drains)
    // → just confirm; otherwise walk onto it first.
    for (let hop = 0; hop < 8 && await page.locator('.con-start__buy--focused').count() === 0; hop++) {
      await press(page, 'ArrowRight', 260);
    }
    await press(page, 'Enter', 1800);
    await waitQueueIdle(page);
  }
  return await buy.count() === 0;
}

/** The purchase item currently owns the focus ring (A means «оплатить»). */
export async function buyFocused(page: Page): Promise<boolean> {
  return (await page.locator('.con-start__buy--focused').count()) > 0;
}

/**
 * Play the deployment queue down to `target` (an English `CardName`) so the
 * spec can play THAT card itself and own the scene it fires. Everything else
 * in the queue is played first, one card per idle window — the corporation
 * gates the preludes by the rules, so "play the rest, then the subject" is
 * the only order that holds without encoding that gate here.
 *
 * Returns false when the target never appeared in the queue (a deal that
 * didn't contain it) — the caller reports it with the real queue contents.
 */
export async function playQueueUntil(page: Page, target: string, maxPlays = 6): Promise<boolean> {
  for (let i = 0; i < maxPlays; i++) {
    await waitQueueIdle(page);
    const queue = await queueCards(page);
    if (!queue.includes(target)) {
      return false;
    }
    if (queue.length === 1) {
      return await focusCard(page, target);
    }
    // Focus anything that is NOT the target and play it.
    let moved = false;
    for (let hop = 0; hop < queue.length + 2; hop++) {
      const focused = await focusedCard(page);
      if (focused !== target && focused !== '') {
        moved = true;
        break;
      }
      await press(page, 'ArrowRight', 260);
    }
    if (!moved) {
      return await focusCard(page, target);
    }
    // ACT → VERIFY → RETRY. A play press is ABSORBED BY DESIGN while the
    // scene is committing (the double-submit guard, an arriving card, a hero
    // still resolving), so "one press = one play" is a lie a test must not
    // tell itself: press until the queue actually shrinks.
    for (let attempt = 0; attempt < 4 && (await queueCards(page)).length === queue.length; attempt++) {
      await press(page, 'Enter', 1600);
      if (await page.locator('.con-reveal').count() > 0) {
        await takeRevealCards(page);
      }
      await waitQueueIdle(page);
    }
    // …AND THE DRAIN HAS TO BE REPEATED OUTSIDE THAT LOOP, because the loop
    // exits on the SHRINK: a card that both left the queue AND raised a scene
    // of its own leaves its reveal standing for the next press to walk into.
    // That is the ordinary case, not an edge one — a corporation with a
    // triggered draw (Point Luna, on its own Earth tag) fires one every time
    // it is dealt, and which corporation is dealt is NOT reproducible
    // (`seed` is ignored by ApiCreateGame — see .claude/rules/tests.md).
    if (await page.locator('.con-reveal').count() > 0) {
      await takeRevealCards(page);
      await waitQueueIdle(page);
    }
  }
  await waitQueueIdle(page);
  return await focusCard(page, target);
}

/**
 * Play the queue card `card` and confirm it actually left — the press that
 * fires a scene must be OWNED by the spec, and a swallowed press (the
 * commit guard) must not read as "the scene never happened". Polls fast
 * (~100 ms) so a spec can still observe the scene from its first frames.
 *
 * ⚠️ A SCENE STANDING BEFORE THE PRESS IS NOT EVIDENCE OF THE PRESS. A reveal
 * left by an EARLIER card owns A — so it swallows the press — and it also
 * satisfies the `sceneUp` test below, which means this function would report
 * a play that never happened and the caller would then measure the previous
 * card's scene as if it were its own. That is exactly how `console-deck-draw`
 * failed on CI and passed on the retry: whenever the (unseeded) deal handed
 * the player Point Luna, playing the corporation fired its triggered draw,
 * and the spec's «the modal is WITHHELD while the scene plays» assertion was
 * reading Point Luna's assembled reveal. Clear it first — follow the surface.
 */
export async function playQueueCard(page: Page, card: string, maxPresses = 4): Promise<boolean> {
  await waitQueueIdle(page);
  if (await page.locator('.con-reveal').count() > 0) {
    await takeRevealCards(page);
    await waitQueueIdle(page);
  }
  if (!await focusCard(page, card)) {
    // FOLLOW THE SURFACE, never fight it: the focus ring may be sitting on
    // the purchase item (A means «оплатить» there, and the ring does not
    // walk back onto the cards until it resolves). Pay, then try again —
    // insisting on a card here is what deadlocked the whole boot.
    if (await buyFocused(page)) {
      await payStartPurchase(page);
      if (!await focusCard(page, card)) {
        return false;
      }
    } else {
      return false;
    }
  }
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Enter');
    for (let w = 0; w < 12; w++) {
      await page.waitForTimeout(100);
      const gone = !(await queueCards(page)).includes(card);
      const sceneUp = await page.locator('.con-deckdraw, .con-reveal, .con-played-hero__proxy').count() > 0;
      if (gone || sceneUp) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Place a pending tile: the seeded cursor is often on a LEGAL cell, but not
 * always («Нельзя разместить здесь» — the panel says so and A is refused),
 * so this walks the board until a press actually resolves the placement.
 * Returns false when there is nothing to place.
 */
export async function placeTile(page: Page, maxTries = 24): Promise<boolean> {
  const kicker = page.locator('.con-context__task-kicker');
  if (await kicker.count() === 0) {
    return false;
  }
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < maxTries && await kicker.count() > 0; i++) {
    await press(page, 'Enter', 1100);
    if (await kicker.count() === 0) {
      return true;
    }
    await press(page, dirs[i % dirs.length], 350);
  }
  return await kicker.count() === 0;
}

/** Take every card of a standing reveal (A per card; the last one closes). */
export async function takeRevealCards(page: Page, maxTakes = 12): Promise<void> {
  const reveal = page.locator('.con-reveal');
  for (let i = 0; i < maxTakes && await reveal.count() > 0; i++) {
    await press(page, 'Enter', 1400);
  }
}

/**
 * Drive whatever the start left standing until the BOARD HOME is live: the
 * hand dock is interactive and nothing is holding the screen. Self-healing
 * by design (a corp first-action composer, a placement, a mandatory
 * announce) — but bounded, and it reports what it was still looking at.
 */
// The budget is a LOAD allowance, not a behaviour claim: a full pregame on a
// busy machine (wizard → summary → deployment → a placing prelude) is minutes
// of real game, and every round here does real work.
export async function waitForBoardHome(page: Page, maxRounds = 70, opts: {keepColony?: string} = {}): Promise<void> {
  const live = page.locator('.con-handdock--live');
  const start = page.locator('.con-start');
  const composer = page.locator('.con-composer');
  const reveal = page.locator('.con-reveal');
  const hand = page.locator('.con-hand');
  const mandatory = page.locator('.con-mandatory');
  const placement = page.locator('.con-context__task-kicker');
  // A server SelectColony on the way home (the solo setup «remove a colony»,
  // a prelude's Build Colony): the COLONY WORKSPACE serves it (standalone or
  // embedded — same root class either way).
  const colonies = page.locator('.con-colonies');
  // The GENERIC prompt surface. It had no branch at all, so a task the walk
  // met on the way home fell through to the 700 ms no-op below and spun until
  // the budget died — reporting «board home never became live — still showing
  // [".con-task",".con-board"]», a diagnosis that names the one surface it
  // never tried to drive.
  const task = page.locator('.con-task');
  const taskVisible = async () => await task.count() > 0 && await task.first().isVisible();
  /** Consecutive rounds the task host has been up with nothing above it. */
  let taskRounds = 0;
  for (let i = 0; i < maxRounds; i++) {
    if (await live.count() > 0 && await placement.count() === 0 && await hand.count() === 0 &&
        await start.count() === 0 && await composer.count() === 0 && await colonies.count() === 0 &&
        await mandatory.count() === 0) {
      await page.waitForTimeout(600);
      return;
    }
    // ORDER MATTERS — always drive the surface that is ON TOP, or the driver
    // fights a covered one (pressing into the start while the hand overlay
    // owns the input is how this used to spin until the budget died).
    if (await reveal.count() > 0) {
      await press(page, 'Enter', 1200);
    } else if (await hand.count() > 0) {
      // INSIDE the start workspace the hand IS the pending start work (a
      // play-from-hand prelude — Eccentric Sponsor / Ecology Experts): play a
      // PLAYABLE card through the ordinary flow (pick → the composer's commit
      // — both are A). B here would fight a task that must resolve. A
      // STANDALONE hand screen is simply not the home — close it.
      //
      // WALK TO A PLAYABLE CARD FIRST, never press A on whatever the cursor
      // happens to sit on: the hand shows every card and marks the ones the
      // rules refuse (`con-hand__slot--unplayable`, with the honest reason
      // under it — «Нельзя разыграть: Требуется температура −16 °C»), so A on
      // a blocked card is correctly REFUSED, forever. The driver hammering one
      // such card is what produced the `[".con-start",".con-hand"]` deadlock
      // that reads exactly like a stalled start workspace but is nothing of
      // the sort — the surface underneath was healthy the whole time. The
      // marker is structural (`ConsoleHandSection.vue:176`), so this follows
      // the same rule as everything else here: read the signal the UI is
      // built on, never the copy.
      if (await start.count() > 0) {
        const playable = page.locator('.con-hand__slot--selected.con-hand__slot--playable');
        for (let j = 0; j < 12 && await playable.count() === 0; j++) {
          await press(page, 'ArrowRight', 260);
        }
        await press(page, 'Enter', 1400);
      } else {
        await press(page, 'Escape', 1400);
      }
    } else if (await mandatory.count() > 0) {
      // A held / DEFERRED decision (incl. a minimized start workspace) —
      // A brings it back; leaving it parked keeps the dock non-interactive.
      await press(page, 'Enter', 1200);
    } else if (await taskVisible()) {
      // THE TASK HOST IS ON TOP, so it is driven BEFORE the start — the
      // branch order's own law. Standing over a still-painted start scene it
      // OWNS the input, so every press the start branch below makes is
      // swallowed: the walk spun out its whole budget and reported «board
      // home never became live — still showing [".con-start",".con-task",
      // ".con-board"]», naming three surfaces and driving the wrong one.
      //
      // VISIBILITY, never count: this host is `v-show`-parked for much of a
      // game, and a mounted-but-hidden task must not out-rank the surface the
      // player is actually looking at.
      //
      // WAIT IT OUT FIRST, ANSWER ONLY A STUCK ONE. A task the shell is
      // already driving resolves by itself, and answering it eagerly is a
      // press into a prompt nobody asked this driver about — the eager
      // version cost two 4K presets. So the first rounds keep the old no-op
      // behaviour and only then does it self-heal: the same shape as the
      // product's own stalled-foreground watchdog, which also insists on
      // several passes before it touches anything.
      //
      // When it does act it uses the console's own two verbs and nothing
      // else: A selects / confirms, RT commits a SET (the multi-pick shape,
      // where A only toggles). Alternating covers both without guessing which
      // prompt kind is on screen.
      taskRounds++;
      if (taskRounds > 3) {
        await press(page, taskRounds % 2 === 0 ? 'Enter' : 'Period', 1400);
      } else {
        await page.waitForTimeout(700);
      }
    } else if (!await startSceneGone(page)) {
      // The start workspace is still PAINTED: finish it with the SAME
      // primitives the boot uses (never a blind Enter — a swallowed press
      // would just burn the budget and the failure would name the wrong
      // thing).
      //
      // PAINT, not mount — the same distinction `startSceneGone` exists for,
      // and the branch order makes it load-bearing: a start prelude that
      // places a tile («Great Aquifer», «Experimental Forest») hands the board
      // over and the scene YIELDS — `startSceneVisible` is
      // `startSceneMounted && !placementActive` (`ConsoleShell.vue:2393`), so
      // `.con-start` is guaranteed mounted-and-hidden for exactly as long as
      // the placement stands. Keyed on the COUNT this branch won the race
      // against the placement branch below and drove presses into an invisible
      // workspace until the budget died — and worse, `playQueueCard`'s blind
      // Enter sometimes leaked through to the LIVE board and committed the
      // tile on whatever cell was seeded.
      if (await summaryVisible(page)) {
        await submitSummary(page);
      } else if (await buyFocused(page)) {
        await payStartPurchase(page);
      } else {
        const queue = await queueCards(page);
        if (queue.length > 0) {
          await playQueueCard(page, await focusedCard(page) || queue[0]);
        } else if (!await payStartPurchase(page)) {
          await press(page, 'Enter', 1200);
        }
      }
    } else if (await composer.count() > 0) {
      const corpFirst = await page.locator('.con-composer--corpfirst').count() > 0;
      await press(page, corpFirst ? 'Enter' : 'KeyX', 1500);
    } else if (await placement.count() > 0) {
      await placeTile(page);
    } else if (await colonies.count() > 0) {
      // ITERATION 2 — the overview never commits: A DESCENDS into the FOCUS
      // STAGE and the stage's own A resolves a pick/build. Read the
      // STRUCTURAL markers (`data-colony-intent` on the stage,
      // `data-colony-mode` on the section) — never a footer label.
      const stage = page.locator('.con-colfocus');
      if (await stage.count() > 0) {
        if (await page.locator('.con-colfocus--resolving').count() > 0) {
          await page.waitForTimeout(900); // a transaction is landing — let it
        } else {
          const intent = await stage.getAttribute('data-colony-intent').catch(() => null);
          if (intent === 'pick' || intent === 'build') {
            await press(page, 'Enter', 1800); // confirm ON the stage
          } else {
            // An idle trade/inspect descent is NOT the way home — fold back.
            await press(page, 'Escape', 1200);
          }
        }
      } else if ((await colonies.first().getAttribute('data-colony-mode').catch(() => null)) === 'pick') {
        // A live SelectColony: steer OFF a colony the spec needs alive
        // (`keepColony`), then A descends into the pick stage; the next
        // round confirms there. Act → verify → retry, as everywhere.
        if (opts.keepColony !== undefined) {
          const keepFocused = page.locator(`.con-coltile--focused[data-test="con-colony-${opts.keepColony}"]`);
          for (let j = 0; j < 6 && await keepFocused.count() > 0; j++) {
            await press(page, 'ArrowRight', 500);
          }
        }
        await press(page, 'Enter', 1800);
      } else {
        // No live pick — the standing section itself blocks the home
        // verdict (a follow-up that has already settled): close it.
        await press(page, 'Escape', 1200);
      }
    } else {
      taskRounds = 0;
      await page.waitForTimeout(700);
    }
  }
  expect(await live.count(), `board home never became live — still showing ${JSON.stringify(await visibleSurfaces(page))}`)
    .toBeGreaterThan(0);
}

/**
 * A GATED INTERRUPTIVE PROMPT IS ANNOUNCED, NEVER AUTO-OPENED — so open it.
 *
 * `consoleMandatoryGate.ts`: a mandatory ACTION (a forced `handSelect`, a
 * `colonyBonus` collect, an off-turn forced reaction) leaves its surface CLOSED
 * and names itself on a board-home plate; **A opens it**. A spec that injects or
 * provokes one and then waits for the surface directly waits forever — which is
 * exactly how `console-pluto-bonus-discard` and `console-colony-trade-probe`
 * both timed out on `.con-reveal__*` while the board underneath was perfectly
 * healthy, showing «БОНУС КОЛОНИИ · Ⓐ Открыть».
 *
 * Returns whether a plate was found and acknowledged, so a caller can stay
 * honest about which path it took. The wait is bounded and structural — the
 * plate's own root class, never its copy.
 */
export async function openMandatoryAnnounce(page: Page, maxMs = 25_000): Promise<boolean> {
  const plate = page.locator('.con-mandatory');
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await plate.count() > 0) {
      await press(page, 'Enter', 900);
      // The gate hands the screen to the surface it announced; if the plate is
      // still up, the press raced the entrance — try again inside the budget.
      if (await plate.count() === 0) {
        return true;
      }
      continue;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

/**
 * What the player would actually SEE right now (root surface classes that
 * are genuinely painted). A failure message built on this names the screen
 * the run got stuck on — parked `v-show` layers (the summary pane lives on
 * through the whole game) would otherwise make every diagnosis a lie.
 */
export async function visibleSurfaces(page: Page): Promise<Array<string>> {
  return page.evaluate(() => {
    const roots = ['.con-start', '.con-start__summary', '.con-hand', '.con-composer', '.con-reveal',
      '.con-mandatory', '.con-task', '.con-deckdraw', '.con-handdock--live', '.con-board'];
    return roots.filter((sel) => {
      const el = document.querySelector(sel);
      return el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    });
  });
}

/**
 * The whole pregame in one call: wizard → summary → deployment → board home.
 * A spec that only needs "a live game" says exactly that.
 */
export async function bootToBoard(page: Page, opts: WalkOptions & {first?: string, keepColony?: string} = {}): Promise<void> {
  await walkToSummary(page, opts);
  await submitSummary(page);
  await playStartQueue(page, {first: opts.first});
  await waitForBoardHome(page, 70, {keepColony: opts.keepColony});
}

// ────────────────────────────────────────────────────────────────────────
// THE PREGAME AS A WHOLE — «put card X in this player's hand, on the board
// home, and get out of the way».
//
// Everything below used to be copy-pasted per spec: a 50-line game config, a
// seed-retry deal search, a `goto` + first-paint budget, a hand-rolled corp
// pick and a hand-rolled play-from-hand. Four probes drifted apart that way
// and then failed TOGETHER on one attribute (`data-zoom-slot` is emitted only
// on the ACTIVE step pane — `ConsoleStartScene.vue:120`), because each copy
// walked the wizard with its own predicates instead of the driver's.
//
// The rule stays the one at the top of this file: the road to the subject is
// SETUP and lives HERE; a spec's own file contains only its claim.
// ────────────────────────────────────────────────────────────────────────

/**
 * The solo test-mode game every console probe starts from. `overrides` is a
 * shallow merge, with `expansions` merged one level deeper — so a Venus probe
 * says `soloGameConfig({expansions: {venus: true}})` and nothing else.
 *
 * `testMode: true` is load-bearing: it is what makes the deal big enough for a
 * spec to find a specific card (8 corporations / 20 projects) instead of
 * re-creating games until the RNG is kind.
 */
export function soloGameConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const {expansions, players, ...rest} = overrides as {
    expansions?: Record<string, boolean>,
    players?: Array<Record<string, unknown>>,
  };
  return {
    players: players ?? [{name: 'ConsoleTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
      ...(expansions ?? {}),
    },
    board: 'tharsis',
    seed: 0.1,
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
    customColoniesList: [],
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
    ...rest,
  };
}

/**
 * Base/corpera corporations to hand `customCorporationsList` when a probe
 * must keep ONE corporation out of the human's deal — a MarsBot probe that
 * forces the bot's corporation, since RB-B Setup 1 legitimately hands the bot
 * a DIFFERENT one when the human holds its original.
 *
 * ⚠️ `customCorporationsList` is CARDS-ON-TOP, not a restriction: it only
 * puts those names at the top of the corporation deck, and the rest of the
 * deal is still random. `testMode` deals EIGHT corporations, so a two-name
 * list leaves six random slots — which is exactly how a probe forcing C30
 * Aridor watched the wizard pick Aridor and the bot legitimately get
 * something else. Filling all eight slots from a list that excludes the one
 * name makes the collision unexpressible.
 */
const PROBE_CORPORATIONS: ReadonlyArray<string> = [
  'CrediCor', 'Ecoline', 'Helion', 'Interplanetary Cinematics', 'Inventrix',
  'Mining Guild', 'PhoboLog', 'Saturn Systems', 'Teractor', 'Tharsis Republic',
  'ThorGate', 'United Nations Mars Initiative',
];

/** Those corporations minus `excluded` — see {@link PROBE_CORPORATIONS}. */
export function corporationsExcluding(...excluded: ReadonlyArray<string>): Array<string> {
  return PROBE_CORPORATIONS.filter((name) => !excluded.includes(name));
}

/**
 * Create games (varying the seed) until the initial deal offers EVERY card in
 * `cards`, and return that player's id. API-only, so the loop is cheap — far
 * cheaper than driving a UI that turns out not to hold the subject card.
 *
 * The deal is read from the server's own `waitingFor` tree, never from the
 * screen: at this point there is no screen.
 */
export async function createGameWithCards(
  request: APIRequestContext,
  cards: ReadonlyArray<string>,
  opts: {config?: Record<string, unknown>, seed?: number, step?: number, attempts?: number} = {},
): Promise<string> {
  const base = opts.config ?? soloGameConfig();
  const seed = opts.seed ?? Number(base.seed ?? 0.1);
  const step = opts.step ?? 0.017;
  // The deal is NOT a pure function of the seed on a live server (the specs
  // that hand-rolled this loop said so in a comment and then used 40 anyway),
  // so this is a probability budget: ~20 of ~200 projects per deal means each
  // attempt is a ~1-in-10 shot, and 40 of them still miss about once in 70
  // runs — which across a dozen probes is a failure a week. The loop is
  // API-only, so buying two more nines costs seconds, not minutes.
  const attempts = opts.attempts ?? 80;
  let dealt: Array<string> = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const created = await request.post('/api/creategame', {data: {...base, seed: seed + attempt * step}});
    expect(created.ok(), 'the game server accepted the config').toBeTruthy();
    const {players} = await created.json();
    const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
    dealt = (pv.waitingFor?.options ?? [])
      .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
    if (cards.every((c) => dealt.includes(c))) {
      return players[0].id;
    }
  }
  // Report the LAST deal — «not found» is useless, «here is what the server
  // actually offered» names a renamed card or a missing expansion at once.
  expect(dealt, `${attempts} deals, none offering ${cards.join(' + ')}`).toEqual(
    expect.arrayContaining([...cards]));
  return '';
}

// ────────────────────────────────────────────────────────────────────────
// THE API PATH — ANSWER the pregame instead of ACTING IT OUT
//
// The walk above is SETUP, never the subject (this file's opening line), and
// yet it cost the suite most of its wall clock: 123 tests / ~23 minutes, single
// files at 6–8 minutes, almost all of it a keyboard simulating a state the
// server produces in one request. It was also the single biggest source of
// FALSE failures — nearly every "bug" repaired on 2026-08-07 was the boot
// breaking under load, not the product.
//
// So a spec whose subject is anything AFTER the pregame now gets its game the
// way the server hands one out: POST `player/input` with the `InputResponse`
// the live `waitingFor` asks for, repeat until the ACTION MENU stands, THEN
// open the console on an already-playable board.
//
// This is NOT a test-only back door. It is the SAME endpoint the real client
// posts to (`src/server/routes/PlayerInput.ts`), with the same responses, the
// same validation and the same rules — nothing here can reach a state a player
// could not. A DB/state shortcut would silently drift from the rules these
// specs exist to check; this cannot, by construction.
//
// What it deliberately does NOT do: it never touches the pregame's PRESENTATION
// (the deal cinematic, the summary, the deployment queue, the delivery beat).
// A spec whose subject IS one of those stays on `via: 'ui'` — see BootOptions.
// ────────────────────────────────────────────────────────────────────────

/**
 * The shape of a `waitingFor` node as it arrives over the wire — the subset a
 * seeder needs. Deliberately structural and loose: this is JSON off an HTTP
 * response, so a compile-time union would only be a comfortable fiction. Every
 * field read here is one the server genuinely serializes
 * (`src/common/models/PlayerInputModel.ts`).
 */
type WirePrompt = {
  type: string,
  title?: unknown,
  min?: number,
  max?: number,
  maxByDefault?: boolean,
  amount?: number,
  count?: number,
  options?: Array<WirePrompt>,
  cards?: Array<{name: string}>,
  spaces?: Array<string>,
  players?: Array<string>,
  coloniesModel?: Array<{name: string}>,
  include?: Array<string>,
  startGamePrompt?: {kind: string},
};

type WirePlayerModel = {
  waitingFor?: WirePrompt,
  game: {phase: string},
};

/** A response body for `player/input`, kept loose for the same reason. */
type WireResponse = Record<string, unknown> & {type: string};

/** The zero payment — every `SpendableResource` at 0 (`Payment.EMPTY`). */
const NO_PAYMENT: Readonly<Record<string, number>> = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

/** A prompt's title as a plain string ('' for a `Message` — see the note above). */
function promptTitle(prompt: WirePrompt): string {
  return typeof prompt.title === 'string' ? prompt.title : '';
}

/** A one-line description of a prompt, for a failure that NAMES what it met. */
function describePrompt(prompt: WirePrompt | undefined): string {
  if (prompt === undefined) {
    return '(nothing)';
  }
  const title = typeof prompt.title === 'string' ?
    prompt.title :
    String((prompt.title as {message?: string} | undefined)?.message ?? '');
  const start = prompt.startGamePrompt !== undefined ? ` startGamePrompt=${prompt.startGamePrompt.kind}` : '';
  return `${prompt.type}${start} «${title}»`;
}

/** The live player model, straight off the server. */
export async function fetchPlayerModel(request: APIRequestContext, playerId: string): Promise<WirePlayerModel> {
  const res = await request.get(`/api/player?id=${playerId}`);
  expect(res.ok(), `GET api/player failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

/**
 * Answer the live prompt and return the UPDATED model — `player/input` replies
 * with the same `PlayerViewModel` the client would poll for, so one round trip
 * is one whole step of the game.
 */
export async function sendPlayerInput(
  request: APIRequestContext,
  playerId: string,
  response: WireResponse,
): Promise<WirePlayerModel> {
  const res = await request.post(`/player/input?id=${playerId}`, {data: response});
  expect(res.ok(),
    `POST player/input rejected ${JSON.stringify(response)}: ${res.status()} ${await res.text()}`)
    .toBeTruthy();
  return res.json();
}

/** What the API seeder should pick when the pregame offers a choice. */
export type SeedPlan = {
  /** Projects to BUY out of the initial deal (English `CardName`s). */
  cards?: ReadonlyArray<string>,
  /**
   * Buy this MANY projects in total — the API spelling of the wizard's
   * `fillPicks(n)`, for a spec that needs «a non-empty hand» and does not care
   * which cards. `cards` is bought first and counts towards the total.
   */
  buy?: number,
  /**
   * Take THIS corporation; default: a calm one (see `CORP_WITH_FIRST_ACTION`).
   *
   * ⚠️ NAME IT whenever the spec depends on a particular corporation.
   * `customCorporationsList` does NOT narrow the deal in `testMode` — it only
   * guarantees the corp is IN it, and testMode deals EIGHT — so a spec whose
   * config says «the only dealable corp is X» is describing an intention, not
   * a fact. The default then quietly picks some other calm corporation and the
   * spec fails much later, on the thing X was there to produce (this cost two
   * specs at once: the first-action modal that never appeared, and the payment
   * panel that found no alternative source without Helion).
   */
  corporation?: string,
  /** Take THESE preludes (a prelude game); default: the first two offered. */
  preludes?: ReadonlyArray<string>,
  /** Play THIS card first when the pregame offers a choice of preludes. */
  first?: string,
  /** A solo colony removal must not eat this colony. */
  keepColony?: string,
  /** Where the seeding stops (see {@link BootStop}). */
  until?: BootStop,
};

/**
 * Pick the cards for one `SelectInitialCards` sub-prompt.
 *
 * The sub-prompts are discriminated by their SHARED TITLE CONSTANTS, not by
 * their position: the order is corp → prelude? → CEO? → projects
 * (`SelectInitialCards.ts`), so an index would silently mean something else the
 * moment an expansion is toggled — the exact class of bug this driver exists to
 * end. The client discriminates them the same way.
 */
function pickInitialCards(step: WirePrompt, plan: SeedPlan): Array<string> {
  const offered = (step.cards ?? []).map((c) => c.name);
  const title = promptTitle(step);
  const take = (wanted: ReadonlyArray<string>, count: number): Array<string> => {
    const hit = wanted.filter((c) => offered.includes(c));
    const rest = offered.filter((c) => !hit.includes(c));
    return [...hit, ...rest].slice(0, count);
  };
  if (title === SELECT_CORPORATION_TITLE) {
    if (plan.corporation !== undefined) {
      expect(offered, `the deal must offer the corporation ${plan.corporation}`).toContain(plan.corporation);
      return [plan.corporation];
    }
    // A CALM corporation for the same reason the wizard picks one: a mandatory
    // first action stands between the boot and the spec's own first press.
    const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
    return [calm ?? offered[0]];
  }
  if (title === SELECT_PRELUDE_TITLE) {
    // DEDUPED: `first` (which prelude to PLAY first) and `preludes` (which to
    // TAKE) legitimately name the same card, and picking it twice is a
    // response the server accepts — the player then holds two copies of one
    // prelude and the probe blames the product for it.
    const wanted = [...new Set([...(plan.first === undefined ? [] : [plan.first]), ...(plan.preludes ?? [])])];
    return take(wanted, step.min ?? 2);
  }
  if (title === SELECT_CEO_TITLE) {
    return offered.slice(0, step.min ?? 1);
  }
  if (title === SELECT_PROJECTS_TITLE) {
    const wanted = plan.cards ?? [];
    for (const card of wanted) {
      expect(offered, `${card} must be in the initial deal (offered: ${offered.join(', ')})`).toContain(card);
    }
    return take(wanted, Math.max(plan.buy ?? 0, wanted.length));
  }
  // A sub-prompt this driver has not met: satisfy its own minimum and say so
  // in the failure if that turns out to be wrong.
  return offered.slice(0, step.min ?? 0);
}

/**
 * Build the `InputResponse` for whatever the pregame is asking.
 *
 * Recursive, because `or` / `and` nest. Everything it answers is a prompt the
 * REAL client answers with the same shape — this is a keyboard replaced by a
 * request, never a rule replaced by a shortcut.
 */
function answerPrompt(prompt: WirePrompt, plan: SeedPlan): WireResponse {
  switch (prompt.type) {
  case 'initialCards':
    return {
      type: 'initialCards',
      responses: (prompt.options ?? []).map((step) => ({type: 'card', cards: pickInitialCards(step, plan)})),
    };
  case 'card': {
    const offered = (prompt.cards ?? []).map((c) => c.name);
    // A prelude choice is the one place a spec cares WHICH card the pregame
    // plays (`first`) — everything else takes the prompt's own minimum.
    const wanted = plan.first !== undefined && offered.includes(plan.first) ? [plan.first] : [];
    const rest = offered.filter((c) => !wanted.includes(c));
    return {type: 'card', cards: [...wanted, ...rest].slice(0, Math.max(prompt.min ?? 1, 0))};
  }
  case 'option':
    return {type: 'option'};
  case 'or': {
    // BRANCH 0, ALWAYS — and that is a contract, not a coin toss: the only
    // `or`s on the road to the action menu are the corporation's first action
    // (branch 0 = «take it», the PASS is appended LAST — `Player.ts:2126`) and
    // the odd effect choice a prelude fires. A pass option is never first, so
    // this can never end the generation behind the spec's back.
    const branch = (prompt.options ?? [])[0];
    expect(branch, `an «or» with no options: ${describePrompt(prompt)}`).toBeDefined();
    return {type: 'or', index: 0, response: answerPrompt(branch, plan)};
  }
  case 'and':
    return {type: 'and', responses: (prompt.options ?? []).map((o) => answerPrompt(o, plan))};
  case 'space': {
    const spaces = prompt.spaces ?? [];
    expect(spaces.length, `a placement with no legal space: ${describePrompt(prompt)}`).toBeGreaterThan(0);
    return {type: 'space', spaceId: spaces[0]};
  }
  case 'projectCard': {
    // A FORCED play, never a voluntary one — and that distinction is what makes
    // answering it legitimate rather than «playing a card behind the spec's
    // back» (the mistake `submitSummary` made earlier today, when a stray press
    // played a prelude nobody asked for).
    //
    // The loop RETURNS at the action menu, so a bare `projectCard` prompt can
    // only be an effect that DEMANDS a play — a prelude's «play a card from
    // your hand» (Eccentric Sponsor / Ecology Experts, which is why this fires
    // exactly on the configs with `prelude: true`). The game does not proceed
    // until it is answered, so declining is not on offer; the only choice is
    // WHICH card, and the cheapest keeps the most resources for the spec's own
    // subject.
    const affordable = [...(prompt.cards ?? [])]
      .sort((a, b) => (a.calculatedCost ?? 0) - (b.calculatedCost ?? 0));
    const card = affordable[0];
    expect(card, `a forced play with no playable card: ${describePrompt(prompt)}`).toBeDefined();
    return {
      type: 'projectCard',
      card: card.name,
      payment: {...NO_PAYMENT, megacredits: card.calculatedCost ?? 0},
    };
  }
  case 'payment':
    return {type: 'payment', payment: {...NO_PAYMENT, megacredits: prompt.amount ?? 0}};
  case 'amount':
    return {type: 'amount', amount: (prompt.maxByDefault === true ? prompt.max : prompt.min) ?? 0};
  case 'colony': {
    const colonies = (prompt.coloniesModel ?? []).map((c) => c.name);
    // The solo setup REMOVES a colony — never the one a spec came to look at.
    const pick = colonies.find((c) => c !== plan.keepColony) ?? colonies[0];
    expect(pick, `a colony prompt with no colonies: ${describePrompt(prompt)}`).toBeDefined();
    return {type: 'colony', colonyName: pick};
  }
  case 'player':
    return {type: 'player', player: (prompt.players ?? [])[0]};
  case 'resource':
    return {type: 'resource', resource: (prompt.include ?? ['megacredits'])[0]};
  case 'resources':
    return {type: 'resources', units: {megacredits: prompt.count ?? 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0}};
  case 'productionToLose':
    return {type: 'productionToLose', units: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0}};
  default:
    // NAME what it could not answer. A seeder that silently guesses is worse
    // than one that stops: the spec would fail somewhere else entirely.
    expect(false, `the API seeder has no answer for ${describePrompt(prompt)} — ` +
      'either teach it here or put this spec on {via: \'ui\'}').toBeTruthy();
    return {type: 'option'};
  }
}

/**
 * Drive the pregame OVER THE API until the player stands on the ACTION MENU.
 *
 * One round = one prompt answered = one request. A whole solo pregame is 2–7
 * of them (corp → [pay] → [preludes + their effects] → [corp first action]),
 * i.e. under a second — against minutes of keyboard for the same state.
 *
 * `until: 'startRelease'` stops one prompt EARLIER, with the corporation's
 * mandatory first action still live, for a spec whose subject IS that prompt —
 * the same meaning the stop has on the UI path.
 */
export async function seedGameOverApi(
  request: APIRequestContext,
  playerId: string,
  plan: SeedPlan = {},
  maxRounds = 40,
): Promise<void> {
  let model = await fetchPlayerModel(request, playerId);
  let last: WirePrompt | undefined;
  for (let round = 0; round < maxRounds; round++) {
    // NOTHING TO ANSWER is a WAIT, never a round. A solo human answers
    // synchronously, so an empty `waitingFor` means the table is busy with
    // someone else — a MarsBot taking its turn, or another seat in a
    // multiplayer seed. Spending answer-rounds on that would let a slow bot
    // exhaust the budget and report «stuck» about a game that was merely
    // thinking; the budget must bound the CONVERSATION, not the machine.
    for (let waited = 0; model.waitingFor === undefined && waited < 60; waited++) {
      await new Promise((r) => setTimeout(r, 500));
      model = await fetchPlayerModel(request, playerId);
    }
    const prompt = model.waitingFor;
    expect(prompt, `the table never came back to this player (phase ${model.game?.phase})`).toBeDefined();
    if (prompt === undefined) {
      return;
    }
    last = prompt;
    if (isActionMenuTitle(promptTitle(prompt))) {
      return;
    }
    if (plan.until === 'startRelease' && prompt.startGamePrompt?.kind === 'corporationInitialAction') {
      return;
    }
    model = await sendPlayerInput(request, playerId, answerPrompt(prompt, plan));
  }
  expect(false, `the API seed never reached the action menu in ${maxRounds} rounds — ` +
    `stuck on ${describePrompt(last)} (phase ${model.game?.phase})`).toBeTruthy();
}

/**
 * Open the console-native shell on a player id and wait for its FIRST USABLE PAINT.
 * The budget is a LOAD allowance (a 4K viewport inside a full parallel run
 * genuinely takes tens of seconds to paint), never a behaviour assertion —
 * every behavioural wait after this point is structural.
 */
export async function openConsole(page: Page, playerId: string, query = ''): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1${query}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 90_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  // The session-wide GPU warm-up paints the real console underneath its veil,
  // so `.con-root` (and even the live hand dock) can exist while the first key
  // still races the warm-up's top-layer surface. The veil's unmount is the
  // structural boundary between "painted" and "ready for the spec to drive".
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
}

/**
 * Corporations a probe whose subject is NOT the corporation must avoid.
 *
 * Two different reasons, one effect — something stands between the boot and
 * the spec's own first press: a MANDATORY first action opens its own composer
 * and gates the turn behind a confirm; Helion's heat-as-M€ turns even a 1 M€
 * action into a full payment prompt.
 */
export const CORP_WITH_FIRST_ACTION: ReadonlyArray<string> = [
  'Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion',
  // Colonies: the first action asks «Select colony tile to add» — a prompt
  // the generic API driver has no answer for.
  'Aridor'];

/**
 * Pick a corporation that lets the game start CLEAN (see
 * `CORP_WITH_FIRST_ACTION`). Falls back to «any corporation» when the deal
 * offers nothing else — a started game beats a skipped test, and the spec's
 * own retries absorb the extra prompt.
 */
export async function pickCalmCorporation(page: Page): Promise<string> {
  const offered = await offeredCards(page);
  const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
  if (calm === undefined) {
    await fillPicks(page, 1);
    return (await pickedCards(page))[0] ?? '';
  }
  await pickCards(page, [calm], ringWalk(offered.length, 1));
  return calm;
}

/**
 * A move budget that WALKS THE WHOLE RING with room to spare.
 *
 * `pickCards`' default of 20 is exactly the size of the test-mode projects
 * deal, and the subject card is as likely to be the LAST slot as the first —
 * so the default could only reach it if every single press landed. It didn't
 * (4K, tv profile): «Search For Life must be bought (offered: … Search For
 * Life)» — the deal HAD it, the walk merely ran out of steps one slot short.
 * The budget must therefore be the ring size plus the picks plus slack, never
 * a constant that happens to match one deal size.
 */
function ringWalk(offered: number, picks: number): number {
  return offered + picks + 6;
}

/**
 * The `onStep` hook for «a calm corporation, and buy exactly these projects».
 * The overwhelmingly common shape: the spec's subject is a card it needs IN
 * HAND, and everything else about the wizard is noise.
 *
 * The empty-offer early return is not defensive noise: `kind` comes from the
 * breadcrumb, and the DEPLOYMENT keeps saying «Проекты» after the last step
 * pane is gone (see {@link deploymentActive}). Asserting there would blame the
 * deal for a card the wizard has already bought — the loudest possible lie a
 * setup helper can tell. The walk's own early return catches this a round
 * earlier; this closes the frame-sized race between the two checks.
 */
export function buyProjects(cards: ReadonlyArray<string>): NonNullable<WalkOptions['onStep']> {
  return async (page: Page, kind: StepKind) => {
    if (kind === 'corporation') {
      await pickCalmCorporation(page);
    } else if (kind === 'project') {
      const offered = await offeredCards(page);
      if (offered.length === 0) {
        return;
      }
      const picked = await pickCards(page, cards, ringWalk(offered.length, cards.length));
      for (const card of cards) {
        expect(picked, `${card} must be bought (offered: ${offered.join(', ')})`).toContain(card);
      }
    }
  };
}

/**
 * The start workspace has RELEASED the screen: the pregame is over and the
 * board home owns the input.
 *
 * VISIBILITY, never a node count — `startSceneGone` carries the whole argument
 * (`ConsoleShell.vue:2395`, `ConsoleStartScene.vue:26`): the scene stays
 * MOUNTED for the rest of the game, so «is the wizard done» has no answer in
 * the DOM tree, only in what is painted.
 *
 * It DRIVES while it waits, with the deployment's own primitives: a start that
 * is still standing is still owed something (a card, the purchase item, a
 * reveal), and a blind Enter would be swallowed by the commit guard and burn
 * the budget describing the wrong screen.
 */
export async function waitForStartRelease(page: Page, maxMs = 60_000): Promise<void> {
  const started = Date.now();
  const firstActionStage = page.locator('.con-start__firstact');
  while (Date.now() - started < maxMs && !await startSceneGone(page)) {
    // The corporation's mandatory FIRST ACTION is the workspace's own final
    // conditional stage now — a corp that owes one HOLDS the workspace (that
    // is the point), so the stage STANDING is this stop's arrival, exactly
    // like the prompt being live is on the API path.
    if (await firstActionStage.count() > 0) {
      return;
    }
    await playStartQueue(page, {plays: 2});
    await page.waitForTimeout(400);
  }
  expect(await startSceneGone(page) || await firstActionStage.count() > 0,
    `the start workspace never released — still showing ${JSON.stringify(await visibleSurfaces(page))}`)
    .toBeTruthy();
}

/** How far the pregame drives before it hands the page over to the spec. */
export type BootStop =
  /**
   * …until the BOARD HOME is live: the hand dock takes presses and nothing is
   * holding the screen. The default — «just give me a live game».
   */
  'boardHome' |
  /**
   * …only until the start workspace would RELEASE. For a spec whose subject is
   * the very first thing the game asks — the corporation's mandatory first
   * action. A corp that owes one now HOLDS the workspace on its own «ПЕРВОЕ
   * ДЕЙСТВИЕ» stage (the flow's final conditional stage), so this stop arrives
   * either at the released scene (no first action) or at that standing stage.
   * Driving on to the board home would ANSWER the prompt by design, and the
   * spec would then hunt for a stage its own setup had already resolved.
   */
  'startRelease';

/**
 * HOW the spec gets its game.
 *
 *  · `'api'` (DEFAULT) — the pregame is ANSWERED over `player/input` and the
 *    console then opens on an already-playable board. Same endpoint, same
 *    responses and same rules as the real client; seconds instead of minutes,
 *    and none of the boot's load-sensitivity.
 *  · `'ui'` — the wizard is WALKED with the keyboard, exactly as before. The
 *    ONLY correct mode for a spec whose SUBJECT is the pregame itself: the
 *    start scene, the deal cinematic, the summary, the deployment queue, the
 *    delivery/arrival beat. If a spec asserts anything about those, it belongs
 *    here — the API path never produces them, because the game is already
 *    running before the first paint.
 */
export type BootVia = 'api' | 'ui';

export type BootOptions = {
  /** The game to create (`soloGameConfig(...)`); default: the plain solo one. */
  config?: Record<string, unknown>,
  /** English `CardName`s the deal must offer AND the pregame must buy. */
  cards?: ReadonlyArray<string>,
  /** Extra query on the player URL (`&consoleProfile=tv`, …). */
  query?: string,
  /** Deal search: first seed + the step between attempts. */
  seed?: number,
  step?: number,
  /**
   * Override the per-step WIZARD hook (a prelude game picks its own preludes).
   * A hook is a KEY SCRIPT by definition, so passing one implies `via: 'ui'`
   * unless the spec says otherwise — the API path expresses the same intent
   * with `corporation` / `preludes` / `cards`.
   */
  onStep?: WalkOptions['onStep'],
  /** Play this card FIRST (the pregame's prelude choice / deployment queue). */
  first?: string,
  /** A solo colony pick must not eat this colony. */
  keepColony?: string,
  /** Where the road ends (see {@link BootStop}). */
  until?: BootStop,
  /** How the game is obtained (see {@link BootVia}); default `'api'`. */
  via?: BootVia,
  /** API path: take THIS corporation instead of any calm one. */
  corporation?: string,
  /** API path: take THESE preludes (a prelude game). */
  preludes?: ReadonlyArray<string>,
  /** API path: buy this many projects in total (see {@link SeedPlan.buy}). */
  buy?: number,
};

/**
 * THE PREGAME IN ONE CALL — create the game, get it to the point where the
 * spec's own story begins, and open the console there.
 *
 * This is the "intermediate path" every console probe used to hand-roll: a
 * `goto` + a first-paint budget, then a key script that alternated A / RT and
 * decided the wizard was over by COUNTING `.con-start__frame` nodes. That last
 * predicate is the one the app explicitly invalidated (MOUNTED != VISIBLE —
 * `ConsoleShell.vue:2395`), and thirteen specs failed together on it while the
 * game underneath had booted perfectly. There is now ONE road, and the next
 * start-flow rework is adapted here instead of in thirteen files.
 *
 * By DEFAULT that road is the API one (see {@link BootVia}): the walk is SETUP,
 * never the subject, and simulating a keyboard for minutes to reach a state the
 * server hands out in one request bought nothing but false failures. A spec
 * whose subject IS the pregame passes `via: 'ui'` and gets the walk unchanged.
 *
 * Returns the player id — a spec that then talks to the API (or writes a
 * per-participant localStorage pref) needs it.
 */
export async function bootIntoGame(
  page: Page,
  request: APIRequestContext,
  opts: BootOptions = {},
): Promise<string> {
  const cards = opts.cards ?? [];
  // No required cards → `every` over an empty list is true, so this creates
  // exactly one game and returns it. Same road either way.
  const playerId = await createGameWithCards(request, cards,
    {config: opts.config, seed: opts.seed, step: opts.step});
  const via = opts.via ?? (opts.onStep === undefined ? 'api' : 'ui');
  if (via === 'api') {
    await bootSeededGame(page, request, playerId, {
      cards,
      buy: opts.buy,
      corporation: opts.corporation,
      preludes: opts.preludes,
      first: opts.first,
      keepColony: opts.keepColony,
      until: opts.until,
      query: opts.query,
    });
    return playerId;
  }
  await openConsole(page, playerId, opts.query ?? '');
  await walkToSummary(page, {onStep: opts.onStep ?? buyProjects(cards)});
  await submitSummary(page);
  await playStartQueue(page, {first: opts.first});
  if (opts.until === 'startRelease') {
    await waitForStartRelease(page);
    return playerId;
  }
  await waitForBoardHome(page, 70, {keepColony: opts.keepColony});
  return playerId;
}

/**
 * THE API SEED FOR A GAME THE SPEC ALREADY CREATED — answer the pregame, open
 * the console on the running board, and stop where the spec's story begins.
 *
 * The half of {@link bootIntoGame} that comes AFTER the game exists, exposed on
 * its own because a dozen probes create their own game for a reason the driver
 * cannot express (a custom config, several players, picking the player id by
 * NAME). They used to follow it with a hand-rolled key script — a rotation of
 * blind presses guarded by RU screen text — which is the single thing this file
 * exists to delete. Those three lines are now this one call.
 */
export async function bootSeededGame(
  page: Page,
  request: APIRequestContext,
  playerId: string,
  opts: SeedPlan & {query?: string} = {},
): Promise<void> {
  await seedGameOverApi(request, playerId, opts);
  await openConsole(page, playerId, opts.query ?? '');
  if (opts.until === 'startRelease') {
    // The start workspace never mounts on this path (its own prompts are
    // already answered), so there is no release to wait for — what stands is
    // the corporation's first action, which is the spec's own subject.
    return;
  }
  // Still the SHARED verdict, never a bare timeout: the board home is «the dock
  // takes presses and nothing is holding the screen», and a game seeded into
  // the action phase can still open on something (a deferred prompt, a colony
  // follow-up). Fewer rounds than the walk because there is no wizard to finish.
  await waitForBoardHome(page, 25, {keepColony: opts.keepColony});
}

/**
 * The «I need these cards in hand» spelling of {@link bootIntoGame} — the
 * overwhelmingly common case, so it reads as one sentence at the call site.
 */
export async function bootWithCards(
  page: Page,
  request: APIRequestContext,
  opts: BootOptions & {cards: ReadonlyArray<string>},
): Promise<string> {
  return bootIntoGame(page, request, opts);
}

/**
 * The VIEWER's own turn is live and the action menu takes presses.
 *
 * STRUCTURAL, never the chip's text: the `1/2` action counter is rendered for
 * exactly one status label — `turn` (`playerStatusPresenter.ts`: `showCounter`
 * is true there and nowhere else) — and `--me` / `--active` are the strip's own
 * modifiers (`ConsoleStatusStrip.vue:333`). The specs used to match the RU word
 * «ДЕЙСТВИЕ» inside `.con-status`, which is the anti-pattern this file exists
 * to remove: the label is a translation of the English key `Action`, so a copy
 * tweak in one locale file silently turns "the game is live" into a timeout.
 */
export function turnChip(page: Page): Locator {
  return page.locator('.con-status__player--me.con-status__player--active .con-status__pstatus-counter');
}

/** Wait until the viewer's turn is live (see {@link turnChip}). */
export async function waitForTurn(page: Page, timeout = 20_000): Promise<void> {
  await expect(turnChip(page)).toHaveCount(1, {timeout});
}

/**
 * How many cards the viewer HOLDS — read off the hand DOCK's own total.
 *
 * The dock is the one place that answers this on EVERY screen: «once the dock
 * appears after setup it stays to the END of the game» (`.claude/rules/
 * console-ui.md` § HAND DOCK presence), so unlike the hand screen it cannot be
 * absent just because something else is open. Returns -1 when the dock has not
 * been built yet (pregame).
 */
export async function handCount(page: Page): Promise<number> {
  // The DOCK ROOT's own `data-hand-total` — the one carrier of this number in
  // EVERY dock mode. The visible «КАРТЫ n/m» counter is swapped for the album
  // SPINE while the hand album owns the cards, and the spine states PAGES, not
  // cards; keying on whichever of those happens to be painted broke the
  // discard specs twice (an unbounded read against the unmounted counter, then
  // a spine range a later rework dropped). Returns -1 before the dock is built.
  const raw = await page.locator('.con-handdock').first()
    .getAttribute('data-hand-total').catch(() => null);
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) ? -1 : n;
}

/**
 * Play `card` OUT OF THE HAND through the ordinary console path: RT wheel →
 * centre slot («КАРТЫ») → focus the card → A opens the play composer → A
 * confirms.
 *
 * Retried AS A WHOLE, because the honest exit condition is «the card left the
 * hand»: on a heavy frame any single press can be swallowed mid-flight (by
 * design — the commit guard), and the run then reaches the spec's subject with
 * the card still in hand and fails somewhere far away from the real cause
 * («Нет действий карт»). Between attempts it backs out of whatever stayed open
 * instead of pressing harder.
 *
 * ⚠️ THE VERDICT IS NOT `.con-hand [data-zoom-slot=<card>]` IS GONE. That node
 * is equally absent when the card was played and when the hand SCREEN simply
 * closed — a swallowed confirm therefore read as a successful play, and the run
 * walked on to the Action Browser, met «Нет действий карт» and blamed the
 * workspace for a card still sitting in hand. So: while the hand screen is up,
 * ask IT (card-exact); otherwise ask the DOCK's total, which is live on every
 * screen. Both are structural; neither can be true for the wrong reason.
 */
export async function playCardFromHand(page: Page, card: string, attempts = 3): Promise<boolean> {
  const inHand = page.locator(`.con-hand [data-zoom-slot="${card}"]`);
  const handScreen = page.locator('.con-hand');
  const held = await handCount(page);
  const played = async (): Promise<boolean> => await handScreen.count() > 0 ?
    await inHand.count() === 0 :
    await handCount(page) < held;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1600); // centre slot → the hand screen
    await inHand.waitFor({timeout: 12_000}).catch(() => {});
    // THE BUDGET IS THE RING, never a constant. A fixed 14 is smaller than the
    // hand on a wide deal, and the subject is as likely to be the LAST slot as
    // the first — the `deck` profile failed exactly here («Search For Life must
    // have been played») while fhd/tv4k passed, because the walk ran out of
    // steps rather than because anything was wrong. Same lesson `ringWalk`
    // already carries for `pickCards`.
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    const landed = await focusCard(page, card, ringWalk(Math.max(slots, 1), 1));
    if (!landed) {
      // NEVER press A on the wrong card. Enter here plays whatever the cursor
      // happens to sit on, which spends the turn on an unrelated card and makes
      // the spec fail somewhere else entirely, several assertions later.
      for (let i = 0; i < 3 && await page.locator('.con-hand, .con-play, .con-composer--play').count() > 0; i++) {
        await press(page, 'Escape', 700);
      }
      continue;
    }
    // The card is rendered before the dock-to-hand reveal releases input.
    // On a loaded 4K frame the fixed settle above can expire while A is still
    // deliberately gated, so wait for the hand's own structural ready signal.
    await page.locator('.con-hand:not(.con-hand--transit)')
      .waitFor({state: 'visible', timeout: 15_000});
    await press(page, 'Enter', 900); // open the play composer
    for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }
    await page.waitForTimeout(4200); // the played-hero scene settles, the card lands
    if (await played()) {
      return true;
    }
    for (let i = 0; i < 3 && await page.locator('.con-hand, .con-play, .con-composer--play').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
  }
  return played();
}

/**
 * Open the CARD ACTIONS workspace: RT wheel → ↑ slot. Verified entry with the
 * same retry discipline as every other press here (a press landing on a busy
 * 4K frame is deliberately consumed), and it closes a hand/play screen that
 * swallowed the wheel instead of pressing into it.
 */
/**
 * Open the RT QUICK WHEEL, verified.
 *
 * A single blind `Period` is not enough and never was: a press landing on a
 * busy frame is deliberately consumed, and at 4K that is the common case, not
 * the rare one — `console-surface-motion · tv4k` failed on exactly this
 * («locator('.con-quick') … Received: 0») while fhd passed. Same retry
 * discipline as {@link openCardActions}, including clearing a hand/play screen
 * that swallowed the press instead of yielding to it.
 */
/**
 * Open / close the FULLSCREEN card viewer with a verified press.
 *
 * `KeyX` (inspect) and `Escape` (close) are absorbed on a busy frame exactly
 * like every other console press, and the specs' local «3 blind tries then wait
 * 8s passively» could only ever time out once the tries ran out — the passive
 * half has nothing left to wait for. `console-blue-action-purchase · tv4k`
 * failed there while fhd and deck passed, which is the machine speaking, not
 * the product. Nudge while waiting, and give the caller ONE place to fix when
 * the viewer's entry changes again.
 */
export async function openZoomViewer(page: Page, key = 'KeyX', maxMs = 20_000): Promise<void> {
  const zoom = page.locator('dialog.con-zoom[open]');
  const started = Date.now();
  while (Date.now() - started < maxMs && await zoom.count() === 0) {
    await press(page, key, 1200);
  }
  await expect(zoom).toHaveCount(1, {timeout: 8_000});
}

export async function closeZoomViewer(page: Page, maxMs = 15_000): Promise<void> {
  const zoom = page.locator('dialog.con-zoom[open]');
  const started = Date.now();
  while (Date.now() - started < maxMs && await zoom.count() > 0) {
    await press(page, 'Escape', 1200);
  }
  await expect(zoom).toHaveCount(0, {timeout: 8_000});
}

export async function openQuickWheel(page: Page, tries = 8): Promise<void> {
  const wheel = page.locator('.con-quick');
  for (let i = 0; i < tries && await wheel.count() === 0; i++) {
    if (i > 0 && await page.locator('.con-hand, .con-play').count() > 0) {
      await press(page, 'Escape', 600);
    }
    await press(page, 'Period', 700);
  }
  await expect(wheel).toHaveCount(1, {timeout: 10_000});
}

export async function openCardActions(page: Page, tries = 10): Promise<void> {
  const workspace = page.locator('.con-cardactions');
  for (let i = 0; i < tries && await workspace.count() === 0; i++) {
    if (i > 0 && await page.locator('.con-hand, .con-play').count() > 0) {
      await press(page, 'Escape', 600);
    }
    await press(page, 'Period', 800);
    await press(page, 'ArrowUp', 1400);
  }
  await expect(workspace).toHaveCount(1, {timeout: 10_000});
}

/**
 * DESCEND into ACTION FOCUS: A on the focused action row recomposes the
 * browser's OWN frame into the stage (`.con-cardactions__stagewrap`).
 *
 * The retry is gated on the stage's ABSENCE, which is what makes it safe: a
 * press that lands while the browse layer is still settling is consumed by
 * design (the same commit guard `openCardActions` answers), while a second
 * press on an ALREADY OPEN stage would CONFIRM the action — so this presses
 * only while there is no stage, and never twice on one.
 *
 * The assertion stays: «A recomposes into the focus stage» is still proved,
 * just not «exactly one keystroke does it», which was never the contract and
 * is exactly the kind of claim a busy 4K frame falsifies at random.
 */
export async function openActionFocus(page: Page, tries = 4): Promise<void> {
  const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
  for (let i = 0; i < tries && await stage.count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(stage, 'A must recompose the browser into the ACTION FOCUS stage')
    .toHaveCount(1, {timeout: 8000});
}
