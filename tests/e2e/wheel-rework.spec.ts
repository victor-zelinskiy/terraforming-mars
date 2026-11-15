import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, cinematicBeat, press, settle, soloGameConfig} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

/**
 * Quick-wheel rework · press→release lifecycle + the commit/collapse/reveal
 * transition grammar (PRESS → MECHANICAL COMMIT → DEPTH COLLAPSE → CONTEXT
 * REVEAL — no icon flights).
 *
 * Drives a real solo COLONIES game through the console-native shell and
 * verifies the reworked RT/LT wheel end to end:
 *  - the ARMED state lifts a tile toward the player on the d-pad DOWN edge
 *    (neighbours recede HALF a layer — never disappear),
 *  - the commit fires on the UP edge; the destination forms in parallel and
 *    its `data-wheel-anchor` emblem echoes in,
 *  - the trading screen is titled «Торговля» with the wheel's own emblem,
 *  - B mid-arm cancels without executing (and the stale release is inert),
 *  - a fast tap commits exactly like before,
 *  - a BLOCKED slot arms in resistance mode and refuses on release (wheel
 *    stays open, the honest reason surfaces),
 *  - LT↔RT switches swap the cross in place (and the command bar advertises
 *    the opposite trigger),
 *  - heat conversion really spends 8 heat; plant conversion really enters
 *    (and B-cancels out of) greenery placement,
 *  - standard projects / card actions / pass-confirm all open with their
 *    emblems,
 *  - the LEFT STICK (injected fake pad): focus follows the sector, circling
 *    re-focuses, the CONFIRMED neutral commits.
 *
 * Screenshot gallery → `screenshots/wheel-rework/`.
 */

const OUT_DIR = path.resolve('screenshots', 'wheel-rework');

/**
 * `testMode` gives 500 of everything, so both conversions are available.
 *
 * UNMI is forced as the ONLY dealable corporation: it has a card action (spend
 * 3 M€ → +1 TR, only after TR was raised this turn), so the Action Center
 * always shows a real premium tile — the status rail, the reserved meta strip
 * with its honest reason, and the reveal cascade have something to prove on.
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'WheelTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {colonies: true},
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['United Nations Mars Initiative'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await press(page, code, settleMs);
}

/**
 * Open a wheel from the calm board home, retrying past lingering holds — act →
 * verify: after each press the wheel gets the rest of the old window to STAND
 * before the press is tried again (a retry is a second press on whatever the
 * first one opened), and the loop ends the moment it stands.
 */
async function openWheel(page: Page, code: 'Comma' | 'Period'): Promise<void> {
  const wheel = page.locator('.con-quick');
  for (let i = 0; i < 8 && await wheel.count() === 0; i++) {
    await key(page, code, 900);
    await wheel.first().waitFor({state: 'attached', timeout: 900}).catch(() => undefined);
  }
  await expect.poll(() => wheel.count(), {message: `the ${code} wheel never opened`}).toBeGreaterThan(0);
}

/**
 * The wheel's tiles AT REST — every slot body's box the same twice, a frame
 * apart, with no finite motion left (the entrance, the arm's lift, a refused
 * seat): the wait a still frame of the gallery needs, never a guessed pause.
 */
async function wheelAtRest(page: Page, what: string): Promise<void> {
  await readSettled(page, () => page.evaluate(() => Array.from(document.querySelectorAll('.con-quick__slot-body')).map((el) => {
    const b = el.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
  })), {message: what});
}

/**
 * «Did `selector` ever stand / ever leave?» — recorded from before the action (a negative claim is a record, never one
 * instant). `settled` for a claim that it NEVER LEFT: a sample between two writes of one task is not a frame.
 */
async function armPresence(page: Page, key: string, selector: string, settled = false): Promise<Witness<boolean>> {
  return armWitness<boolean, string>(page, key, (sel) => document.querySelector(sel) !== null, {args: selector, settled});
}

/** Install the fake standard pad (the LEFT STICK's driver) — `__stick(x, y)` moves its axes. */
async function installFakePad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pad = {
      index: 0, id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true,
      mapping: 'standard', timestamp: 1,
      buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0})),
      axes: [0, 0, 0, 0],
    };
    navigator.getGamepads = function() {
      return [pad, null, null, null] as unknown as ReturnType<typeof navigator.getGamepads>;
    };
    (window as unknown as {__pad: typeof pad}).__pad = pad;
    (window as unknown as {__stick: (x: number, y: number) => void}).__stick = (x: number, y: number) => {
      pad.axes = [x, y, 0, 0];
      pad.timestamp = performance.now();
    };
    // Chromium refuses a plain object in GamepadEventInit — fall back to a
    // bare Event carrying the pad as an expando (onConnected only reads
    // `e.gamepad.index/id`), so the poll loop reliably starts headless.
    try {
      window.dispatchEvent(new GamepadEvent('gamepadconnected', {gamepad: pad as unknown as Gamepad}));
    } catch (e) {
      const ev = new Event('gamepadconnected') as Event & {gamepad: typeof pad};
      ev.gamepad = pad;
      window.dispatchEvent(ev);
    }
  });
}

/**
 * Move the fake pad's left stick. The axes STAY where they are put, so every
 * positive claim after a move is a polling assertion that waits for the pad
 * poll to read them — no pause here.
 */
async function stick(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([sx, sy]) => (window as unknown as {__stick: (x: number, y: number) => void}).__stick(sx, sy), [x, y]);
}

/**
 * Boot a game and land on the CALM board home: the wizard walked, the solo
 * Colonies setup picks resolved, the corporation's announced first action
 * carried out — until that resolves the action menu is honestly narrowed and
 * the wheel's std/conversion tiles would sit disabled-with-reason.
 *
 * All of it is the shared driver's job (`consoleStart.ts` — `waitForBoardHome`
 * drives the colony pick, the mandatory announce and any tile placement with
 * the same act→verify→retry discipline). The local walk this replaces decided
 * the wizard was over by COUNTING `.con-start__frame` nodes — a question the
 * DOM cannot answer, since the scene stays MOUNTED through its yield
 * (`ConsoleShell.vue:2395`) and its panes are `v-show`
 * (`ConsoleStartScene.vue:26`) — and it opened the announce with B, which has
 * been A since the mandatory prompts were unified (the announce card renders
 * `GamepadGlyph control="confirm"`, and `ConsoleShell.vue:6235` acknowledges
 * the beat on `primary`).
 */
async function bootWheelBoard(page: Page, request: APIRequestContext, extraQuery = ''): Promise<void> {
  // UNMI by NAME: `customCorporationsList` only guarantees it is IN the deal
  // (testMode deals eight), and UNMI is on the seeder's avoid-list — without
  // this the wheel would be exercised on some other corporation entirely.
  await bootIntoGame(page, request, {
    config: GAME_CONFIG,
    query: extraQuery,
    corporation: 'United Nations Mars Initiative',
  });
}

test.describe('quick-wheel rework', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('press→release, flights, trading rename, conversions', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootWheelBoard(page, request);

    // ── 1 · RT wheel: static premium look ────────────────────────────
    await openWheel(page, 'Period');
    await expect(page.locator('.con-quick__slot')).toHaveCount(5);
    await expect(page.locator('.con-quick__slot-body')).toHaveCount(5);
    await wheelAtRest(page, 'the RT wheel assembled');
    await shoot(page, '01-rt-wheel-static');

    // ── 2 · ARM on the down edge: the right tile seats, neighbours mute ──
    // The key is HELD while the arm is read: the arm is the down edge's own
    // state (polled), and the shot waits for the lift to come to rest.
    await page.keyboard.down('ArrowRight');
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--armed')).toHaveCount(1);
    await expect(page.locator('.con-quick__slot--muted')).toHaveCount(4);
    await wheelAtRest(page, 'the right tile armed');
    await shoot(page, '02-rt-armed-right');

    // ── 3 · COMMIT on the up edge → the COLONY WORKSPACE, with the wheel's
    //        emblem as the flight anchor ──────────────────────────────────
    await page.keyboard.up('ArrowRight');
    await cinematicBeat(page, 260, 'the collapse/reveal storyboard frame — the shot is MID-transition by design');
    await shoot(page, '03-collapse-reveal');
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await settle(page);
    // The destination's own header, not a per-surface kicker: the colonies
    // screen became a WORKSPACE and adopted the shared `ConsoleWsHead`
    // (`ConsoleColoniesSection.vue:29` — `root="Colonies"`, `emblem="colonies"`,
    // `wheelAnchor="trading"`), so the title is the crumb ROOT «КОЛОНИИ» and
    // «ТОРГОВЛЯ» is a STAGE the crumb only grows once the player descends into
    // a colony. The old `.con-colonies__kicker` no longer exists anywhere in
    // `src/` — one header for the whole family is the point (console-ui.md
    // § the workspace band).
    await expect(page.locator('.con-colonies .con-wshead__root')).toContainText(/колонии/i);
    // What the WHEEL contract still owns: the destination's emblem is the
    // handoff's landing anchor, and it is really painted (the echo tweens onto
    // it — a missing/hidden anchor makes the flight land nowhere).
    const anchor = page.locator('.con-colonies [data-wheel-anchor="trading"]');
    await expect(anchor).toHaveCount(1);
    await expect(anchor).toBeVisible();
    await shoot(page, '04-trading-screen');
    await key(page, 'Escape', 1400); // back to the board home
    await expect.poll(() => page.locator('.con-colonies').count()).toBe(0);

    // ── 4 · B mid-arm cancels: nothing executes, the stale release is inert ──
    await openWheel(page, 'Period');
    await page.keyboard.down('ArrowRight');
    // B lands MID-ARM: the arm is the down edge's own state — wait for it, never a guessed hold.
    await page.locator('.con-quick__slot--right.con-quick__slot--armed').waitFor({timeout: 8_000});
    // «Nothing executes» is a claim about the WHOLE window — recorded from before B, asked once the console is at rest.
    const cancelledExec = await armPresence(page, 'wheel-cancelled-arm', '.con-colonies');
    await key(page, 'Escape', 500);
    await page.keyboard.up('ArrowRight');
    await settle(page);
    await expect.poll(() => page.locator('.con-quick').count(), {message: 'B must close the wheel'}).toBe(0);
    expect(await cancelledExec.ever((up) => up), 'a cancelled arm must not execute').toBe(false);
    await cancelledExec.stop();

    // ── 5 · A fast tap commits exactly like before ───────────────────
    await openWheel(page, 'Period');
    await key(page, 'ArrowRight', 400);
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await key(page, 'Escape', 1400);

    // ── 6 · A BLOCKED slot resists and refuses (hydro is not in this game) ──
    await openWheel(page, 'Period');
    await page.keyboard.down('ArrowLeft');
    await expect(page.locator('.con-quick__slot--left.con-quick__slot--armed-blocked')).toHaveCount(1);
    await wheelAtRest(page, 'the blocked arm seated');
    await shoot(page, '05-armed-blocked');
    // «The wheel stays open» holds for the WHOLE refusal — recorded from before the release, asked at rest.
    const refusedWheel = await armPresence(page, 'wheel-refused-commit', '.con-quick', true);
    await page.keyboard.up('ArrowLeft');
    await settle(page);
    expect(await refusedWheel.ever((up) => !up), 'a refused commit keeps the wheel open').toBe(false);
    await refusedWheel.stop();
    await expect.poll(() => page.locator('.con-quick').count(), {message: 'a refused commit keeps the wheel open'}).toBeGreaterThan(0);
    await shoot(page, '06-blocked-refused-notice');

    // ── 7 · LT↔RT switch swaps the cross in place; the command bar
    //        advertises the opposite trigger (the switch affordance) ────
    await key(page, 'Comma', 700); // RT wheel open + LT → switches to basics
    await expect(page.locator('.con-quick__kicker')).toContainText(/базовые/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/действия/i); // «RT Действия»
    await shoot(page, '07-lt-wheel');
    await key(page, 'Period', 700); // and back to categories
    await expect(page.locator('.con-quick__kicker')).not.toContainText(/базовые/i);
    // «ВЫБЕРИТЕ ДЕЙСТВИЕ» — the RT kicker no longer duplicates the top
    // node's first word («ДЕЙСТВИЯ» over «ДЕЙСТВИЯ КАРТ»).
    await expect(page.locator('.con-quick__kicker')).toContainText(/действ/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/базовые/i); // «LT Базовые действия»
    await key(page, 'Escape', 600);

    // ── 8 · Standard projects (LT centre) — emblem anchor present ────
    await openWheel(page, 'Comma');
    await key(page, 'Enter', 1500);
    await page.waitForSelector('.con-stdp', {timeout: 8_000});
    await expect(page.locator('.con-stdp [data-wheel-anchor="std-projects"]')).toHaveCount(1);
    await shoot(page, '08-std-projects');
    await key(page, 'Escape', 1200);

    // ── 9 · Card actions (RT up) — emblem anchor, the UNMI premium tile
    //        (status rail + reserved meta strip with its reason), no
    //        trickle-in reflow (the store was pre-warmed at wheel open) ──
    await openWheel(page, 'Period');
    await key(page, 'ArrowUp', 1500);
    await page.waitForSelector('.con-cardactions', {timeout: 8_000});
    await expect(page.locator('.con-cardactions [data-wheel-anchor="card-actions"]')).toHaveCount(1);
    await expect(page.locator('.con-cardactions__group')).not.toHaveCount(0);
    await expect(page.locator('.con-cardactions__tile-meta').first()).toBeAttached();
    await expect(page.locator('.con-cardactions__tile-reason').first()).toContainText(/./); // the honest reason line
    await shoot(page, '09-card-actions');
    await key(page, 'Escape', 1200);

    // ── 10 · Pass (LT down) → the confirm card with its emblem; input
    //         is accepted while the wheel is still assembling ──────────
    await key(page, 'Comma', 260); // deliberately short: mid-entrance
    await key(page, 'ArrowDown', 900);
    await page.waitForSelector('.con-confirm', {timeout: 8_000});
    await expect(page.locator('.con-confirm [data-wheel-anchor="confirm"]')).toHaveCount(1);
    await shoot(page, '10-pass-confirm');
    await key(page, 'Escape', 900); // cancel — nothing submitted
    await expect.poll(() => page.locator('.con-confirm').count()).toBe(0);

    // ── 11 · Plant conversion continues into greenery placement; B cancels
    //         (a client-side cancel — no action is consumed) ────────────
    await openWheel(page, 'Comma');
    await key(page, 'ArrowLeft', 700);
    await page.waitForSelector('.con-board--live', {timeout: 8_000});
    await shoot(page, '13-plants-placement');
    await key(page, 'Escape', 900);
    await expect.poll(() => page.locator('.con-board--live').count(), {message: 'B must cancel the placement'}).toBe(0);

    // ── 12 · Heat conversion really spends 8 heat (ember flight) ─────
    const heatValue = page.locator('.con-res__row--heat .con-res__value');
    const heatBefore = parseInt((await heatValue.innerText()).trim(), 10);
    await openWheel(page, 'Comma');
    await key(page, 'ArrowRight', 500);
    await shoot(page, '11-heat-commit');
    await settle(page); // the commit pulse + round trip end as holds/transport go quiet
    // The counter itself may still be ticking its flip tail — poll the VALUE.
    await expect.poll(async () => parseInt((await heatValue.innerText()).trim(), 10),
      {timeout: 10_000}).toBe(heatBefore - 8);
    await shoot(page, '12-heat-after');

    // ── 13 · Cards (RT centre) → the hand rises out of the dock ──────
    await settle(page); // the turn rolls after the conversion
    await openWheel(page, 'Period');
    await key(page, 'Enter', 2600);
    await page.waitForSelector('.con-hand', {timeout: 10_000});
    await shoot(page, '14-hand-open');
    await key(page, 'Escape', 2200);

    // ── 14 · LEFT STICK (fake pad): focus follows the sector, circling
    //         re-focuses, the CONFIRMED neutral commits ─────────────────
    // Every move below is followed by the state it must produce (a polling
    // assertion waits for the pad poll to read the axes) — never a pause.
    await installFakePad(page);
    await openWheel(page, 'Period');
    await stick(page, 1, 0); // engage RIGHT → trading focuses
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--armed')).toHaveCount(1);
    await stick(page, 0, 1); // circle to DOWN (voting — blocked focus, still honest)
    await expect(page.locator('.con-quick__slot--down.con-quick__slot--armed-blocked')).toHaveCount(1);
    await wheelAtRest(page, 'the stick on the blocked slot');
    await shoot(page, '15-stick-focus-blocked');
    await stick(page, 1, 0); // circle back to RIGHT
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--armed')).toHaveCount(1);
    await stick(page, 0, 0); // CONFIRMED neutral → mechanical commit
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await shoot(page, '16-stick-commit-trading');
    await key(page, 'Escape', 1400);
  });

  test('FOCUS & CONFIRM: home focus, navigation-only directions, universal A', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootWheelBoard(page, request, '&wheelControl=focus-confirm');

    const focusedCenter = page.locator('.con-quick__slot--center.con-quick__slot--focus');

    // ── 1 · Every RT open starts at the fixed HOME focus («Карты»),
    //        visible from the first beats of the entrance; the bar leads
    //        with the mode's verb («A Выбрать») ─────────────────────────
    await openWheel(page, 'Period');
    await expect(focusedCenter).toHaveCount(1);
    await expect(page.locator('.con-cmdbar')).toContainText(/выбрать/i);
    await shoot(page, 'fc-01-home-focus');

    // ── 2 · A direction only MOVES the focus — its release executes
    //        NOTHING (the wheel stays open, no overlay) ─────────────────
    const directionExec = await armPresence(page, 'wheel-fc-direction', '.con-colonies');
    await key(page, 'ArrowRight', 500);
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--focus')).toHaveCount(1);
    expect(await directionExec.ever((up) => up), 'a direction release must not execute').toBe(false);
    await directionExec.stop();
    await expect.poll(() => page.locator('.con-quick').count()).toBeGreaterThan(0);
    await shoot(page, 'fc-02-focus-right');

    // ── 3 · The OPPOSITE direction returns to the centre (the map) ─────
    await key(page, 'ArrowLeft', 400);
    await expect(focusedCenter).toHaveCount(1);

    // ── 4 · The stick moves the focus; the confirmed neutral executes
    //        NOTHING (the sharpest contrast with quick-select) ──────────
    await installFakePad(page);
    await stick(page, 1, 0);
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--focus')).toHaveCount(1);
    // Confirmed neutral — must NOT commit, must NOT steal focus. Nothing on screen marks the neutral as CONFIRMED (it is
    // the pad poll's own clock, `AIM_NEUTRAL_MS` on its frames), so the negative claim is a record over the window the
    // product takes to confirm it — armed before the release, asked after.
    const neutralExec = await armPresence(page, 'wheel-fc-neutral', '.con-colonies');
    await stick(page, 0, 0);
    await cinematicBeat(page, 600, 'the stick\'s neutral is confirmed on the pad poll\'s own clock — the window a negative claim watches');
    expect(await neutralExec.ever((up) => up), 'stick neutral must not execute in focus-confirm').toBe(false);
    await neutralExec.stop();
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--focus')).toHaveCount(1);

    // ── 4b · The stick REACHES THE CENTRE: it walks the d-pad's map, so an
    //         OPPOSITE deflection returns home to «Карты» (the centre is not
    //         a sector — an absolute-angle stick could never reach it) ──────
    await stick(page, -1, 0);
    await expect(focusedCenter).toHaveCount(1);
    await wheelAtRest(page, 'the stick home on the centre');
    await shoot(page, 'fc-02b-stick-home');
    await stick(page, 1, 0); // back out to «Торговля» for the confirm below
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--focus')).toHaveCount(1);
    // The stick back at neutral before A — in focus-confirm a neutral moves nothing (the claim above), so A below
    // confirms the focus whichever frame the pad poll reads it in.
    await stick(page, 0, 0);

    // ── 5 · A confirms the CURRENT focus (not the centre): press seats the
    //        tile, release commits → trading opens through the shared
    //        commit/collapse/reveal pipeline ──────────────────────────────
    await page.keyboard.down('Enter');
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--armed')).toHaveCount(1);
    await wheelAtRest(page, 'A held on the focused tile');
    await shoot(page, 'fc-03-pressed');
    await page.keyboard.up('Enter');
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await key(page, 'Escape', 1400);

    // ── 6 · The home focus is NEVER remembered: the next open (and every
    //        LT↔RT switch) starts back at the centre ──────────────────────
    await openWheel(page, 'Period');
    await expect(focusedCenter).toHaveCount(1);
    await key(page, 'Comma', 700); // switch to LT — home focus again
    await expect(page.locator('.con-quick__kicker')).toContainText(/базовые/i);
    await expect(focusedCenter).toHaveCount(1);
    await key(page, 'Period', 700); // and back — home focus again
    await expect(focusedCenter).toHaveCount(1);

    // ── 7 · B during a held A cancels: nothing executes, later release inert ──
    await page.keyboard.down('Enter');
    // B lands while A is HELD: the held A's arm (the centre, the home focus) is its own state — wait for it.
    await page.locator('.con-quick__slot--center.con-quick__slot--armed').waitFor({timeout: 8_000});
    const cancelledA = await armPresence(page, 'wheel-fc-cancelled-a', '.con-hand');
    await key(page, 'Escape', 500);
    await page.keyboard.up('Enter');
    await settle(page);
    await expect.poll(() => page.locator('.con-quick').count(), {message: 'B must close the wheel'}).toBe(0);
    expect(await cancelledA.ever((up) => up), 'a cancelled A must not execute').toBe(false);
    await cancelledA.stop();

    // ── 8 · A on a BLOCKED focus refuses: the wheel stays open, the focus
    //        survives, navigation continues immediately ────────────────────
    await openWheel(page, 'Period');
    await key(page, 'ArrowDown', 400); // «Голосование» — blocked, still focusable
    await expect(page.locator('.con-quick__slot--down.con-quick__slot--focus')).toHaveCount(1);
    await key(page, 'Enter', 500);
    await expect.poll(() => page.locator('.con-quick').count(), {message: 'a refused confirm keeps the wheel open'}).toBeGreaterThan(0);
    await expect(page.locator('.con-quick__slot--down.con-quick__slot--focus')).toHaveCount(1);
    await shoot(page, 'fc-04-blocked-refused');
    await key(page, 'Escape', 600);
  });
});
