import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, pressUntil} from './consoleStart';
import {enterSittingByPass} from './parliamentDrive';
import {armWitness} from './witness';

/**
 * A STEP WHOSE ZONE IS STILL COMING SPEAKS FOR NOBODY — the bar offers no verb of a grid that is not on screen, the
 * pad does not press into it, and the one-owner law says the step WAITS.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 6 — the third hundred of whole games under pilot 2, game 1013, 2026-11-25).
 * A law of the sitting builds a colony: the colonies' frame is pushed the moment the flow owes the step (the question
 * is its), and it renders nowhere until the sitting's stage publishes its zone — after the payout that came with the
 * question has flown (embed rule 4: ownership and readiness are separate questions). In the plain walk the two
 * coincide. But a player who is LOOKING at the law's card (X — the fullscreen viewer) when the step arrives holds the
 * stage back: for those seconds the stack said «colonies», `section` — its projection — said «colonies», the bar
 * offered «A Выбрать», and nothing of the colonies was on screen. The measure named it («says colonies, painted
 * parliament»); a press that came between the viewer's close and the zone went to a grid nobody could see.
 *
 * The law now: `workspaceStackAwaitsZone()` — one answer for the pad (the press is the beat's), the bar (quiet) and
 * the function (`QuestionFacts.zoneAwaited` → held `claim`).
 *
 * The table is fixture `parliament-colony-assembly` (Colony Contest, the winner's free colony). Every wait is for a
 * STATE; what the bar said while the step had no zone is RECORDED from before the pass (`armWitness`).
 */
const PRESET = {viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const GRID = '.con-parl [data-embed-slot="parliament-stage"] .con-colonies';
const VIEWER = 'dialog.con-zoom[open]';

type Seen = {frames: string, bar: string, grid: boolean, viewer: boolean};
type OwnerLog = {disagreements: Array<{what?: string}>};

const ownerLog = (page: Page): Promise<OwnerLog> =>
  page.evaluate(() => (window as unknown as {__conServingOwner: () => OwnerLog}).__conServingOwner());

test.describe('a step whose zone is still coming speaks for nobody', () => {
  test.use({viewport: PRESET.viewport});

  test('the colony step arrives under the card the player is reading: no verb of an unseen grid, no disagreement — and the grid, standing, takes its verbs', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-colony-assembly', {query: PRESET.query});
    const seen = await armWitness<Seen, {grid: string, viewer: string}>(page, 'step-zone', ({grid, viewer}) => {
      const ready = (window as unknown as {__conReady?: () => {wsFrames?: Array<string>}}).__conReady?.();
      return {
        frames: (ready?.wsFrames ?? []).join('>'),
        bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
        grid: document.querySelector(grid) !== null,
        viewer: document.querySelector(viewer) !== null,
      };
    }, {args: {grid: GRID, viewer: VIEWER}});
    await enterSittingByPass(page, request, playerId);

    // X — the player reads the law's card while the sitting walks to its reward.
    expect(await pressUntil(page, 'KeyX', async () => await page.locator(VIEWER).count() > 0, {tries: 4, settleMs: 900}),
      'X lifts the card into the viewer').toBe(true);

    // THE STEP ARRIVES UNDER THE VIEWER: its frame stands on the stack (its zone with it, or a beat later).
    await seen.waitFor((v) => /colonies/.test(v.frames), {timeoutMs: 90_000, message: 'the colony step never came'});

    // B — the card goes back; the stage finishes its payout, publishes its zone, the grid stands.
    expect(await pressUntil(page, 'Escape', async () => await page.locator(VIEWER).count() === 0, {tries: 4, settleMs: 900}), 'B closes the viewer').toBe(true);
    await seen.waitFor((v) => v.grid, {timeoutMs: 90_000, message: 'the colonies never stood in the sitting\'s stage'});
    const record = await seen.stop();

    // WHAT THE BAR SAID WHILE THE STEP HAD NO ZONE: nothing of the grid.
    // (Whether a look of the walk caught the step WITHOUT its zone is the machine's own business — the gap itself is
    // the stack's unit row, `workspaceStackAwaitsZone`. The claim here holds for every look there was.)
    const unseen = record.filter((sample) => /colonies/.test(sample.v.frames) && !sample.v.grid);
    expect([...new Set(unseen.map((sample) => sample.v.bar))].filter((bar) => /Выбрать|Построить/.test(bar)),
      'no verb of a grid that is not on screen').toEqual([]);
    // …and the one-owner law read every look of it as a wait.
    expect((await ownerLog(page)).disagreements.map((entry) => entry.what ?? ''), 'the function and the screen never parted').toEqual([]);

    // THE GRID, STANDING, HAS ITS VERBS: the bar names the pick, and L3 the law that asked.
    await expect.poll(async () => (await page.locator('.con-cmdbar').textContent() ?? '').replace(/\s+/g, ' '), {timeout: 30_000, message: 'the standing grid offers its pick'})
      .toMatch(/Выбрать/);
  });
});
