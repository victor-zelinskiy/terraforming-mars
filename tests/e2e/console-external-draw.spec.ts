import {test, expect, Page, APIRequestContext, Route} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, openMandatoryAnnounce, press} from './consoleStart';

/**
 * THE EXTERNAL DRAW — the mandatory take of cards ANOTHER player's action drew
 * for the viewer (Solar Logistics on a foreign space event, Sponsored
 * Academies), end to end on the CLIENT:
 *
 *  1. the demand is ANNOUNCED (`.con-mandatory` names the effect), never a
 *     fullscreen reveal torn over whatever the player was doing — and the
 *     cards are NOWHERE in the hand until taken;
 *  2. A opens the dedicated «ДОБОР КАРТЫ» workspace: cause line (who played
 *     what), the effect card's source seat, the batch dealt off the deck;
 *  3. A takes ONE card (its seat stays as a quiet ghost — the row never
 *     re-flows under the flight), B takes ALL; with a single card left B is
 *     deliberately DEAD (the workspace is locked — no close, no minimize);
 *  4. the last take folds the workspace and the player is back on the board,
 *     nothing stranded, nothing deferred.
 *
 * DRIVEN THROUGH THE STATEFUL PATCHER (the console-colony-remote-bonus
 * precedent): an external draw needs another player's play against the
 * viewer's tableau; the patcher answers with exactly what the server sends in
 * each leg — one leg per answered input — so the whole lifecycle is
 * deterministic. Everything under test is client lifecycle; the server half
 * (the intake itself) is pinned by `tests/deferredActions/ExternalDrawIntake`
 * + `tests/automa/AutomaHumanTagReactions`.
 */

const OUT = path.resolve('screenshots', 'external-draw');

const BATCH = ['Micro-Mills', 'Insulation', 'Windmills'] as const;

function newGameConfig() {
  return {
    players: [{name: 'Recipient', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
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
    automa: undefined,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Recipient') ?? model.players[0]).id;
}

type Model = Record<string, any>;

/**
 * One leg per answered input. Cycle N leaves `BATCH.slice(taken)` awaiting the
 * take; the last leg ends the prompt. The taken cards JOIN `cardsInHand` (the
 * real server moves them at the answer), so the dock's landing is backed by
 * the model exactly as in production.
 */
function patchForCycle(body: Model, cycle: number, taken: number): void {
  if (body.game !== undefined) {
    body.game.gameAge = (body.game.gameAge ?? 0) + cycle;
  }
  // The initiator is a real participant of the game as the client sees it —
  // the cause line names them through the ordinary player model.
  if (Array.isArray(body.players) && !body.players.some((p: Model) => p.color === 'green')) {
    body.players.push({...body.players[0], name: 'Rival', color: 'green', isMarsBot: false});
  }
  body.cardsInHand = [
    ...(body.cardsInHand ?? []),
    ...BATCH.slice(0, taken).map((name) => ({name})),
  ];
  const remaining = BATCH.slice(taken);
  if (remaining.length === 0) {
    body.waitingFor = undefined;
    return;
  }
  body.waitingFor = {
    type: 'card',
    title: `Take ${remaining.length} card(s) drawn by Solar Logistics`,
    buttonLabel: 'Take',
    cards: remaining.map((name) => ({name})),
    min: 1,
    max: remaining.length,
    showOnlyInLearnerMode: false,
    externalDrawPrompt: {
      intakeId: 1,
      count: BATCH.length,
      remaining: remaining.length,
      effectCard: 'Solar Logistics',
      effectCardOwner: 'you',
      initiator: 'green',
      triggerCard: 'Big Asteroid',
    },
  };
}

async function installSequence(page: Page): Promise<{taken: () => number}> {
  let taken = 0;
  let cycle = 1;
  let last: Model | undefined;
  await page.route('**/api/player*', async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json() as Model;
    patchForCycle(body, cycle, taken);
    last = body;
    await route.fulfill({response, json: body});
  });
  await page.route('**/player/input*', async (route: Route) => {
    // The answer names the cards taken — advance by exactly that many.
    const post = route.request().postDataJSON() as {cards?: Array<string>} | undefined;
    const took = post?.cards?.length ?? 1;
    taken = Math.min(BATCH.length, taken + took);
    cycle++;
    const body = last ?? {};
    patchForCycle(body, cycle, taken);
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  return {taken: () => taken};
}

/** Every fact this spec asserts, sampled from inside the page. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const ws = document.querySelector('.con-extdraw');
    const slots = Array.from(document.querySelectorAll('.con-extdraw__slot'));
    const ghosts = Array.from(document.querySelectorAll('.con-extdraw__slot--ghost'));
    const status = (document.querySelector('.con-extdraw__status') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    const cause = (document.querySelector('.con-extdraw__cause') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    return {
      workspace: ws !== null,
      slots: slots.length,
      ghosts: ghosts.length,
      status,
      cause,
      bar: (document.querySelector('.con-cmdbar, .con-commands, .con-footer') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      ghostDebug: (() => {
        const g = document.querySelector('.con-extdraw__slot--ghost') as HTMLElement | null;
        if (g === null) {
          return '';
        }
        const r = g.getBoundingClientRect();
        const card = g.querySelector('.card-container, .pcard') as HTMLElement | null;
        const band = g.querySelector('.con-extdraw__ghostband') as HTMLElement | null;
        const cs = card === null ? undefined : getComputedStyle(card);
        const bs = band === null ? undefined : getComputedStyle(band);
        const br = band?.getBoundingClientRect();
        return `slot=${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}` +
          ` card=${cs?.opacity}/${cs?.visibility}/${cs?.display}` +
          ` band=${bs?.visibility}/${bs?.display}/${Math.round(br?.width ?? 0)}x${Math.round(br?.height ?? 0)}`;
      })(),
      /** The ghost seat's card must stay faintly PAINTED (the intake's
       *  con-deal-hold released) — 0 here is the invisible-hole regression. */
      ghostOpacity: (() => {
        const card = document.querySelector('.con-extdraw__slot--ghost :is(.card-container, .pcard)');
        return card === null ? -1 : parseFloat(getComputedStyle(card as HTMLElement).opacity);
      })(),
      plate: document.querySelector('.con-mandatory') !== null,
      plateText: (document.querySelector('.con-mandatory') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      fullBleedReveal: document.querySelector('.con-reveal') !== null,
      stranded: document.querySelector('.con-stranded') !== null,
      sourceSeat: document.querySelector('.con-extdraw__source .con-src') !== null,
      dockCount: (document.querySelector('.con-handdock .con-handdock__num--total') as HTMLElement | null)?.innerText.trim() ?? '',
    };
  });
}

test('an external draw: announced → A opens the workspace → take one, take all → the workspace folds', async ({page, request}) => {
  test.setTimeout(240_000);
  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(2500);
  await bootToBoard(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, 2);
      }
    },
  });
  await page.waitForTimeout(1500);

  const sequence = await installSequence(page);
  await page.reload();

  // ── 1 · ANNOUNCED, never torn open — and the cards are NOWHERE yet.
  expect(await openMandatoryAnnounce(page), 'the external draw was not announced').toBeTruthy();
  await page.waitForSelector('.con-extdraw', {timeout: 30_000});
  await page.waitForTimeout(2600); // the entrance + the deal settle
  await shoot(page, '01-workspace');

  const opened = await snapshot(page);
  console.log('── external draw, opened ──', JSON.stringify(opened));
  expect(opened.workspace, 'the workspace stood up').toBeTruthy();
  expect(opened.slots, 'three prepared seats').toBe(3);
  expect(opened.ghosts, 'nothing taken yet').toBe(0);
  expect(opened.sourceSeat, 'the effect card sits in the source seat').toBeTruthy();
  expect(opened.cause, 'the cause names the initiator').toContain('Rival');
  expect(opened.cause, 'the cause names the trigger card').toContain('Большой астероид');
  expect(opened.cause, 'the effect line names Solar Logistics').toContain('Солнечная логистика');
  expect(opened.fullBleedReveal, 'no fullscreen reveal beside the workspace').toBeFalsy();
  // The ONE command bar carries the workspace's own contract from the first
  // frame — never the stale fallback «Выбрать/Назад» (fallbackActive is
  // sticky across consumed presses) and never a false «close» affordance.
  // ⚠️ innerText is the RENDERED text — the bar upper-cases via CSS.
  const bar = opened.bar.toUpperCase();
  expect(bar, 'the bar advertises the take').toContain('ЗАБРАТЬ КАРТУ');
  expect(bar, 'the bar advertises take-all').toContain('ЗАБРАТЬ ВСЕ');
  expect(bar, 'no back/close affordance on a locked workspace').not.toContain('НАЗАД');

  // ── 2 · A takes ONE: its seat stays as a ghost, the row does not re-flow.
  await press(page, 'Enter', 2600);
  const afterOne = await snapshot(page);
  console.log('── external draw, after one ──', JSON.stringify(afterOne));
  expect(sequence.taken(), 'exactly one card was submitted').toBe(1);
  expect(afterOne.workspace, 'the workspace stands through the batch').toBeTruthy();
  expect(afterOne.slots, 'the layout is stable (ghost seat kept)').toBe(3);
  expect(afterOne.ghosts, 'the taken card left a ghost seat').toBe(1);
  expect(afterOne.ghostOpacity, 'the ghost seat is faintly painted, never a hole').toBeGreaterThan(0.1);
  await shoot(page, '02-after-take-one');

  // ── 3 · B takes ALL the rest (two cards, one answer, the stack intake).
  await press(page, 'Escape', 3200);
  expect(sequence.taken(), '«Забрать все» submitted the remainder').toBe(3);

  // ── 4 · THE END: the workspace folds once the flight lands; nothing
  //        stranded, nothing deferred, no plate left behind.
  const gone = page.locator('.con-extdraw');
  await expect(gone, 'the workspace never folded after the last take').toHaveCount(0, {timeout: 25_000});
  await page.waitForTimeout(1500);
  await shoot(page, '03-after');
  const end = await snapshot(page);
  console.log('── external draw, after ──', JSON.stringify(end));
  expect(end.stranded, 'an unserved prompt was left behind').toBeFalsy();
  expect(end.plate, 'the announcement did not clear').toBeFalsy();
});

test('the workspace is LOCKED: B with one card left neither takes nor closes', async ({page, request}) => {
  test.setTimeout(240_000);
  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(2500);
  await bootToBoard(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, 2);
      }
    },
  });
  await page.waitForTimeout(1500);

  const sequence = await installSequence(page);
  await page.reload();
  expect(await openMandatoryAnnounce(page), 'the external draw was not announced').toBeTruthy();
  await page.waitForSelector('.con-extdraw', {timeout: 30_000});
  await page.waitForTimeout(2600);

  // Take two, one at a time — one card left.
  await press(page, 'Enter', 2600);
  await press(page, 'Enter', 2600);
  expect(sequence.taken()).toBe(2);

  // B is a dead button now: no take, no close, no minimize.
  await press(page, 'Escape', 1800);
  const held = await snapshot(page);
  console.log('── external draw, locked ──', JSON.stringify(held));
  expect(sequence.taken(), 'B must not take the last card').toBe(2);
  expect(held.workspace, 'B must not close the locked workspace').toBeTruthy();
  await shoot(page, '10-locked');

  // A finishes the batch; the workspace folds.
  await press(page, 'Enter', 2600);
  expect(sequence.taken()).toBe(3);
  await expect(page.locator('.con-extdraw')).toHaveCount(0, {timeout: 25_000});
});
