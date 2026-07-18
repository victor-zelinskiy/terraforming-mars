import {test, expect, Page} from '@playwright/test';
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

/** Walk the start wizard to the summary and submit it (mirrors
 *  console-start-summary.spec.ts — corporation commits with A, the project
 *  buy continues with RT, the empty buy confirms twice). */
async function walkIntoGame(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  const summary = page.locator('.con-start__summary');
  const activeStep = page.locator('.con-start__step--active');

  for (let i = 0; i < 8 && await summary.count() === 0; i++) {
    await page.waitForSelector('.con-cards__verdictbar', {timeout: 25_000});
    await page.waitForTimeout(400);
    const before = (await activeStep.innerText()).toLowerCase();
    await key(page, /корпорац|директор/.test(before) ? 'Enter' : 'KeyE', 1200);
    for (let w = 0; w < 20 && await summary.count() === 0 &&
         (await activeStep.innerText()).toLowerCase() === before; w++) {
      await page.waitForTimeout(250);
    }
  }
  await expect(summary).toHaveCount(1);
  await key(page, 'Enter', 700); // arms the zero-projects warning
  await key(page, 'Enter', 2500); // submits — the game shell takes over
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

test.describe('console top HUD · project draw pile', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('renders the physical stack; count = the server draw-pile size; placed before the generation', async ({page, request}) => {
    test.setTimeout(180_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await walkIntoGame(page);

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
