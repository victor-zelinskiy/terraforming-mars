import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE RESOURCE-DISTRIBUTE SURFACE (`SelectResources` — Philares, the behavior
 * DSL's `standardResource`), over the real DOM.
 *
 * Two rules of the reworked surface, both unreachable from testmode (a test
 * party owns ~500 of everything, so the shipped stock-cap bug could never be
 * reproduced there — route interception is the only honest driver):
 *
 *  1 · A GAIN IS CAPPED BY THE BUDGET ALONE. The server validates nothing but
 *      the sum, so a player with an EMPTY pool must still be able to put the
 *      whole reward there. The old surface capped every lane by the stock it
 *      was about to increase — «0 / 0», dead RB, the reward refused.
 *  2 · ONE unit is a RADIO, not six dials: A places / takes back (the same
 *      pattern the Venus-bonus and spend-heat surfaces speak), X commits, and
 *      −1 / +1 / MAX are not advertised.
 *
 * The client half of the prompt's ATTRIBUTION (source dock, trigger line, L3)
 * is `console-prompt-source.spec.ts`; this spec owns the lane arithmetic and
 * the pad grammar.
 */

const OUT = path.resolve('screenshots', 'resource-distribute');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    // promo OFF on purpose: the probe INJECTS the prompt (see
    // console-prompt-source.spec.ts — enabling promo only lengthens the start
    // wizard and made the driver time out).
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Gainer', color: 'red', beginner: false, handicap: 0, first: true}],
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

async function key(page: Page, k: string, wait = 500): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Gainer') ?? model.players[0]).id;
}

/**
 * Serve the Philares distribution prompt with an EMPTIED stock — the state
 * testmode cannot produce, and exactly the one the old per-lane stock cap
 * broke on. Returns a recorder of everything POSTed to `player/input` (the
 * submit route answers with the same model, prompt cleared, so the flow
 * genuinely completes client-side).
 */
async function injectPhilaresPrompt(page: Page, count: number): Promise<{submits: Array<unknown>}> {
  const captured = {
    submits: [] as Array<unknown>,
    lastModel: undefined as Record<string, unknown> | undefined,
    // A stub must stay consistent with its own answers: once the submit said
    // «the prompt is gone», the model route may not re-inject it on the next
    // poll (tests.md — the console-card-discard lesson).
    answered: false,
  };
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const unit of ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']) {
      body.thisPlayer[unit] = 0;
    }
    if (captured.answered) {
      delete body.waitingFor;
    } else {
      body.waitingFor = {
        type: 'resources',
        title: {message: 'Gain ${0} standard resources', data: [{type: 1, value: String(count)}]},
        buttonLabel: 'Select',
        count,
        choiceContext: {
          source: {kind: 'corporation', card: 'Philares'},
          trigger: {
            message: '${0}\'s tile landed next to yours. New adjacencies: ${1}',
            data: [{type: 2, value: 'Bot'}, {type: 1, value: String(count)}],
          },
          mode: 'reward',
        },
      };
    }
    captured.lastModel = body;
    await route.fulfill({response, json: body});
  });
  // The submit: record the payload, answer with the same view minus the prompt.
  await page.route('**/player/input*', async (route) => {
    captured.submits.push(route.request().postDataJSON());
    captured.answered = true;
    const model = {...(captured.lastModel ?? {})};
    delete model.waitingFor;
    await route.fulfill({json: model});
  });
  return captured;
}

test('one resource is a RADIO — A places and takes back, X commits, no stock cap', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await bootSeededGame(page, request, await createGame(request), {buy: 2});
  const captured = await injectPhilaresPrompt(page, 1);
  await page.reload();
  await page.waitForSelector('.con-task', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '1-radio-open');

  // The RADIO shape: no meter, no stepper verbs, an A verb on the bar; every
  // lane shows its stock as a READING (no «/ max» denominator anywhere).
  await expect(page.locator('.con-task__dist-target')).toHaveCount(0);
  await expect(page.locator('.con-task__lane-max')).toHaveCount(0);
  await expect(page.locator('.con-task__lane-stock')).toHaveCount(6);
  const bar = page.locator('.con-cmdbar, .con-commands').first();
  await expect(bar).toContainText(/Добавить/i);
  await expect(bar).not.toContainText('−1');

  // A on the THIRD lane (titanium): the unit lands on a pool the player has
  // ZERO of — the exact state the old stock cap refused («0 / 0»).
  await key(page, 'ArrowDown');
  await key(page, 'ArrowDown');
  await key(page, 'Enter');
  await shoot(page, '2-picked-titanium');
  const picked = page.locator('.con-task__lane').nth(2);
  await expect(picked.locator('.con-task__lane-tick')).toHaveCount(1);
  await expect(picked.locator('.con-task__lane-next')).toHaveText('1');
  await expect(bar).toContainText(/Снять/i);

  // A again TAKES IT BACK — the same gesture, inverted.
  await key(page, 'Enter');
  await expect(picked.locator('.con-task__lane-tick')).toHaveCount(0);
  await expect(bar).toContainText(/Добавить/i);

  // Place it again, X commits: the payload is the byte-identical
  // SelectResourcesResponse the radio stands for.
  await key(page, 'Enter');
  await key(page, 'KeyX', 1500);
  await shoot(page, '3-committed');
  expect(captured.submits.length, 'X submitted the answer').toBeGreaterThan(0);
  // The wire shape is `{runId, ...response}` (gameTransport.submitInput).
  const {runId, ...payload} = captured.submits[0] as Record<string, unknown>;
  void runId;
  expect(payload).toEqual({
    type: 'resources',
    units: {megacredits: 0, steel: 0, titanium: 1, plants: 0, energy: 0, heat: 0},
  });
  await expect(page.locator('.con-task')).toHaveCount(0);
});

test('a real budget keeps the dials — and an EMPTY pool still takes both units', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await bootSeededGame(page, request, await createGame(request), {buy: 2});
  await injectPhilaresPrompt(page, 2);
  await page.reload();
  await page.waitForSelector('.con-task', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '4-dials-open');

  // The BUDGET shape: the meter and the stepper verbs stay.
  await expect(page.locator('.con-task__dist-target')).toHaveCount(1);
  const bar = page.locator('.con-cmdbar, .con-commands').first();
  await expect(bar).toContainText('−1');
  await expect(bar).not.toContainText(/Добавить/i);

  // RB twice on the FIRST lane (M€, stock 0): the whole reward lands on an
  // empty pool. Under the old cap (max = stock = 0) both presses were dead.
  await key(page, 'KeyE');
  await key(page, 'KeyE');
  await shoot(page, '5-both-on-empty-pool');
  const lane = page.locator('.con-task__lane').first();
  await expect(lane.locator('.con-task__lane-delta')).toHaveText('+2');
  await expect(lane.locator('.con-task__lane-next')).toHaveText('2');
  await expect(page.locator('.con-task__dist-target')).toHaveClass(/--ready/);

  // LB steps back down — the dial is still a dial.
  await key(page, 'KeyQ');
  await expect(lane.locator('.con-task__lane-delta')).toHaveText('+1');
});
