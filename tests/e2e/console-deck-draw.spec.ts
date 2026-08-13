import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fillPicks, offeredCards, pickCards, playQueueCard, playQueueUntil, press, queueCards,
  submitSummary, walkToSummary,
} from './consoleStart';

/**
 * The DECK-DRAW hero scene: cards physically come off the top-bar project
 * deck, are judged against the server's own search record, and route to the
 * discard tray / the hold zone before the reveal assembles around them.
 *
 * Driven through a REAL conditional search: the «Acquired Space Agency»
 * prelude ("reveal cards until you find two with a space tag; take them,
 * discard the rest"). The prelude plays as the game starts, so the scene
 * fires right after the start wizard is submitted.
 *
 * What is asserted is the semantics that must never regress:
 *  1. the cards come off the deck and the modal does NOT exist meanwhile;
 *  2. a search that discarded something shows the tray, and its count is the
 *     server's discard count — not a client guess;
 *  3. the reveal ends up holding exactly the matched cards;
 *  4. the tray survives into the modal and is inspectable on demand (X).
 */

const OUT_DIR = path.resolve('screenshots', 'deck-draw');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Victor', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    // The prelude pool is pinned so the wizard always offers the search card
    // alongside three harmless resource preludes.
    customPreludes: ['Acquired Space Agency', 'Donation', 'Loan', 'Martian Industries'],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    // Plain solo: MarsBot rejects custom card lists, and the pinned prelude
    // pool is the whole point of this test.
    automa: undefined,
  };
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * The SETUP: reach the deployment with «Acquired Space Agency» among the two
 * chosen preludes. The walk itself belongs to the shared start driver
 * (`consoleStart`) — this spec only says WHAT it needs picked, so a change in
 * the start flow is adapted in one place instead of here.
 */
const SEARCH_PRELUDE = 'Acquired Space Agency';

async function setUpSearchPrelude(page: Page): Promise<void> {
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
        return;
      }
      if (kind === 'prelude') {
        // The pool is PINNED by the config, so the search prelude is always
        // dealt. It is picked FIRST (the step's limit is two — filling first
        // would spend the limit on the harmless ones and silently drop the
        // subject of this whole spec), then the second slot is filled.
        const picked = await pickCards(p, [SEARCH_PRELUDE]);
        expect(picked, `the search prelude must be dealt (offered: ${(await offeredCards(p)).join(', ')})`)
          .toContain(SEARCH_PRELUDE);
        await fillPicks(p, 2);
      }
      // The project step buys nothing — the search prelude is the subject.
    },
  });
  await submitSummary(page);
}

/**
 * The PRELUDE PHASE: focus «Космическое агентство» in the deployment queue
 * and play it — that press is what fires the deck-draw scene. (The corp is
 * played first if the queue offers it, exactly as a player would.)
 */
async function playSearchPrelude(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__queue [data-queue-slot]', {timeout: 30_000});
  // The rest of the queue (the corporation, the filler prelude) is played
  // first — the scene under test is THIS prelude's, so it goes last and the
  // press that fires it is ours (and is verified to have landed: a press
  // during a commit is absorbed by design).
  const ready = await playQueueUntil(page, SEARCH_PRELUDE);
  expect(ready, `the search prelude must reach the queue (queue: ${(await queueCards(page)).join(', ')})`).toBeTruthy();
  const played = await playQueueCard(page, SEARCH_PRELUDE);
  expect(played, 'the search prelude must actually play').toBeTruthy();
}

test.describe('console · deck-draw hero scene', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a conditional search plays off the deck, trays its discards, then assembles the reveal', async ({page, request}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await setUpSearchPrelude(page);
    await playSearchPrelude(page);

    // 1 · The scene stage exists and the modal is WITHHELD while it plays.
    const stage = page.locator('.con-deckdraw');
    await expect(stage).toHaveCount(1, {timeout: 30_000});
    // At least one card is airborne off the deck.
    await expect(page.locator('.con-deckdraw-proxy')).not.toHaveCount(0);
    expect(await page.locator('.con-reveal__card').count()).toBe(0);
    await shoot(page, '01-search-in-flight');

    // The tray appears for a search that really discarded something. (If the
    // seed's first two cards both carried a space tag there are no discards —
    // that is the honest plain-draw fallback, and the tray must NOT appear.)
    const trayOnStage = page.locator('.con-deckdraw__tray');
    const hadDiscards = await trayOnStage.count() > 0;
    if (hadDiscards) {
      await shoot(page, '02-tray');
    }

    // ── THE TRAY TAKES ITS SEAT — it must TRAVEL to the berth the reveal
    //    keeps for it, never blink out here and back in there. Sampled
    //    continuously, because a teleport and a flight have the SAME end
    //    state: the whole difference is the middle.
    const seat = {
      moved: 0, // px the tray's own pile travelled
      landed: Number.POSITIVE_INFINITY, // closest it ever came to the berth
      /** Frames where BOTH piles were visible in DIFFERENT places (the bug). */
      doubleFrames: 0,
      sawBerth: false,
    };
    let firstPile: {x: number, y: number} | undefined;
    for (let i = 0; i < 140; i++) {
      const s = await page.evaluate(() => {
        const box = (sel: string) => {
          const el = document.querySelector(sel);
          if (el === null) {
            return undefined;
          }
          const r = el.getBoundingClientRect();
          return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width,
            opacity: Number(getComputedStyle(el).opacity)};
        };
        return {
          tray: box('.con-deckdraw__tray-pile'),
          berth: box('.con-reveal__discard-pile'),
          berthBox: box('.con-reveal__discard'),
          reveal: document.querySelector('.con-reveal__card') !== null,
          stage: document.querySelector('.con-deckdraw') !== null,
        };
      });
      if (s.tray !== undefined) {
        if (firstPile === undefined) {
          firstPile = {x: s.tray.x, y: s.tray.y};
        }
        seat.moved = Math.max(seat.moved, Math.hypot(s.tray.x - firstPile.x, s.tray.y - firstPile.y));
      }
      if (s.berth !== undefined) {
        seat.sawBerth = true;
        if (s.tray !== undefined) {
          const gap = Math.hypot(s.tray.x - s.berth.x, s.tray.y - s.berth.y);
          seat.landed = Math.min(seat.landed, gap);
          // Two piles, two places, both painted — exactly the reading the
          // seat flight removes (the berth is held until the tray lands).
          if (gap > 40 && (s.berthBox?.opacity ?? 0) > 0.05) {
            seat.doubleFrames++;
          }
        }
      }
      if (!s.stage && s.reveal) {
        break;
      }
      await page.waitForTimeout(60);
    }

    // 2 · The scene resolves into the reveal modal, holding the found cards.
    const revealCard = page.locator('.con-reveal__card');
    await expect(revealCard).toHaveCount(1, {timeout: 45_000});
    await expect(stage).toHaveCount(0, {timeout: 20_000}); // the stage tore down
    await shoot(page, '03-reveal');

    // The server's own truth for this batch — the client must not disagree.
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as {
      cardDrawReveals: Array<{cards: Array<{name: string}>, sequence?: Array<{card: {name: string}, matched: boolean}>}>,
    };
    const batch = view.cardDrawReveals[0];
    expect(batch, 'the prelude should have queued a reveal').toBeTruthy();
    // Exactly the matched cards are on offer.
    await expect(page.locator('.con-reveal__strip .con-cards__slot')).toHaveCount(batch.cards.length);

    const discards = (batch.sequence ?? []).filter((s) => !s.matched);
    const trayInModal = page.locator('.con-reveal__discard');
    if (discards.length === 0) {
      // Nothing was discarded → no tray anywhere. The plain-draw fallback.
      await expect(trayInModal).toHaveCount(0);
      return;
    }

    // 3 · The tray survived into the modal, and its count is the SERVER's.
    await expect(trayInModal).toHaveCount(1);
    await expect(trayInModal.locator('.con-reveal__discard-count')).toHaveText(String(discards.length));

    // 3b · …and it GOT there physically: the same stack of cards travelled
    //      from the scene's own tray into that berth. (`landed` is the closest
    //      the two piles ever came — a teleport never closes that distance,
    //      it simply swaps one for the other.)
    expect(seat.sawBerth, 'the reveal must keep a berth for the discards').toBeTruthy();
    expect(seat.moved, `the discard pile must TRAVEL to its berth (moved ${Math.round(seat.moved)}px)`)
      .toBeGreaterThan(40);
    expect(Math.round(seat.landed), `the pile must land ON the berth (closest ${Math.round(seat.landed)}px)`)
      .toBeLessThan(40);
    expect(seat.doubleFrames, 'never two discard piles in two places at once').toBe(0);

    // 4 · The tray is opened by R3 ONLY — it is NOT a focus target. Walking
    // the received cards to the end never lands the selection frame on it,
    // and the pile carries the R3 glyph (never X), matching the command bar.
    for (const _card of batch.cards) {
      await key(page, 'ArrowRight', 350);
    }
    await expect(trayInModal).not.toHaveClass(/con-reveal__discard--focused/);
    // The pile's own hint is R3, and nothing else.
    const hint = trayInModal.locator('.con-reveal__discard-hint');
    await expect(hint.locator('.gp-glyph')).toHaveText('R3');
    // The command bar advertises the same single way in.
    const bar = page.locator('.con-cmdbar');
    await expect(bar).toContainText(/сброшенные/i);
    await expect(bar.locator('.gp-glyph', {hasText: 'R3'})).toHaveCount(1);
    await shoot(page, '04-tray-r3');
  });
});
