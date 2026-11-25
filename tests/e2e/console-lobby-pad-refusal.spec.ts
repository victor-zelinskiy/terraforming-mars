import {test, expect, Page} from './consoleTest';
import {soloGameConfig} from './consoleStart';
import {armWitness} from './witness';

/**
 * THE LOBBY REFUSES OUT LOUD — B on a screen with nowhere to go back to shakes the focus ring once, and nothing else.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `surface:gamepad-focus-ring`
 * stood on the ledger of the UNWALKED (`tests/client/bottle/kernelUnwalked.json` — «a pad intent the console shell
 * does not claim falls through to the DOM focus engine and is REFUSED there»). The ring's scope waits for one thing:
 * the end of its refusal shake (`GamepadFocusRing` — `deny()` in `gamepad/focusEngine.ts`). The console shell claims
 * every intent of a game, so the DOM engine speaks only on the screens it still owns (`focusScopes.SCOPE_DEFS`) — and
 * of those the LOBBY (`/game?id=…`, the seats' links of a table of several) is the one a player with a pad really
 * stands on: its back is `none`, so B is a refusal. No spec of the suite held a pad there.
 *
 * The pad is injected (`navigator.getGamepads` — Playwright emits no gamepad input; the recipe of
 * `console-gamepad-reload-carryover`). Every wait is for a STATE: the core has POLLED the pad (the pad counts its own
 * reads), the ring stands, the shake was RECORDED from before the press (`armWitness`) — never a guessed duration.
 */
const PAD_INIT = `
  (function () {
    var pad = {
      index: 0, id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: 1,
      buttons: Array.from({length: 17}, function () { return {pressed: false, touched: false, value: 0}; }),
      axes: [0, 0, 0, 0],
    };
    window.__padReads = 0;
    navigator.getGamepads = function () {
      window.__padReads = (window.__padReads || 0) + 1;
      return [pad, null, null, null];
    };
    window.__set = function (i, on) {
      pad.buttons[i] = {pressed: !!on, touched: !!on, value: on ? 1 : 0};
      pad.timestamp = performance.now();
    };
    setTimeout(function () {
      try { window.dispatchEvent(new GamepadEvent('gamepadconnected', {gamepad: pad})); } catch (e) {}
    }, 150);
  })();
`;
/** The standard mapping's buttons this spec holds. */
const B = 1;
const DOWN = 13;

const padReads = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as {__padReads?: number}).__padReads ?? 0);

/** The core has read the pad `n` more times — it has SEEN what the pad holds now (its poll's own pulse). */
async function padPolled(page: Page, n: number, what: string): Promise<void> {
  const from = await padReads(page);
  await expect.poll(() => padReads(page), {message: `the gamepad core never polled the pad (${what})`, timeout: 15_000}).toBeGreaterThanOrEqual(from + n);
}

/** One press of a button: held until the core has polled it, released until it has polled that. */
async function padPress(page: Page, button: number, what: string): Promise<void> {
  await page.evaluate((i) => (window as unknown as {__set: (i: number, on: boolean) => void}).__set(i, true), button);
  await padPolled(page, 4, `${what} pressed`);
  await page.evaluate((i) => (window as unknown as {__set: (i: number, on: boolean) => void}).__set(i, false), button);
  await padPolled(page, 4, `${what} released`);
}

test.describe('the lobby refuses out loud', () => {
  test('B on the lobby (nowhere to go back to): the focus ring shakes once, the lobby stands — and it can be asked again', async ({page, request}) => {
    test.setTimeout(120_000);
    const created = await request.post('/api/creategame', {
      data: soloGameConfig({
        players: [
          {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
          {name: 'Bruno', color: 'red', beginner: false, handicap: 0, first: false},
        ],
      }),
    });
    expect(created.ok(), 'the server made the table').toBeTruthy();
    const {id} = await created.json() as {id: string};

    await page.addInitScript(PAD_INIT);
    await page.goto(`/game?id=${id}`);
    await page.waitForSelector('#game-home', {timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
    await padPolled(page, 4, 'the idle pad on the lobby');

    // ↓ — the pad takes the screen: the ring stands on one of the lobby's own controls.
    const ring = page.locator('.gp-ring');
    await expect.poll(async () => {
      if (await ring.count() === 0) {
        await padPress(page, DOWN, '↓');
      }
      return ring.count();
    }, {timeout: 30_000, message: 'the focus ring never stood on the lobby'}).toBe(1);

    // B — THE REFUSAL, recorded from before the press: the ring's shake, and the lobby under it.
    const seen = await armWitness<{denied: boolean, lobby: boolean}>(page, 'lobby-refusal', () => ({
      denied: document.querySelector('.gp-ring.gp-ring--denied') !== null,
      lobby: document.querySelector('#game-home') !== null,
    }));
    await padPress(page, B, 'B');
    await seen.waitFor((v) => v.denied, {timeoutMs: 15_000, message: 'B on a screen with no way back said nothing — the ring never shook'});
    await seen.waitFor((v) => !v.denied, {timeoutMs: 15_000, message: 'the shake never ended'});
    const record = await seen.stop();
    expect(record.every((sample) => sample.v.lobby), 'the lobby stood through the refusal').toBe(true);
    await expect(page).toHaveURL(/\/game\?id=/);
    await expect(ring, 'the ring still stands where it stood').toHaveCount(1);

    // …and the refusal is one-shot, re-armed by the next press.
    const again = await armWitness<boolean>(page, 'lobby-refusal-again', () => document.querySelector('.gp-ring.gp-ring--denied') !== null);
    await padPress(page, B, 'B again');
    await again.waitFor((v) => v, {timeoutMs: 15_000, message: 'a second B said nothing'});
    await again.waitFor((v) => !v, {timeoutMs: 15_000, message: 'the second shake never ended'});
    await again.stop();
  });
});
