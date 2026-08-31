import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE HYDRONETWORK IS THE ACTION'S EXECUTION HOST — the repeated blue action
 * (Development Center: spend 1 energy → draw 1 card) runs INSIDE the hydro
 * workspace, end to end, on a DP07 traversal 0 → 7 with the stage-5 deck stop
 * on the path.
 *
 * What this pins (the Problem-2 contract):
 *  · the repeat is PRE-SELECTED on the Decision Rail (the ordered plan feeds
 *    it — 500 test-mode energy, so no conflict) and committed with ONE press;
 *  · the stage-5 stop deals ONCE, the pick confirms, and the parked batch
 *    tail drains INSIDE that answer — the repeat's drawn card arrives while
 *    the deck claim stands, so it presents EMBEDDED in the hydro zone
 *    (`.con-hydro__embed .con-reveal--embedded`), NEVER as a full-bleed band
 *    or the headless fullscreen viewer over the track;
 *  · THE STAGE-BOUND EXECUTION CONTRACT: the copied action's draw belongs to
 *    stage 7, so NOTHING of it may exist while the marker is still on the
 *    stage-5 stop. The first sample with the embedded reveal on screen comes
 *    strictly AFTER the first sample with the viewer's marker on cell 7 — the
 *    marker really walks 5 → 6 → 7 first. (This assertion used to run the other
 *    way round, pinning the defect of `20260831011413_1.jpg` as the contract:
 *    the batch presented over a track still lit at stage 5, and the traversal
 *    could not resume because that very batch was counted as the stop's own
 *    live follow-up.)
 *  · the SOURCE CONTEXT: while the copied draw is up, the workspace stands the
 *    repeated card («ПОВТОР ДЕЙСТВИЯ · Development Center») in its own seat,
 *    out of the card row and out of the focus ring;
 *  · the flow ends on the per-stage result (7 rows), and the server totals
 *    agree: position 7, energy = 500 − 1 (own activation) − 7 (movement)
 *    − 1 (the repeat's own cost), hand +3 (keep-2 + the repeat's draw).
 *
 * Screenshots → `screenshots/hydro-repeat-embed/`.
 */

const OUT = path.resolve('screenshots', 'hydro-repeat-embed');

// Tags for stages 1..7: building+power / earth / space / science / plant /
// microbe — plus the repeatable action and the traversal modifier.
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
const ALL_CARDS = [...TAG_CARDS, 'Development Center', 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'RepeatProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.47,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Settle every intermediate prompt until the action menu stands. */
async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 22)},
  } as never);
}

/** Activate a played blue card over the API — what makes it REPEATABLE. */
async function activateCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
  expect(at, 'the menu offers card actions').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'card', cards: [card]},
  } as never);
}

async function serverState(request: APIRequestContext, id: string): Promise<Wire> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const p = model.thisPlayer ?? {};
  return {
    position: p.deltaProject?.position ?? 0,
    hand: (model.cardsInHand ?? []).length,
    energy: p.energy ?? 0,
  };
}

test.describe('Hydronetwork hosts the repeated action · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('DP07 0→7: rail pre-select → deck stop → the repeat\'s draw EMBEDS → dock landing → the marker resumes → per-stage result', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.47});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);
    // USE Development Center once — the stage-7 pool is the USED actions.
    await activateCard(request, id, 'Development Center');
    await toActionMenu(request, id);
    await openConsole(page, id, '');
    // The API activation drew a card the player has not taken: its reveal is
    // the first thing the console serves on load. Take it (the arrival beat
    // suppresses A while the dealt proxies fly — press until the take lands),
    // let it reach the dock — every later press belongs to the hydro flow.
    await page.waitForSelector('.con-reveal', {timeout: 25_000});
    for (let i = 0; i < 12 && await page.locator('.con-reveal').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }
    await page.waitForSelector('.con-reveal', {state: 'detached', timeout: 25_000});
    await page.waitForTimeout(1800);
    await waitForBoardHome(page, 25);

    // ── Open the Hydronetwork; RT jumps to the farthest legal stage (7 —
    //    stage 8 needs a Jovian tag nobody played). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900); // RT — «К дальнему»
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the farthest legal stage is 7').toBe('7');

    // ── THE RAIL: two crossed choices + the stage-7 repeat pre-select. ──
    const plan = await page.evaluate(() => ({
      railRows: document.querySelectorAll('.con-hydro__pickrow').length,
      conflicts: document.querySelectorAll('.con-hydro__pickrow--conflict').length,
    }));
    expect(plan.railRows, 'choices 1+2 and the repeat pick stand on the rail').toBe(3);
    expect(plan.conflicts, '500 test-mode energy — the ordered plan feeds everything').toBe(0);
    await shoot(page, '01-plan');

    // ── Resolve choice №1 (steel) and №2 (heat production). ──
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'Enter', 900);
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'ArrowRight', 450);
    await press(page, 'Enter', 900);
    expect(await page.locator('.con-hydro__pickrow .con-hydro__bonus-tick').count(),
      'both choices resolved').toBe(2);

    // ── The seat moved ON to the REPEAT row (the focus contract) — open the
    //    picker (the pick bridge: the hydro workspace hides, ДЕЙСТВИЯ КАРТ
    //    stands in repeat mode). ──
    expect(await page.evaluate(() =>
      document.querySelector('.con-hydro__pickrow.con-hydro__summary--focused') !== null),
    'the automatic seat holds the repeat pick').toBe(true);
    await press(page, 'Enter', 2500);
    await page.waitForSelector('.con-cardactions', {timeout: 15_000});
    await shoot(page, '02-repeat-picker');
    await press(page, 'Enter', 2000); // A — the one candidate (Development Center)
    await press(page, 'Enter', 2500); // A — «Выбрать это действие»
    await page.waitForSelector('.con-hydro', {timeout: 15_000});
    await page.waitForTimeout(800);
    expect(await page.locator('.con-hydro__pickrow .con-hydro__bonus-tick').count(),
      'the repeat pick is captured too').toBe(3);
    await shoot(page, '03-plan-complete');

    // ── ARM the probes BEFORE the commit: the traversal walk, the viewer
    //    marker's cells, and EVERY `.con-reveal` sighting classified. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __seq?: number,
        __viewerCells?: Array<{i: number, cell: number}>,
        __reveals?: Array<{i: number, state: string}>,
        __seats?: Array<{i: number, on: boolean}>,
        __doneSeq?: Array<number>,
        __probeStop?: () => void,
      };
      w.__seq = 0;
      w.__viewerCells = [];
      w.__reveals = [];
      w.__seats = [];
      w.__doneSeq = [];
      const sample = () => {
        const i = ++(w.__seq as number);
        const done = document.querySelectorAll('.con-hydro__travchip--done').length;
        const seq = w.__doneSeq!;
        if (seq.length === 0 || seq[seq.length - 1] !== done) {
          seq.push(done);
        }
        const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
        const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
        if (cellAttr !== undefined && cellAttr !== null) {
          const cell = Number(cellAttr);
          const cells = w.__viewerCells!;
          if (cells.length === 0 || cells[cells.length - 1].cell !== cell) {
            cells.push({i, cell});
          }
        }
        const reveal = document.querySelector('.con-reveal');
        let state = 'none';
        if (reveal !== null) {
          state = reveal.classList.contains('con-reveal--headless') ? 'headless' :
            reveal.closest('.con-hydro__embed') !== null ? 'embedded' : 'fullscreen';
        }
        const seen = w.__reveals!;
        if (seen.length === 0 || seen[seen.length - 1].state !== state) {
          seen.push({i, state});
        }
        const seatOn = document.querySelector('.con-hydro__embedsource') !== null;
        const seats = w.__seats!;
        if (seats.length === 0 || seats[seats.length - 1].on !== seatOn) {
          if (seatOn) {
            seats.push({i, on: seatOn});
          }
        }
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 80);
      w.__probeStop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });

    // ── COMMIT — one press (every decision made → the CTA holds the seat). ──
    const before = await serverState(request, id);
    await press(page, 'Enter', 1500);

    // ── THE STAGE-5 STOP: the four dealt cards, keep 2, RT confirms. ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 60_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // ── THE REPEAT'S OWN DRAW EMBEDS: the drained tail answered in the same
    //    response — the batch presents INSIDE the hydro zone. On a miss, dump
    //    the claim's own lifecycle (who released it) instead of guessing. ──
    await page.waitForSelector('.con-hydro__embed .con-reveal--embedded', {timeout: 60_000})
      .catch(async (e) => {
        const diag = await page.evaluate(() =>
          (window as unknown as {__conColonyDiag?: () => unknown}).__conColonyDiag?.());
        throw new Error(`embedded reveal never presented; diag=${JSON.stringify(diag)}\n${String(e)}`);
      });
    const during = await page.evaluate(() => ({
      hydroVisible: (document.querySelector('.con-hydro') as HTMLElement | null)?.offsetParent !== null,
      immersive: document.querySelector('.con-hydro__panel--immersive') !== null,
    }));
    expect(during.hydroVisible, 'the track workspace never leaves the screen').toBe(true);
    expect(during.immersive, 'the embedded batch takes the frame (the immersive pose)').toBe(true);
    // Let the deal-in motion land before the photo — the acceptance frame is
    // the PRESENTED hero, not the first pixel of its arrival animation.
    await page.waitForTimeout(1300);
    const hero = await page.evaluate(() => {
      const slot = document.querySelector('.con-reveal--embedded .con-cards__slot');
      const zone = document.querySelector('.con-hydro__embed');
      const strip = document.querySelector('.con-reveal--embedded .con-reveal__strip');
      const seat = document.querySelector('.con-hydro__embedsource');
      const card = slot?.getBoundingClientRect();
      const seatBox = seat?.getBoundingClientRect();
      return {
        cardH: card?.height ?? 0,
        cardLeft: card?.left ?? 0,
        zoneH: zone?.getBoundingClientRect().height ?? 0,
        // THE USABLE PROMPT STAGE — the row the fit actually solves into, not
        // the whole zone (the head is chrome the cards may not spend).
        rowH: strip?.getBoundingClientRect().height ?? 0,
        seatRight: seatBox === undefined ? 0 : seatBox.right,
        seatOn: seatBox !== undefined,
        // A NATIVE SCROLLBAR IS A BUG on a console stage — but the honest test
        // is «is this element a SCROLL CONTAINER that overflows», not «does any
        // node have more content than box» (a clipped card face legitimately
        // does, and always did).
        scrollers: Array.from(document.querySelectorAll('.con-reveal--embedded, .con-reveal--embedded *'))
          .filter((el) => {
            const o = getComputedStyle(el);
            const scrollable = /(auto|scroll)/.test(o.overflowY + o.overflowX);
            return scrollable && (el.scrollHeight - el.clientHeight > 2 ||
              el.scrollWidth - el.clientWidth > 2);
          })
          .map((el) => `${el.className}`),
      };
    });
    // ACCEPTANCE: the presented card SPENDS the usable stage — never a
    // thumbnail in a huge empty scene, and never a compact ladder fallback.
    expect(hero.cardH, `hero ${Math.round(hero.cardH)}px of ${Math.round(hero.rowH)}px row`)
      .toBeGreaterThan(0.7 * hero.rowH);
    expect(hero.cardH, `hero ${Math.round(hero.cardH)}px of ${Math.round(hero.zoneH)}px zone`)
      .toBeGreaterThan(0.6 * hero.zoneH);
    // …and the SOURCE SEAT stands beside it without touching it: the reserve is
    // spatial, so no phase and no focus scale can make the two overlap.
    expect(hero.seatOn, 'the repeated card stands as the source seat').toBe(true);
    expect(hero.cardLeft, 'the cards clear the seat').toBeGreaterThan(hero.seatRight);
    expect(hero.scrollers, `no scrolling container on a console stage (${JSON.stringify(hero.scrollers)})`)
      .toEqual([]);
    // The seat is CONTEXT: it is in no selection and takes no focus.
    expect(await page.locator('.con-hydro__embedsource .con-cards__slot').count(),
      'the source is not one of the drawn cards').toBe(0);
    await shoot(page, '04-embedded-reveal');
    // A — take every card of the embedded batch (one press per card; the
    // arrival gate may swallow an early press, so press until it clears).
    for (let i = 0; i < 12 && await page.locator('.con-reveal--embedded').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }

    // ── The take → the dock landing → the RESUME: legs 6 and 7 glide. ──
    await page.waitForSelector('.con-hydro__result-stages', {timeout: 90_000});
    await page.evaluate(() => (window as unknown as {__probeStop?: () => void}).__probeStop?.());
    const probes = await page.evaluate(() => {
      const w = window as unknown as {
        __viewerCells?: Array<{i: number, cell: number}>,
        __reveals?: Array<{i: number, state: string}>,
        __seats?: Array<{i: number, on: boolean}>,
        __doneSeq?: Array<number>,
      };
      return {
        cells: w.__viewerCells ?? [], reveals: w.__reveals ?? [],
        seats: w.__seats ?? [], doneSeq: w.__doneSeq ?? [],
      };
    });

    // NEVER a full-bleed band, and never a HEADLESS PRESENTATION. The one
    // sanctioned headless moment is the DETACHED teardown tick — the batch
    // finished its embedded take and the surface renders NOTHING for its
    // closing frame(s) (`drawnRevealDetached`; ConsoleRevealOverlay.headless
    // exists exactly so the departing surface cannot re-dress as a band) —
    // recognized as «directly after 'embedded', directly before gone».
    const leaks = probes.reveals.filter((r, idx) => {
      if (r.state === 'fullscreen') {
        return true;
      }
      if (r.state !== 'headless') {
        return false;
      }
      const prev = probes.reveals[idx - 1]?.state;
      const next = probes.reveals[idx + 1]?.state;
      return !(prev === 'embedded' && (next === 'none' || next === undefined));
    });
    expect(leaks, `no reveal ever PRESENTED outside the workspace (${JSON.stringify(probes.reveals)})`).toEqual([]);
    const embedded = probes.reveals.filter((r) => r.state === 'embedded');
    expect(embedded.length, 'the repeat\'s draw presented embedded').toBeGreaterThan(0);

    // ── THE STAGE-BOUND EXECUTION CONTRACT ────────────────────────────────
    // The copied action's draw is stage 7's reward, and the server resolved it
    // inside the response that answered the stage-5 pick. It may therefore not
    // appear until the marker has physically walked 5 → 6 → 7 and settled.
    const firstEmbeddedOn = Math.min(...embedded.map((r) => r.i));
    const firstOn6 = probes.cells.find((c) => c.cell >= 6);
    const firstOn7 = probes.cells.find((c) => c.cell >= 7);
    expect(firstOn6, `the marker walked to 6 (${JSON.stringify(probes.cells)})`).toBeDefined();
    expect(firstOn7, `the marker reached 7 (${JSON.stringify(probes.cells)})`).toBeDefined();
    expect(firstOn6!.i, 'the marker leaves the stage-5 stop BEFORE stage 7 shows anything')
      .toBeLessThan(firstEmbeddedOn);
    expect(firstOn7!.i, 'the copied draw mounts only once cell 7 is reached')
      .toBeLessThan(firstEmbeddedOn);
    // …and so does the source seat: it materialises WITH its stage, not before.
    const firstSeatOn = probes.seats.length > 0 ? probes.seats[0].i : Infinity;
    expect(firstSeatOn, `the source seat appeared (${JSON.stringify(probes.seats)})`)
      .toBeLessThan(Infinity);
    expect(firstOn7!.i, 'the source card does not precede the stage that repeats it')
      .toBeLessThanOrEqual(firstSeatOn);

    // The walk stayed ordered and complete: cells only ever move forward.
    for (let i = 1; i < probes.cells.length; i++) {
      expect(probes.cells[i].cell, `forward only (${probes.cells.map((c) => c.cell).join(',')})`)
        .toBeGreaterThanOrEqual(probes.cells[i - 1].cell);
    }
    expect(probes.cells[probes.cells.length - 1].cell, 'the marker finished on 7').toBe(7);

    // ── The per-stage result: seven rows, nothing excluded. ──
    const result = await page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__result-stagerow').length,
      excl: document.querySelectorAll('.con-hydro__result-stagerow--excl').length,
    }));
    expect(result.rows, 'seven stages, one row each').toBe(7);
    expect(result.excl, 'nothing excluded on this path').toBe(0);
    await shoot(page, '05-result');

    // ── The server's totals agree with everything the screen promised. ──
    const after = await serverState(request, id);
    expect(after.position, 'the marker\'s server position').toBe(7);
    expect(after.energy, 'movement 7 + the repeat\'s own 1').toBe(before.energy - 8);
    expect(after.hand, 'keep-2 + the repeat\'s draw').toBe(before.hand + 3);
  });
});
