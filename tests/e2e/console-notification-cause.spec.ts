import {test, expect, APIRequestContext, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, settle, waitForBoardHome} from './consoleStart';
import {armWitness, pageNow} from './witness';

/**
 * THE «ПОЧЕМУ»-ZONE — the flagship regression of the provenance iteration:
 * the Tharsis Republic owner hears about a FOREIGN city with the full causal
 * chain on ONE card — WHAT (the band: «+1 доход М€»), WHY (the zone: «ВАША
 * КОРПОРАЦИЯ Тарсис Республика · за размещение города») and WHO (the head's
 * actor chip: Rival) — with source, trigger and actor never substituting for
 * one another.
 *
 * WHY AN E2E: the unit corpus (S1–S21 + the semantics specs) pins the data;
 * what only a live run settles is the real wiring end to end — the rival's
 * REAL play over the API, the deferred Tharsis payout crossing the input
 * boundary, the PREPARING hold releasing a COMPLETE card, and the zone
 * painting under the band without layout drift (screenshots at both couch
 * profiles are the record).
 *
 * The rival is driven over the API (`player/input`, the real endpoint) — the
 * subject is the VIEWER's presentation.
 */

const OUT_DIR = path.resolve('screenshots', 'notification-cause');

const VIEWER_CORP = 'Tharsis Republic';
const VIEWER_COLOR = 'blue';

function tableConfig() {
  return {
    // The VIEWER sits FIRST: the corp dev seam lifts named corporations to the
    // deck top, and the top of every deck is the FIRST seat's deal — so this
    // is the one arrangement that guarantees the viewer IS the Tharsis owner.
    // The rival needs no cards at all: their city is a STANDARD PROJECT.
    players: [
      {name: 'Viewer', color: VIEWER_COLOR, beginner: false, handicap: 0, first: true},
      {name: 'Rival', color: 'red', beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      corpera: false, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    // The dev seam: the corp rides the deck top → the FIRST seat's (the
    // viewer's) corporation deal. testMode deals extra corps, so the plan's
    // `corporation` picks it BY NAME out of the offer.
    customCorporationsList: [VIEWER_CORP],
    customProjectCards: [],
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Box = {x: number, y: number, width: number, height: number};
/** The positive card as it stands: at REST or not, and its band's, zone's and own boxes. */
type StandingCard = {rest: boolean, band: Box | null, why: Box | null, card: Box};

/**
 * THE CARD STANDS AT REST — read in the frame it does (a page reader, self-contained: it is serialized into the page).
 * At rest = the opacity chain at 1 and no FINITE animation left on the card or an ancestor (its entrance is over — the
 * product's own motion, never a guessed interval); the card's own TTL bar is a descendant and does not count. The boxes
 * are taken in THAT sample: a card leaves by its own TTL — read later, it may be gone.
 */
function readStandingCard(sel: string): StandingCard | null {
  const card = document.querySelector<HTMLElement>(sel);
  if (card === null) {
    return null;
  }
  let opacity = 1;
  for (let a: HTMLElement | null = card; a !== null; a = a.parentElement) {
    opacity *= Number(getComputedStyle(a).opacity);
  }
  const moving = document.getAnimations().some((anim) => {
    const target = (anim.effect as KeyframeEffect | null)?.target ?? null;
    return target !== null && target.contains(card) && (anim.playState === 'running' || anim.pending) &&
      anim.effect?.getComputedTiming().endTime !== Infinity;
  });
  const box = (el: Element | null) => {
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
  };
  return {
    rest: opacity > 0.999 && !moving,
    band: box(card.querySelector('.con-notif__you')),
    why: box(card.querySelector('.con-notif__why')),
    card: box(card)!,
  };
}

type WireMenu = {
  waitingFor?: {
    type: string,
    options?: Array<{type: string, title?: string | {message: string}, cards?: Array<{name: string, calculatedCost?: number}>}>,
  },
};

const ZERO_PAY: Readonly<Record<string, number>> = {...NO_PAYMENT};

function optionTitle(o: {title?: string | {message: string}}): string {
  return typeof o.title === 'string' ? o.title : (o.title?.message ?? '');
}

/** Await THIS seat's action menu (an `or` whose options include the standard
 *  projects — the structural marker, never a translated title). */
async function awaitActionMenu(request: APIRequestContext, playerId: string): Promise<NonNullable<WireMenu['waitingFor']>> {
  await expect.poll(async () => {
    const m = await fetchPlayerModel(request, playerId) as unknown as WireMenu;
    return m.waitingFor?.type;
  }, {timeout: 30_000}).toBe('or');
  const model = await fetchPlayerModel(request, playerId) as unknown as WireMenu;
  return model.waitingFor!;
}

/** The rival builds a CITY via the standard project — no dealt card needed. */
async function rivalBuildsCity(request: APIRequestContext, rivalId: string): Promise<void> {
  const menu = await awaitActionMenu(request, rivalId);
  // STRUCTURAL pick: the standard-projects option is the `projectCard`-typed
  // option whose candidates include the City project (titles are for humans;
  // the OTHER projectCard option is the hand play, which offers no 'City').
  const idx = (menu.options ?? []).findIndex((o) =>
    o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'City'));
  expect(idx, `the menu offers standard projects (options: ${(menu.options ?? []).map((o) => `${o.type}:${optionTitle(o)}`).join(' | ')})`).toBeGreaterThanOrEqual(0);
  const city = (menu.options?.[idx].cards ?? []).find((c) => c.name === 'City');
  await sendPlayerInput(request, rivalId, {
    type: 'or', index: idx,
    response: {type: 'projectCard', card: 'City', payment: {...ZERO_PAY, megacredits: city?.calculatedCost ?? 25}},
  });
  // The project defers the placement — answer the space prompt.
  await expect.poll(async () => {
    const m = await fetchPlayerModel(request, rivalId) as unknown as {waitingFor?: {type: string}};
    return m.waitingFor?.type;
  }, {timeout: 20_000}).toBe('space');
  const prompt = await fetchPlayerModel(request, rivalId) as unknown as {waitingFor?: {spaces?: Array<string>}};
  const spaceId = (prompt.waitingFor?.spaces ?? [])[0];
  expect(spaceId, 'a legal city space exists').toBeDefined();
  await sendPlayerInput(request, rivalId, {type: 'space', spaceId});
}

/** The viewer PASSES over the API — they sit first, and the rival cannot act
 *  until the first seat's move; a pass hands the turn over cleanly while the
 *  viewer's console stays an idle observer. */
async function viewerPasses(request: APIRequestContext, viewerId: string): Promise<void> {
  const menu = await awaitActionMenu(request, viewerId);
  const idx = (menu.options ?? []).findIndex((o) => /^Pass/.test(optionTitle(o)));
  expect(idx, `the menu offers a pass (options: ${(menu.options ?? []).map(optionTitle).join(' | ')})`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, viewerId, {type: 'or', index: idx, response: {type: 'option'}});
}

const PROFILES: ReadonlyArray<{tag: string, viewport?: {width: number, height: number}}> = [
  {tag: 'hd'},
  {tag: 'tv4k', viewport: {width: 3840, height: 2160}},
];

for (const profile of PROFILES) {
  test.describe(`the «почему»-zone (Tharsis passive payout) · ${profile.tag}`, () => {
    if (profile.viewport !== undefined) {
      test.use({viewport: profile.viewport});
    }

    test('a foreign city\'s payout names WHAT + WHY + WHO on one card', async ({page, request}) => {
      test.setTimeout(300_000);

      const created = await request.post('/api/creategame', {data: tableConfig()});
      expect(created.ok(), 'the game server accepted the config').toBeTruthy();
      const {players} = await created.json();
      const [viewer, rival] = players.map((p: {id: string}) => p.id);

      await Promise.all([
        // Tharsis' own first action places a city — the generic seed answers
        // the space prompt; that own placement is self-suppressed by policy.
        seedGameOverApi(request, viewer, {corporation: VIEWER_CORP, buy: 1}),
        // The rival's research ends on «the table never came back» — the
        // first seat (the viewer) holds the opening move.
        seedGameOverApi(request, rival, {buy: 1}).catch(() => undefined),
      ]);
      // The viewer passes — the turn goes to the rival while the viewer's
      // console stays an idle observer of the incoming notification.
      await viewerPasses(request, viewer);

      await openConsole(page, viewer, '');
      await waitForBoardHome(page, 25);
      // The card is RECORDED from before the act (FLAKE ZERO — `armWitness`; its frame tick also keeps the compositor
      // painting on a quiet headless screen) — and the seeded stream has diffed silently once the feed stands quiet.
      const standing = await armWitness(page, 'notification-cause-card', readStandingCard, {args: '.con-notif--sign-positive'});
      await settle(page, {timeoutMs: 30_000, notifications: true});

      // ── the ACT: the rival builds a CITY (standard project) ────────────
      const actFrom = await pageNow(page);
      await rivalBuildsCity(request, rival);

      // ── the CARD: one card, band first, the zone right under it ────────
      const card = page.locator('.con-notif--sign-positive');
      await card.waitFor({timeout: 30_000});
      // …read in the frame its entrance is over (the record says when).
      await expect.poll(async () => (await standing.samples()).some((x) => x.t >= actFrom && x.v !== null && x.v.rest),
        {timeout: 15_000, message: 'the payout card comes to rest'}).toBe(true);
      const atRest = (await standing.samples()).find((x) => x.t >= actFrom && x.v !== null && x.v.rest)!.v!;
      await standing.stop();
      await shoot(page, `${profile.tag}-01-tharsis-payout`);

      // WHAT leads: the band states the viewer's own production gain.
      const band = card.locator('.con-notif__you');
      await expect(band).toHaveClass(/con-notif__you--positive/);
      await expect(band).toContainText(/Вы получили|You gained/i);
      await expect(band).toContainText('+1');

      // WHY, in the stable zone: ownership anchor + the corp + the trigger.
      const why = card.locator('.con-notif__why');
      await expect(why).toHaveClass(/con-notif__why--positive/);
      await expect(why).toContainText(/ВАША КОРПОРАЦИЯ|Your corporation/i);
      await expect(why).toContainText(/Тарсис|Tharsis/);
      await expect(why).toContainText(/за размещение города|for a placed city/i);

      // WHO: the actor chip in the head — stated ONCE, and never inside the
      // zone (the initiator is not the reason).
      await expect(card.locator('.con-notif__head')).toContainText('Rival');
      const whyText = (await why.innerText()).replace(/\s+/g, ' ');
      expect(whyText.includes('Rival'), `the zone must not restate the actor: «${whyText}»`).toBe(false);

      // The zone BELONGS to the band geometrically: it sits directly under it
      // (no other block between), left-aligned into the band's column.
      const bandBox = atRest.band;
      const whyBox = atRest.why;
      expect(bandBox, 'band measured').toBeTruthy();
      expect(whyBox, 'zone measured').toBeTruthy();
      expect(whyBox!.y, 'the zone hangs directly off the band').toBeGreaterThan(bandBox!.y);
      expect(whyBox!.y - (bandBox!.y + bandBox!.height), 'no foreign block between band and zone')
        .toBeLessThan(bandBox!.height);

      // No truncation of the long RU corp name: the zone's content fits the
      // card (nothing overflows the card's box horizontally).
      const cardBox = atRest.card;
      expect(whyBox!.x + whyBox!.width, 'the zone stays inside the card')
        .toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);

      // FK · PL-087 — the rival's own line («● +1 −25» — their income and their 25 M€ price in one row, no word for
      // either): two labelled groups, the price apart. Read only when the line stands (the content mode may drop it).
      const cluster = card.locator('.con-notif__cluster').first();
      if (await cluster.count() > 0 && await cluster.locator('.con-notif__chip--paid').count() > 0) {
        await expect(cluster.locator('[data-notif-side="got"]'), 'the income is labelled').toHaveCount(1);
        await expect(cluster.locator('[data-notif-side="paid"]'), 'the price is labelled').toHaveCount(1);
        await expect(cluster.locator('[data-notif-side="paid"]')).toContainText(/заплатил|paid/i);
      }
    });
  });
}
