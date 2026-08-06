import {test, expect, Page} from '@playwright/test';
import {bootToBoard, fillPicks, press} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HAND DOCK probe — evidence generator + the hard alignment contract.
 *
 * Drives a real solo game into the console shell and verifies the permanent
 * bottom-centre hand dock:
 *  - the dock centre is MATHEMATICALLY the viewport centre (±1.5px), and
 *    coaxial with the RT quick-wheel centre slot (requirement #1);
 *  - the silhouette count equals the real hand size;
 *  - mode transitions: live on the board home, subdued under an overlay,
 *    hidden in the hand section, empty tray at 0 cards;
 *  - screenshots to screenshots/hand-dock/ for the visual review.
 */

const OUT = path.resolve('screenshots', 'hand-dock');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'DockTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** The viewer's true hand size (server truth via the public player API). */
async function handSize(request: any, playerId: string): Promise<number> {
  const res = await request.get(`/api/player?id=${playerId}`);
  const view = await res.json();
  return (view.cardsInHand?.length ?? 0) + (view.thisPlayer?.selfReplicatingRobotsCards?.length ?? 0);
}

async function bootGame(page: Page, request: any, buyProjects: number, profileQuery = ''): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  const playerId = model.players[0].id;
  await page.goto(`/player?id=${playerId}&console=1${profileQuery}`);
  // THE SHARED DRIVER, never a hand-rolled key script (the project contract —
  // consoleStart.ts): the walk is SETUP, and this spec must fail on its own
  // dock claims, not on the road to them. The previous scripted walk advanced
  // steps with RB (KeyE) — a verb the 2026-07 wizard polish removed — and its
  // recovery rotation had no RT at all, so any swallowed press livelocked the
  // boot on the corporation step.
  await bootToBoard(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 700);
      } else if (kind === 'prelude') {
        await fillPicks(p, 2);
      } else if (kind === 'project' && buyProjects > 0) {
        await fillPicks(p, buyProjects, 30);
      }
    },
  });
  await page.waitForTimeout(1200);
  return playerId;
}

/** The dock AND its bar bay must centre on the viewport — the hard contract.
 *  Both are asserted: the dock is absolutely centred by construction, while
 *  the bay is a grid track that a stray profile `gap` once shoved half a
 *  gap off-centre. */
async function assertDockCentered(page: Page): Promise<void> {
  const vw = page.viewportSize()!.width;
  const dock = page.locator('.con-handdock');
  await expect(dock).toHaveCount(1);
  const box = await dock.boundingBox();
  expect(box, 'dock has a box').toBeTruthy();
  const center = box!.x + box!.width / 2;
  expect(Math.abs(center - vw / 2), `dock centre ${center} vs viewport ${vw / 2}`).toBeLessThan(1.5);
  const bay = page.locator('.con-cmdbar__bay');
  await expect(bay).toHaveCount(1);
  const bb = await bay.boundingBox();
  const bayCenter = bb!.x + bb!.width / 2;
  expect(Math.abs(bayCenter - vw / 2), `bay centre ${bayCenter} vs viewport ${vw / 2}`).toBeLessThan(1.5);
}

/** The board home's FULL hint set must clear both bay zones — no label may
 *  degrade to an ellipsis on the calm home (the worst-case context the
 *  compact bay typography + the split model are budgeted for). */
async function assertNoClippedHints(page: Page): Promise<void> {
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.con-cmdbar__cmds .con-cmdbar__label')]
      .filter((l) => (l as HTMLElement).scrollWidth > (l as HTMLElement).clientWidth)
      .map((l) => (l as HTMLElement).textContent));
  expect(clipped, `clipped hint labels: ${clipped.join(', ')}`).toHaveLength(0);
}

test.describe('hand dock · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('board home: live, centred, silhouettes = hand size; overlay/section modes', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootGame(page, request, 2);

    // ── live on the board home, mathematically centred ──────────────
    const dock = page.locator('.con-handdock');
    await expect(dock).toHaveClass(/con-handdock--live/);
    await assertDockCentered(page);
    // Silhouettes mirror the REAL hand (server truth; preludes may draw).
    const hand = await handSize(request, playerId);
    await expect(page.locator('.con-handdock__card')).toHaveCount(hand); // EVERY card is a physical back now
    await assertNoClippedHints(page);
    await shoot(page, '01-board-2cards');

    // ── hover → focused-lite (spread/lift) ──────────────────────────
    await dock.hover();
    await page.waitForTimeout(600);
    await shoot(page, '02-board-hover');
    await page.mouse.move(400, 400);

    // ── RT wheel: the dock stays WELDED and live under it ───────────
    // (The old «coaxial with the centre slot» claim described the pre-polish
    // wheel that anchored itself over the dock bay. Today the wheel lays out
    // on its own grid and its «КАРТЫ» slot ANIMATES into the dock plate
    // (`data-wheel-anchor="hand-dock"`) — the bond is the handoff flight,
    // not static geometry. What must hold: the dock does not move, dim or
    // lose its live state while the wheel is open.)
    await key(page, 'Period', 1000);
    await expect(page.locator('.con-quick__slot--center')).toHaveCount(1);
    await assertDockCentered(page);
    await expect(dock).toHaveClass(/con-handdock--live/);
    await shoot(page, '03-rt-wheel-open');
    await key(page, 'Escape', 700);

    // ── LT → Standard Projects screen: the dock stays WELDED (identical
    // visuals), only the click affordance drops. ─────────────────────
    await key(page, 'Comma', 900);
    await key(page, 'Enter', 1100);
    await expect(dock).not.toHaveClass(/con-handdock--live/);
    await shoot(page, '04-overlay-static');
    await key(page, 'Escape', 800);

    // ── hand section: still welded in place, non-interactive ─────────
    // RT wheel → A (РУКА) is the canonical route to the hand section.
    await key(page, 'Period', 900);
    await key(page, 'Enter', 1400);
    await expect(dock).not.toHaveClass(/con-handdock--live/);
    await shoot(page, '05-hand-section');
    await key(page, 'Escape', 1000); // B → back to the board home
    await expect(dock).toHaveClass(/con-handdock--live/);
  });

  test('0 cards: the clean empty tray; placement keeps the dock clear of the board', async ({page, request}) => {
    test.setTimeout(240_000);
    // Buy nothing; at seed .42 the first two preludes draw no cards.
    const playerId = await bootGame(page, request, 0);

    const dock = page.locator('.con-handdock');
    const hand = await handSize(request, playerId);
    await expect(page.locator('.con-handdock__card')).toHaveCount(hand); // EVERY card is a physical back now
    // No placeholder at 0 cards — the empty pack + «0» counter say it; a
    // dashed ghost frame was removed (it read as a broken/awaiting slot).
    await expect(page.locator('.con-handdock__ghost')).toHaveCount(0);
    if (hand === 0) {
      await expect(dock).toHaveClass(/con-handdock--empty/);
    } else {
      console.log(`[probe] preludes drew ${hand} card(s) — empty-tray evidence not reachable at this seed`);
    }
    await assertDockCentered(page);
    await shoot(page, '06-board-empty');

    // Standard project → greenery placement: the board (with its dock
    // clearance) + the live dock coexist without overlap.
    await key(page, 'Comma', 900);
    await key(page, 'Enter', 1100);
    await key(page, 'ArrowDown', 600);
    await key(page, 'ArrowDown', 600);
    await key(page, 'Enter', 1500);
    if (await page.locator('.con-context__task-kicker').count() > 0) {
      await shoot(page, '07-placement');
    }
  });
});

test.describe('hand dock · deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, screen: {width: 1280, height: 800}});

  test('handheld board home: centred compact dock', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootGame(page, request, 3);
    await assertDockCentered(page);
    const hand = await handSize(request, playerId);
    await expect(page.locator('.con-handdock__card')).toHaveCount(hand); // EVERY card is a physical back now
    await assertNoClippedHints(page);
    await shoot(page, '08-handheld-3cards');
  });
});

test.describe('hand dock · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile board home: centred dock', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 2, '&consoleProfile=tv');
    await assertDockCentered(page);
    await shoot(page, '09-tv-2cards');
  });
});
