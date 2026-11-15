import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions,
  openConsole, press, pressUntil, pressUntilVisible, seedGameOverApi, sendPlayerInput, settle, soloGameConfig,
  waitForBoardHome, waitForTurn, walkFocusUntil,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, pageNow, witnessOf} from './witness';

/**
 * THE TRACK'S SECOND DOOR — «Штормовой барьер» → «Открыть Гидросеть».
 *
 * The sibling of `console-card-trade-entry.spec.ts`, and it asserts the same
 * family of claims, because they are what make a card's move and the player's
 * own move ONE flow rather than two:
 *
 *   · the press COMMITS NOTHING — the energy is untouched, the marker has not
 *     moved and the card is still activatable; that is what makes B real;
 *   · the breadcrumb keeps the origin («ДЕЙСТВИЯ КАРТ › ШТОРМОВОЙ БАРЬЕР › …»)
 *     and is the only trace of it — the zone never titles itself;
 *   · the working zone is the ORDINARY Hydronetwork one, with the card as its
 *     source and NO «Пропустить» (nothing was demanded, so there is nothing to
 *     decline — B is the way out, and it says so);
 *   · B walks back ONE logical level, onto the same variant, spending nothing;
 *   · the one confirm at the end pays 1 energy, moves the marker exactly one
 *     step and leaves the generation's own advance untouched.
 *
 * The RULES are guarded server-side (`tests/cards/delta/StormSurgeBarrier.spec`)
 * and the zone's own contract in `consoleHydroCardEntry.spec` — re-driving
 * those here would only re-measure somebody else's claim.
 */

/**
 * How many 16 ms ticks the carried card may spend BLANK on its way home.
 * `runAnchorCarry` blanks the arriving anchor on mount and un-blanks it in the
 * PIN, so the honest cost is the mount frame plus the flush that follows it;
 * anything longer is the card visibly going missing. Measured on this flow
 * (see the `[delta-home]` line the probe prints). Counted as the old sampler
 * counted it — the 16 ms ticks of a FREE main thread that saw the card blank
 * (the home witness's own timer tick, `homeWitness`): a starved frame runs no
 * tick, so a long frame is never read as a long blank.
 */
const DELTA_HOME_BLANK_TICKS = 4;

const CARD = 'Storm Surge Barrier';
const OUT_DIR = path.resolve('screenshots', 'console-delta-card-advance');

const CFG = soloGameConfig({
  players: [{name: 'DeltaTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: [CARD],
  // A corporation with no first action and no economics of its own, so the
  // pregame ends on the action menu and the spec's own numbers are readable.
  customCorporationsList: ['Thorgate'],
  seed: 0.37,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

/** The option index of a named action-menu entry (English keys on the wire). */
function optionIndex(menu: Wire, title: string): number {
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === title);
  expect(at, `the action menu must offer «${title}» — got ` +
    `${JSON.stringify((menu.options ?? []).map(titleOf))}`).toBeGreaterThanOrEqual(0);
  return at;
}

/** The board's own hex adjacency, mirrored from `Board.computeAdjacentSpaces`. */
function neighbourIds(spaces: ReadonlyArray<Wire>, id: string): ReadonlyArray<string> {
  const self = spaces.find((s) => s.id === id);
  if (self === undefined) {
    return [];
  }
  const maxY = Math.max(...spaces.map((s) => s.y ?? 0));
  const middle = maxY / 2;
  const {x, y} = self;
  const coords: Array<[number, number]> = [[x - 1, y], [x + 1, y]];
  const topLeft: [number, number] = [x, y - 1];
  const topRight: [number, number] = [x, y - 1];
  const bottomLeft: [number, number] = [x, y + 1];
  const bottomRight: [number, number] = [x, y + 1];
  if (y < middle) {
    bottomLeft[0]--;
    topRight[0]++;
  } else if (y === middle) {
    bottomRight[0]++;
    topRight[0]++;
  } else {
    topLeft[0]--;
    bottomRight[0]++;
  }
  coords.push(topLeft, topRight, bottomLeft, bottomRight);
  return spaces
    .filter((s) => s.spaceType !== 'colony' && coords.some(([cx, cy]) => s.x === cx && s.y === cy))
    .map((s) => s.id as string);
}

/** Answer whatever stands until the action menu is live again. */
async function toActionMenu(request: APIRequestContext, id: string, rounds = 12): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < rounds; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    // The between-generations research buy is the only thing this walk meets;
    // taking nothing keeps the hand (and the spec's story) unchanged.
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

/** A full M€-only payment of `amount` (every other purse stays at zero). */
function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

/**
 * Play a card out of a menu entry — the SAME `SelectProjectCardToPlay` input
 * backs both «Standard projects» and «Play project card», so one helper serves
 * both, and the price is always the SERVER's own `calculatedCost`.
 */
async function playFromMenu(
  request: APIRequestContext, id: string, entry: string, card: string,
): Promise<Wire> {
  const menu = await toActionMenu(request, id);
  const at = optionIndex(menu, entry);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `«${entry}» must offer ${card} — got ` +
    `${JSON.stringify(((menu.options ?? [])[at].cards ?? []).map((c: Wire) => c.name))}`).toBeDefined();
  return await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 0)},
  } as never) as Wire;
}

/** Run one standard project, placing its tile on the space `pickSpace` chooses. */
async function standardProject(
  request: APIRequestContext, id: string, project: string, pickSpace: (spaces: ReadonlyArray<string>) => string,
): Promise<void> {
  const model = await playFromMenu(request, id, 'Standard projects', project);
  const prompt = model.waitingFor as Wire;
  expect(prompt?.type, `${project} must ask for a space`).toBe('space');
  await sendPlayerInput(request, id, {
    type: 'space', spaceId: pickSpace(prompt.spaces ?? []),
  } as never);
}

/** The viewer's own live numbers, straight off the server. */
async function serverState(request: APIRequestContext, id: string): Promise<{
  energy: number, position: number, usedThisGeneration: boolean, canAct: boolean,
}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const me = model.thisPlayer as Wire;
  return {
    energy: me.energy,
    position: me.deltaProject?.position ?? -1,
    usedThisGeneration: me.deltaProject?.usedThisGeneration === true,
    canAct: (me.tableau ?? []).some((c: Wire) => c.name === CARD),
  };
}

type Readout = {
  hydroUp: boolean,
  crumbRoot: string,
  crumbSubject: string,
  crumbStage: string,
  sourceUp: boolean,
  actions: ReadonlyArray<string>,
  declineUp: boolean,
  backLabel: string,
  routeText: string,
  composerUp: boolean,
  composerCta: string,
  /** Which workspace owns the DRAWN header — it must not change on the walk. */
  crumbHost: string,
  /** The crumb ROOT's own box — the line must not move between the two hosts. */
  rootBox: {x: number, y: number, h: number} | undefined,
  /** The source card's box, wherever it currently lives. */
  sourceBox: {x: number, y: number, w: number} | undefined,
};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const text = (sel: string): string =>
      (document.querySelector(sel) as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    const bar = Array.from(document.querySelectorAll('.con-cmdbar__cmd'));
    return {
      hydroUp: document.querySelector('.con-hydro__layer--bonus') !== null,
      // THE HEAD THE PLAYER IS ACTUALLY READING. Both workspaces keep a header
      // in the DOM through the walk — the host's draws, the step's goes ghost
      // (`visibility: hidden`) — so the probe has to pick the DRAWN one, and
      // WHICH one it is is itself the claim: it must be the same node before
      // and after.
      ...(() => {
        const heads = Array.from(document.querySelectorAll('.con-wshead'));
        const live = heads.find((h) => getComputedStyle(h).visibility !== 'hidden' &&
          (h as HTMLElement).offsetParent !== null);
        const t = (sel: string): string =>
          (live?.querySelector(sel) as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
        return {
          crumbHost: live === null || live === undefined ? '' : (live.className.match(/con-(\w+)__head/) ?? [])[1] ?? '',
          crumbRoot: t('.con-wshead__root'),
          crumbSubject: t('.con-wshead__subject'),
          crumbStage: t('.con-wshead__step'),
        };
      })(),
      sourceUp: document.querySelector('.con-hydro__bonus-source') !== null,
      // DIRECT children only: the permanent glyph slot nests its own span
      // (`.gp-glyph`, itself a last-of-type among the slot's children), so an
      // unscoped descendant query re-collects the badge's «A» as an action.
      actions: Array.from(document.querySelectorAll('.con-hydro__ctazone .con-hydro__cta > span:last-of-type, .con-hydro__bonus-action-title'))
        .map((n) => (n as HTMLElement).innerText.trim()),
      declineUp: document.querySelector('.con-hydro__bonus-action--decline') !== null,
      // The WHOLE bar — the glyph is a component, so «which entry is B» is
      // asked by the verb it carries, exactly as the player reads it.
      backLabel: bar.map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).join(' | '),
      routeText: text('.con-hydro__route'),
      composerUp: document.querySelector('.con-cardactions__stagewrap .con-composer--stage') !== null,
      composerCta: text('.con-composer__cta-label'),
      rootBox: (() => {
        const heads = Array.from(document.querySelectorAll('.con-wshead__root'));
        const live = heads.find((h) => (h as HTMLElement).offsetParent !== null &&
          getComputedStyle(h).visibility !== 'hidden');
        if (live === undefined) {
          return undefined;
        }
        const r = live.getBoundingClientRect();
        return {x: Math.round(r.left), y: Math.round(r.top), h: Math.round(r.height)};
      })(),
      sourceBox: (() => {
        const el = document.querySelector('.con-hydro__bonus-source, .con-composer__actcardwrap');
        if (el === null || (el as HTMLElement).offsetParent === null) {
          return undefined;
        }
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width)};
      })(),
    };
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The readout AT REST — the crumb's box and the source's box are compared across the walk, so both sides settle. */
async function settledReadout(page: Page, what: string): Promise<Readout> {
  return readSettled(page, () => readout(page), {message: what});
}

type Box = {x: number, y: number, w: number, h: number};

/** A card face's box, rounded (a subpixel that jitters is not motion); undefined when it is not in the document. */
async function faceBox(page: Page, selector: string): Promise<Box | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
  }, selector);
}

/**
 * THE CARRY WITNESS — the card on its way INTO the track, RECORDED (FLAKE ZERO: `armWitness`, armed before the press):
 * the dock's `.pcard` box whenever the dock paints, and whether the carry's transform still rides its anchor. Settled —
 * «the first PAINTED frame» is the state a task leaves (the mount and the pin are two writes of one task; a sample
 * between them is a frame no one painted).
 */
type CarrySeen = (Box & {moving: boolean}) | null;
const CARRY_WITNESS = 'delta-carry';
async function armCarryWitness(page: Page): Promise<void> {
  await armWitness<CarrySeen>(page, CARRY_WITNESS, () => {
    const slot = document.querySelector('.con-hydro__bonus-source') as HTMLElement | null;
    const face = slot?.querySelector('.pcard') ?? null;
    if (slot === null || face === null || Number(getComputedStyle(slot).opacity) < 0.05 ||
        getComputedStyle(slot).visibility === 'hidden') {
      return null;
    }
    const r = face.getBoundingClientRect();
    // The carry's own transform rides the ANCHOR — the card's unzoomed
    // wrapper — so that is where «is this frame part of the travel» is read.
    const anchor = slot.querySelector('[data-motion-anchor]') as HTMLElement | null;
    return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      moving: (anchor ?? slot).style.transform !== ''};
  }, {settled: true});
}

/**
 * THE HOME WITNESS — the hero card on its way BACK, RECORDED: its box and its PAINTED opacity (multiplicative up the
 * chain — the body it rides home through is exactly what used to fade it). Settled, for the same «first painted frame»
 * reason. While the card is BLANK each sample carries its 16 ms tick (the witness's own timer tick, `tickMs`), so a
 * blank that stands is one distinct sample per tick of a free main thread — the old sampler's own measure — while a
 * painted pose is recorded only when it changes.
 */
type HomeSeen = (Box & {op: number, tick?: number}) | null;
const HOME_WITNESS = 'delta-home';
async function armHomeWitness(page: Page): Promise<void> {
  await armWitness<HomeSeen>(page, HOME_WITNESS, () => {
    const el = document.querySelector('.con-composer__actcardwrap .pcard');
    const wrap = document.querySelector('.con-composer__actcardwrap') as HTMLElement | null;
    if (el === null || wrap === null || wrap.offsetParent === null) {
      return null;
    }
    let op = 1;
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      op *= Number(getComputedStyle(n).opacity);
    }
    const r = el.getBoundingClientRect();
    const box = {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      op: Math.round(op * 1000) / 1000};
    return op > 0.9 ? box : {...box, tick: Math.floor(performance.now() / 16)};
  }, {settled: true, tickMs: 16});
}

/** THE MARKER WITNESS — the Hydronetwork marker's phase and its x, RECORDED from before the confirm. */
type MarkerSeen = {phase: string, x: number} | null;
const MARKER_WITNESS = 'delta-marker';
async function armMarkerWitness(page: Page): Promise<void> {
  await armWitness<MarkerSeen>(page, MARKER_WITNESS, () => {
    const el = document.querySelector('.con-hydromarker') as HTMLElement | null;
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {phase: (el.className.match(/con-hydromarker--(\w+)/) ?? [])[1] ?? '', x: Math.round(r.left)};
  });
}

/** Walk the browse grid onto the card's ADVANCE variant («Вариант 2 / 2»). */
async function focusAdvanceVariant(page: Page, tries = 16): Promise<void> {
  const variantNow = (): Promise<string> => page.evaluate(() =>
    (document.querySelector('.con-cardactions__detail-variant') as HTMLElement | null)
      ?.innerText.replace(/\s+/g, ' ').trim() ?? '');
  for (let i = 0; i < tries; i++) {
    const at = await variantNow();
    if (/2\s*\/\s*2/.test(at)) {
      return;
    }
    // Each hop is act → verify: the press, then its whole window for the detail to answer.
    await pressUntil(page, i % 2 === 0 ? 'ArrowRight' : 'ArrowDown', async () => (await variantNow()) !== at,
      {tries: 1, settleMs: 500});
  }
  throw new Error(`the advance variant was never focused (detail=«${await variantNow()}»)`);
}

test.describe('console — the card-action Hydronetwork door', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('open → back (nothing spent) → open → confirm (1 energy, one step)', async ({page, request}) => {
    test.setTimeout(600_000);

    // ── The board the card needs: an ocean, and a city of the player's
    //    beside it. Driven over the API — the walk is SETUP, never the subject.
    const playerId = await createGameWithCards(request, [CARD], {config: CFG});
    await seedGameOverApi(request, playerId, {cards: [CARD]});

    let oceanId = '';
    await standardProject(request, playerId, 'Aquifer', (spaces) => {
      oceanId = spaces[0];
      return oceanId;
    });
    const board = (await fetchPlayerModel(request, playerId) as Wire).game.spaces as ReadonlyArray<Wire>;
    const beside = new Set(neighbourIds(board, oceanId));
    await standardProject(request, playerId, 'City', (spaces) => {
      const next = spaces.find((s) => beside.has(s));
      expect(next, `no legal city space beside the ocean ${oceanId}`).toBeDefined();
      return next as string;
    });

    // ── Play the card (its requirement is now met). Still setup.
    const model = await playFromMenu(request, playerId, 'Play project card', CARD);
    expect((model.thisPlayer as Wire).tableau.map((c: Wire) => c.name),
      'the card must be on the table').toContain(CARD);
    await toActionMenu(request, playerId);

    const before = await serverState(request, playerId);
    expect(before.canAct, 'the card is on the table').toBe(true);

    // ── Now the SUBJECT: the console flow. ────────────────────────────────
    await openConsole(page, playerId);
    await waitForBoardHome(page, 25);
    await waitForTurn(page);
    await settle(page);

    await openCardActions(page);
    await focusAdvanceVariant(page);
    await shoot(page, '0-browse');
    // The PRINTED FORMULA in a variant tile is drawn by the render DSL at the
    // console's own scale, and its `plate()` («ГИДРОСЕТЬ») ships a fixed 130px
    // physical-card box — it must not out-grow the row it sits in. Measured at rest.
    const plate = await readSettled(page, () => page.evaluate(() => {
      const el = document.querySelector('.con-cardactions__graphic .card-plate') as HTMLElement | null;
      const row = el?.closest('.con-cardactions__graphic') as HTMLElement | null;
      if (el === null || row === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height), rowH: Math.round(rr.height)};
    }), {message: 'the advance variant\'s plate'});
    expect(plate, 'the advance variant draws a Hydronetwork plate').toBeDefined();
    expect(plate?.h ?? 0, `the plate must fit its own row (${JSON.stringify(plate)})`)
      .toBeLessThanOrEqual(plate?.rowH ?? 0);
    // Content-sized: the label is 9 characters, so a box wider than ~half the
    // formula row is the printed 130px slug, not a fitted plate.
    expect(plate?.w ?? 999, `the plate must size to its label (${JSON.stringify(plate)})`).toBeLessThan(130);
    await openActionFocus(page);

    // The CTA names the walk, never a commit that has not happened. Read AT REST
    // — its crumb box is the reference the track's crumb is compared against.
    const setup = await settledReadout(page, 'the action focus stage');
    expect(setup.composerUp, 'the action focus stage must stand').toBe(true);
    expect(setup.composerCta, 'A opens the track, it does not perform the move')
      .toContain('Гидросеть');
    await shoot(page, '1-variant');

    // ── A: the door. Nothing on the wire, nothing spent. ──────────────────
    //
    // THE CARD IS ONE PHYSICAL OBJECT ACROSS THE WALK. Measure the hero AT
    // REST and arm the carry witness BEFORE the press: the card's first
    // PAINTED frame on the track must be where the player last saw it, not a
    // second card growing somewhere else. The witness records the product's own
    // writes (and every frame), so a starved renderer cannot hide the frame.
    //
    // ⚠️ MEASURE THE PICTURE, NEVER THE SLOT THAT HOLDS IT. This probe used to
    // sample `.con-hydro__bonus-source` — the dock's grid CELL — and it passed
    // for the whole life of a plainly visible defect: a FLIP maps one box onto
    // another, so the cell was faithfully pinned to the hero's corner at the
    // hero's width, while the card INSIDE it (a caption's height lower, and
    // stretched to a column two cards wide) arrived at 43 % of the size the
    // player had just been holding. What the eye follows is the `.pcard`, so
    // that is what the claim is about — on BOTH sides, and in all four
    // dimensions (a height check is what makes «same box» mean «same object»
    // rather than «same left edge»).
    const hero0 = await readSettled(page, () => faceBox(page, '.con-composer__actcardwrap .pcard'),
      {message: 'the composer hero before the door'});
    await armCarryWitness(page);
    await press(page, 'Enter', 2500);
    // THE WITNESS'S WINDOW IS A STATE, NOT A DURATION. The 2500 ms settle above
    // is the press's own pacing; whether the track's source dock has taken the
    // card by then is a different question, and on a loaded run the answer is
    // no — the read then came back with ZERO samples and reported «the card
    // must PAINT on the track» about a carry that had not started yet
    // (measured 1/6 at `--repeat-each=6`, n=0). So: the dock's own card, the
    // carry come to REST (a painted pose that has let go of its transform),
    // then the console's quiet — and only then the record is asked.
    await page.locator('.con-hydro__bonus-source .pcard')
      .waitFor({state: 'visible', timeout: 20_000}).catch(() => {});
    await witnessOf<CarrySeen>(page, CARRY_WITNESS).waitFor((v) => v !== null && !v.moving, {timeoutMs: 15_000})
      .catch(() => undefined); // the asserts below own the verdict, with their own report
    await settle(page);
    const samples = (await witnessOf<CarrySeen>(page, CARRY_WITNESS).stop())
      .map((s) => s.v).filter((v): v is NonNullable<CarrySeen> => v !== null);
    const first = samples[0];
    const carried = `hero=${JSON.stringify(hero0)} first=${JSON.stringify(first)} n=${samples.length}`;
    expect(hero0, `the composer hero must have been measured (${carried})`).toBeDefined();
    expect(first, `the card must PAINT on the track (${carried})`).toBeDefined();
    // It starts where it was, AS IT WAS: same corner, same size, within a hair.
    // The pin derives its delta from the live box, so this is exact by
    // construction — the tolerance is for sub-pixel rounding, not for slack.
    for (const axis of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs((first?.[axis] ?? 0) - (hero0?.[axis] ?? 0)),
        `the carry must START as the hero's own card (${axis}: ${carried})`).toBeLessThanOrEqual(6);
    }
    // …and its FIRST painted frame is already part of the travel. Without the
    // mount-time hold the surface beat the enter hook by two or three frames
    // and painted the card at its destination first — a second card appearing
    // beside the one the player was holding, and only then jumping back.
    expect(first?.moving,
      `the card's first painted frame must already be travelling (${carried})`).toBe(true);
    // …and it covers the ground in frames rather than in one jump. The bar is
    // deliberately «at least one INTERMEDIATE pose»: headless Chromium drives
    // rAF off the compositor, so a GSAP tween advances in a handful of coarse
    // steps here (measured: four distinct poses across a 300 ms travel) and a
    // frame-count threshold would be measuring the harness. Asked of the record
    // as EVER: a painted pose that is neither the first one nor the rest. The
    // START claim above is the one that carries the contract.
    const rest = samples[samples.length - 1];
    const carrySpan = Math.max(
      Math.abs((rest?.x ?? 0) - (hero0?.x ?? 0)),
      Math.abs((rest?.y ?? 0) - (hero0?.y ?? 0)),
      Math.abs((rest?.w ?? 0) - (hero0?.w ?? 0)));
    const samePose = (a: Box | undefined, b: Box | undefined) => a !== undefined && b !== undefined &&
      a.x === b.x && a.y === b.y && a.w === b.w;
    const intermediate = samples.some((sm) => !samePose(sm, first) && !samePose(sm, rest));
    if (carrySpan >= 40) {
      expect(intermediate, `the carry must TRAVEL, not appear (${carried} span=${carrySpan} ` +
        `poses=${new Set(samples.map((sm) => `${sm.x},${sm.y},${sm.w}`)).size})`).toBe(true);
    }
    // Wherever it started, it RESTS in its own slot — a FLIP that never
    // finishes parks the card off its seat for the rest of the surface's life,
    // which is exactly what a leftover inline transform would say.
    expect(rest, `the carry must come to rest (${carried})`).toBeDefined();
    expect(rest?.moving, `the carry must let go of its transform (rest=${JSON.stringify(rest)})`).toBe(false);
    // AT REST — its crumb box is compared with the setup's below.
    const open = await settledReadout(page, 'the Hydronetwork step');
    await shoot(page, '2-hydro-step');
    expect(open.hydroUp, 'the ordinary Hydronetwork working zone must stand').toBe(true);
    expect(open.sourceUp, 'the source card must be in the zone').toBe(true);
    // The crumb keeps the ORIGIN and is the only trace of it.
    expect(open.crumbRoot).toContain('ДЕЙСТВИЯ КАРТ');
    expect(open.crumbSubject.toUpperCase()).toContain('ШТОРМОВОЙ');
    // Only the TAIL advanced — «НАСТРОЙКА» → «ГИДРОСЕТЬ», the subdivision the
    // player walked into.
    expect(open.crumbStage.toUpperCase()).toContain('ГИДРОСЕТЬ');
    // …and it is the SAME header that advanced it. The workspace does not
    // leave when a step of it takes the screen — it yields its body and keeps
    // its line, which is the only way root and subject can be guaranteed not
    // to blink or shift.
    expect(open.crumbHost, 'the drawn header must still belong to the host workspace')
      .toBe(setup.crumbHost);
    expect(open.crumbHost).toBe('cardactions');
    // …and the zone never titles itself.
    expect(open.actions, 'ONE primary in the decision\'s own vocabulary — no refusal beside it')
      .toEqual(['ВЫБЕРИТЕ НАГРАДУ']);
    expect(open.declineUp, 'a card entry offers no «Пропустить»').toBe(false);
    // The bar is UPPERCASED by CSS, so the comparison is case-insensitive.
    expect(open.backLabel.toLowerCase(), 'B names the level it goes back to')
      .toContain('назад к выбору действия');
    expect(open.backLabel.toLowerCase(), 'A and X keep their verbs beside it')
      .toContain('осмотреть');
    expect(open.routeText.replace(/\s/g, ''), 'the route states the server price').toContain('−1');

    const parked = await serverState(request, playerId);
    expect(parked, 'the door commits NOTHING').toEqual(before);

    // THE CRUMB LINE DOES NOT MOVE ON THE WALK. It is the one thing that
    // proves the two screens are one flow, and two hand-written frame
    // paddings had it stepping 11px left and 12px up between them.
    // THE CARRIED CARD SETTLES. It FLIPs from the composer's hero slot into
    // the track's source dock, and a FLIP that never clears its own transform
    // is the worst of both worlds: the card parks off its slot for the rest of
    // the surface's life. (Measured before the fix: a stale
    // `translate(-78px, -216px) scale(0.95)` — the anchor had been measured a
    // frame before the track laid itself out, and the layer's own entry
    // cascade owned the same transform.)
    const flip = await readSettled(page, () => page.evaluate(() => {
      const el = document.querySelector('.con-hydro__bonus-source') as HTMLElement | null;
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {
        inline: el.style.transform,
        w: Math.round(r.width),
        layoutW: el.offsetWidth,
      };
    }), {message: 'the source dock at rest'});
    expect(flip, 'the source dock must be on stage').toBeDefined();
    expect(flip?.inline ?? '', `the FLIP must clear its own transform (${JSON.stringify(flip)})`).toBe('');
    expect(Math.abs((flip?.w ?? 0) - (flip?.layoutW ?? 0)),
      `the card must rest at its natural size (${JSON.stringify(flip)})`).toBeLessThanOrEqual(2);

    // …AND THE TRACK IS NOT STANDING UNDER SOMEBODY ELSE'S DIM. The shared
    // `.con-shade` belongs to whoever is presenting; the action workspace used
    // to drop it by LEAVING, and it no longer leaves. Left unhandled the
    // player got the right header over a greyed-out track.
    await expect.poll(() => page.evaluate(() => {
      const el = document.querySelector('.con-shade') as HTMLElement | null;
      return el === null ? 0 : Number(getComputedStyle(el).opacity);
    }), {message: 'the yielding workspace must hand its dim over too'}).toBeLessThan(0.05);
    const geo = `setup=${JSON.stringify(setup.rootBox)} hydro=${JSON.stringify(open.rootBox)}`;
    expect(setup.rootBox, 'the composer must have a measurable crumb').toBeDefined();
    expect(open.rootBox, 'the track must have a measurable crumb').toBeDefined();
    expect(Math.abs((open.rootBox?.x ?? 0) - (setup.rootBox?.x ?? 0)), `crumb x moved (${geo})`).toBeLessThanOrEqual(2);
    expect(Math.abs((open.rootBox?.y ?? 0) - (setup.rootBox?.y ?? 0)), `crumb y moved (${geo})`).toBeLessThanOrEqual(2);

    // ── B: one logical level back, onto the same variant. ─────────────────
    //
    // …AND THE CARD WALKS BACK THE SAME WAY IT WALKED IN. The workspace does
    // not re-enter (it never left — it YIELDED), so there is no transition
    // hook to carry it: without `carryAnchorsHome` the hero simply faded back
    // into its slot while a second copy dissolved inside the departing track.
    // Same claim as the entry, mirrored: the FIRST painted frame of the hero
    // card is the DOCK's own box.
    const dockBox = await readSettled(page, () => faceBox(page, '.con-hydro__bonus-source .pcard'),
      {message: 'the track\'s source card before B'});
    expect(dockBox, 'the track must be showing the source card').toBeDefined();
    await armHomeWitness(page);
    await press(page, 'Escape', 2500);
    // The record is asked once the hero has PAINTED (bounded — the asserts below own the verdict).
    await witnessOf<HomeSeen>(page, HOME_WITNESS).waitFor((v) => v !== null && v.op > 0.9, {timeoutMs: 15_000})
      .catch(() => undefined);
    const home = (await witnessOf<HomeSeen>(page, HOME_WITNESS).stop())
      .map((s) => s.v).filter((v): v is NonNullable<HomeSeen> => v !== null);
    // THE FIRST **PAINTED** FRAME — the claim has always been about the frame
    // the player can see, and the witness reads the slot from the moment it is
    // LAID OUT. `runAnchorCarry` mounts the arriving anchor blanked
    // (`holdCarriedAnchors`: «a carried object may not paint at a home it is
    // about to leave») and the PIN is what un-blanks it — so the samples before
    // the pin are the hold, at the home box, at opacity 0. Taking `home[0]`
    // measured that hold and reported «the walk home must START at the dock's
    // own card» with a Δ of 57 px and `op: 0` in its own message.
    const firstPainted = home.findIndex((h) => h.op > 0.9);
    const firstHome = firstPainted < 0 ? undefined : home[firstPainted];
    // The blank's length in 16 ms ticks of a free main thread (`armHomeWitness`): the distinct ticks that saw it.
    const blankPrefix = firstPainted < 0 ? -1 :
      new Set(home.slice(0, firstPainted).map((h) => h.tick ?? -1)).size;
    const homeMsg = `dock=${JSON.stringify(dockBox)} first-painted=${JSON.stringify(firstHome)} ` +
      `blank-ticks=${blankPrefix} n=${home.length} head=${JSON.stringify(home.slice(0, 4))}`;
    console.log(`[delta-home] ${homeMsg}`);
    expect(firstHome, `the hero must paint on the way back (${homeMsg})`).toBeDefined();
    for (const axis of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs((firstHome?.[axis] ?? 0) - (dockBox?.[axis] ?? 0)),
        `the walk home must START at the dock's own card (${axis}: ${homeMsg})`).toBeLessThanOrEqual(6);
    }
    // …and SOLID from there on: the un-yield's flat opacity fade used to run
    // straight through the object it was carrying.
    expect(firstHome?.op ?? 0, `the carried card must not fade home (${homeMsg})`).toBeGreaterThan(0.9);
    // …AND THE BLANK IS A MOUNT FRAME, NOT A GAP. The hold exists so the card
    // cannot paint at its home before the pin; if it outlives a couple of
    // sampler ticks (16 ms each) the player sees the card they are holding
    // VANISH and re-appear mid-flight — the exact defect `runAnchorCarry`'s
    // «the old code held the object INVISIBLE for that whole gap» names.
    expect(blankPrefix, `the carried card may not go missing on the way home (${homeMsg})`)
      .toBeLessThanOrEqual(DELTA_HOME_BLANK_TICKS);
    const back = await settledReadout(page, 'back on the card variant');
    await shoot(page, '3-back');
    expect(back.hydroUp, 'B leaves the track').toBe(false);
    expect(back.composerUp, 'B lands back on the card variant').toBe(true);
    expect(back.composerCta).toContain('Гидросеть');
    // …AND THE CARD CAME BACK WITH IT. The walk out blanks the departing copy
    // so the travelling card is never double — free for a surface that then
    // unmounts, a permanent hole in this one, which waits mounted under the
    // track. Its hero slot came up empty and stayed empty for the rest of the
    // game until the entrance learned to heal what the exit posed.
    // SETTLED, not sampled: the slot's own keyed face swap and the returning
    // FLIP both run on the way back, so a one-shot read can catch either
    // mid-flight. Two agreeing reads a frame apart is the project's own settle rule (`readSettled`).
    const hero = await readSettled(page, () => page.evaluate(() => {
      const el = document.querySelector('.con-composer__actcardwrap') as HTMLElement | null;
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {opacity: getComputedStyle(el).opacity, w: Math.round(r.width), h: Math.round(r.height)};
    }), {message: 'the composer hero back in its slot'});
    expect(hero, 'the composer hero slot must exist').toBeDefined();
    expect(Number(hero?.opacity ?? 0), `the carried card must come back visible (${JSON.stringify(hero)})`)
      .toBeGreaterThan(0.9);
    expect(hero?.w ?? 0, 'and at its own size').toBeGreaterThan(100);
    expect(await serverState(request, playerId), 'B spends nothing').toEqual(before);

    // ── Re-enter and CONFIRM. ─────────────────────────────────────────────
    await press(page, 'Enter', 2500);
    await expect.poll(async () => (await readout(page)).hydroUp, {message: 're-entering shows the step again'}).toBe(true);

    // THE MARKER'S OWN LEG, RECORDED from before the confirm (`armWitness` —
    // the product's own writes + a frame tick): every phase it wears and every
    // x it is painted at, on the page's own clock.
    await armMarkerWitness(page);

    // A on the confirm routes into the LANDED STAGE'S OWN reward step when it
    // has one (position 1 asks «2 steel or 2 plants»), and that step is where
    // the whole move commits — pick, then confirm. So the drive is bounded and
    // keyed on the SERVER's own position, never on a fixed key count: each A
    // gets its whole window, and a slow answer is WAITED for, never re-pressed.
    const moved = async () => (await serverState(request, playerId)).position !== before.position;
    await pressUntil(page, 'Enter', moved, {tries: 6, settleMs: 2200});
    await expect.poll(moved, {timeout: 14_000, message: 'the card\'s move never committed on the server'}).toBe(true);
    const after = await serverState(request, playerId);
    await shoot(page, '4-committed');

    // ── THE MARKER ACTUALLY TRAVELLED. ────────────────────────────────────
    //
    // The client leg is armed at the confirm but cannot start until the layer
    // re-renders and both stop anchors measure stable; the RESPONSE beats that
    // now that the WebSocket channel answers in about one frame, where the old
    // 1 s poll gave the glide its run for free. Left unhandled, the gate opened
    // past a director that did not exist yet, the view committed, the layer
    // unmounted mid-glide and the marker simply APPEARED on the new stop
    // (measured: 19 samples over 343 ms, phases charge+glide only, 5 moving).
    // So this asserts the PHRASE, not a duration: it ran to its own landing.
    const marked = await witnessOf<MarkerSeen>(page, MARKER_WITNESS).samples();
    const readAt = await pageNow(page);
    await witnessOf<MarkerSeen>(page, MARKER_WITNESS).stop();
    const mk = marked.filter((s) => s.v !== null).map((s) => ({t: s.t, ...(s.v as NonNullable<MarkerSeen>)}));
    const xs = mk.map((m) => m.x);
    const phases = [...new Set(mk.map((m) => m.phase))];
    // The x positions it was PAINTED at between its first and its last — a pose the record saw in between.
    const distinctXs = new Set(xs).size;
    const moving = xs.filter((x, i) => i > 0 && x !== xs[i - 1]).length;
    // The leg's span on the PAGE's clock: from the marker's first record to the record that ended its presence (or
    // the read, while it still stands) — the window the old sampler spanned.
    const lastIdx = marked.map((s) => s.v !== null).lastIndexOf(true);
    const ended = lastIdx >= 0 && lastIdx < marked.length - 1 ? marked[lastIdx + 1].t : readAt;
    const span = mk.length > 0 ? ended - mk[0].t : 0;
    const report = `samples=${mk.length} span=${span}ms phases=${JSON.stringify(phases)} moving=${moving} xs=${distinctXs}`;
    // …AND REACHED ITS LANDING. `arrive` is a PHASE, not necessarily a painted
    // state: `hydroMarkerDirector` emits it and calls `tryLock()` in the SAME
    // tick, so when the commit is already answered — and over the WebSocket
    // channel it is, in about one frame — `finishLock()` runs synchronously and
    // the `--arrive` class never survives to a paint (measured 2/6 at
    // `--repeat-each=6`: `phases=["glide","lock","pulse"]`, span 1067 ms, 26
    // moving samples, with the leg entirely healthy). `lock`/`pulse` are the
    // honest witness of the same fact and STRICTLY imply it: `finishLock` is
    // reachable only through `tryLock`, which returns unless `arriveReached`.
    // The regression this guards (the marker APPEARING on the new stop:
    // charge+glide only, 19 samples over 343 ms, 5 moving) has neither.
    expect(phases.some((p) => p === 'arrive' || p === 'lock'),
      `the glide must reach its ARRIVAL (${report})`).toBe(true);
    // «It travelled» is asked of the record as EVER — a pose painted strictly between where it stood and where it
    // landed; how MANY such frames a machine paints is the machine's (the old «> 10 moving samples» counted frames).
    const startX = xs[0];
    const endX = xs[xs.length - 1];
    const between = xs.some((x) => x !== startX && x !== endX && (x - startX) * (endX - x) > 0);
    expect(between, `the marker must visibly travel, not appear (${report})`).toBe(true);
    expect(span, `the whole leg must play, not one frame of it (${report})`).toBeGreaterThan(600);

    // The move: exactly one step, exactly one energy, and the generation's own
    // advance is untouched.
    expect(after.position, 'exactly one step').toBe(before.position + 1);
    expect(after.energy, 'exactly one energy').toBe(before.energy - 1);
    expect(after.usedThisGeneration, 'the generation own advance is untouched').toBe(false);
  });

  /**
   * ══ THE NESTED CHAIN — the dark-screen regression ═══════════════════════
   *
   *   Card Actions (origin) → Storm Surge Barrier → Hydronet (6 → 7)
   *     → the repeat-action selector (a SECOND Card Actions instance)
   *       → pick → back to the SAME Hydronet instance.
   *
   * The workspace must come back FULLY LIT (no stale dim/pose on the root,
   * rail, scene, ctx or act; no shade; input alive), with the chosen action
   * standing in the pre-select summary and focus ON that summary — the same
   * press may not commit the move. This is the exact chain that shipped as
   * «после выбора действия весь экран остаётся под тёмным overlay».
   */
  test('nested repeat selector: origin → Hydronet → selector → back, fully lit', async ({page, request}) => {
    test.setTimeout(600_000);
    const DEEP_CARDS = [
      CARD,                      // Storm Surge Barrier (the door)
      'Solar Power',             // power + building
      'Development Manager',     // earth
      'Space Station',           // space
      'Research',                // science ×2
      'Adapted Lichen',          // plant
      'Tardigrades',             // microbe; ACTIVE — the repeatable action
    ];
    const DEEP_CFG = soloGameConfig({
      players: [{name: 'DeepChain', color: 'red', beginner: false, handicap: 0, first: true}],
      expansions: {deltaProject: true},
      customProjectCards: DEEP_CARDS,
      customCorporationsList: ['Thorgate'],
      seed: 0.53,
    });
    const playerId = await createGameWithCards(request, DEEP_CARDS, {config: DEEP_CFG});
    await seedGameOverApi(request, playerId, {cards: DEEP_CARDS});

    // The card's own requirement (a city of ours beside an ocean) + the tag
    // path to stage 7 + a used blue action. All setup, all over the API.
    let oceanId = '';
    await standardProject(request, playerId, 'Aquifer', (spaces) => {
      oceanId = spaces[0];
      return oceanId;
    });
    const board = (await fetchPlayerModel(request, playerId) as Wire).game.spaces as ReadonlyArray<Wire>;
    const beside = new Set(neighbourIds(board, oceanId));
    await standardProject(request, playerId, 'City', (spaces) => {
      const next = spaces.find((s) => beside.has(s));
      expect(next, `no legal city space beside the ocean ${oceanId}`).toBeDefined();
      return next as string;
    });
    for (const card of DEEP_CARDS) {
      await playFromMenu(request, playerId, 'Play project card', card);
    }
    // USE the blue action — that is what makes it repeatable at stage 7.
    {
      const menu = await toActionMenu(request, playerId);
      const at = (menu.options ?? []).findIndex((o: Wire) =>
        (o.cards ?? []).some((c: Wire) => c.name === 'Tardigrades') && titleOf(o) !== 'Play project card');
      expect(at, `the menu offers Tardigrades' action — got ` +
        `${JSON.stringify((menu.options ?? []).map(titleOf))}`).toBeGreaterThanOrEqual(0);
      await sendPlayerInput(request, playerId, {
        type: 'or', index: at, response: {type: 'card', cards: ['Tardigrades']},
      } as never);
      await toActionMenu(request, playerId);
    }

    await openConsole(page, playerId);
    await waitForBoardHome(page, 25);
    await waitForTurn(page);
    await settle(page);

    // ── The ORDINARY advance to 6 (the tag path covers it), through the UI. ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
    // Walk the plan onto stage 6 — each hop verified by the focused stop moving, never «→ five times».
    const focusedStop = () => page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    await walkFocusUntil(page, async () => (await focusedStop()) === '6', focusedStop, 16, 450);
    await expect.poll(focusedStop, {message: 'the plan stands on stage 6'}).toBe('6');
    await press(page, 'Enter', 2500); // commit (fixed reward — no substeps)
    await page.waitForSelector('.con-hydro__layer--result', {timeout: 30_000});
    await press(page, 'Enter', 2000); // read the result → board home
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
    await expect.poll(async () =>
      ((await fetchPlayerModel(request, playerId)) as Wire).thisPlayer.deltaProject?.position ?? 0,
    {timeout: 20_000}).toBe(6);

    // ── The DOOR: origin Card Actions → the card's advance → Hydronet 6→7. ──
    await settle(page);
    await openCardActions(page);
    await focusAdvanceVariant(page);
    await openActionFocus(page);
    await settle(page);
    await press(page, 'Enter', 2200); // the door
    await page.waitForSelector('.con-hydro__layer--bonus', {timeout: 15_000});
    // Stage 7 owes its pick — the cursor starts ON it (focus priority).
    const bar = await page.evaluate(() => (document.querySelector('.con-cmdbar') as HTMLElement | null)?.innerText ?? '');
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('.con-hydro__pickrow.con-hydro__summary--focused') !== null),
    {message: `the cursor starts on the pre-select (bar «${bar}»)`}).toBe(true);
    await shoot(page, '5-deep-preselect');

    // ── INTO the nested selector (a SECOND Card Actions instance) and back. ──
    await press(page, 'Enter', 1800);
    // ⚠️ The ORIGIN instance is also `.con-cardactions`, mounted but hidden
    // (v-show) — a bare selector waits on THAT one and times out while the
    // repeat instance is plainly on screen. `:visible` picks the live one.
    await page.waitForSelector('.con-cardactions:visible', {timeout: 15_000});
    await shoot(page, '6-deep-selector');
    const trace: Array<string> = [];
    // «Returned» is the hydro ROOT being VISIBLE again (the bonus layer sits
    // in the DOM even while the root is v-show-hidden — counting it stops the
    // walk before a single press reaches the selector). A visibility test (a
    // laid-out box), never a measurement.
    const hydroHidden = () => page.evaluate(() => {
      const el = document.querySelector('.con-hydro') as HTMLElement | null;
      return el === null || getComputedStyle(el).display === 'none' || el.offsetWidth === 0;
    });
    // Act → verify: each A gets its whole window for the hydro root to come back before the next; what the screen
    // said after each look is kept (a changed line only) for the report.
    const resolved = await pressUntil(page, 'Enter', async () => {
      const line = await page.evaluate(() => [
        (document.querySelector('.con-wshead__step') as HTMLElement | null)?.innerText ?? '',
        (document.querySelector('.con-cmdbar') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? '',
        document.querySelector('.con-hydro__layer--bonus') !== null ? 'BONUS' : '',
        document.querySelector('.con-cardactions:not([style*="display: none"])') !== null ? 'SEL' : '',
      ].join(' § '));
      if (trace.at(-1) !== line) {
        trace.push(line);
      }
      return !(await hydroHidden());
    }, {tries: 5, settleMs: 1900});
    expect(resolved, `the selector never resolved — presses: ${JSON.stringify(trace, null, 1)}`).toBe(true);
    // ── DIAGNOSTIC TIMELINE: what actually stands after the resolve — polled until the bonus layer is visible, every
    //    changed line kept for the report. ──
    const timeline: Array<string> = [];
    const backLit = await expect.poll(async () => {
      const line = await page.evaluate(() => {
        const vis = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el === null) {
            return '∅';
          }
          const cs = getComputedStyle(el);
          return `${cs.display !== 'none' && el.offsetWidth > 0 ? 'V' : 'h'}·o${cs.opacity}`;
        };
        return [
          'hydro=' + vis('.con-hydro'),
          'bonus=' + vis('.con-hydro__layer--bonus'),
          'sel=' + vis('.con-cardactions'),
          'crumb=' + ((document.querySelector('.con-wshead__step') as HTMLElement | null)?.innerText ?? ''),
        ].join(' ');
      });
      if (timeline.at(-1) !== line) {
        timeline.push(line);
      }
      return /bonus=V/.test(line);
    }, {timeout: 12_000}).toBe(true).then(() => true, () => false);
    expect(backLit, `the workspace never came back visible:\n${timeline.join('\n')}`).toBe(true);

    // ── THE LIGHT: every load-bearing layer fully lit, nothing stale — read
    //    once the return motion has come to REST (never after a guessed pause). ──
    const light = await readSettled(page, () => page.evaluate(() => {
      const op = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el === null) {
          return undefined;
        }
        return {
          opacity: Number(getComputedStyle(el).opacity),
          inline: (el.style.opacity ?? '') + '|' + (el.style.transform ?? '') + '|' + (el.style.visibility ?? ''),
          display: getComputedStyle(el).display,
        };
      };
      const shade = document.querySelector('.con-shade') as HTMLElement | null;
      return {
        root: op('.con-hydro'),
        rail: op('.con-hydro__rail'),
        scene: op('.con-hydro__scene'),
        panel: op('.con-hydro__panel'),
        ctx: op('.con-hydro__ctx'),
        act: op('.con-hydro__act'),
        origin: op('.con-cardactions'),
        shade: shade === null ? undefined :
          {opacity: Number(getComputedStyle(shade).opacity)},
        inert: document.querySelector('.con-hydro[inert], .con-hydro [inert]') !== null,
        focusedRow: document.querySelector('.con-hydro__pickrow.con-hydro__summary--focused') !== null,
        ctaFocused: document.querySelector('.con-hydro__cta--focused') !== null,
        summary: (document.querySelector('.con-hydro__pickrow') as HTMLElement | null)
          ?.innerText.replace(/\s+/g, ' ').trim() ?? '',
        bar: (document.querySelector('.con-cmdbar') as HTMLElement | null)
          ?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      };
    }), {message: 'the returned workspace at rest'});
    await shoot(page, '7-deep-returned');
    for (const key of ['root', 'rail', 'scene', 'panel', 'ctx', 'act'] as const) {
      const l = (light as any)[key];
      expect(l, `${key} is on screen`).toBeDefined();
      expect(l.opacity, `${key} must be fully lit (inline «${l.inline}»)`).toBeGreaterThan(0.95);
    }
    expect((light as any).shade?.opacity ?? 0, 'no stale shade').toBeLessThan(0.05);
    expect(light.inert, 'nothing inert').toBe(false);
    expect(String(light.summary), 'the chosen action stands in the summary').toMatch(/Tardigrades|Тихоходки/i);
    // THE ANSWER MOVES THE CURSOR ON: nothing left open → the offer's CTA.
    expect(light.focusedRow, 'the resolved decision does not hold the cursor').toBe(false);
    expect(light.ctaFocused, `focus advanced to the final CTA (bar «${light.bar}»)`).toBe(true);

    // ── The same press does not commit: the position is still 6. ──
    const pos = ((await fetchPlayerModel(request, playerId)) as Wire).thisPlayer.deltaProject?.position ?? 0;
    expect(pos, 'nothing committed by the return').toBe(6);
  });

  /**
   * ══ «СВЕРНУТЬ» OVER THE CARD'S STEP — the restored track is lit ═════════
   *
   *   Card Actions → Storm Surge Barrier → Hydronet 4 → 5 («Гидромоделирование»,
   *   draw 4 keep 2) → B (collapse) → A on the board-home card → the SAME pick.
   *
   * The restore re-mounts the whole stack at once, so the action workspace
   * comes back ALREADY yielded to its step. It used to take the shared dim
   * back on its re-entry (the yield watcher gave it up at setup, the `appear`
   * entry re-acquired it a flush later and nothing fired again): the owner's
   * 4K frame of 2026-10-28 — «ДЕЙСТВИЯ КАРТ › ВЫБОР» bright over a track and
   * four cards greyed out under a full shade.
   */
  test('collapse → restore of the card\'s Hydronet step: no stale shade', async ({page, request}) => {
    test.setTimeout(600_000);
    const PATH_CARDS = [
      CARD,                  // Storm Surge Barrier (the door)
      'Solar Power',         // power + building
      'Development Manager', // earth
      'Space Station',       // space
      'Research',            // science ×2 — stage 5
    ];
    const PATH_CFG = soloGameConfig({
      players: [{name: 'ShadeProbe', color: 'red', beginner: false, handicap: 0, first: true}],
      expansions: {deltaProject: true},
      customProjectCards: PATH_CARDS,
      customCorporationsList: ['Thorgate'],
      seed: 0.61,
    });
    const playerId = await createGameWithCards(request, PATH_CARDS, {config: PATH_CFG});
    await seedGameOverApi(request, playerId, {cards: PATH_CARDS});

    // ── Setup over the API: the card's requirement, the tag path, 0 → 4. ──
    let oceanId = '';
    await standardProject(request, playerId, 'Aquifer', (spaces) => {
      oceanId = spaces[0];
      return oceanId;
    });
    const board = (await fetchPlayerModel(request, playerId) as Wire).game.spaces as ReadonlyArray<Wire>;
    const beside = new Set(neighbourIds(board, oceanId));
    await standardProject(request, playerId, 'City', (spaces) => {
      const next = spaces.find((s) => beside.has(s));
      expect(next, `no legal city space beside the ocean ${oceanId}`).toBeDefined();
      return next as string;
    });
    for (const card of PATH_CARDS) {
      await playFromMenu(request, playerId, 'Play project card', card);
    }
    {
      const menu = await toActionMenu(request, playerId);
      const at = optionIndex(menu, 'Advance on the Hydronetwork track');
      const asked = await sendPlayerInput(request, playerId, {type: 'or', index: at, response: {type: 'option'}} as never) as Wire;
      expect((asked.waitingFor as Wire)?.type, 'the advance asks its step count').toBe('deltaProject');
      await sendPlayerInput(request, playerId, {type: 'deltaProject', amount: 4} as never);
      await toActionMenu(request, playerId);
    }
    const before = await serverState(request, playerId);
    expect(before.position, 'the marker stands on 4').toBe(4);

    await openConsole(page, playerId);
    await waitForBoardHome(page, 25);
    await waitForTurn(page);

    // ── The door, then the one commit: the card's step lands on 5. ──
    await openCardActions(page);
    await focusAdvanceVariant(page);
    await openActionFocus(page);
    await pressUntilVisible(page, 'Enter', '.con-hydro__layer--bonus', {tries: 3, settleMs: 2200});
    // Stage 5 has no choice — A on the step is the commit. Keyed on the
    // SERVER's position, so a slow answer is waited for, never re-pressed.
    await pressUntil(page, 'Enter', async () => (await serverState(request, playerId)).position !== before.position,
      {tries: 4, settleMs: 2200});
    await expect.poll(async () => (await serverState(request, playerId)).position,
      {timeout: 20_000}).toBe(5);
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 30_000});

    const shadeOpacity = () => page.evaluate(() => {
      const el = document.querySelector('.con-shade') as HTMLElement | null;
      return el === null ? 0 : Number(getComputedStyle(el).opacity);
    });
    await expect.poll(shadeOpacity, {timeout: 5_000, message: 'the step stands lit before the park'})
      .toBeLessThan(0.05);
    await shoot(page, '8-shade-step');

    // ── B: the deck pick's own minimize parks the WHOLE stack. ──
    await press(page, 'Escape', 1600);
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
    await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 15_000});

    // ── A on the board-home card: the same instance at the same depth. ──
    await expect(page.locator('.con-mandatory')).toBeVisible({timeout: 20_000});
    await press(page, 'Enter', 2200);
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 20_000});
    await expect(page.locator('.con-cardactions--yielded'),
      'the action workspace came back yielded to its step').toHaveCount(1, {timeout: 10_000});
    await expect.poll(async () => (await readout(page)).crumbRoot, {message: 'the crumb keeps the origin'})
      .toContain('ДЕЙСТВИЯ КАРТ');

    // THE CLAIM: no dim over the restored step. Polled past the shade's own
    // 260 ms off-fade — the defect never cleared at all.
    await expect.poll(shadeOpacity, {timeout: 5_000, message: 'no stale shade over the restored step'})
      .toBeLessThan(0.05);
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('.con-cardactions')?.getAttribute('data-motion-shade-yielded') ?? ''),
    {message: 'the yielded surface declares its surrendered dim'}).toBe('1');
    await shoot(page, '9-shade-restored');
    expect((await serverState(request, playerId)).position, 'the restore commits nothing').toBe(5);
  });
});
