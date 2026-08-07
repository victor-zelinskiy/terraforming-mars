import {test, expect} from '@playwright/test';
import {bootSeededGame, createGameWithCards} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The top-HUD project draw pile (ConsoleProjectDeck): a physical card-back
 * stack + the remaining-card count in the status strip, BETWEEN the global
 * parameters and the generation block.
 *
 * Asserts the criteria that are easy to regress:
 *  1. the widget renders in the live shell (stack + top card + count);
 *  2. the count equals the SERVER's authoritative draw-pile size
 *     (GameModel.deckSize) — never a client derivation;
 *  3. it sits between the parameter group and the generation block;
 *  4. it is informational — not controller-focusable, no button.
 */

const OUT_DIR = path.resolve('screenshots', 'project-deck');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
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
    customPreludes: [],
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
    automa: {difficulty: 'normal'},
  };
}

test.describe('console top HUD · project draw pile', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('renders the physical stack; count = the server draw-pile size; placed before the generation', async ({page, request}) => {
    test.setTimeout(180_000);

    // The pregame is SETUP — the subject is the HUD's draw pile, a board-home
    // object. The shared driver ANSWERS it over `player/input` and opens the
    // console on a live board (buying NOTHING, so the deck size is the fresh
    // one this spec compares against the server's own `deckSize`).
    const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
    await bootSeededGame(page, request, playerId);

    // The live shell's status strip carries the deck widget.
    const deck = page.locator('.con-status .con-deckstack');
    await expect(deck).toHaveCount(1, {timeout: 45_000});
    await expect(deck.locator('.con-deckstack__top')).toHaveCount(1);
    // A fresh corpera deck is far above the FULL threshold → 3 side layers.
    await expect(deck.locator('.con-deckstack__layer')).toHaveCount(3);

    // 2 · the count is the SERVER's drawPile size, byte-for-byte.
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as
      {game: {deckSize: number}};
    const shown = (await deck.locator('.con-deckstack__count').innerText()).trim();
    expect(Number(shown.replace(/\D+/g, ''))).toBe(view.game.deckSize);

    // 3 · sits between the parameter group and the generation block.
    const order = await page.evaluate(() => {
      const params = document.querySelector('.con-status__params');
      if (params === null) {
        return 'no-params';
      }
      const kids = Array.from(params.children).map((el) => el.className.split(' ')[0]);
      return kids.join('|');
    });
    expect(order).toContain('con-deckstack|con-status__gen');

    // 4 · informational only — no button, not focusable.
    await expect(deck.locator('button')).toHaveCount(0);
    expect(await deck.getAttribute('tabindex')).toBeNull();

    fs.mkdirSync(OUT_DIR, {recursive: true});
    await page.locator('.con-status').screenshot({path: path.join(OUT_DIR, 'top-bar.png')});
    await page.screenshot({path: path.join(OUT_DIR, 'shell.png')});
  });
});
