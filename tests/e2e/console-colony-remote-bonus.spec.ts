import {test, expect, Page, APIRequestContext, Route} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, openMandatoryAnnounce, press} from './consoleStart';

/**
 * SOMEBODY ELSE TRADED ON MY COLONY — the whole leg, to its END.
 *
 * The reported break (two own settlements on Pluto, a bot trading with it):
 *  1. the payout opened the TRADING screen — track, berths, reward rail — with
 *     the actual decision squeezed into a corner of it;
 *  2. the second cycle's reveal stood ON TOP of that still-lit track (two
 *     surfaces in one zone);
 *  3. the flow never ENDED: after the last discard the board offered
 *     «Вернуться к решению», A came back to a colony screen with nothing to do
 *     and B left an empty frame — the colony subsystem was dead for the rest
 *     of the session;
 *  4. the receipt counted discards from payouts two generations old, and the
 *     source line named a trader from one of them.
 *
 * (3) and (4) were one bug: the client-armed ENTRY was itself a term of
 * `colonyResolutionLive`, and the entry is only cleared on that predicate's
 * FALLING edge — a latch that could never open. (1) is the missing composition
 * (`intent: 'bonus'`), (2) the handoff pose that never armed for a stage
 * mounting mid-resolution.
 *
 * DRIVEN THROUGH A STATEFUL PATCHER. A remote bonus needs another player's
 * trade against colonies the viewer owns two cubes on; walking a real game
 * there costs minutes per run and never reproduces the SEQUENCE reliably. The
 * patcher answers the client with exactly what the server sends in each leg —
 * one cycle per answered input — so the whole lifecycle, INCLUDING its end, is
 * deterministic. Everything under test is client lifecycle.
 */

const OUT = path.resolve('screenshots', 'colony-remote-bonus');

function newGameConfig() {
  return {
    players: [{name: 'RemoteBonus', color: 'red', beginner: false, handicap: 0, first: true}],
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

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'RemoteBonus') ?? model.players[0]).id;
}

type Model = Record<string, any>;

/**
 * THE SEQUENCE, exactly as the server plays it for two settlements on Pluto:
 * one bonus card at a time, each closed by its own mandatory discard, and
 * nothing at all once the last one is answered.
 */
function patchForCycle(body: Model, cycle: number): void {
  // ⚠️ EVERY LEG IS A NEW RESPONSE, and the client's own «is this a new
  // response?» is `gameAge|undoCount` (structural sharing keeps identities
  // otherwise). A patched body that reuses the previous age looks like the same
  // model coming round again — the per-response watchers never fire and the
  // flow stalls halfway, which is a harness artifact indistinguishable from the
  // bug under test.
  if (body.game !== undefined) {
    body.game.gameAge = (body.game.gameAge ?? 0) + cycle;
  }
  if (cycle > 1) {
    // The payout is OVER: the answer produced no next marker and no next batch
    // — the ordinary end of a bonus sequence, and the leg the whole spec is
    // about. Everything must let go here; before the fix nothing did, ever.
    body.cardDrawReveals = [];
    body.waitingFor = undefined;
    return;
  }
  body.cardDrawReveals = [{
    id: 901,
    source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'remote:g1:a1', role: 'bonus'}},
    cards: [{name: 'Micro-Mills'}],
    tradeSegments: [{role: 'bonus', count: 1}],
  }];
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

/**
 * The patcher: GET polls carry the CURRENT cycle; every answered input
 * ADVANCES it and answers with the next leg. The last GET body is kept so a
 * POST can be answered without asking the real server for a prompt it is not
 * in.
 */
async function installSequence(page: Page): Promise<{cycle: () => number, settle: () => void}> {
  let cycle = 1;
  let last: Model | undefined;
  // ⚠️ The hand is deliberately left ALONE. Shrinking it per answer looks
  // faithful and is not: a test hand is 2-3 cards, so the second cycle's prompt
  // came back with nothing to select — the surface then legitimately cannot
  // serve it and the amber stranded guard covers the screen, which reads
  // exactly like the product bug under test.
  await page.route('**/api/player*', async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json() as Model;
    patchForCycle(body, cycle);
    last = body;
    await route.fulfill({response, json: body});
  });
  await page.route('**/player/input*', async (route: Route) => {
    cycle++;
    const body = last ?? {};
    patchForCycle(body, cycle);
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  return {
    cycle: () => cycle,
    /** The payout is OVER — the server owes this player nothing more. */
    settle: () => {
      cycle = 99;
    },
  };
}

/** Every fact this spec asserts, sampled from inside the page. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const diag = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    const d = diag !== undefined ? diag() : {};
    const stage = document.querySelector('.con-colfocus');
    const strip = document.querySelector('.con-colfocus__outcome .con-reveal__strip');
    const zone = document.querySelector('.con-colfocus__outcome');
    const overflow = (() => {
      if (strip === null || zone === null) {
        return 0;
      }
      const z = zone.getBoundingClientRect();
      let worst = 0;
      strip.querySelectorAll('.con-cards__slot').forEach((slot) => {
        const r = slot.getBoundingClientRect();
        worst = Math.max(worst, z.left - r.left, r.right - z.right, z.top - r.top, r.bottom - z.bottom);
      });
      return Math.round(worst);
    })();
    return {
      colonies: document.querySelector('.con-colonies') !== null,
      stage: stage !== null,
      intent: stage?.getAttribute('data-colony-intent') ?? '',
      handing: stage?.classList.contains('con-colfocus--handing') ?? false,
      // The trading half must not exist in the bonus composition.
      track: document.querySelectorAll('.con-colfocus__xtrack').length,
      rail: document.querySelectorAll('.con-colfocus__result').length,
      // …and the payout must be inside the stage's own zone.
      revealInStage: document.querySelector('.con-colfocus__outcome .con-reveal') !== null,
      fullBleed: Array.from(document.querySelectorAll('.con-reveal'))
        .some((el) => el.closest('.con-colfocus__outcome') === null && el.closest('.con-colonies') === null),
      source: (document.querySelector('.con-colfocus__srcctx') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      lead: document.querySelector('.con-colfocus__srcctx--lead') !== null,
      discarded: (document.querySelector('[data-colony-discard-seat]') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      overflow,
      restoreCard: document.querySelector('.con-mandatory') !== null,
      stranded: document.querySelector('.con-stranded') !== null,
      hand: document.querySelector('.con-hand') !== null,
      embeddedHand: document.querySelector('.con-colonies .con-hand--embedded') !== null,
      yielded: document.querySelector('.con-colonies__browse--yield') !== null,
      wf: d.wfType ?? null,
      outcomeHost: d.outcomeHost ?? null,
      outcomeStage: d.outcomeStage ?? '',
      reveals: (d.liveReveals as ReadonlyArray<string> | undefined)?.join(',') ?? '',
      release: d.lastRelease ?? '',
      resolutionLive: d.resolutionLive === true,
      resolutionEvidence: d.resolutionEvidence === true,
      entry: d.entry ?? null,
      stack: (d.stack as Array<{kind: string}> | undefined)?.map((f) => f.kind).join('>') ?? '',
      parked: (d.parked as Array<string> | undefined)?.join(',') ?? '',
      taskDeferred: d.taskDeferred === true,
    };
  });
}

/**
 * Take the card on the table.
 *
 * ⚠️ A = «take» ONLY while the payout is genuinely up. Pressing it blind walks
 * the browse grid the instant the reveal is between states — and A there
 * DESCENDS into a colony, which reads in the log exactly like the flow having
 * moved on by itself.
 */
async function takePayout(page: Page): Promise<void> {
  const reveal = page.locator('.con-colfocus__outcome .con-reveal');
  await expect(reveal, 'the payout never presented in the workspace').toBeVisible({timeout: 30_000});
  await page.waitForSelector('.con-colfocus__outcome .con-cards__slot--focused', {timeout: 20_000})
    .catch(() => undefined);
  await press(page, 'Enter', 2200);
}

test('a FOREIGN trade pays this colony: the bonus composition, and an ending', async ({page, request}) => {
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
  // A remote colony bonus is ANNOUNCED, never auto-opened.
  expect(await openMandatoryAnnounce(page), 'the colony bonus was not announced').toBeTruthy();
  await page.waitForSelector('.con-colfocus', {timeout: 30_000});
  await page.waitForTimeout(2600); // the entrance + the card's arrival settle
  await shoot(page, '01-bonus-stage');

  // ── 1 · THE BONUS COMPOSITION — the paying colony, whose trade it was, and
  //    the choice. Not the trading screen with a decision hidden inside it.
  const opened = await snapshot(page);
  console.log('── remote bonus, cycle 1 ──', JSON.stringify(opened));
  expect(opened.intent, 'the stage did not open in its BONUS composition').toBe('bonus');
  expect(opened.track, 'the trade track stood in a payout the player did not trade for').toBe(0);
  expect(opened.rail, 'the reward package stood in a bonus that weighs nothing').toBe(0);
  expect(opened.lead, 'the trigger was not the leading statement of the surface').toBeTruthy();
  expect(opened.revealInStage, 'the payout did not present inside the colony stage').toBeTruthy();
  expect(opened.fullBleed, 'a full-bleed reveal opened over the board').toBeFalsy();
  expect(opened.handing, 'the payout zone was not handed the stage body').toBeTruthy();
  // The cards fit the zone they are in (the 4K report: a cropped row).
  expect(opened.overflow, `a card stuck ${opened.overflow}px out of the payout zone`).toBeLessThanOrEqual(1);

  // ── 2 · The card is taken, and its mandatory discard runs INSIDE this
  //    workspace (never a second root) — the same step the trade's own payout
  //    opens, here without a trade.
  await takePayout(page);
  const hand = page.locator('.con-colonies .con-hand.con-hand--embedded');
  for (let i = 0; i < 5 && await hand.count() === 0; i++) {
    await press(page, 'Enter', 1600);
  }
  await expect(hand, 'the mandatory discard did not open inside the colony workspace')
    .toBeVisible({timeout: 25_000});
  await shoot(page, '02-embedded-discard');
  await press(page, 'Enter', 2600); // answer it (single-select)
  expect(sequence.cycle(), 'the discard was never answered').toBeGreaterThan(1);

  // ── 3 · THE END, and the whole point of this spec.
  //
  // The answer carried no next marker and no next batch: the server owes this
  // player nothing more. EVERYTHING must let go — the claim, the workspace,
  // the entry context. Before the fix nothing did, ever again: the armed ENTRY
  // was itself a term of `colonyResolutionLive`, and the entry is only cleared
  // on that predicate's FALLING edge — so the workspace stood over an empty
  // frame, the board offered «Вернуться к решению», and the colony subsystem
  // was dead for the rest of the session.
  const gone = page.locator('.con-colonies');
  await expect(gone, 'the colony workspace never left after its payout was over')
    .toHaveCount(0, {timeout: 25_000});
  await page.waitForTimeout(1200);
  await shoot(page, '03-after');
  const end = await snapshot(page);
  console.log('── remote bonus, after ──', JSON.stringify(end));
  expect(end.resolutionEvidence, 'the server still owes something (the drive misfired)').toBeFalsy();
  expect(end.resolutionLive,
    `the resolution stayed live with no evidence — entry=${JSON.stringify(end.entry)}`).toBeFalsy();
  expect((end.entry as {colony: string} | null)?.colony ?? '',
    'the entry context outlived its resolution (the latch)').toBe('');
  expect(end.stage, 'the colony stage stood after its payout was over').toBeFalsy();
  expect(end.stranded, 'an unserved prompt was left behind').toBeFalsy();
  expect(end.parked, 'the finished flow was PARKED instead of finishing').toBe('');
  expect(end.taskDeferred, 'the finished flow was left deferred («Вернуться к решению»)').toBeFalsy();
});
