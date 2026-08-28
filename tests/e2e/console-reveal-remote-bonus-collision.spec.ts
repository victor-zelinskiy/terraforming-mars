import {test, expect, Page, APIRequestContext, Route} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, press} from './consoleStart';

/**
 * MY REVEAL IS MINE UNTIL I FINISH IT — even when somebody else's colony bonus
 * lands in the middle of it.
 *
 * THE REPORTED BREAK. The viewer activates «Запретная зона», draws a card, and
 * is standing in the reveal with the card still untaken. An opponent trades on
 * Pluto, where the viewer owns a cube: the owner bonus is a DETACHED DELIVERY
 * queued on the RECIPIENT, so its batch and its mandatory-discard marker arrive
 * WHILE the viewer's own reveal is up. What happened then:
 *
 *   · the reveal vanished with the card still untaken (the park was written as
 *     a STATE — `remoteColonyBonusPending` short-circuited the whole
 *     `rawDrawnRevealPending`, which IS `admissionSignals.revealPending`);
 *   · with the `reveal` block gone from every admission policy at once, the
 *     bonus's own door opened over the workspace the player was still in — the
 *     A they pressed to TAKE THEIR CARD opened Pluto instead;
 *   · arming the entry released the park, so their own batch came back INSIDE
 *     the colony workspace, presented as somebody else's payout: two flows in
 *     one zone, the outcome claim already dropped, no way back. Only rejoining
 *     the game cleared it.
 *
 * THE LAW UNDER TEST — the park is about ONE BATCH, never about «the reveal»,
 * and the discard MARKER is about the batch it owns (`bonusDiscardOwnsBatch`):
 * while the viewer's own draw is on the table it keeps its surface, keeps every
 * other prompt out (the queue is `consolePromptAdmission`), and grows no
 * closing step it does not owe. The foreign delivery waits its turn — and gets
 * it, in full, the moment the viewer is done.
 *
 * DRIVEN THROUGH A ROUTE PATCHER (the `console-colony-remote-bonus` technique):
 * the collision needs an opponent's trade landing inside a one-frame window of
 * the viewer's own draw, which no real walk reproduces reliably. Everything
 * asserted is client lifecycle.
 */

const OUT = path.resolve('screenshots', 'reveal-remote-bonus-collision');

/** The viewer's OWN draw — a card action's, nothing to do with any colony. */
const OWN_BATCH_ID = 800;
/** The opponent's Pluto delivery, queued behind it. */
const BONUS_BATCH_ID = 900;

function newGameConfig() {
  return {
    players: [{name: 'Collision', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
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
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
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

type Model = Record<string, any>;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Collision') ?? model.players[0]).id;
}

/**
 * THE COLLISION, exactly as the server sends it: the viewer's own card-sourced
 * batch still untaken, the opponent's Pluto bonus batch queued behind it (a
 * later reveal id — the server's ids are monotonic and the store is FIFO), and
 * the mandatory discard marker that rides the bonus.
 */
function patchCollision(body: Model, cycle: number): void {
  // ⚠️ EVERY LEG IS A NEW RESPONSE — the client's «is this a new response?» is
  // `gameAge|undoCount`, so a reused age looks like the same model coming round
  // again and the per-response watchers never fire.
  if (body.game !== undefined) {
    body.game.gameAge = (body.game.gameAge ?? 0) + cycle;
  }
  body.cardDrawReveals = [
    {
      id: OWN_BATCH_ID,
      source: {type: 'card', cardName: 'Restricted Area'},
      cards: [{name: 'Micro-Mills'}],
    },
    {
      id: BONUS_BATCH_ID,
      source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'collision:g1:a1', role: 'bonus'}},
      cards: [{name: 'Insulation'}],
      tradeSegments: [{role: 'bonus', count: 1}],
    },
  ];
  body.waitingFor = {
    type: 'card',
    title: 'Pluto colony bonus. Select a card to discard',
    buttonLabel: 'Discard',
    cards: (body.cardsInHand ?? []).slice(0, 6),
    min: 1,
    max: 1,
    showOnlyInLearnerMode: false,
    discardPrompt: {
      min: 1, max: 1, source: {kind: 'colony'},
      colonyBonus: {colonyName: 'Pluto', index: 1, total: 1},
    },
  };
}

/** The standing table: every poll answers the same collision. */
async function installCollision(page: Page): Promise<void> {
  let cycle = 1;
  await page.route('**/api/player*', async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json() as Model;
    patchCollision(body, cycle++);
    await route.fulfill({response, json: body});
  });
}

/** Every fact this spec asserts, sampled from inside the page. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const diag = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    const d = diag !== undefined ? diag() : {};
    return {
      // The viewer's own reveal, and WHERE it is.
      reveal: document.querySelector('.con-reveal') !== null,
      revealPending: d.revealPending === true,
      // …which batches are on the table, and how many cards of each are untaken
      // ('<id>:<untaken>' + 'D' once dismissed — see the shell's diag).
      reveals: (d.liveReveals as ReadonlyArray<string> | undefined)?.join(',') ?? '',
      // THE STOLEN CONTEXT: any of these standing while the own reveal is up is
      // the bug.
      colonies: document.querySelector('.con-colonies') !== null,
      colonyStage: document.querySelector('.con-colfocus') !== null,
      announce: document.querySelector('.con-mandatory') !== null,
      hand: document.querySelector('.con-hand') !== null,
      stack: (d.stack as Array<{kind: string}> | undefined)?.map((f) => f.kind).join('>') ?? '',
      // The closing step is a property of the batch, not of the standing prompt:
      // a foreign marker must grow no zone and no «сбросить карту» over the
      // viewer's own cards.
      bonusZones: document.querySelectorAll('.con-reveal [class*="zone"]').length,
      entry: (d.entry as {colony: string} | undefined)?.colony ?? '',
      stranded: document.querySelector('.con-stranded') !== null,
    };
  });
}

test('a remote colony bonus WAITS for the reveal the player is standing in', async ({page, request}) => {
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

  await installCollision(page);
  await page.reload();

  // ── 1 · THE OWN REVEAL STANDS. The batch is the viewer's own draw; the
  //    opponent's delivery is behind it, and the discard marker that came with
  //    it belongs to that batch — not to this one.
  const reveal = page.locator('.con-reveal');
  await expect(reveal, 'the viewer\'s own reveal never presented (the park took it down)')
    .toBeVisible({timeout: 45_000});
  await page.waitForTimeout(2000); // the deal + arrival settle
  await shoot(page, '01-own-reveal-stands');

  const during = await snapshot(page);
  console.log('── collision, own reveal up ──', JSON.stringify(during));
  expect(during.revealPending, 'the reveal signal every admission gate reads went false').toBeTruthy();
  expect(during.reveals, 'the own batch is not the one on the table')
    .toContain(`${OWN_BATCH_ID}:1`);

  // …AND NOTHING ELSE TOOK THE CONTEXT. Each of these is the reported symptom
  // in a different shape.
  expect(during.colonies, 'the colony workspace opened over the reveal').toBeFalsy();
  expect(during.colonyStage, 'the Pluto bonus stage opened over the reveal').toBeFalsy();
  expect(during.hand, 'the foreign discard opened the hand over the reveal').toBeFalsy();
  expect(during.announce, 'the announcement plate stole A from the reveal').toBeFalsy();
  expect(during.entry, 'the remote entry armed itself without the player').toBe('');
  expect(during.bonusZones,
    'a foreign colony\'s discard grew zones over the viewer\'s own cards').toBe(0);

  // ── 2 · A TAKES THE CARD — the press the player made in the report, which
  //    walked them into Pluto instead.
  await press(page, 'Enter', 3000);
  await shoot(page, '02-after-take');
  const taken = await snapshot(page);
  console.log('── collision, after the take ──', JSON.stringify(taken));
  expect(taken.reveals, 'A did not take the viewer\'s own card')
    .toContain(`${OWN_BATCH_ID}:0`);
  expect(taken.stranded, 'the take left an unserved prompt behind').toBeFalsy();

  // ── 3 · …AND ONLY THEN DOES THE DELIVERY GET ITS TURN. The park is still a
  //    park: the foreign batch does not force itself open either — it is
  //    ANNOUNCED, and the player's own press is the door (the whole point of
  //    the queue: one demand at a time, in order).
  const plate = page.locator('.con-mandatory');
  await expect(plate, 'the parked colony bonus was never handed to the player')
    .toBeVisible({timeout: 30_000});
  const queued = await snapshot(page);
  console.log('── collision, delivery announced ──', JSON.stringify(queued));
  expect(queued.colonies, 'the delivery force-opened instead of being announced').toBeFalsy();
  await shoot(page, '03-delivery-announced');

  await press(page, 'Enter', 3000);
  await expect(page.locator('.con-colfocus'), 'the announced delivery did not open its colony')
    .toBeVisible({timeout: 30_000});
  await shoot(page, '04-delivery-open');
  const opened = await snapshot(page);
  console.log('── collision, delivery open ──', JSON.stringify(opened));
  expect(opened.entry, 'the delivery opened without arming its entry').toBe('Pluto');
});
