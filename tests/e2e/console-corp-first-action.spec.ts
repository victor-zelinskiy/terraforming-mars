import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console-native · the corporation's MANDATORY FIRST ACTION modal.
 *
 * Drives a real solo game (Tharsis Republic forced via customCorporationsList)
 * through the console start wizard to the player's first turn, where the
 * `corporationInitialAction` prompt must now be served by the DEDICATED
 * confirm modal (ConsoleCorpFirstActionConfirm) — the play composer's
 * mandatory sibling — and NOT by the «Разыграно» table's retired action mode.
 *
 * Asserts: the mandatory framing (kicker + badge), the printed first-action
 * ask, the honest post-confirm follow-up note, the corporation card on the
 * left, the played table NOT mounted, and that A submits the OrOptions option
 * (the modal yields to the city-placement follow-up).
 */

const OUT_DIR = path.resolve('screenshots', 'console-corp-first-action');

/** A deterministic solo game whose only dealable corp is Tharsis Republic. */
function newGameConfig() {
  return {
    players: [{name: 'FirstActionTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      // No preludes: the start wizard stays short (corp → buy → start).
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
    // Exactly ONE dealable corporation — the wizard's corp step is forced to
    // Tharsis Republic, whose first action ("Place a city tile") exercises the
    // modal's ask + the placement follow-up note.
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['Tharsis Republic'],
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
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/**
 * The right key for whatever the start wizard is CURRENTLY showing (read the
 * DOM fresh each iteration rather than assuming a fixed press count — the
 * corp pick's hero animation has variable timing, so a blind index-based
 * cycle races it and can land an Enter on the projects step, toggling a card
 * on instead of leaving the zero-project buy alone).
 *
 * Step navigation lives on the TRIGGERS (`START_INPUT_OVERRIDES` in
 * ConsoleStartScene.vue remaps triggerR/Period to `nextSection`), not the
 * bumpers — `KeyE` (RB) is a no-op here. `Period` (RT) advances the
 * multi-pick projects step; every other surface (the single-pick corp step,
 * the summary's launch CTA — pressed twice for the zero-projects
 * double-confirm — and the ceremony's corp-play prompt) is driven by `Enter`.
 */
async function currentWizardKey(page: Page): Promise<string> {
  if (await page.locator('.con-start__summary-cards').count() > 0) {
    return 'Enter';
  }
  const activeIdx = await page.locator('.con-start__step').evaluateAll(
    (els) => els.findIndex((el) => el.classList.contains('con-start__step--active')),
  );
  // Step 0 (corp) is single-pick: Enter both commits and advances. Any later
  // step (projects, in this fixed config) is multi-pick: Period advances.
  // -1 (no rail — the ceremony's own prompts) also falls back to Enter.
  return activeIdx <= 0 ? 'Enter' : 'Period';
}

test.describe('console corp first-action modal', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the mandatory first action is served by the dedicated modal, not the played table', async ({page, request}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(3500);

    // Walk the start wizard adaptively (see currentWizardKey) until the start
    // scene is gone — this also carries the corporation-play press.
    const startScene = page.locator('.con-start__frame');
    for (let i = 0; i < 24 && await startScene.count() > 0; i++) {
      await key(page, await currentWizardKey(page), 1100);
    }
    expect(await startScene.count(), 'start wizard never completed').toBe(0);

    // The player's first turn: the corporationInitialAction prompt must mount
    // the DEDICATED modal (presence is derived — no imperative open). It is an
    // INTERRUPTIVE mandatory decision (consoleMandatoryGate.ts scopes
    // corpFirstAction as always-gated), so the shell first shows the
    // announce card (ConsoleMandatoryAnnounce, `.con-mandatory`) instead of
    // auto-opening it — A opens it.
    const modal = page.locator('.con-composer--corpfirst');
    const announce = page.locator('.con-mandatory');
    for (let i = 0; i < 10 && await modal.count() === 0; i++) {
      if (await announce.count() > 0) {
        await key(page, 'Enter', 800);
      } else {
        await page.waitForTimeout(800);
      }
    }
    await modal.waitFor({state: 'visible', timeout: 60_000});
    await page.waitForTimeout(1500); // entry transition settles
    await shoot(page, '01-first-action-modal');

    // The retired serving surface must NOT be mounted.
    expect(await page.locator('.con-played').count(), 'the played table must not serve the first action anymore').toBe(0);

    // Mandatory framing: the kicker + the badge.
    const kicker = await page.locator('.con-composer__kicker--mandatory').innerText();
    expect(kicker).toContain('ОБЯЗАТЕЛЬНОЕ ДЕЙСТВИЕ КОРПОРАЦИИ');
    const badge = (await page.locator('.con-composer__paytag--mandatory').innerText()).toUpperCase();
    expect(badge).toContain('ОБЯЗАТЕЛЬНО');

    // The printed first-action ask is shown (Tharsis: place a city tile).
    const ask = await page.locator('.con-composer__corpfirst-ask').innerText();
    expect(ask.trim()).not.toBe('');
    expect(ask).toContain('тайл города');

    // The honest post-confirm follow-up note — and it NAMES the tile: Tharsis
    // Republic's free city is «разместите тайл города», not a mute "pick a spot".
    const notes = await page.locator('.con-composer--corpfirst .con-composer__next').allInnerTexts();
    expect(notes.join(' ')).toContain('тайл города');
    // The row carries the tile pictogram, so the shared «ДАЛЕЕ» presenter really ran.
    expect(await page.locator('.con-composer--corpfirst .con-composer__next-tile').count()).toBeGreaterThan(0);

    // The corporation card renders as the modal's artifact (premium face).
    expect(await page.locator('.con-composer--corpfirst .con-composer__playcard :is(.card-container, .pcard)').count()).toBeGreaterThan(0);

    // The CTA names the action; A submits the OrOptions option.
    const cta = await page.locator('.con-composer--corpfirst .con-composer__cta-label').innerText();
    expect(cta.toUpperCase()).toContain('ВЫПОЛНИТЬ ПЕРВОЕ ДЕЙСТВИЕ');
    await key(page, 'Enter', 2500);

    // The modal yields to the action's own follow-up — the city placement.
    await modal.waitFor({state: 'detached', timeout: 30_000});
    const panel = page.locator('.con-context');
    let placing = false;
    for (let i = 0; i < 20 && !placing; i++) {
      placing = (await panel.innerText().catch(() => '')).includes('РАЗМЕЩЕНИЕ ТАЙЛА');
      if (!placing) {
        await page.waitForTimeout(600);
      }
    }
    await shoot(page, '02-city-placement-follow-up');
    expect(placing, 'the city placement follow-up never opened').toBeTruthy();
  });
});
