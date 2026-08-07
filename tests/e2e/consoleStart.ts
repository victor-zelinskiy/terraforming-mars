import {APIRequestContext, Locator, Page, expect} from '@playwright/test';

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
 * The primitives here are deliberately structural — they read the same
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

/** The focused card's RENDERED name (the pinned status rail). Localised —
 *  use `focusedCard` when you mean a specific card. */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.querySelector('.con-start__status-name')?.textContent ?? '').trim());
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
    if (i % 4 === 3) {
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
  const hit = new Set<string>();
  for (let i = 0; i < maxMoves && hit.size < cards.length; i++) {
    const focused = await focusedCard(page);
    if (cards.includes(focused) && !hit.has(focused)) {
      await press(page, 'Enter', 520);
      hit.add(focused);
    }
    if (hit.size < cards.length) {
      await press(page, 'ArrowRight', 280);
    }
  }
  return [...hit];
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
  expect(await summaryVisible(page) || await page.locator('.con-colonies').count() > 0 ||
    await deploymentActive(page),
  `the wizard reached its summary — still showing ${JSON.stringify(await visibleSurfaces(page))}`).toBeTruthy();
}

/**
 * Submit the summary. A zero-projects buy ARMS an amber warning first and
 * only the second A submits, so this is press-verify-retry: it presses until
 * the surface actually reacts, never a fixed number of blind presses (a
 * press that lands inside the summary's reveal convoy is absorbed by the
 * flow gate BY DESIGN — the double-submit guard).
 */
export async function submitSummary(page: Page): Promise<void> {
  const warn = page.locator('.con-start__skipwarn');
  for (let i = 0; i < 6 && await summaryVisible(page) && !await awaitingOthers(page); i++) {
    await press(page, 'Enter', 900);
    if (await warn.count() > 0) {
      await press(page, 'Enter', 1400); // the confirmation press
    }
  }
  // ACCEPTED means one of TWO honest outcomes: the deployment took the screen
  // (solo / everyone ready), or the summary STAYS in its waiting state
  // because the table is still confirming — the multiplayer hand-over is
  // simultaneous by design, so «the summary disappeared» is not the contract.
  await expect.poll(async () => !(await summaryVisible(page)) || await awaitingOthers(page),
    {timeout: 25_000}).toBeTruthy();
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
  }
  await waitQueueIdle(page);
  return await focusCard(page, target);
}

/**
 * Play the queue card `card` and confirm it actually left — the press that
 * fires a scene must be OWNED by the spec, and a swallowed press (the
 * commit guard) must not read as "the scene never happened". Polls fast
 * (~100 ms) so a spec can still observe the scene from its first frames.
 */
export async function playQueueCard(page: Page, card: string, maxPresses = 4): Promise<boolean> {
  await waitQueueIdle(page);
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
      await page.waitForTimeout(700);
    }
  }
  expect(await live.count(), `board home never became live — still showing ${JSON.stringify(await visibleSurfaces(page))}`)
    .toBeGreaterThan(0);
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

/**
 * Open the console-native shell on a player id and wait for its FIRST PAINT.
 * The budget is a LOAD allowance (a 4K viewport inside a full parallel run
 * genuinely takes tens of seconds to paint), never a behaviour assertion —
 * every behavioural wait after this point is structural.
 */
export async function openConsole(page: Page, playerId: string, query = ''): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1${query}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 90_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
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
  'Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion'];

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
  while (Date.now() - started < maxMs && !await startSceneGone(page)) {
    await playStartQueue(page, {plays: 2});
    await page.waitForTimeout(400);
  }
  expect(await startSceneGone(page),
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
   * …only until the start workspace RELEASES. For a spec whose subject is the
   * very first thing the game asks — the corporation's mandatory first action.
   * Driving on to the board home would ANSWER that prompt by design
   * (`waitForBoardHome` confirms a `--corpfirst` composer to get past it), and
   * the spec would then hunt for a modal its own setup had already dismissed.
   */
  'startRelease';

export type BootOptions = {
  /** The game to create (`soloGameConfig(...)`); default: the plain solo one. */
  config?: Record<string, unknown>,
  /** English `CardName`s the deal must offer AND the wizard must buy. */
  cards?: ReadonlyArray<string>,
  /** Extra query on the player URL (`&consoleProfile=tv`, …). */
  query?: string,
  /** Deal search: first seed + the step between attempts. */
  seed?: number,
  step?: number,
  /** Override the per-step hook (a prelude game picks its own preludes). */
  onStep?: WalkOptions['onStep'],
  /** Deployment: play this card FIRST (the spec owns the scene it fires). */
  first?: string,
  /** A solo colony pick must not eat this colony. */
  keepColony?: string,
  /** Where the road ends (see {@link BootStop}). */
  until?: BootStop,
};

/**
 * THE PREGAME IN ONE CALL — create the game, open the console on it, walk the
 * wizard, deploy, and stop where the spec's own story begins.
 *
 * This is the "intermediate path" every console probe used to hand-roll: a
 * `goto` + a first-paint budget, then a key script that alternated A / RT and
 * decided the wizard was over by COUNTING `.con-start__frame` nodes. That last
 * predicate is the one the app explicitly invalidated (MOUNTED != VISIBLE —
 * `ConsoleShell.vue:2395`), and thirteen specs failed together on it while the
 * game underneath had booted perfectly. There is now ONE road, and the next
 * start-flow rework is adapted here instead of in thirteen files.
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
  const text = await page.locator('.con-handdock__num--total').first().innerText().catch(() => '');
  const n = Number.parseInt(text.trim(), 10);
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
    for (let step = 0; step < 14 && await focusedCard(page) !== card; step++) {
      await press(page, 'ArrowRight', 260);
    }
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
