import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootIntoGame, focusCard, press, placeTile, soloGameConfig, fetchPlayerModel} from './consoleStart';

/**
 * STAGED PLAY — the cell pick as the LAST REVERSIBLE STEP of playing a
 * tile-placing card (docs/TILE_PLAY_STAGED_COMMIT.md).
 *
 * The contract under test, end to end against a REAL server:
 *
 *   1. «Разыграть» on a tile-placing card submits NOTHING: the composer hands
 *      the screen to the board's placement stage while the server's change
 *      counters stand still and the card is still in the hand — the whole
 *      «prepare» is client-side by construction.
 *   2. B on the board (navigate phase) restores the play composer for the
 *      SAME card — the round trip has no game consequences at all.
 *   3. The cell CONFIRM is the one submit: the play commits, the tile lands
 *      on the chosen cell, the card joins the tableau — and the flow ENDS ON
 *      THE BOARD (no workspace returns for a bow).
 *
 * Card: «Mohole Area» — a special tile on an ocean-reserved area with a
 * production reward; cost 20 against Teractor's 60 M€ start, so the payment
 * is AUTO and the composer is ready on open (no branch/step walk — the spec
 * drives the staged boundary, not the composer's pickers).
 */

const CARD = 'Mohole Area';
const CONFIG = soloGameConfig({
  players: [{name: 'StagedTester', color: 'red', beginner: false, handicap: 0, first: true}],
  customCorporationsList: ['Teractor'],
});

/** The server's own change counter — the fact «nothing was submitted». */
async function gameAge(request: APIRequestContext, playerId: string): Promise<number> {
  const model = await fetchPlayerModel(request, playerId);
  return (model.game as {gameAge?: number}).gameAge ?? -1;
}

async function handNames(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const model = await fetchPlayerModel(request, playerId);
  // `cardsInHand` is a root field of the self view (PlayerViewModel), not of
  // the public `thisPlayer` half.
  const self = model as unknown as {cardsInHand?: Array<{name: string}>};
  return (self.cardsInHand ?? []).map((c) => c.name);
}

async function tableauNames(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const model = await fetchPlayerModel(request, playerId);
  const self = model.thisPlayer as {tableau?: Array<{name: string}>} | undefined;
  return (self?.tableau ?? []).map((c) => c.name);
}

/** Open the hand from board home (RT wheel → centre slot) and descend into
 *  the play composer of `card`. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand screen
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  await press(page, 'Enter', 1200); // open the play composer
  await page.locator('.con-composer--play').waitFor({timeout: 15_000});
}

test.describe('staged play — the cell is the last reversible step', () => {
  test('play → board → B → composer restored → confirm → the flow ends on the board', async ({page, request}) => {
    test.setTimeout(420_000);

    const playerId = await bootIntoGame(page, request, {
      config: CONFIG,
      cards: [CARD],
      corporation: 'Teractor',
    });

    const panel = page.locator('.con-context');
    const composer = page.locator('.con-composer--play');

    // ── 1. «Разыграть» opens the BOARD, not the wire ─────────────────────
    await openPlayComposer(page, CARD);
    const ageBeforePlay = await gameAge(request, playerId);
    await press(page, 'Enter', 900); // the composer CTA (AUTO payment → ready)

    await expect(panel, 'the staged placement never took the board').toContainText(
      /размещение тайла/i, {timeout: 30_000});
    await expect(composer, 'the composer must yield to the board').toHaveCount(0);

    // NOTHING was submitted: the server's change counter stands still and the
    // card is still in the hand — the reversibility is a server-side fact,
    // not a client promise.
    expect(await gameAge(request, playerId), 'the play must not touch the server before the cell confirm')
      .toBe(ageBeforePlay);
    expect(await handNames(request, playerId), 'the card must still be in the hand while staging')
      .toContain(CARD);

    // ── 2. B restores the composer — the round trip costs nothing ────────
    await press(page, 'Escape', 1400);
    await expect(composer, 'B on the board must restore the play composer').toHaveCount(1);
    await expect(composer, 'the restored composer must carry the SAME card')
      .toContainText(new RegExp('Мохол|Mohole', 'i'));
    expect(await gameAge(request, playerId), 'the cancel must leave no trace')
      .toBe(ageBeforePlay);
    expect(await handNames(request, playerId)).toContain(CARD);

    // ── 3. the cell confirm is THE submit; the flow ends on the board ────
    await press(page, 'Enter', 900); // «Разыграть» again
    await expect(panel).toContainText(/размещение тайла/i, {timeout: 30_000});
    expect(await placeTile(page), 'the placement confirm never resolved').toBeTruthy();

    // The play is real now: the card left the hand for the tableau and the
    // server's counter moved — exactly once, at the cell confirm.
    await expect.poll(() => tableauNames(request, playerId), {
      message: 'the committed play never reached the tableau',
      timeout: 30_000,
    }).toContain(CARD);
    expect(await handNames(request, playerId)).not.toContain(CARD);
    expect(await gameAge(request, playerId)).toBeGreaterThan(ageBeforePlay);

    // …and the flow ENDED ON THE BOARD: no hand workspace came back for a
    // second confirm or a result screen.
    await page.waitForTimeout(4_000); // let the tile hero + rewards settle
    await expect(page.locator('.con-hand')).toHaveCount(0);
    await expect(composer).toHaveCount(0);
  });
});
