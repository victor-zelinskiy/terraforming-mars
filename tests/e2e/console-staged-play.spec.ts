import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootIntoGame, focusCard, press, placeTile, soloGameConfig, fetchPlayerModel, playCardFromHand, openCardActions, openActionFocus} from './consoleStart';

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

/** The multi-ocean case (D2): «Ice Asteroid» — 2 oceans, no requirement,
 *  cost 23 against Teractor's 60 M€ (AUTO payment, ready composer). */
const MULTI_CARD = 'Ice Asteroid';
const MULTI_CONFIG = soloGameConfig({
  players: [{name: 'MultiTester', color: 'red', beginner: false, handicap: 0, first: true}],
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

    // THE CEREMONY WITNESS, armed BEFORE the press (MutationObserver +
    // setInterval — never rAF, which stalls headless): the staged landing must
    // really play (a hero proxy flies onto the receiving stage) before the
    // board takes over. Without this the spec passes on a silent no-flight
    // degrade too, which is exactly the regression it must catch.
    await page.evaluate(() => {
      const w = window as unknown as {__stagedCeremony: {proxy: number, recv: number, samples: number}};
      w.__stagedCeremony = {proxy: 0, recv: 0, samples: 0};
      const tick = () => {
        w.__stagedCeremony.samples++;
        if (document.querySelector('.con-played-hero__proxy') !== null) {
          w.__stagedCeremony.proxy++;
        }
        if (document.querySelector('.con-recv') !== null) {
          w.__stagedCeremony.recv++;
        }
      };
      const iv = setInterval(tick, 40);
      const mo = new MutationObserver(tick);
      mo.observe(document.body, {childList: true, subtree: true});
      setTimeout(() => {
        clearInterval(iv);
        mo.disconnect();
      }, 15_000);
    });
    await press(page, 'Enter', 900); // the composer CTA (AUTO payment → ready)

    await expect(panel, 'the staged placement never took the board').toContainText(
      /размещение тайла/i, {timeout: 30_000});
    await expect(composer, 'the composer must yield to the board').toHaveCount(0);

    const ceremony = await page.evaluate(() =>
      (window as unknown as {__stagedCeremony: {proxy: number, recv: number, samples: number}}).__stagedCeremony);
    expect(ceremony.samples, 'the ceremony probe never ran').toBeGreaterThan(5);
    expect(ceremony.proxy, `the staged landing ceremony never flew a card (samples=${ceremony.samples})`)
      .toBeGreaterThan(0);
    expect(ceremony.recv, `the receiving stage never presented (samples=${ceremony.samples})`)
      .toBeGreaterThan(0);

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

  test('multi-tile (D2): the FIRST pick announces the second placement; the second announces nothing', async ({page, request}) => {
    test.setTimeout(420_000);

    const playerId = await bootIntoGame(page, request, {
      config: MULTI_CONFIG,
      cards: [MULTI_CARD],
      corporation: 'Teractor',
    });

    const panel = page.locator('.con-context');
    const planLine = page.locator('.con-context__next');

    await openPlayComposer(page, MULTI_CARD);
    await press(page, 'Enter', 900); // «Разыграть на поле» — the staged first pick
    await expect(panel).toContainText(/размещение тайла/i, {timeout: 30_000});

    // THE PLAN LINE — compact but noticeable, and CONSTANT: the player picks
    // the first ocean knowing a second follows.
    await expect(planLine, 'the first pick must announce the second placement')
      .toContainText(/Затем ещё одно размещение/i, {timeout: 10_000});
    await expect(planLine).toContainText(/Океан/i);

    // Commit the first cell — the play commits, the SECOND ocean arrives as a
    // live chained prompt…
    expect(await placeTile(page), 'the first placement never resolved').toBeTruthy();
    await expect(panel, 'the second (live) placement never took the board')
      .toContainText(/размещение тайла/i, {timeout: 30_000});
    // …and it announces NOTHING: absence is the «this is the last one» message.
    await expect(planLine).toHaveCount(0);

    expect(await placeTile(page), 'the second placement never resolved').toBeTruthy();
    await expect.poll(() => tableauNames(request, playerId), {
      message: 'the committed play never reached the tableau',
      timeout: 30_000,
    }).toContain(MULTI_CARD);
  });

  test('blue-card ACTION: activate → board → B → composer restored → confirm → the ocean commits', async ({page, request}) => {
    test.setTimeout(420_000);

    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        players: [{name: 'ActionTester', color: 'red', beginner: false, handicap: 0, first: true}],
        customCorporationsList: ['Teractor'],
      }),
      cards: ['Aquifer Pumping'],
      corporation: 'Teractor',
    });

    const panel = page.locator('.con-context');
    const workspace = page.locator('.con-cardactions');
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');

    // The card itself places nothing on play — an ordinary (non-staged) play.
    expect(await playCardFromHand(page, 'Aquifer Pumping'),
      'Aquifer Pumping must have been played').toBe(true);
    await page.waitForTimeout(4_000); // the landing story settles

    // ── activate: Действия карт → the action's composer ──────────────────
    await openCardActions(page);
    await openActionFocus(page);
    const ageBefore = await gameAge(request, playerId);

    // A («Подтвердить выполнение» — the cursor opens ON the commit rail for a
    // ready action) hands the screen to the BOARD — nothing is submitted, the
    // workspace yields. Retry while the composer still stands: an early press
    // can land during the entry settle and be consumed by design.
    for (let i = 0; i < 3 && await workspace.count() > 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await expect(panel, 'the staged action placement never took the board')
      .toContainText(/размещение тайла/i, {timeout: 30_000});
    await expect(workspace, 'the Action Center must yield to the board').toHaveCount(0);
    expect(await gameAge(request, playerId), 'the action must not touch the server before the cell confirm')
      .toBe(ageBefore);

    // ── B restores the very composer (same card, same variant) ───────────
    await press(page, 'Escape', 1600);
    await expect(stage, 'B on the board must restore the action composer').toHaveCount(1, {timeout: 10_000});
    expect(await gameAge(request, playerId), 'the cancel must leave no trace').toBe(ageBefore);

    // ── the cell confirm is THE submit; the flow ends on the board ───────
    for (let i = 0; i < 3 && await workspace.count() > 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await expect(panel).toContainText(/размещение тайла/i, {timeout: 30_000});
    expect(await placeTile(page), 'the placement confirm never resolved').toBeTruthy();
    await expect.poll(() => gameAge(request, playerId), {
      message: 'the committed action never reached the server',
      timeout: 30_000,
    }).toBeGreaterThan(ageBefore);
    await page.waitForTimeout(3_000); // the tile hero settles
    await expect(workspace, 'the flow must end on the board — no workspace bow').toHaveCount(0);
  });
});
