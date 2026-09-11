import {test, expect, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, playCardFromHand, settle, waitForBoardHome} from './consoleStart';

/**
 * A PLAYED CARD THAT RAISES A GLOBAL PARAMETER STILL CONCLUDES ITS WORKSPACE.
 *
 * The field report (2026-09-11): «после отправки карты в свое место в зону
 * разыграно workspace завис на 30 секунд», with the console export showing a
 * single event — `[presentation-ledger] story «board-beat-park» degraded
 * after 30s`. The trigger is structural: a play whose response moves a global
 * parameter seeds the board-beat park (a scale changed while the play's hand
 * workspace covered the board), and the park can only DRAIN over a board the
 * workspace has left — so «park owed» and «workspace up» could wait on each
 * other, broken only by the park's 30 s safety, because no `owedConclusion`
 * ingredient re-fired when the park cleared.
 *
 * MiningExpedition raises oxygen +1 (its removeAnyPlants finds no opponent in
 * solo), so playing it from the hand is exactly that trigger with no
 * placement/target follow-up. The contract: the hand workspace LEAVES and the
 * board home returns well within the park's old 30 s cliff, and the oxygen HUD
 * reflects the raise. A failure dumps the shell's stuck-state snapshot.
 */

async function stuckDump(page: Page): Promise<string> {
  const snap = await page.evaluate(() => {
    const w = window as unknown as {
      __conColonyDiag?: () => unknown,
      __presentationLedgerDiag?: () => unknown,
      __foregroundDiag?: () => unknown,
    };
    return {
      colony: w.__conColonyDiag?.() ?? null,
      ledger: w.__presentationLedgerDiag?.() ?? null,
      foreground: w.__foregroundDiag?.() ?? null,
    };
  });
  return JSON.stringify(snap);
}

test.describe('Play → scale raise → the workspace concludes · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('MiningExpedition (oxygen +1) leaves the hand workspace promptly, HUD updated', async ({page, request}) => {
    test.setTimeout(180_000);
    const playerId = await bootFixture(page, request, 'play-scale-card');
    await settle(page);

    const before = await fetchPlayerModel(request, playerId) as {game?: {oxygenLevel?: number}};
    const oxyBefore = before.game?.oxygenLevel ?? 0;

    // Play it from the hand (the driver asks the SERVER's own hand as the
    // witness, and treats a standing placement as played — there is none here).
    const played = await playCardFromHand(page, 'Mining Expedition');
    expect(played, 'the card was played from the hand').toBe(true);

    const t0 = Date.now();
    // THE CONTRACT: the board home returns on its own — no workspace band, no
    // hand screen — well within the park's 30 s cliff. Poll server truth +
    // the shell's own «where am I» witness.
    const home = await page.waitForFunction(() => {
      const w = window as unknown as {__conReady?: () => {wsDepth?: number} | undefined};
      const r = w.__conReady?.();
      const band = document.querySelector('.con-ws, .con-hand, .con-play') as HTMLElement | null;
      const bandShown = band !== null && band.offsetParent !== null;
      return (r?.wsDepth ?? 0) === 0 && !bandShown;
    }, {timeout: 20_000}).then(() => true).catch(() => false);
    const elapsed = Date.now() - t0;
    if (!home) {
      expect(home, `the workspace never concluded after the scale-raising play — ${await stuckDump(page)}`).toBe(true);
    }
    expect(elapsed, `board home returned in ${elapsed}ms (the field hang was ~30 s) — ${await stuckDump(page)}`)
      .toBeLessThanOrEqual(15_000);
    await waitForBoardHome(page, 25);

    // The raise actually happened (the play was real, not just dismissed).
    const after = await fetchPlayerModel(request, playerId) as {game?: {oxygenLevel?: number}};
    expect(after.game?.oxygenLevel ?? 0, 'oxygen rose by the play').toBe(oxyBefore + 1);
  });
});
