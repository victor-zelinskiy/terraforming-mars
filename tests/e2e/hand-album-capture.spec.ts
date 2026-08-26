import {test, expect, Page} from '@playwright/test';
import {bootIntoGame} from './consoleStart';

/**
 * HAND ALBUM capture — a VIDEO-ONLY run for the frame-by-frame motion review
 * (open from the dock → page walk → page jump → close back into the dock).
 * No assertions beyond liveness: the artifact is the video, inspected frame
 * by frame for duplicate cards / early appearances / size snaps / rail
 * jumps. Temporary review tooling — delete after the review if unwanted.
 */

test.use({
  viewport: {width: 1920, height: 1080},
  deviceScaleFactor: 1,
  screen: {width: 1920, height: 1080},
  video: {mode: 'on', size: {width: 1920, height: 1080}},
});

function newGameConfig() {
  return {
    players: [{name: 'CaptureTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
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
  };
}

async function key(page: Page, code: string, settleMs = 300): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

test('capture: open → walk → jump → close', async ({page, request}) => {
  test.setTimeout(480_000);
  // LARGE layout (4/page) — the reporting user's own mode, where most of
  // the hand lives as page packets: the dense-fan open and the LIFO close
  // assembly are exactly what the tape must show.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('tm_console_album', 'large');
    } catch {
      /* adaptive layout still shows the transition */
    }
  });
  // 13 cards: the walk crosses a page edge; with 4/page the packet tail is
  // the majority of the hand.
  await bootIntoGame(page, request, {config: newGameConfig(), buy: 13, query: ''});
  await page.waitForTimeout(1200);

  // Open (RT wheel → A) with NO settle around the press — the open episode
  // must be on tape from its first frame.
  for (let i = 0; i < 4 && await page.locator('.con-hand').count() === 0; i++) {
    await key(page, 'Period', 500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2600); // the whole open episode
  }
  await expect(page.locator('.con-hand')).toHaveCount(1);
  await page.waitForTimeout(600);

  // Walk right across the page edge (the slide is on tape).
  for (let i = 0; i < 11; i++) {
    await key(page, 'ArrowRight', 150);
  }
  await page.waitForTimeout(600);
  // Jump a page back with the wheel.
  const albumBox = await page.locator('.con-hand__album').boundingBox();
  if (albumBox !== null) {
    await page.mouse.move(albumBox.x + albumBox.width / 2, albumBox.y + albumBox.height / 2);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(700);
  }
  // Close — the gather is the tail of the tape.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2600);
  await expect(page.locator('.con-hand')).toHaveCount(0);
});
