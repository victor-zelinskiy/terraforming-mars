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


async function injectPrompt(
  page: Page,
  waitingFor: unknown,
  /**
   * The viewer's TABLEAU, for prompts that point at cards already on the table.
   * The shared played-target selector resolves every candidate's physical owner
   * from the live tableaux — that is what makes it a picker over the TABLE and
   * not a list of names — so a prompt whose candidates nobody owns is not a
   * smaller fixture, it is a shape the server never sends.
   */
  tableau?: ReadonlyArray<{name: string, resources?: number}>,
): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.waitingFor = waitingFor;
    if (tableau !== undefined) {
      body.thisPlayer.tableau = tableau;
      const self = (body.players ?? []).find((p: {color: string}) => p.color === body.thisPlayer.color);
      if (self !== undefined) {
        self.tableau = tableau;
      }
    }
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

  // …and the LAST B is «СВЕРНУТЬ»: the panel folds away and the board-home
  // card is the ONE door back. It shipped without that door — the surface
  // hides itself on the deferred flag and the restore card enumerated three
  // task families, none of them this one, so the bonus was unreachable for
  // the rest of the session (and silently: a deferred task is never stranded).
  await key(page, 'Escape', 1200);
  await expect(page.locator('.con-venus')).toHaveCount(0);
  await shoot(page, '4b-venus-minimized');
  const restore = page.locator('[data-test="con-mandatory-announce"]');
  await expect(restore).toBeVisible();
  await expect(restore).toContainText(/БОНУС ВЕНЕРЫ/i);
  await expect(restore).toContainText(/вернуться к бонусу/i);
  // A brings the very same decision back.
  await key(page, 'Enter', 1200);
  await expect(page.locator('.con-venus')).toBeVisible();
  await expect(page.locator('.con-venus__opt')).toHaveCount(2);
  await shoot(page, '4c-venus-restored');
});

test('a one-step bill is a radio too — the same gesture, the bill kept', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, {
    type: 'and',
    title: {message: 'Select how to spend ${0} heat', data: [{type: 1, value: '1'}]},
    buttonLabel: 'Save',
    spendHeatPrompt: {amount: 1},
    choiceContext: {source: {kind: 'corporation', card: 'Stormcraft Incorporated'}, mode: 'effect-choice'},
    options: [amountOption('Heat', 8), amountOption('Stormcraft Incorporated Floaters (2 heat each)', 3)],
  });
  await page.reload();
  await page.waitForSelector('.con-heat', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '9-heat-single');

  // The DIALS go (0 / 1 is not a number worth a stepper) — but the BILL stays:
  // a payment always states what it costs.
  await expect(page.locator('.con-lanes__dial')).toHaveCount(0);
  await expect(page.locator('.con-lanes__meter-target')).toHaveText('1');
  await expect(page.locator('.con-lanes__blocked')).toContainText(/выберите, чем оплатить/i);

  const bar = page.locator('.con-cmdbar, .con-commands').first();
  await expect(bar).toContainText(/ДОБАВИТЬ/i);
  await expect(bar).not.toContainText(/МАКС/i);

  // Heat covers it exactly; the floater covers it too (wasteful, and legal —
  // dropping it would leave the bill unpaid), so both are whole answers.
  await key(page, 'Enter', 700);
  await expect(page.locator('.con-lanes__meter')).toHaveClass(/con-lanes__meter--ready/);
  await expect(bar).toContainText(/СНЯТЬ/i);
  await key(page, 'ArrowDown', 400);
  await key(page, 'Enter', 700);
  await shoot(page, '10-heat-single-floater');
  await expect(page.locator('.con-lanes__row--active')).toHaveCount(1);
  await expect(page.locator('.con-lanes__pays').nth(1)).toContainText('2');
});

/*
 * THE COMMON SHAPE. A Venus step usually hands over ONE resource, and a budget
 * stepper is the wrong instrument for a decision that is really «which one»: the
 * player counts a dial to 1 and then hunts for the confirm. The surface asks the
 * pure engine (`budgetSingleStep`) and becomes a radio instead.
 */
test('one resource: the lanes become a radio — A places it, X takes it', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, {
    type: 'and',
    title: 'Gain 1 resource(s) for your Venus track bonus.',
    buttonLabel: 'Save',
    venusBonusPrompt: {kind: 'standard', baseCount: 1},
    // The base bonus is `GainResources`'s bare six-amount `and`, in unit order.
    options: [
      amountOption('M€', 1), amountOption('Steel', 1), amountOption('Titanium', 1),
      amountOption('Plants', 1), amountOption('Energy', 1), amountOption('Heat', 1),
    ],
  });
  await page.reload();
  await page.waitForSelector('.con-venus', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '7-venus-single');

  await expectsWorkspaceBand(page, '.con-venus');
  await expect(page.locator('.con-lanes__row')).toHaveCount(6);
  // The BUDGET chrome is gone: no meter to read, no «+1» counter to parse.
  await expect(page.locator('.con-lanes__meter')).toHaveCount(0);
  await expect(page.locator('.con-lanes__delta')).toHaveCount(0);
  await expect(page.locator('.con-lanes__blocked')).toContainText(/выберите, куда положить/i);

  // ONE verb on the bar, and none of the stepper ones.
  const bar = page.locator('.con-cmdbar, .con-commands').first();
  await expect(bar).toContainText(/ДОБАВИТЬ/i);
  await expect(bar).not.toContainText(/МАКС/i);
  await expect(bar).toContainText(/ЗАБРАТЬ/i);

  // A puts the resource on the focused lane; the row says so and the verb flips.
  await key(page, 'ArrowDown', 400);
  await key(page, 'Enter', 700);
  await shoot(page, '8-venus-single-picked');
  const steel = page.locator('.con-lanes__row').nth(1);
  await expect(steel).toHaveClass(/con-lanes__row--active/);
  await expect(steel.locator('.con-lanes__next')).toHaveCount(1);
  await expect(bar).toContainText(/СНЯТЬ/i);
  await expect(page.locator('.con-lanes__blocked')).toHaveCount(0);

  // …and A on ANOTHER lane MOVES it (a second unit is impossible), so the
  // gesture is never a dead press.
  await key(page, 'ArrowDown', 400);
  await key(page, 'Enter', 700);
  await expect(page.locator('.con-lanes__row--active')).toHaveCount(1);
  await expect(page.locator('.con-lanes__row').nth(2)).toHaveClass(/con-lanes__row--active/);
  // The chosen row keeps its mark once the cursor moves on.
  await key(page, 'ArrowUp', 400);
  await expect(page.locator('.con-lanes__tick')).toHaveCount(1);
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

/**
 * THE WILD'S HOST CARD — on the ONE picker, at 4K.
 *
 * This stage used to be a Venus-owned strip: a flex row with `overflow-x`, a
 * fixed `zoom`, an index cursor and nothing but card faces. Past four
 * candidates the rest lived off the panel, and no reading of any kind was
 * offered — no `было → стало`, no ПО, no status rail. It now hands the
 * server's own `SelectCard` to `ConsolePlayedTargetStep`, the same step the
 * card-play composer, the blue-action composer, the colony payout, the hydro
 * stage and the bot attack all point their targets with.
 *
 * At 3840×2160 on purpose: a fit claim asserted at one resolution is a claim
 * about one resolution, and the TV profile is where the old strip cropped.
 */
test.describe('the Venus wild resource: the SHARED target picker', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

  const WILD_TARGETS = [
    'Tardigrades', 'Birds', 'Fish', 'Pets', 'Livestock',
    'Ants', 'Decomposers', 'Extreme-Cold Fungus', 'Search For Life',
  ];

  test('every candidate is reachable, reads «было → стало», and nothing is cropped', async ({page, request}) => {
    test.setTimeout(240_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await openGame(page, request);

    await injectPrompt(page, {
      type: 'or',
      title: 'Gain 1 resource(s) for your Venus track bonus.',
      buttonLabel: 'Save',
      venusBonusPrompt: {
        kind: 'final',
        baseCount: 1,
        wildCardTargets: WILD_TARGETS,
        // The SERVER's per-candidate ПО reading — Birds scores per animal (it
        // moves), Tardigrades per FOUR microbes (at 1 it does not).
        wildCardVp: {'Birds': {from: 2, to: 3}, 'Tardigrades': {from: 0, to: 0}},
      },
      options: [
        {type: 'and', title: '', buttonLabel: 'Save', options: [
          {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', min: 1, max: 1,
            showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
            cards: WILD_TARGETS.map((name, i) => ({name, resources: i === 1 ? 2 : i}))},
          {type: 'and', title: '', buttonLabel: 'Save', options: []},
        ]},
        {type: 'and', title: '', buttonLabel: 'Save', options: []},
      ],
    }, WILD_TARGETS.map((name, i) => ({name, resources: i === 1 ? 2 : i})));
    await page.reload();
    await page.waitForSelector('.con-venus', {state: 'visible', timeout: 40_000});
    await page.waitForTimeout(1200);

    // A on the FIRST branch — «положите его на карту».
    await key(page, 'Enter', 1200);
    await shoot(page, '9-venus-wild-picker');

    // THE SHARED STEP, and no Venus strip anywhere.
    await expect(page.locator('.con-ptsel')).toBeVisible();
    expect(await page.locator('.con-venus__cards').count(), 'the old strip is gone').toBe(0);
    // The panel header states the ask, so the step must not restate it.
    expect(await page.locator('.con-ptsel__contract').count()).toBe(0);
    await expect(page.locator('.con-lanes__kicker')).toContainText(/БОНУС ВЕНЕРЫ/i);
    // The tail names THIS stage, never the one after it.
    await expect(page.locator('.con-lanes__crumb-stage')).toHaveText(/ЦЕЛЬ/i);

    // EVERY authoritative candidate is on screen — the reported bug.
    await expect(page.locator('[data-ptsel-cell]')).toHaveCount(WILD_TARGETS.length);

    // …and none of them is cropped, off the panel, or behind a scrollbar.
    const fit = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.con-lanes__panel');
      const step = document.querySelector<HTMLElement>('.con-ptsel');
      if (panel === null || step === null) {
        return undefined;
      }
      const pr = panel.getBoundingClientRect();
      const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-ptsel-cell]'));
      const outside = cells.filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width < 40 || b.height < 40 ||
          b.left < pr.left - 1 || b.right > pr.right + 1 ||
          b.top < pr.top - 1 || b.bottom > pr.bottom + 1;
      }).length;
      const hScrollers = Array.from(step.querySelectorAll<HTMLElement>('*'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
        .map((el) => el.className);
      const w = cells[0]?.getBoundingClientRect().width ?? 0;
      return {outside, hScrollers, cardW: w, panelW: pr.width, panelH: pr.height,
        vw: window.innerWidth, rootScrollW: document.documentElement.scrollWidth};
    });
    expect(fit, 'the picker mounted').toBeDefined();
    expect(fit!.outside, 'no candidate leaves the panel').toBe(0);
    expect(fit!.hScrollers, 'a horizontal scrollbar in this step is the old bug').toEqual([]);
    expect(fit!.rootScrollW, 'the page itself never scrolls').toBeLessThanOrEqual(fit!.vw + 1);
    // …and the cards stay READABLE on a TV rather than shrinking to fit.
    expect(fit!.cardW, 'a candidate is still a card, not a chip').toBeGreaterThan(180);

    // THE STATUS RAIL — the reading the old strip never had.
    const rail = page.locator('.con-ptsel__rail');
    await expect(rail).toBeVisible();
    await expect(rail).toContainText(/0\s*→\s*1/);

    // Walk to the candidate whose ПО the wild actually moves: the rail states
    // it, and the one whose points do NOT move states no ПО at all.
    await key(page, 'ArrowRight', 700);
    await shoot(page, '10-venus-wild-focus');
    await expect(rail).toContainText(/2\s*→\s*3/);
    await expect(rail).toContainText(/ПО/);
    await key(page, 'ArrowLeft', 700);
    expect((await rail.textContent() ?? '').includes('ПО'),
      'a ПО reading that does not move is not printed').toBe(false);

    // A locks the focused card and the flow advances to the placement — the
    // crumb only ever gains a tail.
    await key(page, 'Enter', 900);
    await expect(page.locator('.con-lanes__crumb-stage')).toHaveText(/РАЗМЕЩЕНИЕ/i);
    await expect(page.locator('.con-venus__wild-recap')).toHaveCount(1);
    await shoot(page, '11-venus-wild-placed');

    // B is ONE logical level: back INTO the picker, with the pick still made.
    await key(page, 'Escape', 900);
    await expect(page.locator('.con-ptsel')).toBeVisible();
    await expect(page.locator('.con-ptsel__slot--locked')).toHaveCount(1);
    await shoot(page, '12-venus-wild-reopened');
  });
});
