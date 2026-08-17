import {test, expect, Page} from '@playwright/test';
import {bootWithCards, playCardFromHand, press, soloGameConfig, waitForTurn} from './consoleStart';

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

/** No requirement, 4 M€, one production step — it raises no prompt of its own. */
const CHEAP_CARD = 'Power Plant';

const CONFIG = soloGameConfig({automa: {difficulty: 'normal'}});

/** Commit lag past which the player perceives «бот думает». */
const COMMIT_BUDGET_MS = 1_500;

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
