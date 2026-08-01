import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * CONVERT PLANTS NAMES ITSELF — over the real DOM.
 *
 * The basic action «потратить 8 растений» opens a board placement, and its
 * context panel showed no source at all. The marker existed all along
 * (`ConvertPlants` sets `cancellablePlacement(...)`) — but the placement is a
 * NESTED branch of the action-menu `OrOptions`, and `ServerModel.getWaitingFor`
 * decorates the TOP-LEVEL prompt only, so it never reached the client. The same
 * trap `discardPrompt` already paid for; the marker now rides
 * `SelectSpace.toModel()` and survives any depth.
 *
 * This probe drives the REAL basic action — no interception — so it proves the
 * whole chain: server marker → nested serialization → chip → L3.
 */

const OUT = path.resolve('screenshots', 'convert-plants-source');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Gardener', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4, automa: undefined,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}
async function key(page: Page, code: string, settle = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console placement panel · convert plants', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the basic action names itself as the source, and L3 opens it', async ({page, request}) => {
    test.setTimeout(300_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // testMode grants 500 of every resource, so the plants are already there.
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};

    await page.goto(`/player?id=${model.players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(3500);

    const startScene = page.locator('.con-start__frame');
    for (let i = 0; i < 24 && await startScene.count() > 0; i++) {
      const text = await startScene.innerText().catch(() => '');
      let press: string;
      if (/Заплатить|Начать|НАЧАТЬ|ОПЛАТИТЬ/.test(text)) {
        press = 'Enter';
      } else if (/для покупки/i.test(text)) {
        press = 'Period';
      } else {
        press = i % 2 === 0 ? 'Enter' : 'Period';
      }
      await key(page, press, 1400);
    }
    await page.waitForTimeout(2500);
    expect(await startScene.count(), 'start wizard never completed').toBe(0);

    const rootText = () => page.locator('.con-root').innerText().catch(() => '');
    if (/ПОКУПКА КАРТ/.test(await rootText())) {
      await key(page, 'Escape', 3200);
      for (let i = 0; i < 4 && /ПРОПУСТИТЬ/.test(await rootText()); i++) {
        await key(page, 'Enter', 2600);
      }
      await page.waitForTimeout(1500);
    }

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» is the LEFT slot of the basic actions.
    // The wheel is PRESS→RELEASE: the direction ARMS the slot on key-down and
    // FIRES it on key-up, so the arrow alone activates it. (An extra Enter
    // afterwards lands on the placement that just opened and commits the tile
    // at whatever cell is selected — which is how this probe first "lost" the
    // whole placement step.)
    await key(page, 'Comma', 1400);
    await shoot(page, '1-basic-actions');
    await key(page, 'ArrowLeft', 2600);
    await shoot(page, '2-convert-plants-placement');

    const panel = page.locator('.con-context');
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'never reached the board placement').toBeTruthy();

    // THE FIX: the nested marker arrives, so the panel names the basic action.
    const chip = panel.locator('.con-src');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveClass(/con-src--chip/);
    // The CARD's own name («Конвертировать растения»), not the wheel's label
    // for the same action («Потратить растения») — the chip names the object
    // L3 will open, so the two must agree with the card, not with the menu.
    await expect(chip.locator('.con-src__plate-name')).toContainText(/Конвертировать растения|Convert Plants/i);
    await expect(panel.locator('.con-context__source-hint')).toHaveCount(1);
    await expect(page.locator('.con-cmdbar, .con-commands').first()).toContainText(/ИСТОЧНИК/i);

    // …and the marker's OTHER half arrives with it: this placement is genuinely
    // cancellable (the plants are spent only once a cell is chosen).
    await expect(panel).toContainText(/Отменить размещение/i);

    // L3 opens the real standard-action card; the placement survives.
    await key(page, 'KeyC', 1800);
    await shoot(page, '3-convert-plants-source-fullscreen');
    await expect(page.locator('.con-zoom')).toHaveCount(1);
    await key(page, 'Escape', 1600);
    await expect(page.locator('.con-zoom')).toHaveCount(0);
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'the placement survives the viewer').toBeTruthy();
  });
});
