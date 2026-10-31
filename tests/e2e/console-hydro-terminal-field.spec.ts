import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, openConsole, press, settle, waitForBoardHome} from './consoleStart';
import type {FixtureName} from './consoleStart';

/**
 * THE TERMINAL LANDING WHOSE ANSWER PASSES THE MOVE — the owner's hydro freeze of 2026-10-31 (game gce2206994265:
 * «передвижение на 5 ПО вторым действием, ход передался другому игроку, после анимации экран завис — развис только при
 * сворачивании»). The FIELD TABLE itself (`field-hydro-terminal`: the owner's save, blue's first action replayed —
 * three seats, a human rival, MarsBot; the finish passes the move to the BOT, whose turn arrives behind the ceremony
 * with a tile beside blue's and blue's own M€ reaction) and a two-human table (`hydro-terminal-2p`: the move passes to
 * a human who never answers).
 *
 * THE CYCLE THIS PINS (the audit of 2026-10-31): the foreign tile's VIEWER INCOME was held on the panel until the
 * landing flew; the landing parked for a board the hydro workspace covered; the hydro resolution counted the panel's
 * hold as its own busy — so the flow stood «executing» with nothing in flight until the board-home watchdog. Now the
 * resolution's busy reads the flow's OWN reward work only, and a landing that parks for a covered board gives the
 * viewer their income at once. The contract: the ceremony plays, the workspace LEAVES ON ITS OWN within the chain's
 * honest budget, nothing stalls (the harness is red on `[liveness] stall` / `[workspace-stall] beat`).
 */
const TABLES = [['field-hydro-terminal', 'blue'], ['hydro-terminal-2p', undefined]] as const satisfies ReadonlyArray<readonly [FixtureName, string | undefined]>;

const sceneOf = (page: Page) => page.evaluate(() => {
  const w = window as unknown as {__conReady?: () => {holds: Array<string>, wsFrames: Array<string>}, __conHydroDiag?: () => unknown};
  const ready = w.__conReady?.();
  const q = (s: string) => document.querySelectorAll(s).length;
  return {hydro: q('.con-hydro'), cere: q('.con-hydro__cere'), ws: q('.con-ws'), holds: ready?.holds ?? [], frames: ready?.wsFrames ?? [], diag: w.__conHydroDiag?.()};
});

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

for (const [fixture, viewerColor] of TABLES) {
  test(`${fixture} · the finish as the turn's second action: the ceremony plays, the workspace leaves by itself, nothing stalls`, async ({page, request}) => {
    test.setTimeout(420_000);
    const booted = await bootFixtureSeats(page, request, fixture, {query: '&consoleProfile=tv'});
    let playerId = booted.playerId;
    if (viewerColor !== undefined) {
      // THE FIELD VIEWER by COLOUR (the loader's seat order is not the fixture's); open the viewer's own page.
      for (const id of booted.seats) {
        const m = await fetchPlayerModel(request, id) as unknown as {thisPlayer?: {color?: string}};
        if (m.thisPlayer?.color === viewerColor) {
          playerId = id;
        }
      }
      await openConsole(page, playerId, '&consoleProfile=tv');
      await waitForBoardHome(page, 25);
    }
    await settle(page);

    // The Hydronetwork (the wheel route every hydro spec drives) → RT «К дальнему» → the 5 VP slot → A.
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900);
    const focused = await page.evaluate(() => document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the farthest legal stage is the 5 VP slot').toBe('11');
    await press(page, 'Enter', 900);
    await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as {thisPlayer: {deltaProject?: {position?: number}}}).thisPlayer.deltaProject?.position,
      {timeout: 30_000, message: 'the server position is the finish slot'}).toBe(11);
    await page.waitForSelector('.con-hydro__cere', {timeout: 30_000});
    const cereAt = Date.now();

    // THE CONTRACT: the flow closes ITSELF — ceremony → summary → the workspace leaves. No press, no help.
    const reads: Array<string> = [];
    let gone = false;
    for (let i = 0; i < 20 && !gone; i++) {
      const s = await sceneOf(page);
      reads.push(`${i}s hydro=${s.hydro} cere=${s.cere} holds=${s.holds.join(',')} frames=${s.frames.join(';')} diag=${JSON.stringify(s.diag).slice(0, 300)}`);
      gone = s.hydro === 0 && s.ws === 0;
      if (!gone) {
        await cinematicBeat(page, 1000, 'the ending on a 1 s grid');
      }
    }
    const closeMs = Date.now() - cereAt;
    expect(gone, `the workspace never left after the ceremony — ${reads.join(' | ')}`).toBe(true);
    expect(closeMs, `ceremony→close took ${closeMs}ms (a stall hides behind the 14–30 s safeties) — ${reads.join(' | ')}`).toBeLessThanOrEqual(14_000);

    // The board is the player's again; the harness's guards are the witness that nothing stalled on the way.
    await settle(page, {timeoutMs: 30_000});
  });
}
