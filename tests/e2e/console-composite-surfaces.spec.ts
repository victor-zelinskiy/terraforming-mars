import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE THREE PROMPTS THAT USED TO FALL THROUGH TO THE DESKTOP MODAL, over the
 * real DOM.
 *
 * `consoleTaskRouter`'s red list named them for months: the Venus alt-track
 * bonus and Stormcraft's spend-heat (both `composite`, both IN SCOPE, both with
 * a premium DESKTOP modal and no console-native one) and the planetary-event
 * thresholds. On a TV they broke the shell's whole language — a mouse-shaped
 * dialog with no pad contract, no workspace band and no source.
 *
 * The rules each surface applies are pinned by `compositePrompts.spec.ts`; what
 * THIS proves is that they mount as console-native surfaces at all: inside the
 * workspace band, with their own command contract on the ONE bottom bar, and
 * with the desktop modal gone.
 *
 * Route interception is the harness the decision / discard / Pluto probes
 * already use: walking a real game to a 30 % Venus step depends on the shuffle,
 * and the subject under test is the client layer.
 */

const OUT = path.resolve('screenshots', 'composite-surfaces');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Composer', color: 'red', beginner: false, handicap: 0, first: true}],
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
    automa: undefined,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, k: string, wait = 600): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Composer') ?? model.players[0]).id;
}


async function injectPrompt(page: Page, waitingFor: unknown): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.waitingFor = waitingFor;
    await route.fulfill({response, json: body});
  });
}

/**
 * The opening is SETUP — the subject is where each injected surface STANDS.
 * The shared driver ANSWERS the pregame over `player/input` and opens the
 * console on a live board (a real hand, a real dock).
 */
async function openGame(page: Page, request: APIRequestContext): Promise<void> {
  await bootSeededGame(page, request, await createGame(request), {buy: 2});
}

/** Every one of these surfaces must live in the band, not over the rail. */
async function expectsWorkspaceBand(page: Page, root: string): Promise<void> {
  const band = await page.locator(root).boundingBox();
  expect(band).not.toBeNull();
  expect(band!.x, 'the surface starts right of the player rail').toBeGreaterThan(60);
  // …and the desktop fallback modal is gone, not merely covered.
  expect(await page.locator('.mandatory-input-modal:not(.mandatory-input-modal--suppressed)').count(),
    'the desktop modal must not serve this prompt any more').toBe(0);
}

const amountOption = (title: string, max: number) =>
  ({type: 'amount', title, buttonLabel: 'Select', min: 0, max, maxByDefault: false});

test('spend heat: a bill, two lanes, and no way to overpay', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, {
    type: 'and',
    title: {message: 'Select how to spend ${0} heat', data: [{type: 1, value: '6'}]},
    buttonLabel: 'Save',
    spendHeatPrompt: {amount: 6},
    choiceContext: {source: {kind: 'corporation', card: 'Stormcraft Incorporated'}, mode: 'effect-choice'},
    options: [amountOption('Heat', 8), amountOption('Stormcraft Incorporated Floaters (2 heat each)', 3)],
  });
  await page.reload();
  await page.waitForSelector('.con-heat', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '1-spend-heat');

  await expectsWorkspaceBand(page, '.con-heat');
  await expect(page.locator('.con-lanes__kicker')).toContainText(/ПОТРАТИТЬ ТЕПЛО/i);
  // The BILL and its live coverage, in one place.
  await expect(page.locator('.con-lanes__meter')).toContainText('0');
  await expect(page.locator('.con-lanes__meter-target')).toHaveText('6');
  await expect(page.locator('.con-lanes__row')).toHaveCount(2);
  // …and WHO offered the floaters, with the real card face.
  expect(await page.locator('.con-heat .con-src .pcard, .con-heat .con-src .card-container').count()).toBeGreaterThan(0);

  // The pad contract is on the ONE bar — the panel draws no footer of its own.
  const bar = page.locator('.con-cmdbar, .con-commands').first();
  await expect(bar).toContainText(/МАКС/i);
  await expect(bar).toContainText(/Оплатить/i);
  await expect(bar).toContainText(/ИСТОЧНИК/i);

  // RT pours the whole bill onto the focused lane; the meter says so.
  await key(page, 'Period', 900);
  await shoot(page, '2-spend-heat-max');
  await expect(page.locator('.con-lanes__meter')).toHaveClass(/con-lanes__meter--ready/);
});

test('the Venus bonus: one flow — the wild first, then the placement', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, {
    type: 'or',
    title: 'Gain 3 resource(s) for your Venus track bonus.',
    buttonLabel: 'Save',
    venusBonusPrompt: {kind: 'final', baseCount: 2, wildCardTargets: ['Tardigrades']},
    options: [
      {type: 'and', title: '', buttonLabel: 'Save', options: [
        {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', cards: [{name: 'Tardigrades'}], min: 1, max: 1,
          showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false},
        {type: 'and', title: '', buttonLabel: 'Save', options: []},
      ]},
      {type: 'and', title: '', buttonLabel: 'Save', options: []},
    ],
  });
  await page.reload();
  await page.waitForSelector('.con-venus', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '3-venus-wild');

  await expectsWorkspaceBand(page, '.con-venus');
  // STAGE 1: the wild's destination, with a real question.
  await expect(page.locator('.con-lanes__title')).toContainText(/дополнительный ресурс/i);
  await expect(page.locator('.con-venus__opt')).toHaveCount(2);
  // The breadcrumb names the stage, and the root never moves.
  await expect(page.locator('.con-lanes__kicker')).toContainText(/БОНУС ВЕНЕРЫ/i);
  await expect(page.locator('.con-lanes__crumb-stage')).toHaveText(/ДОПОЛНИТЕЛЬНЫЙ РЕСУРС/i);

  // A on the SECOND branch («take one more standard resource») folds the wild
  // into the budget and drops straight to the lanes — 2 + 1 = 3.
  await key(page, 'ArrowDown', 500);
  await key(page, 'Enter', 900);
  await shoot(page, '4-venus-place');
  await expect(page.locator('.con-lanes__row')).toHaveCount(6);
  await expect(page.locator('.con-lanes__meter-target')).toHaveText('3');
  await expect(page.locator('.con-lanes__crumb-stage')).toHaveText(/РАЗМЕЩЕНИЕ/i);
  // …and the decision the player just made stays visible.
  await expect(page.locator('.con-venus__wild-recap')).toHaveCount(1);

  // B is ONE logical level: back to the wild question, bonus intact.
  await key(page, 'Escape', 900);
  await expect(page.locator('.con-venus__opt')).toHaveCount(2);
});

test('the planetary thresholds: every row says what it DOES', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, {
    type: 'aresGlobalParameters',
    title: 'Adjust Ares global parameters up to 1 step.',
    buttonLabel: 'Save',
    aresData: {
      includeHazards: true,
      milestoneResults: [],
      hazardData: {
        erosionOceanCount: {threshold: 3, available: true},
        removeDustStormsOceanCount: {threshold: 6, available: true},
        severeErosionTemperature: {threshold: -6, available: true},
        severeDustStormOxygen: {threshold: 8, available: false},
      },
    },
  });
  await page.reload();
  await page.waitForSelector('.con-ares', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '5-ares-thresholds');

  await expectsWorkspaceBand(page, '.con-ares');
  // A threshold that already FIRED is absent, not a greyed row.
  await expect(page.locator('.con-ares__row')).toHaveCount(3);
  // Diegetic: the expansion's name never appears on screen.
  await expect(page.locator('.con-ares__panel')).not.toContainText(/Ares|Арес/i);
  // Every row carries its consequence, not just a number.
  await expect(page.locator('.con-ares__effect').first()).not.toHaveText('');
  // Standing pat is a real answer, and the surface says so.
  await expect(page.locator('.con-ares__count')).toContainText(/БЕЗ ИЗМЕНЕНИЙ/i);

  // RB shifts the focused threshold by one; °C moves TWO degrees.
  await key(page, 'ArrowDown', 400);
  await key(page, 'ArrowDown', 400);
  await key(page, 'KeyE', 800); // RB
  await shoot(page, '6-ares-shifted');
  const temp = page.locator('.con-ares__row').nth(2);
  await expect(temp).toHaveClass(/con-ares__row--changed/);
  await expect(temp.locator('.con-ares__next')).toHaveText('-4°C');
  await expect(page.locator('.con-ares__count')).toContainText(/1/);
});
