import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console-native PROMPT ADMISSION · one response, one demand on the player.
 *
 * Experimental Forest (prelude) draws 2 plant-tag cards AND places a greenery.
 * The executor draws SYNCHRONOUSLY and only DEFERS the placement, so a single
 * server response carries `cardDrawReveals` and `waitingFor = SelectSpace`
 * together.
 *
 * The regression this guards: the console played both at once — the drawn-cards
 * reveal assembled over a board that had ALREADY gone live for the greenery,
 * force-switching the section and closing every layer underneath. Two demands in
 * one frame from one play.
 *
 * The contract (consolePromptAdmission.ts): while the reveal owns the
 * foreground the board stays DARK, and the placement comes alive only once the
 * draw beat has fully finished.
 */

const OUT_DIR = path.resolve('screenshots', 'console-prompt-admission');

/** A deterministic solo game whose FIRST dealt prelude is the one we want. */
function newGameConfig(customPreludes: Array<string>, prelude = true) {
  return {
    players: [{name: 'AdmissionTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude, prelude2: false, turmoil: false, community: false,
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
    // Deck.shuffle(cardsOnTop) pushes [...rest, ...top] and draw() pops from the
    // END — so these are dealt FIRST, landing on the wizard's focused slot.
    customPreludes,
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
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/**
 * Move the wizard's card cursor onto a NAMED card and pick it. The grid is
 * pad-driven (no click handler), so this walks the focus — `data-zoom-slot`
 * carries the English CardName, `--focused` / `--picked` carry the state.
 */
async function pickCard(page: Page, cardName: string): Promise<boolean> {
  const slot = page.locator(`[data-zoom-slot="${cardName}"]`).first();
  for (let i = 0; i < 34; i++) {
    if (await slot.count() === 0) {
      return false;
    }
    const cls = await slot.getAttribute('class') ?? '';
    if (cls.includes('con-cards__slot--picked')) {
      return true;
    }
    if (cls.includes('con-cards__slot--focused')) {
      await key(page, 'Enter', 700);
      continue;
    }
    await key(page, i % 6 === 5 ? 'ArrowDown' : 'ArrowRight', 220);
  }
  return false;
}

/**
 * Walk the start wizard, picking the NAMED preludes whenever their step is up.
 * Everything else alternates A (pick the focused item) / RT («СЛЕД. ШАГ»).
 */
async function walkWizard(page: Page, preludes: Array<string>): Promise<void> {
  const frame = page.locator('.con-start__frame');
  for (let guard = 0; guard < 40 && await frame.count() > 0; guard++) {
    let picked = false;
    for (const name of preludes) {
      const slot = page.locator(`[data-zoom-slot="${name}"]`).first();
      if (await slot.count() === 0) {
        continue;
      }
      const cls = await slot.getAttribute('class') ?? '';
      // Only the wizard's PICK grid — not the post-pick play rail.
      if (!cls.includes('con-cards__slot') || cls.includes('con-cards__slot--picked')) {
        continue;
      }
      picked = await pickCard(page, name) || picked;
    }
    if (picked) {
      await key(page, 'Period', 1100); // the named picks are in — next step
      continue;
    }
    // STATE-AWARE advance: a blind A/RT alternation buys projects (spawning a
    // payment task) and can stall on the summary. Read the active step: the
    // FIRST step needs a pick (corp), the LAST one launches, the rest skip.
    const stage = await page.evaluate(() => {
      const steps = [...document.querySelectorAll('.con-start__step')];
      return {
        active: steps.findIndex((s) => s.classList.contains('con-start__step--active')),
        steps: steps.length,
      };
    });
    if (stage.steps === 0) {
      await key(page, 'Enter', 1100); // a sequence beat (play corp / prelude)
    } else if (stage.active === 0) {
      await key(page, 'Enter', 1000);
      await key(page, 'Period', 1000);
    } else if (stage.active === stage.steps - 1) {
      await key(page, 'Enter', 1400); // summary → launch
    } else {
      await key(page, 'Period', 1000);
    }
  }
}

async function openGame(page: Page, request: any, preludes: Array<string>, prelude = true): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig(preludes, prelude)});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
}

test.describe('console prompt admission · a draw and a placement in ONE response', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the board stays dark while the drawn-cards reveal owns the foreground', async ({page, request}) => {
    test.setTimeout(300_000);

    // Both custom preludes land on the two focused slots the walk picks, so
    // Experimental Forest is played whichever way `inplaceShuffle` orders the
    // pair. Metals Company is pure production — it can't raise a prompt.
    await openGame(page, request, ['Experimental Forest', 'Metals Company']);

    const reveal = page.locator('.con-reveal');
    const boardLive = page.locator('.con-board--live');

    await walkWizard(page, ['Experimental Forest', 'Metals Company']);

    // The preludes resolve as the game starts — Experimental Forest's response
    // carries the reveal AND the greenery SelectSpace together. A (Enter) plays
    // the focused prelude off the rail.
    let sawReveal = false;
    for (let i = 0; i < 40 && !sawReveal; i++) {
      if (await reveal.count() > 0) {
        sawReveal = true;
        break;
      }
      await key(page, 'Enter', 900);
    }

    await shoot(page, '01-reveal-up');
    expect(sawReveal, 'the drawn-cards reveal never appeared — was Experimental Forest played?').toBeTruthy();

    // ── THE ASSERTION ──────────────────────────────────────────────────────
    // The greenery SelectSpace is already pending in the same payload. The board
    // must NOT be live: no placement cursor, no available-cell highlight, no
    // forced section switch. Before the fix this was 1 and the hexes glowed.
    expect(await boardLive.count(), 'the board went LIVE for the greenery while the reveal was up').toBe(0);
    expect(await page.locator('.board-space--available').count(),
      'the hex highlight was painted under the reveal modal').toBe(0);

    // Answer the reveal (A takes each card; it closes when the batch is done)
    // and let the intake flights land in the dock.
    for (let i = 0; i < 8 && await reveal.count() > 0; i++) {
      await key(page, 'Enter', 900);
    }
    await page.waitForTimeout(4000);
    await shoot(page, '02-after-reveal');

    // ── AND THEN the placement gets its turn, on its own. ──────────────────
    expect(await reveal.count(), 'the reveal never closed').toBe(0);
    await expect(page.locator('.con-board--live')).toHaveCount(1, {timeout: 20_000});
    expect(await page.locator('.con-context').innerText()).toContain('РАЗМЕЩЕНИЕ ТАЙЛА');
    await shoot(page, '03-placement-live');
  });

  test('a plain placement with no draw still comes alive immediately', async ({page, request}) => {
    test.setTimeout(300_000);

    // NO preludes — the short corp → buy → start wizard, then the standard
    // Greenery project. Nothing draws, so the placement must come alive at once.
    await openGame(page, request, [], false);

    await walkWizard(page, []);
    await page.waitForTimeout(2500);
    expect(await page.locator('.con-start__frame').count(), 'start wizard never completed').toBe(0);

    // LT wheel → Standard Projects → «Озеленение» (2 rows down) → placement.
    await key(page, 'Comma', 1200);
    await key(page, 'Enter', 1500);
    await key(page, 'ArrowDown', 500);
    await key(page, 'ArrowDown', 500);
    await key(page, 'Enter', 2500);
    await shoot(page, '10-plain-placement');

    await expect(page.locator('.con-board--live')).toHaveCount(1, {timeout: 20_000});
    expect(await page.locator('.con-context').innerText()).toContain('РАЗМЕЩЕНИЕ ТАЙЛА');
    expect(await page.locator('.board-space--available').count(),
      'no cells were offered for a plain greenery placement').toBeGreaterThan(0);
  });
});
