import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions,
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
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
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
      // SCOPED to the head that is on screen. The action workspace stays
      // MOUNTED underneath (v-show), so an unscoped query reads its hidden
      // header — the probe would then measure the wrong crumb entirely.
      crumbRoot: text('.con-hydro__head .con-wshead__root'),
      crumbSubject: text('.con-hydro__head .con-wshead__subject'),
      crumbStage: text('.con-hydro__head .con-wshead__step'),
      composerCrumbStage: text('.con-cardactions__head .con-wshead__step'),
      sourceUp: document.querySelector('.con-hydro__bonus-source') !== null,
      actions: Array.from(document.querySelectorAll('.con-hydro__bonus-action-title'))
        .map((n) => (n as HTMLElement).innerText.trim()),
      declineUp: document.querySelector('.con-hydro__bonus-action--decline') !== null,
      // The WHOLE bar — the glyph is a component, so «which entry is B» is
      // asked by the verb it carries, exactly as the player reads it.
      backLabel: bar.map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).join(' | '),
      routeText: text('.con-hydro__route'),
      composerUp: document.querySelector('.con-cardactions__stagewrap .con-composer--stage') !== null,
      composerCta: text('.con-composer__cta-label'),
      rootBox: (() => {
        // The VISIBLE head — the action workspace stays mounted (v-show) under
        // the track, so its hidden header must never be the one measured.
        const heads = Array.from(document.querySelectorAll('.con-wshead__root'));
        const live = heads.find((h) => (h as HTMLElement).offsetParent !== null);
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
    await openActionFocus(page);
    await page.waitForTimeout(800);

    // The CTA names the walk, never a commit that has not happened.
    const setup = await readout(page);
    expect(setup.composerUp, 'the action focus stage must stand').toBe(true);
    expect(setup.composerCta, 'A opens the track, it does not perform the move')
      .toContain('Гидросеть');
    await shoot(page, '1-variant');

    // ── A: the door. Nothing on the wire, nothing spent. ──────────────────
    await press(page, 'Enter', 2500);
    const open = await readout(page);
    await shoot(page, '2-hydro-step');
    expect(open.hydroUp, 'the ordinary Hydronetwork working zone must stand').toBe(true);
    expect(open.sourceUp, 'the source card must be in the zone').toBe(true);
    // The crumb keeps the ORIGIN and is the only trace of it.
    expect(open.crumbRoot).toContain('ДЕЙСТВИЯ КАРТ');
    expect(open.crumbSubject.toUpperCase()).toContain('ШТОРМОВОЙ');
    expect(open.crumbStage.toUpperCase()).toContain('ПРОДВИЖЕНИЕ');
    // …and the zone never titles itself.
    expect(open.actions, 'one verb — a move nobody demanded has no refusal')
      .toEqual(['Продвинуться']);
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
    const flip = await page.evaluate(() => {
      const el = document.querySelector('.con-hydro__bonus-source') as HTMLElement | null;
      if (el === null) {
        return 'no source';
      }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return `transform=${cs.transform} inline=${el.style.transform || '-'} box=${Math.round(r.width)}x${Math.round(r.height)} offsetW=${el.offsetWidth}`;
    });
    // eslint-disable-next-line no-console
    console.log('[FLIP]', flip);
    const geo = `setup=${JSON.stringify(setup.rootBox)} hydro=${JSON.stringify(open.rootBox)}`;
    expect(setup.rootBox, 'the composer must have a measurable crumb').toBeDefined();
    expect(open.rootBox, 'the track must have a measurable crumb').toBeDefined();
    expect(Math.abs((open.rootBox?.x ?? 0) - (setup.rootBox?.x ?? 0)), `crumb x moved (${geo})`).toBeLessThanOrEqual(2);
    expect(Math.abs((open.rootBox?.y ?? 0) - (setup.rootBox?.y ?? 0)), `crumb y moved (${geo})`).toBeLessThanOrEqual(2);

    // ── B: one logical level back, onto the same variant. ─────────────────
    await press(page, 'Escape', 2500);
    const back = await readout(page);
    await shoot(page, '3-back');
    expect(back.hydroUp, 'B leaves the track').toBe(false);
    expect(back.composerUp, 'B lands back on the card variant').toBe(true);
    expect(back.composerCta).toContain('Гидросеть');
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
});
