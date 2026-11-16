import {test, expect} from './consoleTest';
import {bootIntoGame, openQuickWheel, pressUntil, settle} from './consoleStart';
import {readSettled} from './settledRead';

/**
 * HAND ALBUM capture — a VIDEO-ONLY run for the frame-by-frame motion review
 * (open from the dock → page walk → page jump → close back into the dock).
 * No assertions beyond liveness: the artifact is the video, inspected frame
 * by frame for duplicate cards / early appearances / size snaps / rail
 * jumps. Temporary review tooling — delete after the review if unwanted.
 *
 * The video records throughout, so no wait here is a capture timing: each
 * episode is waited out by the state that ends it (the album standing / gone)
 * and the console at REST (`settle`), never a guessed duration.
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
  await settle(page);

  // Open (RT wheel → A) — the open episode is on tape from its first frame (the video never stops). The wheel is
  // opened act → verify; A on its centre slot is verified by its OWN effect (the wheel took it, or the album stands),
  // and a swallowed A is pressed again on the same standing wheel — never a second A into the opened album.
  const hand = page.locator('.con-hand');
  const wheel = page.locator('.con-quick');
  await openQuickWheel(page);
  await pressUntil(page, 'Enter', async () => await hand.count() > 0 || await wheel.count() === 0, {tries: 3, settleMs: 2600});
  await expect(hand).toHaveCount(1, {timeout: 10_000});
  await settle(page); // the whole open episode, played to its end

  // Walk right across the page edge (the slide is on tape) — eleven HOPS, each act → verify on the album's own
  // cursor (the selected slot moved), so a swallowed arrow is pressed again rather than shortening the walk.
  const selected = () => page.evaluate(() =>
    document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
  for (let hop = 0; hop < 11; hop++) {
    const from = await selected();
    await pressUntil(page, 'ArrowRight', async () => await selected() !== from, {tries: 2, settleMs: 600});
  }
  // Jump a page back with the wheel — aimed at the album's box AT REST (the page slide over).
  const albumBox = await readSettled(page, () => page.locator('.con-hand__album').boundingBox(),
    {message: 'the album box before the wheel jump'});
  if (albumBox !== null) {
    await page.mouse.move(albumBox.x + albumBox.width / 2, albumBox.y + albumBox.height / 2);
    await page.mouse.wheel(0, -120);
    await settle(page); // the page jump, played to its end
  }
  // Close — the gather is the tail of the tape: the album leaves, then the gather lands (the console at rest).
  await page.keyboard.press('Escape');
  await expect(hand).toHaveCount(0, {timeout: 10_000});
  await settle(page);
});
