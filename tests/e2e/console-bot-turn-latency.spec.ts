import {test, expect, Page} from '@playwright/test';
import {bootWithCards, focusCard, playCardFromHand, press, soloGameConfig, turnChip, waitForTurn} from './consoleStart';

/**
 * MARSBOT TURN LATENCY — the client's own numbers for «сколько бот думает».
 *
 * THE REPORT: on a LOCAL server MarsBot's turn regularly took ~5 seconds. The
 * server was measured resolving a turn in under a millisecond, so the wait was
 * entirely in the client's presentation pipeline: EVERY response carrying a
 * fresh turn opened a STAGING window, which buffers the authoritative view —
 * the player's own next prompt with it — until that turn's compact card has
 * been DELIVERED. Delivery waits behind the notification feed's silencing gates,
 * and the player's own action cinematic is running at exactly that moment.
 *
 * WHY AN E2E (the repo default is a unit spec): the unit specs pin the SEAM
 * (`marsBotPresentation` / `marsBotStagedCommits`) with hand-built views. What
 * only a live run can settle is that the real wiring — a real bot answering a
 * real press inside a real console, through `WaitingFor`'s submit path and
 * `App`'s poll path — produces the same verdict.
 *
 * ⚠️ THE PRESSES ARE THE POINT, not a slower way to drive the game. A spec that
 * answers over the API cannot measure this at all: the client deliberately
 * skips its refresh while it still holds a prompt of its own
 * (`WaitingFor.waitForUpdate` → `viewerHasPrompt`), so a browser whose prompt
 * was answered behind its back simply freezes and observes nothing.
 *
 * The measurement is the CLIENT's own diagnostic (`__botTurnDiag`,
 * `marsBotTurnTiming.ts`), not a stopwatch around a screenshot: it timestamps
 * the response arriving and the view committing INSIDE the page, so the number
 * carries no harness, network or paint noise.
 */

/** No requirement, cheap, one production step each — neither raises a prompt. */
const CHEAP_CARD = 'Power Plant';
const CARD_A = CHEAP_CARD;
const CARD_B = 'Acquired Company';

/* `customProjectCards` (the existing dev seam) puts both on top of the deck, so
 * the seed does not have to keep re-rolling deals to find them. */
const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal'},
  customProjectCards: [CARD_A, CARD_B],
});

/** Commit lag past which the player perceives «бот думает». */
const COMMIT_BUDGET_MS = 1_500;

/** Wall clock from «I handed my turn over» to «my turn is live again». */
const HANDOVER_BUDGET_MS = 4_000;

/**
 * …and when the hand-over is a CARD PLAY: the window legitimately contains the
 * play cinematic (~2.5–3 s solo; longer on a loaded box — in the serial e2e
 * run the same scenario measures ~6.7 s purely from harness load) plus the
 * bot's server pacing. The defect this bounds was measured at **21.4 s** (the
 * dropped poll + the consumed WS wake + the 20 s stretched fallback), so the
 * ceiling sits far above honest-cinematic noise and far below the bug. The
 * SHARP instrument is the per-turn `commit` assertion beside it.
 */
const PLAY_HANDOVER_BUDGET_MS = 12_000;

/**
 * …and for a whole RUN of bot turns watched from inside a workspace.
 *
 * DELIBERATELY GENEROUS: this half of the wait is the bot genuinely PLAYING —
 * five paced turns, production, the generation change — and that is not a
 * defect to be budgeted away. What the ceiling exists to catch is the HOLD the
 * report was about, measured at 92 s before the fix. The per-turn `commit`
 * assertions below are the sharp instrument.
 */
const RUN_BUDGET_MS = 20_000;

type TurnDiag = {key: string, marks: Record<string, number>, notes: Record<string, string>};

/** The client's own per-turn stage breakdown. */
async function diag(page: Page): Promise<Array<TurnDiag>> {
  return await page.evaluate(() => {
    const probe = (window as unknown as {__botTurnDiag?: () => Array<unknown>}).__botTurnDiag;
    return (probe?.() ?? []) as Array<TurnDiag>;
  });
}

/**
 * Keep the page PAINTING while we wait. Headless Chromium drives rAF off the
 * compositor and starves it on a static frame; a tiny screenshot is a
 * BeginFrame, so toast lifetimes and transitions keep running as they do on a
 * real screen.
 */
async function settle(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(100);
  }
}

/**
 * The LT wheel's own slots (`consoleQuickModel`): centre = Standard Projects,
 * up = «Пропустить ход», down = «Пас». Opened with a press, confirmed with A.
 */
async function wheelPick(page: Page, slot: 'up' | 'down'): Promise<void> {
  await press(page, 'Comma', 900); // LT → the basic-actions wheel
  await press(page, slot === 'up' ? 'ArrowUp' : 'ArrowDown', 500);
  await press(page, 'Enter', 1200);
}

/** Wait until at least `n` bot turns have been observed by the client. */
async function awaitTurns(page: Page, n: number, maxMs = 60_000): Promise<Array<TurnDiag>> {
  const deadline = Date.now() + maxMs;
  let turns = await diag(page);
  while (turns.length < n && Date.now() < deadline) {
    await settle(page, 500);
    turns = await diag(page);
  }
  return turns;
}

test.describe('MarsBot turn latency', () => {
  test('a lone turn commits on the spot; a RUN of turns still sequences', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CHEAP_CARD], config: CONFIG});
    await waitForTurn(page);
    await settle(page, 2_000);

    // ── SCENARIO 1 · ONE action, then hand the turn over deliberately. The
    //    bot answers with a SINGLE turn and control comes straight back — the
    //    exact shape of the report.
    expect(await playCardFromHand(page, CHEAP_CARD), `${CHEAP_CARD} must have been played`).toBe(true);
    await settle(page, 1_500);
    await wheelPick(page, 'up'); // «Пропустить ход» (offered after the first action)

    const afterSkip = await awaitTurns(page, 1);
    // The measured record IS the evidence — print it, so a future regression
    // report carries numbers instead of «кажется, медленно».
    console.log('[bot-turn-latency] after skip:', JSON.stringify(afterSkip));
    expect(afterSkip.length, 'the bot never took an observable turn').toBeGreaterThan(0);
    const single = afterSkip.filter((t) => t.notes.response === 'single');
    expect(single.length, `no lone bot turn was observed: ${JSON.stringify(afterSkip)}`).toBeGreaterThan(0);
    for (const t of single) {
      expect(t.marks.commit, `lone turn ${t.key} held the player's own prompt: ${JSON.stringify(t)}`)
        .toBeLessThan(COMMIT_BUDGET_MS);
    }

    // ── SCENARIO 2 · PASS. The bot now plays out the round, so the turns are a
    //    RUN and the queue is exactly what should carry them.
    await waitForTurn(page);
    await settle(page, 1_000);
    await wheelPick(page, 'down'); // «Пас»

    const afterPass = await awaitTurns(page, afterSkip.length + 2, 90_000);
    console.log('[bot-turn-latency] after pass:', JSON.stringify(afterPass));
    const sequenced = afterPass.filter((t) => t.notes.response === 'sequenced');
    expect(sequenced.length, `the bot's post-pass run was not sequenced: ${JSON.stringify(afterPass)}`)
      .toBeGreaterThan(0);

    // ── The player's ESCAPE from that run: B on the card collapses the whole
    //    backlog instead of uncovering the next card. The verdict is the
    //    DIAGNOSTIC, not the DOM: the bot may legitimately take another turn
    //    right after the press, so «is a card on screen» cannot tell a stepped
    //    queue from a fresh arrival. What must hold is that every turn already
    //    observed BEFORE the press has committed — none of them is still
    //    waiting out a card's lifetime.
    const card = page.locator('.con-notif.notification-card--variant-bot-turn');
    await card.first().waitFor({timeout: 15_000}).catch(() => {});
    expect(await card.count(), 'the bot-turn card never presented during the run').toBeGreaterThan(0);
    const before = (await diag(page)).map((t) => t.key);
    await press(page, 'Escape', 900);
    await settle(page, 1_200);
    const after = await diag(page);
    console.log('[bot-turn-latency] after B:', JSON.stringify(after));
    for (const key of before) {
      const record = after.find((t) => t.key === key);
      expect(record?.marks.commit, `B left turn ${key} uncommitted: ${JSON.stringify(record)}`).toBeDefined();
    }
  });
});


/**
 * THE WORKSPACE CASE — «бот лагает по 5–10 секунд, особенно когда я в
 * workspace во время его хода».
 *
 * ⚠️ THE MEASUREMENT HAS TO EXCLUDE THE HARNESS. A first attempt timed the whole
 * gesture and reported 3.0 s vs 4.3 s — but 2.6 s of that was this file's own
 * `press` settle pauses, and the second half had taken no action, so the wheel's
 * «Пропустить ход» was disabled and no bot turn happened at all. Both numbers
 * were about the test.
 *
 * So: the clock starts on the frame the HAND-OVER IS SUBMITTED (the Enter that
 * confirms the wheel slot) and stops when the viewer's own turn is live again
 * (`turnChip`). Both halves play a real card first, and both spend the SAME two
 * extra presses afterwards — the baseline opens and closes the wheel, the
 * subject opens the hand workspace and stays there — so the only difference
 * between the two runs is where the player is standing while the bot plays.
 */
/**
 * End the turn from the LT wheel and time the return of control. `after` runs
 * INSIDE the measured window on purpose: it is what the player does while the
 * bot plays.
 */
async function handOverAndTime(page: Page, after: (p: Page) => Promise<void>): Promise<number> {
  await press(page, 'Comma', 900); // LT → the basic-actions wheel
  await press(page, 'ArrowUp', 500); // «Пропустить ход»
  const t0 = Date.now();
  await page.keyboard.press('Enter'); // ← the hand-over itself; no settle pause
  await after(page);
  await expect(turnChip(page)).toHaveCount(1, {timeout: 90_000});
  return Date.now() - t0;
}

test.describe('MarsBot turn latency · inside a workspace', () => {
  test('handing the turn over from inside a workspace returns control just as fast', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CARD_A, CARD_B], config: CONFIG});
    await waitForTurn(page);
    await settle(page, 2_000);

    // ── BASELINE: the player stays on the board home. ────────────────────
    expect(await playCardFromHand(page, CARD_A), `${CARD_A} must have been played`).toBe(true);
    await settle(page, 1_200);
    const onBoard = await handOverAndTime(page, async (p) => {
      // The same two presses the subject spends, on a surface that changes
      // nothing: open the wheel and close it again.
      await press(p, 'Comma', 400);
      await press(p, 'Escape', 600);
    });
    const afterBoard = await diag(page);
    console.log('[bot-turn-latency] board home:', onBoard, 'ms', JSON.stringify(afterBoard));

    // ── THE REPORTED CASE: the player walks into a workspace and stays
    //    there for the whole of the bot's turn.
    await settle(page, 1_500);
    expect(await playCardFromHand(page, CARD_B), `${CARD_B} must have been played`).toBe(true);
    await settle(page, 1_200);
    const inWorkspace = await handOverAndTime(page, async (p) => {
      await press(p, 'Period', 400); // RT → the quick wheel
      await press(p, 'Enter', 600); // centre slot → «КАРТЫ», the hand workspace
    });
    const afterWs = await diag(page);
    console.log('[bot-turn-latency] inside a workspace:', inWorkspace, 'ms', JSON.stringify(afterWs));

    // Both halves must have actually produced a bot turn, or the numbers are
    // about nothing (the first attempt at this spec measured exactly that).
    expect(afterWs.length, 'the second hand-over produced no bot turn').toBeGreaterThan(afterBoard.length);

    expect(inWorkspace, `standing in a workspace cost ${inWorkspace - onBoard}ms extra ` +
      `(board ${onBoard}ms, workspace ${inWorkspace}ms)`).toBeLessThan(HANDOVER_BUDGET_MS);
  });
});

/**
 * THE RUN, WATCHED FROM INSIDE A WORKSPACE — the shape the report describes.
 *
 * The player passes (so the bot plays out the whole round) and walks straight
 * into a workspace, which is what they do while «the bot thinks». Every one of
 * those turns is SEQUENCED, so the authoritative view — and with it the
 * player's own next prompt — is buffered behind the compact cards, one card at
 * a time, each with its own lifetime.
 *
 * The number printed here is the whole wait: pass → control back. The sampler
 * records WHO was holding the foreground during it, so a failure names the
 * cause instead of the symptom.
 */
type ForegroundDiag = {
  reason: string, claims: Array<string>, animationHolds: Array<string>,
  mandatoryHeld: boolean, signals: Record<string, boolean>, expired: Array<string>, queue: number,
};

async function foreground(page: Page): Promise<ForegroundDiag | undefined> {
  return await page.evaluate(() => {
    const probe = (window as unknown as {__foregroundDiag?: () => unknown}).__foregroundDiag;
    return (probe?.() ?? undefined) as ForegroundDiag | undefined;
  });
}

test.describe('MarsBot turn latency · a RUN watched from a workspace', () => {
  test('passing and browsing does not hold the player behind the bot\'s cards', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CARD_A], config: CONFIG});
    await waitForTurn(page);
    await settle(page, 2_000);

    // Pass, then walk into the hand workspace and stay there.
    await press(page, 'Comma', 900);
    await press(page, 'ArrowDown', 500); // «Пас»
    const t0 = Date.now();
    await page.keyboard.press('Enter');
    await press(page, 'Period', 400); // RT → the quick wheel
    await press(page, 'Enter', 600); // centre → «КАРТЫ»

    // Sample who is holding the screen while we wait for control to return.
    /*
     * «Control is back» here is THE TABLE WAITING ON ME, not the action-phase
     * turn chip: a pass ends the generation, so what comes back first is the
     * research buy. Measuring the turn chip would have been measuring the
     * player's own idleness (the first attempt did, and reported the test's own
     * 90 s deadline as the bug).
     */
    const awaited = page.locator('.con-status__player--me.con-status__player--active');
    const seen: Array<string> = [];
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (await awaited.count() > 0) {
        break;
      }
      const fg = await foreground(page);
      if (fg !== undefined) {
        const line = `${fg.reason || '-'} | claims=${fg.claims.join(',') || '-'} | ` +
          `anim=${fg.animationHolds.join(',') || '-'} | sig=${Object.keys(fg.signals).join(',') || '-'} | q=${fg.queue}`;
        if (seen[seen.length - 1] !== line) {
          seen.push(line);
        }
      }
      await settle(page, 250);
    }
    const elapsed = Date.now() - t0;
    console.log('[bot-turn-latency] pass → control back, inside a workspace:', elapsed, 'ms');
    console.log('[bot-turn-latency] foreground timeline:\n  ' + seen.join('\n  '));
    console.log('[bot-turn-latency] turns:', JSON.stringify(await diag(page)));

    // THE SHARP ASSERTION: the client never sat on the answer. Before the fix
    // the run's turns committed at 42.5 s (the last card's delivery); the
    // window now walks the board at its own tempo and commits on the spot.
    const turns = await diag(page);
    expect(turns.length, 'the bot never took an observable turn').toBeGreaterThan(1);
    for (const t of turns) {
      expect(t.marks.commit, `turn ${t.key} held the player's own view: ${JSON.stringify(t)}`)
        .toBeLessThan(COMMIT_BUDGET_MS);
    }
    expect(elapsed, `the bot's run held the player for ${elapsed}ms while they worked`)
      .toBeLessThan(RUN_BUDGET_MS);
  });
});

/**
 * THE PLAY-ENDS-TURN CASE — «после розыгрыша карты я опять репродюсил задержку
 * хода MarsBot до 5 секунд; после пропуска хода или паса всё было ок».
 *
 * The one thing a card play has that a skip does not is the CINEMATIC: the
 * played-hero scene (and its landing / reveal chain) is running exactly when
 * the bot's turn arrives on the POLL path. `App.update` refuses to commit a
 * polled view while any of eight scene predicates is active — and it used to
 * DROP the fetched model entirely, leaving the commit to whatever poll tick
 * happened to land after the chain released (up to the 20 s stretched interval
 * with a healthy WS, since the one WS wake had already been consumed by the
 * dropped attempt).
 *
 * The measurement: card A is action 1 (untimed), card B is action 2 — its
 * confirm ENDS the turn, so the clock runs from that confirm to the viewer's
 * turn chip. Both the cinematic and the bot's server pacing legitimately live
 * inside this window; what must NOT live in it is a poll-granularity wait
 * after the cinematic has already released.
 */
test.describe('MarsBot turn latency · a play that ends the turn', () => {
  test('the bot turn behind the play cinematic commits at release, not at the next poll', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CARD_A, CARD_B], config: CONFIG});
    await waitForTurn(page);
    await settle(page, 2_000);

    // ── Action 1: card A, untimed (control returns to the player). ───────
    expect(await playCardFromHand(page, CARD_A), `${CARD_A} must have been played`).toBe(true);
    await settle(page, 1_500);
    await waitForTurn(page);

    // ── Action 2: card B — the confirm ends the turn. Timed by hand: the
    //    helper's own settles would dominate the measurement.
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1600); // centre slot → the hand screen
    const inHand = page.locator(`.con-hand [data-zoom-slot="${CARD_B}"]`);
    await inHand.waitFor({timeout: 12_000});
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, CARD_B, Math.max(slots * 2, 8)), `${CARD_B} must be focusable`).toBe(true);
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await press(page, 'Enter', 900); // open the play composer
    const composer = page.locator('.con-composer--play, .con-play');
    await composer.first().waitFor({timeout: 8_000});

    const t0 = Date.now();
    for (let i = 0; i < 5 && await composer.count() > 0; i++) {
      await page.keyboard.press('Enter'); // the confirm — no settle pause, the clock is running
      await settle(page, 700);
    }
    // Sample who holds the foreground while we wait for control to return.
    const seen: Array<string> = [];
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await turnChip(page).count() > 0) {
        break;
      }
      const fg = await foreground(page);
      if (fg !== undefined) {
        const line = `${Date.now() - t0}ms: ${fg.reason || '-'} | anim=${fg.animationHolds.join(',') || '-'} | ` +
          `sig=${Object.keys(fg.signals).join(',') || '-'} | q=${fg.queue}`;
        if (seen[seen.length - 1]?.split(': ')[1] !== line.split(': ')[1]) {
          seen.push(line);
        }
      }
      await settle(page, 250);
    }
    const elapsed = Date.now() - t0;
    console.log('[bot-turn-latency] play-ends-turn → control back:', elapsed, 'ms');
    console.log('[bot-turn-latency] foreground timeline:\n  ' + seen.join('\n  '));
    console.log('[bot-turn-latency] turns:', JSON.stringify(await diag(page)));

    // THE SHARP ASSERTION: the client never sat on the fetched answer — the
    // moment the deferred refresh let the poll through, the view committed.
    const turns = await diag(page);
    expect(turns.length, 'the bot never took an observable turn').toBeGreaterThan(0);
    for (const t of turns) {
      expect(t.marks.commit, `turn ${t.key} held the player's own view: ${JSON.stringify(t)}`)
        .toBeLessThan(COMMIT_BUDGET_MS);
    }
    expect(elapsed, `the bot's turn behind the play cinematic held the player for ${elapsed}ms`)
      .toBeLessThan(PLAY_HANDOVER_BUDGET_MS);
  });
});
