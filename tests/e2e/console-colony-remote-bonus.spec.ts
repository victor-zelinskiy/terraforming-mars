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
 * THE MERGED PAYOUT, exactly as a Pluto trade pays a player with TWO
 * settlements: two income cards, the first colony's bonus card beside them, and
 * a second zone standing for the colony whose card is not drawn yet. FOUR boxes
 * in the strip — the composition the 4K report was made of.
 */
function patchMerged(body: Model): void {
  if (body.game !== undefined) {
    body.game.gameAge = (body.game.gameAge ?? 0) + 1;
  }
  body.cardDrawReveals = [{
    id: 950,
    source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'merged:g1:a1', role: 'income'}},
    cards: [{name: 'Micro-Mills'}, {name: 'Insulation'}, {name: 'Windmills'}],
    tradeSegments: [{role: 'income', count: 2}, {role: 'bonus', count: 1}],
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
      colonyBonus: {colonyName: 'Pluto', index: 1, total: 2},
    },
  };
}

/**
 * THE SEQUENCE, one leg per answered input: the bonus card and its mandatory
 * discard, then nothing at all once that discard is answered.
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

/** The MERGED payout, frozen (every poll answers the same standing table). */
async function installMerged(page: Page): Promise<void> {
  await page.route('**/api/player*', async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json() as Model;
    patchMerged(body);
    await route.fulfill({response, json: body});
  });
}

/**
 * THE GEOMETRY OF THE PAYOUT ROW, measured where it is laid out.
 *
 * ⚠️ A fit claim asserted at ONE resolution is a claim about one resolution —
 * and the default e2e viewport is 720p, which is exactly where this composition
 * fits by accident. The numbers below are what the engine solved against
 * (`--con-cards-zoom`, the strip's own box) beside what the browser actually
 * painted, so a divergence names itself instead of showing up as «cards look
 * cropped».
 */
async function rowGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
    };
    const zone = document.querySelector('.con-colfocus__outcome');
    const strip = document.querySelector('.con-reveal__strip');
    const items = Array.from(strip?.children ?? []) as Array<HTMLElement>;
    const cards = Array.from(document.querySelectorAll('.con-reveal__strip .con-cards__slot')) as Array<HTMLElement>;
    const cs = strip === null ? undefined : getComputedStyle(strip as HTMLElement);
    const stripBox = strip === null ? null : {
      w: (strip as HTMLElement).clientWidth, h: (strip as HTMLElement).clientHeight,
      sw: (strip as HTMLElement).scrollWidth, sh: (strip as HTMLElement).scrollHeight,
    };
    // ⚠️ TWO different questions, and only the first one is «cropped».
    //
    // `clipped` measures the painted cards against the row's BORDER box — the
    // box that actually clips (`overflow: hidden`). Its padding is deliberate
    // headroom (the focused card's ring and lift live there), so measuring
    // against the CONTENT box calls a healthy focus emphasis an overflow.
    // `spill` is that softer reading, kept as a budget: a line that eats more
    // than its headroom is one profile tweak away from being cropped.
    let clipped = 0;
    let spill = 0;
    const rows = new Set<number>();
    const s = (strip as HTMLElement).getBoundingClientRect();
    const pad = {
      t: parseFloat(cs?.paddingTop ?? '0'), b: parseFloat(cs?.paddingBottom ?? '0'),
      l: parseFloat(cs?.paddingLeft ?? '0'), r: parseFloat(cs?.paddingRight ?? '0'),
    };
    cards.forEach((c) => {
      const r = c.getBoundingClientRect();
      rows.add(Math.round(r.top / 200));
      clipped = Math.max(clipped, s.top - r.top, r.bottom - s.bottom, s.left - r.left, r.right - s.right);
      spill = Math.max(spill,
        (s.top + pad.t) - r.top, r.bottom - (s.bottom - pad.b),
        (s.left + pad.l) - r.left, r.right - (s.right - pad.r));
    });
    const worst = clipped;
    return {
      zone: box(zone),
      strip: stripBox,
      stripBox: box(strip),
      pad: cs === undefined ? '' :
        `${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft}`,
      root: document.querySelector('.con-reveal')?.className ?? '',
      fit: (strip as HTMLElement | null)?.dataset.fit ?? '',
      flex: cs === undefined ? '' :
        `cg=${cs.columnGap} rg=${cs.rowGap} wrap=${cs.flexWrap} ac=${cs.alignContent} ai=${cs.alignItems} of=${cs.overflow} mw=${cs.maxWidth}`,
      rem: getComputedStyle(document.documentElement).fontSize,
      zoom: cs?.getPropertyValue('--con-cards-zoom').trim() ?? '',
      rowMax: cs?.getPropertyValue('--con-ws-stage-rowmax').trim() ?? '',
      perRow: cs?.getPropertyValue('--con-ws-stage-per-row').trim() ?? '',
      gap: cs?.getPropertyValue('--con-ws-stage-gap').trim() ?? '',
      items: items.length,
      cards: cards.length,
      renderedRows: rows.size,
      // The RAW row, item by item (class + box + margins) — the only way to see
      // the model and the layout disagree.
      layout: items.map((el) => {
        const s = getComputedStyle(el);
        return {
          cls: el.className.replace(/con-(reveal|cards)__/g, ''),
          ...box(el),
          m: `${s.marginTop}/${s.marginRight}/${s.marginBottom}/${s.marginLeft}`,
        };
      }),
      card: box(cards[0] ?? null),
      overflow: Math.round(worst),
      spill: Math.round(spill),
    };
  });
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

/**
 * THE MERGED PAYOUT FITS THE ZONE IT IS IN — at 4K, which is the only place it
 * was ever reported broken.
 *
 * Two income cards, one colony-bonus card in its zone and one zone still to
 * come: four boxes. On a 4K TV they rendered as three cards CROPPED AT THE TOP
 * with the fourth wrapped onto a line the stage had no height for — a shape the
 * fit never solved and could not have solved, because the row is measured with
 * a model that says every item is exactly one slot wide.
 *
 * ⚠️ The default e2e viewport is 720p and this composition fits there by
 * accident, which is why the first version of this guard passed while the
 * screenshot said otherwise. Geometry is asserted where the geometry lives.
 */
const FIT_PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of FIT_PROFILES) {
  test.describe(`the merged payout · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('four boxes fit the payout zone — no crop, no wrap the stage cannot hold', async ({page, request}) => {
      test.setTimeout(240_000);
      const playerId = await createGame(request);
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
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

      await installMerged(page);
      await page.reload();
      expect(await openMandatoryAnnounce(page), 'the colony bonus was not announced').toBeTruthy();
      await page.waitForSelector('.con-reveal__bonus-zone', {state: 'visible', timeout: 40_000});
      await page.waitForTimeout(3200); // the arrival + the fit's own settle pass
      await shoot(page, `10-merged-${profile.tag}`);

      const geo = await rowGeometry(page);
      console.log(`── merged payout @${profile.tag} ──`, JSON.stringify(geo));
      expect(geo.items, 'two income cards + two colony zones').toBe(4);
      // ① NOTHING IS CROPPED — measured against the box that actually clips.
      expect(geo.overflow, `a card stuck ${geo.overflow}px out of the row`).toBeLessThanOrEqual(2);
      // …and the line does not eat its own focus headroom either.
      expect(geo.spill, `the line spent ${geo.spill}px of the row's headroom`).toBeLessThanOrEqual(24);
      // ② THE SHAPE THAT RENDERS IS THE SHAPE THAT WAS SOLVED — a line that
      //    breaks where the engine did not plan it doubles the height it was
      //    solved for, and the height is what crops.
      expect(geo.renderedRows, `the row rendered ${geo.renderedRows} lines for a ${geo.perRow}-per-row shape`)
        .toBe(Math.ceil(4 / Number(geo.perRow || 4)));
      // ③ …and the whole row is inside the payout zone.
      const zone = geo.zone!;
      const card = geo.card!;
      expect(card.y, 'the first card starts above the payout zone').toBeGreaterThanOrEqual(zone.y - 2);
      expect(card.y + card.h, 'the first card runs past the payout zone')
        .toBeLessThanOrEqual(zone.y + zone.h + 2);
    });
  });
}
