import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE STAGE-BOUND EXECUTION CONTRACT — the exact scenario of the negative
 * acceptance frame `20260831011413_1.jpg`.
 *
 * WHAT WENT WRONG THERE. A DP07 traversal crosses stages 5, 6 and 7. Stage 5
 * («Гидромоделирование») asks the player to keep 2 of 4 cards; stage 7's reward
 * REPEATS a used blue action, pre-selected as «Центр ИИ», whose action draws 2
 * more. The server resolves the WHOLE traversal inside the request that answers
 * the stage-5 pick (the parked batch tail drains in that very request), so AI
 * Central's cards were on the wire while the marker was still standing on cell
 * 5 — and the console showed them: two batches on one scene, over a track whose
 * highlight, header and marker all still said «Гидромоделирование».
 *
 * WHAT THIS PINS, in order:
 *  1. NOTHING of stage 7 exists while the marker is on the stage-5 stop — not
 *     the cards, not the source card, not the header, not the hints. Sampled
 *     continuously, so an early frame is a failure and not a lucky miss.
 *  2. The marker really WALKS 5 → 6 → 7; the copied action's batch mounts
 *     strictly after cell 7 is reached, and the source card never precedes it.
 *  3. SOURCE IDENTITY is the card the player CHOSE, not the first eligible one
 *     — two used blue actions are on offer and the plan names the second.
 *  4. The drawn cards are the scene's protagonists (≥70 % of the usable row),
 *     the source seat is beside them and never inside their row or focus.
 *  5. `L3 Источник` opens the SHARED fullscreen with ONE copy of the card on
 *     screen (its seat is held empty for the flight), and closing it returns to
 *     the same prompt with the same untaken cards — nothing is replayed.
 *
 * Screenshots → `screenshots/hydro-stage-bound-repeat/`.
 */

const OUT = path.resolve('screenshots', 'hydro-stage-bound-repeat');

// Tags for stages 1..7: building+power / earth / space / science / plant /
// microbe — plus BOTH repeatable actions (Development Center is the decoy the
// plan must not pick) and the traversal modifier. `Research` + `Development
// Center` are what make AI Central's «3 science tags» requirement legal.
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
const ALL_CARDS = [...TAG_CARDS, 'Development Center', 'AI Central', 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'StageBound', color: 'red', beginner: false, handicap: 0, first: true}],
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
  expect(offered, `${card} is in hand and playable`).toBeDefined();
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

/**
 * Clear every reveal the API activations left standing.
 *
 * TWO activations mean TWO batches, and they do not arrive together: the second
 * mounts a beat after the first is dismissed. So the drain is rounds, not one
 * pass — «no reveal right now» is not «no reveal», and exiting on the gap is
 * exactly how the setup used to walk into the Hydronetwork with a band still
 * owning the pad.
 */
async function drainReveals(page: Page): Promise<void> {
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < 12 && await page.locator('.con-reveal').count() > 0; i++) {
      await press(page, 'Enter', 800);
    }
    await page.waitForTimeout(2000);
    if (await page.locator('.con-reveal').count() === 0) {
      return;
    }
  }
  expect(await page.locator('.con-reveal').count(), 'every seeded reveal was taken').toBe(0);
}

test.describe('The Hydronetwork traversal is stage-bound · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('DP07 0→7: stage 5 answered → the marker WALKS 5→6→7 → only THEN «Центр ИИ» acts', async ({page, request}) => {
    test.setTimeout(600_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.47});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);
    // USE BOTH blue actions — the stage-7 pool is the USED actions, so the
    // picker offers two and the plan has to name one. Development Center is
    // played (and used) FIRST, so it is the first eligible candidate: if the
    // source were derived from «the first one» or «the last one looked at»
    // rather than from the plan, this test would show the wrong card.
    await activateCard(request, id, 'Development Center');
    await toActionMenu(request, id);
    await activateCard(request, id, 'AI Central');
    await toActionMenu(request, id);

    await openConsole(page, id, '');
    await page.waitForSelector('.con-reveal', {timeout: 25_000});
    await drainReveals(page);
    await waitForBoardHome(page, 25);

    // ── Open the Hydronetwork; RT jumps to the farthest legal stage (7 —
    //    stage 8 needs a Jovian tag nobody played). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900); // RT — «К дальнему»
    expect(await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? ''),
    'the farthest legal stage is 7').toBe('7');

    // ── THE RAIL: two crossed choices, then the stage-7 repeat pre-select. ──
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'Enter', 900);
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'ArrowRight', 450);
    await press(page, 'Enter', 900);

    // ── THE PICK: walk to AI CENTRAL by its structural identity, never by
    //    position and never by the tile's translated text. ──
    await press(page, 'Enter', 2500);
    await page.waitForSelector('.con-cardactions', {timeout: 15_000});
    const focusedCard = () => page.evaluate(() =>
      document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    const offered = await page.evaluate(() => Array.from(
      document.querySelectorAll('.con-cardactions__tile'))
      .map((t) => t.getAttribute('data-action-card') ?? ''));
    expect(offered, `both used actions are candidates (${JSON.stringify(offered)})`)
      .toEqual(expect.arrayContaining(['Development Center', 'AI Central']));
    for (let i = 0; i < 6 && await focusedCard() !== 'AI Central'; i++) {
      await press(page, 'ArrowRight', 450);
    }
    expect(await focusedCard(), 'the cursor holds AI Central').toBe('AI Central');
    await shoot(page, '01-repeat-picker');
    await press(page, 'Enter', 2000); // A — descend into AI Central
    await press(page, 'Enter', 2500); // A — «Выбрать это действие»
    await page.waitForSelector('.con-hydro', {timeout: 15_000});
    await page.waitForTimeout(800);

    // ── ARM THE CENSUS. Every sample records, together: where the viewer's
    //    marker stands, whether any stage-7 artifact is on screen, and what the
    //    breadcrumb's stage segment says. Recording them TOGETHER is the point:
    //    the defect is a CO-OCCURRENCE («cards from 7 while the marker is on
    //    5»), and three independent timelines cannot prove its absence. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __seq?: number, __census?: Array<Record<string, unknown>>, __stop?: () => void,
      };
      w.__seq = 0;
      w.__census = [];
      const sample = () => {
        const i = ++(w.__seq as number);
        const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
        const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
        const seat = document.querySelector('.con-hydro__embedsource');
        const row = {
          cell: cellAttr === undefined || cellAttr === null ? -1 : Number(cellAttr),
          reveal: document.querySelector('.con-hydro__embed .con-reveal--embedded') !== null,
          anyReveal: document.querySelector('.con-reveal') !== null,
          seat: seat !== null,
          seatCard: seat?.getAttribute('data-zoom-slot') ?? '',
          stage: (document.querySelector('.con-wshead__stage')?.textContent ?? '').trim(),
        };
        const census = w.__census!;
        const prev = census[census.length - 1];
        if (prev === undefined || JSON.stringify(prev) !== JSON.stringify({...row, i: prev?.i})) {
          census.push({...row, i});
        }
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 60);
      w.__stop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });

    // ── COMMIT — one press. ──
    await press(page, 'Enter', 1500);

    // ── THE STAGE-5 STOP: the four dealt cards, keep 2, RT confirms. ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 60_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await shoot(page, '02-stage5-pick');
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // ── The copied action's own draw — which may only exist once cell 7 has
    //    been reached. (`20260831011413_1.jpg` is this selector resolving with
    //    the marker still on 5.) ──
    await page.waitForSelector('.con-hydro__embed .con-reveal--embedded', {timeout: 90_000});
    await page.waitForTimeout(1400);

    await page.evaluate(() => (window as unknown as {__stop?: () => void}).__stop?.());
    const census = await page.evaluate(() =>
      (window as unknown as {__census?: Array<Record<string, unknown>>}).__census ?? []);
    const dump = JSON.stringify(census);

    // ① NOTHING OF STAGE 7 WHILE THE MARKER IS BEHIND IT. Every single sample
    //    taken while the marker was on a cell below 7 must be free of the
    //    copied action's artifacts — cards AND source card.
    const early = census.filter((r) => (r.cell as number) >= 0 && (r.cell as number) < 7);
    expect(early.length, `the census watched the marker below 7 (${dump})`).toBeGreaterThan(0);
    for (const r of early) {
      expect(r.reveal, `stage-7 cards at cell ${r.cell} (${dump})`).toBe(false);
      expect(r.seat, `the source card at cell ${r.cell} (${dump})`).toBe(false);
    }

    // ② THE WALK REALLY HAPPENED — 5, then 6, then 7, forward only.
    const cells = census.map((r) => r.cell as number).filter((c) => c >= 0);
    expect(cells, `the marker stood on 5 (${dump})`).toContain(5);
    expect(cells, `the marker crossed 6 (${dump})`).toContain(6);
    expect(cells[cells.length - 1], `the marker finished on 7 (${dump})`).toBe(7);
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i], `forward only (${cells.join(',')})`).toBeGreaterThanOrEqual(cells[i - 1]);
    }

    // ③ SOURCE IDENTITY is the CHOSEN card — never the first eligible one.
    const seated = census.filter((r) => r.seat === true);
    expect(seated.length, `the source card materialised (${dump})`).toBeGreaterThan(0);
    for (const r of seated) {
      expect(r.seatCard, 'the seat shows the card the plan named').toBe('AI Central');
      expect(r.cell, 'the source never precedes its own stage').toBe(7);
    }

    // ④ THE CARDS ARE THE SCENE. Two cards, each spending the usable row, with
    //    the seat beside them — not in their row, not in the focus ring.
    const geom = await page.evaluate(() => {
      const slots = Array.from(document.querySelectorAll('.con-reveal--embedded .con-cards__slot'));
      const strip = document.querySelector('.con-reveal--embedded .con-reveal__strip');
      const seat = document.querySelector('.con-hydro__embedsource');
      return {
        cards: slots.map((s) => {
          const b = s.getBoundingClientRect();
          return {h: b.height, left: b.left};
        }),
        rowH: strip?.getBoundingClientRect().height ?? 0,
        seatRight: seat?.getBoundingClientRect().right ?? 0,
        seatInRow: strip?.contains(seat ?? null) === true,
        focusable: document.querySelectorAll('.con-hydro__embedsource .con-cards__slot--focused').length,
      };
    });
    expect(geom.cards.length, 'AI Central drew two cards').toBe(2);
    for (const c of geom.cards) {
      expect(c.h, `card ${Math.round(c.h)}px of ${Math.round(geom.rowH)}px row`)
        .toBeGreaterThan(0.7 * geom.rowH);
      expect(c.left, 'every card clears the seat').toBeGreaterThan(geom.seatRight);
    }
    expect(geom.seatInRow, 'the source is not part of the drawn row').toBe(false);
    expect(geom.focusable, 'the source never takes the focus ring').toBe(0);
    await shoot(page, '03-stage7-copied-draw');

    // ⑤ L3 ИСТОЧНИК — the shared fullscreen, ONE copy, and a return that
    //    replays nothing. (The seat is held EMPTY for the flight, which is what
    //    makes «never two copies of one card» structural rather than lucky.)
    const untakenBefore = await page.locator('.con-reveal--embedded .con-cards__slot').count();
    await press(page, 'KeyC', 1200); // L3 — «Источник» (consoleActionModel: KeyC → stickL)
    await page.waitForTimeout(1200);
    const zoomed = await page.evaluate(() => ({
      open: document.querySelector('dialog.con-zoom') !== null,
      // The seat's own slot is emptied while the viewer holds the card.
      seatHeld: document.querySelector('.con-hydro__embedsource .con-zoom-hold') !== null ||
        (document.querySelector('.con-hydro__embedsource-card')?.getBoundingClientRect().height ?? 0) < 4,
      stillEmbedded: document.querySelector('.con-hydro__embed .con-reveal--embedded') !== null,
    }));
    expect(zoomed.open, 'L3 opened the shared fullscreen viewer').toBe(true);
    expect(zoomed.seatHeld, 'the source slot is held empty — never two copies').toBe(true);
    expect(zoomed.stillEmbedded, 'the child prompt was never unmounted').toBe(true);
    await shoot(page, '04-source-fullscreen');

    await press(page, 'Escape', 1400); // B — «ЗАКРЫТЬ» (consoleActionModel: Escape → back)
    await page.waitForSelector('dialog.con-zoom', {state: 'detached', timeout: 15_000});
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      untaken: document.querySelectorAll('.con-reveal--embedded .con-cards__slot').length,
      seat: document.querySelector('.con-hydro__embedsource')?.getAttribute('data-zoom-slot') ?? '',
      seatCopies: document.querySelectorAll('.con-hydro__embedsource').length,
      cell: Number(document.querySelector('.con-hydro__stop-marker--viewer')
        ?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker') ?? -1),
    }));
    expect(after.untaken, 'the same batch — nothing was re-dealt').toBe(untakenBefore);
    expect(after.seat, 'the source came back to its seat').toBe('AI Central');
    expect(after.seatCopies, 'exactly one seat').toBe(1);
    expect(after.cell, 'the marker did not move for an inspection').toBe(7);

    // ── Take the batch and let the flow finish: the traversal must still end
    //    honestly (the gate holds nothing hostage). ──
    for (let i = 0; i < 12 && await page.locator('.con-reveal--embedded').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }
    await page.waitForSelector('.con-hydro__result-stages', {timeout: 90_000});
    expect(await page.locator('.con-hydro__result-stagerow').count(), 'seven stages, one row each').toBe(7);
    await shoot(page, '05-result');

    const model = await fetchPlayerModel(request, id) as Wire;
    expect(model.thisPlayer?.deltaProject?.position, 'the server agrees the marker is on 7').toBe(7);
  });
});
