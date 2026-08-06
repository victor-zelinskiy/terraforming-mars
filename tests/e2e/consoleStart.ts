import {Page, expect} from '@playwright/test';

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
      '.con-cards__slot--focused[data-zoom-slot], .con-start__qcard--focused[data-queue-slot]');
    return el?.getAttribute('data-zoom-slot') ?? el?.getAttribute('data-queue-slot') ?? '';
  });
}

/** The summary pane is SHOWN (parked `v-show` — visibility, never count). */
export async function summaryVisible(page: Page): Promise<boolean> {
  return page.locator('.con-start > .con-start__frame .con-start__summary').isVisible().catch(() => false);
}

/** The start workspace is gone — the board home owns the screen. */
export async function startSceneGone(page: Page): Promise<boolean> {
  return (await page.locator('.con-start').count()) === 0;
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
  expect(await summaryVisible(page), 'the wizard reached its summary').toBeTruthy();
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
export async function waitForBoardHome(page: Page, maxRounds = 70): Promise<void> {
  const live = page.locator('.con-handdock--live');
  const start = page.locator('.con-start');
  const composer = page.locator('.con-composer');
  const reveal = page.locator('.con-reveal');
  const hand = page.locator('.con-hand');
  const mandatory = page.locator('.con-mandatory');
  const placement = page.locator('.con-context__task-kicker');
  for (let i = 0; i < maxRounds; i++) {
    if (await live.count() > 0 && await placement.count() === 0 && await hand.count() === 0 &&
        await start.count() === 0 && await composer.count() === 0) {
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
      // play-from-hand prelude — Eccentric Sponsor / Ecology Experts): play
      // the focused playable card through the ordinary flow (pick → the
      // composer's commit — both are A). B here would fight a task that must
      // resolve. A STANDALONE hand screen is simply not the home — close it.
      await press(page, await start.count() > 0 ? 'Enter' : 'Escape', 1400);
    } else if (await mandatory.count() > 0) {
      // A held / DEFERRED decision (incl. a minimized start workspace) —
      // A brings it back; leaving it parked keeps the dock non-interactive.
      await press(page, 'Enter', 1200);
    } else if (await start.count() > 0) {
      // The start workspace is still up: finish it with the SAME primitives
      // the boot uses (never a blind Enter — a swallowed press would just
      // burn the budget and the failure would name the wrong thing).
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
export async function bootToBoard(page: Page, opts: WalkOptions & {first?: string} = {}): Promise<void> {
  await walkToSummary(page, opts);
  await submitSummary(page);
  await playStartQueue(page, {first: opts.first});
  await waitForBoardHome(page);
}
