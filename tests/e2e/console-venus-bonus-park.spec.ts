/*
 * A BOARD BEAT WAITS FOR A BOARD THE PLAYER CAN SEE — the Venus 8% bonus.
 *
 * Crossing Venus 8% draws a card whose one honest presentation is the cover
 * lifting off the scale's own marker — a BOARD cinematic. Before the
 * board-beat park, a play made INSIDE the hand workspace fired all of it
 * immediately: the marker snapped behind `display:none`, and the cover-lift
 * scene armed against a hidden board, measured a 0×0 anchor, aborted — and
 * the fullscreen viewer opened `mandatory` OVER the open workspace while the
 * batch's presence wedged the workspace's own conclusion («workspace завис
 * пустой»).
 *
 * The contract now (boardBeatPark.ts), watched frame by frame because every
 * failure here is an ORDER question:
 *
 *   workspace up   → NO fullscreen surface, and the top HUD still reads the
 *                    pre-change Venus value (the story is HELD);
 *   workspace gone → the scales tell their story, THEN the bonus presents
 *                    over a board the player can see, and the card is taken.
 */
import {expect, test, Page} from './consoleTest';
import * as fs from 'fs';
import * as path from 'path';
import {bootWithCards, composerLoaded, press, pressUntil, settle, soloGameConfig, takeRevealCards, waitForBoardHome} from './consoleStart';
import {armWitness, Witness} from './witness';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'venus-bonus-park');

/** One recorded state of the crossing play: the hand, a fullscreen surface, the stranded guard, the HUD's Venus. */
type Seen = {hand: boolean, reveal: boolean, zoom: boolean, stranded: boolean, strip: string};

/** Venus +3 steps (0% → 6%) — the setup play, crossing nothing. Cost 27. */
const SHADE = 'Giant Solar Shade';
/** Venus +1 step (6% → 8%) — THE crossing: the 8% draw fires inside the hand
 *  workspace's own response. Cost 23. CrediCor's 57 − 2 buys covers both. */
const GHG = 'GHG Import From Venus';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The top HUD's Venus readout («6%» / «8%») — the held-value witness. */
async function venusStrip(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.querySelector('.con-status__param--venus .con-status__value')?.textContent ?? '').trim());
}

/** Open the hand workspace, walk onto `card`, descend, CONFIRM the play (`beforeCommit` runs right before the A). */
async function playFromHand(page: Page, card: string, beforeCommit: () => Promise<unknown> = async () => undefined): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  // The open episode settles — a STATE (holds, the flights home, finite motion), never a fixed 800 ms.
  await settle(page);

  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const selected = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    await press(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
    lastSelected = selected;
  }
  expect(await onTarget(), `the hand cursor never reached ${card}`).toBeGreaterThan(0);
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  // The sheet has its preview and stands still (its readiness marker, then the console at rest) — never a fixed 1 s;
  // the driver's A then waits out the commit row's own arrival window by itself.
  await composerLoaded(page);
  await settle(page);
  await beforeCommit();
  await press(page, 'Enter', 400);
}

test.describe('the Venus 8% bonus waits for the workspace to leave', () => {
  test.setTimeout(360_000);

  test('no fullscreen over the workspace; the scales and the draw play on the board after it', async ({page, request}) => {
    await bootWithCards(page, request, {
      cards: [SHADE, GHG],
      corporation: 'CrediCor',
      config: soloGameConfig({
        expansions: {venus: true},
        customProjectCards: [SHADE, GHG],
        // Cards-on-top, so the deal OFFERS the corporation whose 57 M€ pays
        // for both plays (27 + 23 + two 3 M€ buys).
        customCorporationsList: ['CrediCor'],
      }),
    });

    // ── SETUP PLAY: Venus 0% → 6% (no crossing). Its own scale story drains
    //    after the workspace leaves; we only need the board home back and the
    //    HUD reading 6% before the real probe starts.
    await playFromHand(page, SHADE);
    await waitForBoardHome(page);
    await expect
      .poll(() => venusStrip(page), {timeout: 30_000, message: 'the HUD reaches 6% after the setup play'})
      .toBe('6%');
    await shoot(page, 'venus-6-baseline');

    // ── THE CROSSING PLAY, RECORDED from the commit's own A (FLAKE ZERO — `armWitness`: every state the product
    //    writes, never a 150 ms poll that sleeps through a surface). `settled`: «a fullscreen over the OPEN
    //    workspace» is a COEXISTENCE — a sample is the state a task LEAVES, never the gap between two of its writes.
    const armed: Array<Witness<Seen>> = [];
    await playFromHand(page, GHG, async () => {
      armed.push(await armWitness<Seen>(page, 'venus-bonus-park', () => ({
        hand: document.querySelector('.con-hand') !== null,
        reveal: document.querySelector('.con-reveal') !== null,
        zoom: document.querySelector('.card-zoom-dialog') !== null,
        stranded: document.querySelector('.con-stranded') !== null,
        strip: (document.querySelector('.con-status__param--venus .con-status__value')?.textContent ?? '').trim(),
      }), {settled: true}));
    });
    const w = armed[0];
    const fullscreen = (s: Seen) => s.reveal || s.zoom;
    // The bonus presented over the board the player can see (the workspace gone) — waited for as a STATE.
    const overBoard = await w.waitFor((s) => !s.hand && fullscreen(s), {timeoutMs: 45_000}).then(() => true, () => false);
    if (overBoard) {
      await shoot(page, 'bonus-over-board');
      // The take is the surface's own A — act → verify (the surface left) → retry; the record keeps watching the
      // closing half (viewer → intake → board home).
      await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal, .card-zoom-dialog').count() === 0, {tries: 8, settleMs: 1500});
    }
    // The whole story has been told: scales at 8%, no surface left up — the END STATE the window runs to.
    await w.waitFor((s) => !s.hand && s.strip.includes('8') && !fullscreen(s), {timeoutMs: 30_000}).catch(() => undefined);
    const seen = (await w.stop()).map((x) => x.v);
    if (seen.some((s) => s.hand && fullscreen(s))) {
      await shoot(page, 'BUG-fullscreen-under-workspace');
    }
    const log = {
      /** A fullscreen surface (reveal band / zoom viewer) over the OPEN hand
       *  workspace — the reported bug's first half. Must be 0 (recorded states, never frames). */
      fullscreenUnderHand: seen.filter((s) => s.hand && fullscreen(s)).length,
      /** The HUD read the TRUTH («8%») while the workspace still owned the screen — state delivery, 2026-10-28:
       *  the instrument flips at once, the board tells the story later. Must be > 0 (it used to be the held-value
       *  contract's violation; the owner reversed that law: «состояния в top bar — сразу же»). */
      strip8UnderHand: seen.filter((s) => s.hand && s.strip.includes('8')).length,
      /** The stranded-prompt guard fired — the «workspace завис» detector. */
      strandedFrames: seen.filter((s) => s.stranded).length,
      handGone: seen.some((s) => !s.hand),
      sawFullscreenOverBoard: seen.some((s) => !s.hand && fullscreen(s)),
      sawStrip8OverBoard: seen.some((s) => !s.hand && s.strip.includes('8')),
      trace: seen.map((s, i) => `${i} h:${s.hand ? 1 : 0} r:${s.reveal ? 1 : 0} z:${s.zoom ? 1 : 0} v:${s.strip}`),
    };
    console.log(`[venus bonus trace]\n${log.trace.join('\n')}`);

    // THE ORDER — the whole point of the board-beat park:
    expect(log.fullscreenUnderHand,
      'no fullscreen reveal/viewer may open over the open workspace').toBe(0);
    expect(log.strip8UnderHand,
      'the HUD reads the applied 8 % AT ONCE, while the workspace still owns the screen (state delivery, 2026-10-28)').toBeGreaterThan(0);
    expect(log.handGone,
      'the workspace CONCLUDES — the flow may never hang committed-and-empty').toBeTruthy();
    expect(log.sawFullscreenOverBoard,
      'the bonus card IS presented, over a board the player can see').toBeTruthy();
    expect(log.sawStrip8OverBoard, 'the scales tell the 8% story on the board').toBeTruthy();
    expect(log.strandedFrames, 'the stranded-prompt guard never fires').toBe(0);

    // The batch is CONSUMED and the game goes on — the anti-deadlock half.
    await takeRevealCards(page);
    await waitForBoardHome(page);
    await expect.poll(() => venusStrip(page), {timeout: 15_000}).toBe('8%');
    await shoot(page, 'venus-8-settled');
  });
});
