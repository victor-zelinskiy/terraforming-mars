import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions,
  openConsole, press, seedGameOverApi, sendPlayerInput, soloGameConfig,
  waitForBoardHome, waitForTurn,
} from './consoleStart';

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
  composerCrumbStage: string,
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

/** Walk the browse grid onto the card's ADVANCE variant («Вариант 2 / 2»). */
async function focusAdvanceVariant(page: Page, tries = 16): Promise<void> {
  const variantNow = (): Promise<string> => page.evaluate(() =>
    (document.querySelector('.con-cardactions__detail-variant') as HTMLElement | null)
      ?.innerText.replace(/\s+/g, ' ').trim() ?? '');
  for (let i = 0; i < tries; i++) {
    if (/2\s*\/\s*2/.test(await variantNow())) {
      return;
    }
    await press(page, i % 2 === 0 ? 'ArrowRight' : 'ArrowDown', 500);
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
    await page.waitForTimeout(2500);

    await openCardActions(page);
    await focusAdvanceVariant(page);
    await shoot(page, '0-browse');
    // The PRINTED FORMULA in a variant tile is drawn by the render DSL at the
    // console's own scale, and its `plate()` («ГИДРОСЕТЬ») ships a fixed 130px
    // physical-card box — it must not out-grow the row it sits in.
    const plate = await page.evaluate(() => {
      const el = document.querySelector('.con-cardactions__graphic .card-plate') as HTMLElement | null;
      const row = el?.closest('.con-cardactions__graphic') as HTMLElement | null;
      if (el === null || row === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height), rowH: Math.round(rr.height)};
    });
    expect(plate, 'the advance variant draws a Hydronetwork plate').toBeDefined();
    expect(plate?.h ?? 0, `the plate must fit its own row (${JSON.stringify(plate)})`)
      .toBeLessThanOrEqual(plate?.rowH ?? 0);
    // Content-sized: the label is 9 characters, so a box wider than ~half the
    // formula row is the printed 130px slug, not a fitted plate.
    expect(plate?.w ?? 999, `the plate must size to its label (${JSON.stringify(plate)})`).toBeLessThan(130);
    await openActionFocus(page);
    await page.waitForTimeout(800);

    // The CTA names the walk, never a commit that has not happened.
    const setup = await readout(page);
    expect(setup.composerUp, 'the action focus stage must stand').toBe(true);
    expect(setup.composerCta, 'A opens the track, it does not perform the move')
      .toContain('Гидросеть');
    await shoot(page, '1-variant');

    // ── A: the door. Nothing on the wire, nothing spent. ──────────────────
    //
    // THE CARD IS ONE PHYSICAL OBJECT ACROSS THE WALK. Arm the sampler BEFORE
    // the press and record the hero's rect from the same frame: the card's
    // first PAINTED frame on the track must be where the player last saw it,
    // not a second card growing somewhere else. `setInterval`, never rAF —
    // headless Chromium drives rAF off the compositor.
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
    await page.evaluate(() => {
      type Box = {x: number, y: number, w: number, h: number};
      const w = window as unknown as {
        __carry?: {hero?: Box, samples: Array<Box & {moving: boolean}>},
      };
      const boxOf = (el: Element | null): Box | undefined => {
        if (el === null) {
          return undefined;
        }
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
      };
      w.__carry = {hero: boxOf(document.querySelector('.con-composer__actcardwrap .pcard')), samples: []};
      const tick = () => {
        const slot = document.querySelector('.con-hydro__bonus-source') as HTMLElement | null;
        const face = slot?.querySelector('.pcard') ?? null;
        const box = boxOf(face);
        if (slot === null || box === undefined || Number(getComputedStyle(slot).opacity) < 0.05 ||
            getComputedStyle(slot).visibility === 'hidden') {
          return;
        }
        // The carry's own transform rides the ANCHOR — the card's unzoomed
        // wrapper — so that is where «is this frame part of the travel» is read.
        const anchor = slot.querySelector('[data-motion-anchor]') as HTMLElement | null;
        w.__carry?.samples.push({...box, moving: (anchor ?? slot).style.transform !== ''});
      };
      setInterval(tick, 16);
    });
    await press(page, 'Enter', 2500);
    const carry = await page.evaluate(() => {
      const w = window as unknown as {
        __carry?: {hero?: {x: number, y: number, w: number, h: number},
          samples: Array<{x: number, y: number, w: number, h: number, moving: boolean}>},
      };
      return w.__carry;
    });
    const first = carry?.samples[0];
    const hero0 = carry?.hero;
    const carried = `hero=${JSON.stringify(hero0)} first=${JSON.stringify(first)} n=${carry?.samples.length}`;
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
    // frame-count threshold would be measuring the harness. The START claim
    // above is the one that carries the contract.
    const samples = carry?.samples ?? [];
    const rest = samples[samples.length - 1];
    const carrySpan = Math.max(
      Math.abs((rest?.x ?? 0) - (hero0?.x ?? 0)),
      Math.abs((rest?.y ?? 0) - (hero0?.y ?? 0)),
      Math.abs((rest?.w ?? 0) - (hero0?.w ?? 0)));
    const moved = samples.filter((sm, i, all) =>
      i > 0 && (sm.x !== all[i - 1].x || sm.y !== all[i - 1].y || sm.w !== all[i - 1].w)).length;
    if (carrySpan >= 40) {
      expect(moved, `the carry must TRAVEL, not appear (${carried} span=${carrySpan} moved=${moved})`)
        .toBeGreaterThanOrEqual(2);
    }
    // Wherever it started, it RESTS in its own slot — a FLIP that never
    // finishes parks the card off its seat for the rest of the surface's life,
    // which is exactly what a leftover inline transform would say.
    expect(rest, `the carry must come to rest (${carried})`).toBeDefined();
    expect(rest?.moving, `the carry must let go of its transform (rest=${JSON.stringify(rest)})`).toBe(false);
    const open = await readout(page);
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
    const flip = await page.evaluate(() => {
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
    });
    expect(flip, 'the source dock must be on stage').toBeDefined();
    expect(flip?.inline ?? '', `the FLIP must clear its own transform (${JSON.stringify(flip)})`).toBe('');
    expect(Math.abs((flip?.w ?? 0) - (flip?.layoutW ?? 0)),
      `the card must rest at its natural size (${JSON.stringify(flip)})`).toBeLessThanOrEqual(2);

    // …AND THE TRACK IS NOT STANDING UNDER SOMEBODY ELSE'S DIM. The shared
    // `.con-shade` belongs to whoever is presenting; the action workspace used
    // to drop it by LEAVING, and it no longer leaves. Left unhandled the
    // player got the right header over a greyed-out track.
    const shade = await page.evaluate(() => {
      const el = document.querySelector('.con-shade') as HTMLElement | null;
      return el === null ? 0 : Number(getComputedStyle(el).opacity);
    });
    expect(shade, 'the yielding workspace must hand its dim over too').toBeLessThan(0.05);
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
    const dockBox = await page.evaluate(() => {
      const el = document.querySelector('.con-hydro__bonus-source .pcard');
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
    });
    expect(dockBox, 'the track must be showing the source card').toBeDefined();
    await page.evaluate(() => {
      type Box = {x: number, y: number, w: number, h: number, op: number};
      const w = window as unknown as {__home?: Array<Box>};
      w.__home = [];
      setInterval(() => {
        const el = document.querySelector('.con-composer__actcardwrap .pcard');
        const wrap = document.querySelector('.con-composer__actcardwrap') as HTMLElement | null;
        if (el === null || wrap === null || wrap.offsetParent === null) {
          return;
        }
        // The PAINTED opacity — `opacity` is multiplicative, and the body this
        // card rides home through is exactly what used to fade it out.
        let op = 1;
        for (let n: Element | null = el; n !== null; n = n.parentElement) {
          op *= Number(getComputedStyle(n).opacity);
        }
        const r = el.getBoundingClientRect();
        w.__home?.push({x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), op});
      }, 16);
    });
    await press(page, 'Escape', 2500);
    const home = await page.evaluate(() => (window as unknown as {__home?: Array<{x: number, y: number, w: number, h: number, op: number}>}).__home ?? []);
    const firstHome = home[0];
    const homeMsg = `dock=${JSON.stringify(dockBox)} first=${JSON.stringify(firstHome)} n=${home.length}`;
    expect(firstHome, `the hero must paint on the way back (${homeMsg})`).toBeDefined();
    for (const axis of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs((firstHome?.[axis] ?? 0) - (dockBox?.[axis] ?? 0)),
        `the walk home must START at the dock's own card (${axis}: ${homeMsg})`).toBeLessThanOrEqual(6);
    }
    // …and SOLID while it travels: the un-yield's flat opacity fade used to
    // run straight through the object it was carrying.
    expect(firstHome?.op ?? 0, `the carried card must not fade home (${homeMsg})`).toBeGreaterThan(0.9);
    const back = await readout(page);
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
    // mid-flight. Two agreeing samples is the project's own settle rule.
    const readHero = () => page.evaluate(() => {
      const el = document.querySelector('.con-composer__actcardwrap') as HTMLElement | null;
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {opacity: getComputedStyle(el).opacity, w: Math.round(r.width), h: Math.round(r.height)};
    });
    let hero = await readHero();
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(200);
      const next = await readHero();
      if (JSON.stringify(next) === JSON.stringify(hero) && Number(next?.opacity ?? 0) > 0.9) {
        break;
      }
      hero = next;
    }
    expect(hero, 'the composer hero slot must exist').toBeDefined();
    expect(Number(hero?.opacity ?? 0), `the carried card must come back visible (${JSON.stringify(hero)})`)
      .toBeGreaterThan(0.9);
    expect(hero?.w ?? 0, 'and at its own size').toBeGreaterThan(100);
    expect(await serverState(request, playerId), 'B spends nothing').toEqual(before);

    // ── Re-enter and CONFIRM. ─────────────────────────────────────────────
    await press(page, 'Enter', 2500);
    expect((await readout(page)).hydroUp, 're-entering shows the step again').toBe(true);

    // THE MARKER'S OWN LEG, sampled from inside the page. `setInterval` +
    // `MutationObserver`, never `requestAnimationFrame`: headless Chromium
    // drives rAF off the compositor, so a rAF sampler stops sampling exactly
    // when the screen goes quiet.
    await page.evaluate(() => {
      const w = window as unknown as {__mk?: Array<{t: number, phase: string, x: number}>};
      w.__mk = [];
      const t0 = performance.now();
      const tick = () => {
        const el = document.querySelector('.con-hydromarker') as HTMLElement | null;
        if (el === null) {
          return;
        }
        const r = el.getBoundingClientRect();
        const phase = (el.className.match(/con-hydromarker--(\w+)/) ?? [])[1] ?? '';
        w.__mk?.push({t: Math.round(performance.now() - t0), phase, x: Math.round(r.left)});
      };
      setInterval(tick, 16);
    });

    // A on the confirm routes into the LANDED STAGE'S OWN reward step when it
    // has one (position 1 asks «2 steel or 2 plants»), and that step is where
    // the whole move commits — pick, then confirm. So the drive is bounded and
    // keyed on the SERVER's own position, never on a fixed key count.
    let after = before;
    for (let i = 0; i < 6 && after.position === before.position; i++) {
      await press(page, 'Enter', 2200);
      after = await serverState(request, playerId);
    }
    for (let i = 0; i < 20 && after.position === before.position; i++) {
      await page.waitForTimeout(700);
      after = await serverState(request, playerId);
    }
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
    const mk = await page.evaluate(() =>
      (window as unknown as {__mk?: Array<{t: number, phase: string, x: number}>}).__mk ?? []);
    const xs = mk.map((m) => m.x);
    const phases = [...new Set(mk.map((m) => m.phase))];
    const moving = xs.filter((x, i) => i > 0 && x !== xs[i - 1]).length;
    const span = mk.length > 0 ? mk[mk.length - 1].t - mk[0].t : 0;
    const report = `samples=${mk.length} span=${span}ms phases=${JSON.stringify(phases)} moving=${moving}`;
    expect(phases, `the glide must reach its ARRIVAL (${report})`).toContain('arrive');
    expect(moving, `the marker must visibly travel, not appear (${report})`).toBeGreaterThan(10);
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
    await page.waitForTimeout(2000);

    // ── The ORDINARY advance to 6 (the tag path covers it), through the UI. ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
    for (let i = 0; i < 5; i++) {
      await press(page, 'ArrowRight', 450);
    }
    const at6 = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(at6, 'the plan stands on stage 6').toBe('6');
    await press(page, 'Enter', 2500); // commit (fixed reward — no substeps)
    await page.waitForSelector('.con-hydro__layer--result', {timeout: 30_000});
    await press(page, 'Enter', 2000); // read the result → board home
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
    await expect.poll(async () =>
      ((await fetchPlayerModel(request, playerId)) as Wire).thisPlayer.deltaProject?.position ?? 0,
    {timeout: 20_000}).toBe(6);

    // ── The DOOR: origin Card Actions → the card's advance → Hydronet 6→7. ──
    await page.waitForTimeout(1500);
    await openCardActions(page);
    await focusAdvanceVariant(page);
    await openActionFocus(page);
    await page.waitForTimeout(800);
    await press(page, 'Enter', 2200); // the door
    await page.waitForSelector('.con-hydro__layer--bonus', {timeout: 15_000});
    // Stage 7 owes its pick — the cursor starts ON it (focus priority).
    const seeded = await page.evaluate(() => ({
      focusedRow: document.querySelector('.con-hydro__pickrow.con-hydro__summary--focused') !== null,
      bar: (document.querySelector('.con-cmdbar') as HTMLElement | null)?.innerText ?? '',
    }));
    expect(seeded.focusedRow, `the cursor starts on the pre-select (bar «${seeded.bar}»)`).toBe(true);
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
    // walk before a single press reaches the selector).
    const hydroHidden = () => page.evaluate(() => {
      const el = document.querySelector('.con-hydro') as HTMLElement | null;
      return el === null || getComputedStyle(el).display === 'none' || el.getBoundingClientRect().width === 0;
    });
    for (let i = 0; i < 5 && await hydroHidden(); i++) {
      await press(page, 'Enter', 1900);
      trace.push(await page.evaluate(() => [
        (document.querySelector('.con-wshead__step') as HTMLElement | null)?.innerText ?? '',
        (document.querySelector('.con-cmdbar') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? '',
        document.querySelector('.con-hydro__layer--bonus') !== null ? 'BONUS' : '',
        document.querySelector('.con-cardactions:not([style*="display: none"])') !== null ? 'SEL' : '',
      ].join(' § ')));
    }
    expect(await hydroHidden(),
      `the selector never resolved — presses: ${JSON.stringify(trace, null, 1)}`).toBe(false);
    // ── DIAGNOSTIC SAMPLER: what actually stands after the resolve. ──
    const timeline: Array<string> = [];
    for (let i = 0; i < 30; i++) {
      timeline.push(await page.evaluate(() => {
        const vis = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el === null) {
            return '∅';
          }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return `${cs.display !== 'none' && r.width > 0 ? 'V' : 'h'}·o${cs.opacity}`;
        };
        return [
          'hydro=' + vis('.con-hydro'),
          'bonus=' + vis('.con-hydro__layer--bonus'),
          'sel=' + vis('.con-cardactions'),
          'crumb=' + ((document.querySelector('.con-wshead__step') as HTMLElement | null)?.innerText ?? ''),
        ].join(' ');
      }));
      if (/bonus=V/.test(timeline[timeline.length - 1])) {
        break;
      }
      await page.waitForTimeout(400);
    }
    expect(/bonus=V/.test(timeline[timeline.length - 1]),
      `the workspace never came back visible:\n${timeline.join('\n')}`).toBe(true);
    await page.waitForTimeout(1400); // let any return motion settle
    await shoot(page, '7-deep-returned');

    // ── THE LIGHT: every load-bearing layer fully lit, nothing stale. ──
    const light = await page.evaluate(() => {
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
    });
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
});
