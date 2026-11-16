import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  composerLoaded, createGameWithCards, fetchPlayerModel, finiteMotion, NO_PAYMENT, openConsole, placeTile, press, pressUntil,
  seedGameOverApi, sendPlayerInput, settle, soloGameConfig, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * A COPIED ACTION THAT WALKS ONTO THE BOARD — «Кочевники Марса».
 *
 * The other half of the same law as `console-hydro-copied-colony.spec.ts`: a
 * repeated action's target may be RUNTIME-ONLY. The launch-pad's is a colony
 * (another workspace); the nomads' is a SPACE — «переместите кочевников на
 * соседнюю свободную область и получите бонус размещения». Neither exists when
 * the Hydronetwork's stage-7 reward is PLANNED, generations before the copy
 * runs, so neither may be asked for there: the plan captures the card and stops
 * (`consoleActionComposer.ts` § RUNTIME-NAVIGATION STEPS) and the server raises
 * the real question as the copy's own follow-up.
 *
 * The board is not a workspace, so its half of the contract differs — and that
 * difference is what this pins:
 *  1. NOTHING of stage 7 while the marker is below it. The board is ALWAYS
 *     mounted, so «nothing» here means no legal cells: the placement's own
 *     highlight is the surface, and it may not light two cells early.
 *  2. When the marker arrives, the workspace YIELDS — a tile is chosen on the
 *     board, and a screen standing over it would make the choice unreachable.
 *  3. The placement is answerable, and answering it FINISHES the flow: the
 *     Hydronetwork comes back to play its own payoff read, and only then does
 *     the finished flow leave.
 *
 * Screenshots → `screenshots/hydro-copied-tile/`.
 */

const OUT = path.resolve('screenshots', 'hydro-copied-tile');

const NOMADS = 'Mars Nomads';
// Tags for stages 1..7: building+power / earth / space / science / plant /
// microbe. (The nomads themselves carry none the track asks for.)
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
const ALL_CARDS = [...TAG_CARDS, NOMADS, 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'CopyTile', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true, promo: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.23,
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

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 40; i++) {
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
    if (prompt.type === 'card') {
      const need = (prompt.min ?? prompt.minCardsToSelect ?? 0) as number;
      const pick = need > 0 ? [(prompt.cards ?? [])[0]?.name].filter((n) => n !== undefined) : [];
      model = await sendPlayerInput(request, id, {type: 'card', cards: pick} as never) as Wire;
      continue;
    }
    model = await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

// DERIVED, never a literal (the consoleStart.ts rule): `isPayment` demands a
// field for EVERY spendable, so a hand-written map rots the day the game
// grows one (floodgateSteel — «payment is not a valid type», 400).
function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
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

/** Open a surface from the quick wheel (RT, then the arm) — act → verify on the surface standing, bounded. */
async function openFromWheel(page: Page, opened: string, tries = 4): Promise<void> {
  for (let attempt = 0; attempt < tries && await page.locator(opened).count() === 0; attempt++) {
    await press(page, 'Period', 1400);
    await pressUntil(page, 'ArrowLeft', async () => await page.locator(opened).count() > 0, {tries: 1, settleMs: 1800});
  }
}

/** The motion of a hand-over at rest (bounded — the end of a window, never a claim). */
async function motionAtRest(page: Page): Promise<void> {
  await expect.poll(() => finiteMotion(page), {timeout: 8_000}).toBe(0).catch(() => undefined);
}

/** The CENSUS row: the marker's cell, the open cell and the board's legal cells, read TOGETHER. */
type CensusRow = {cell: number, open: number, legal: number, hydro: boolean, result: boolean, phase: string};

/** The reader of a {@link CensusRow} — in the page, self-contained. */
function readCensus(): CensusRow {
  const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
  const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
  const openCell = document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop');
  return {
    cell: cellAttr === undefined || cellAttr === null ? -1 : Number(cellAttr),
    // THE OPEN CELL — the magnified one that names its stage and grows
    // the connector stem. During a walk it must BE the marker's cell.
    open: openCell === undefined || openCell === null ? -1 : Number(openCell),
    // The placement's own surface: the legal cells it lit.
    legal: document.querySelectorAll('.board-space--available').length,
    // …and whether the workspace is still standing over the board.
    hydro: document.querySelector('.con-hydro') !== null,
    result: document.querySelector('.con-hydro__layer--result') !== null,
    // The FLOW's own phase — so a failure names the state machine's
    // stall instead of the surface that did not appear because of it.
    phase: (window as unknown as {__conHydroDiag?: () => {commit: {phase: string} | null}})
      .__conHydroDiag?.()?.commit?.phase ?? 'none',
  };
}

/** MOVE the nomads once — what makes the card repeatable at stage 7. */
async function useNomads(request: APIRequestContext, id: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
  expect(at, 'the nomads are an available action').toBeGreaterThanOrEqual(0);
  const model = await sendPlayerInput(request, id, {
    type: 'or', index: at, response: {type: 'card', cards: [NOMADS]},
  } as never) as Wire;
  // The action IS a space pick — no branch in between.
  const prompt = model.waitingFor as Wire | undefined;
  expect(prompt?.type, `the move asks for a space (got ${titleOf(prompt)})`).toBe('space');
  await sendPlayerInput(request, id,
    {type: 'space', spaceId: (prompt?.spaces ?? [])[0]} as never);
  await toActionMenu(request, id);
}

test.describe('a copied action walks onto the board · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the repeated MOVE asks for its space on stage 7 — and the track takes the screen back', async ({page, request}) => {
    test.setTimeout(900_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.23});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await useNomads(request, id);

    await openConsole(page, id, '');
    await waitForBoardHome(page, 30);

    // ── Open the Hydronetwork and plan 0 → 7. ──
    await openFromWheel(page, '.con-hydro');
    await page.waitForSelector('.con-hydro', {timeout: 20_000});
    await press(page, 'Period', 900); // RT — «К дальнему»
    const focused = () => page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    // Walking back to stage 7 — each step act → verify on the focused stop.
    await pressUntil(page, 'ArrowLeft', async () => await focused() === '7', {tries: 8, settleMs: 500});
    await expect.poll(() => focused(), {message: 'the plan targets the reuse stage'}).toBe('7');
    await shoot(page, '01-plan');

    // ── THE CENSUS: the marker's cell and the BOARD's legal cells, RECORDED
    //    TOGETHER from before the commit. The board is always mounted, so «did
    //    stage 7 start early» is a question about the PLACEMENT HIGHLIGHT, not
    //    about a surface — and «the highlight IS the marker» compares two cells
    //    of one state (`settled`: the state a task leaves, never the gap between
    //    two writes of one flush). ──
    const censusWitness = await armWitness<CensusRow>(page, 'hydro-copied-tile-census', readCensus, {settled: true, max: 20_000});

    // ── THE RAIL: answer every crossed stage that asks, including the reuse. The rail ticks its own answered rows, so
    //    the driver walks until they are all ticked — each A verified by its effect, never a guessed count. ──
    const readRail = () => page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__pickrow').length,
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
      picker: document.querySelector('.con-cardactions') !== null,
      composer: document.querySelector('.con-composer') !== null,
    }));
    let planShot = false;
    for (let round = 0; round < 20; round++) {
      const st = await readRail();
      if (st.rows > 0 && st.ticks >= st.rows) {
        break;
      }
      if (st.picker && !st.composer) {
        const readTiles = () => page.evaluate(() => Array.from(
          document.querySelectorAll('.con-cardactions__tile')).map((t) => ({
          card: t.getAttribute('data-action-card') ?? '',
          reason: (t.querySelector('.con-cardactions__tile-reason')?.textContent ?? '').trim(),
        })));
        await expect.poll(async () => (await readTiles()).map((t) => t.card),
          {message: `the used action is on offer — ${JSON.stringify(await readTiles())}`}).toContain(NOMADS);
        await expect.poll(async () => (await readTiles()).find((t) => t.card === NOMADS)?.reason,
          {message: `the move is available — ${JSON.stringify(await readTiles())}`}).toBe('');
        // A — descend into the move (verified by the composer standing).
        await pressUntil(page, 'Enter', async () => (await readRail()).composer, {tries: 1, settleMs: 2200});
        continue;
      }
      if (st.composer) {
        // THE PLAN'S OWN VERB. The move's target is a SPACE, which does not
        // exist until the copy runs — a composer that tried to ask for it here
        // would have nothing to offer and no way forward. Read once the
        // composer has LOADED, at rest.
        await composerLoaded(page);
        const cta = await readSettled(page, () => page.evaluate(() => {
          const el = document.querySelector('.con-composer__cta');
          return {
            label: (el?.querySelector('.con-composer__cta-label')?.textContent ?? '').trim(),
            held: el?.classList.contains('con-composer__cta--held') ?? false,
            disabled: el?.getAttribute('aria-disabled') ?? '',
            body: (document.querySelector('.con-composer')?.textContent ?? '')
              .replace(/\s+/g, ' ').trim().slice(0, 260),
          };
        }), {settle: false, message: 'the repeat plan\'s composer'});
        if (!planShot) {
          await shoot(page, '02-repeat-plan-composer');
          planShot = true;
        }
        expect(cta.held, `the commit is not withheld — ${cta.body}`).toBe(false);
        expect(cta.disabled, `…and it is pressable — ${cta.body}`).toBe('false');
        await press(page, 'Enter', 2500); // A — «Выбрать это действие»
        await page.waitForSelector('.con-hydro', {timeout: 20_000});
        // The plan's composer LEFT before the rail is read again (a second A on a lingering one is a second confirm).
        await page.locator('.con-composer').first().waitFor({state: 'detached', timeout: 10_000}).catch(() => undefined);
        continue;
      }
      // A answers the rail's next decision — given its whole window to move the rail before the next look.
      const before = JSON.stringify(st);
      await pressUntil(page, 'Enter', async () => JSON.stringify(await readRail()) !== before, {tries: 1, settleMs: 1200});
    }
    const readRailCount = () => page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__pickrow').length,
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
    }));
    await expect.poll(async () => {
      const r = await readRailCount();
      return r.ticks === r.rows;
    }, {message: `every rail decision is captured (${JSON.stringify(await readRailCount())})`}).toBe(true);
    await shoot(page, '03-plan-complete');

    // ── COMMIT — one press. ──
    await press(page, 'Enter', 1500);

    // ── The stage-5 stop: keep 2 of the four dealt cards. This is also what
    //    makes the scenario real — the copy's prompt rides the very response
    //    that answers this pick. Each A verified by the pick's own band (A is a
    //    TOGGLE), the cursor walked onto a card not yet kept. ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 120_000});
    const picked = page.locator('.con-cards__slot--picked');
    const pickFocus = () => page.evaluate(() => {
      const el = document.querySelector('.con-deckpick .con-cards__slot--focused[data-deckpick-slot]');
      return el === null ? '' : `${el.getAttribute('data-deckpick-slot')}|${el.classList.contains('con-cards__slot--picked') ? 1 : 0}`;
    });
    await pressUntil(page, 'Enter', async () => await picked.count() >= 1, {tries: 3, settleMs: 600});
    await walkFocusUntil(page, async () => (await pickFocus()).endsWith('|0'), async () => (await pickFocus()).split('|')[0], 6, 450);
    await pressUntil(page, 'Enter', async () => await picked.count() >= 2, {tries: 3, settleMs: 600});
    await expect.poll(() => page.locator('.con-cards__slot--picked').count(), {message: 'two picks held'}).toBe(2);
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // ── THE PLACEMENT. It is the copy's honest follow-up, so it may only exist
    //    once the marker has taken cell 7 — and when it does, the board must be
    //    reachable. ──
    await expect(page.locator('.board-space--available').first())
      .toBeVisible({timeout: 180_000});
    // ② THE WORKSPACE YIELDS. A tile is chosen ON the board; a screen standing
    //    over it would make the choice unreachable. (A live state — polled.)
    await expect.poll(() => page.locator('.con-hydro').count(), {message: 'the track let the board through'}).toBe(0);
    await expect.poll(() => page.locator('.board-space--available').count(), {message: 'and the move has real destinations'})
      .toBeGreaterThan(0);
    await motionAtRest(page);
    await shoot(page, '04-placement-on-the-board');
    const wire = await fetchPlayerModel(request, id) as Wire;
    console.log(`[wire] waitingFor=${wire.waitingFor?.type} stamp=${wire.waitingFor?.copiedActionSource}`);
    expect(wire.waitingFor?.type, 'the copy is asking for a space').toBe('space');
    expect(wire.waitingFor?.copiedActionSource,
      'and the server attributes it to the copied card').toBe(NOMADS);

    // ── ANSWER IT, then let the flow finish on its own: the record runs until
    //    the Hydronetwork has played its result AND the finished flow has left
    //    (the END of the flow, never its first sign — bounded; the claims below
    //    name what never came). ──
    expect(await placeTile(page), 'the space was placed').toBe(true);
    await censusWitness.waitFor((r) => r.result, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => {
      const rows = (await censusWitness.samples()).map((s) => s.v);
      const resultAt = rows.findIndex((r) => r.result);
      return resultAt >= 0 && rows.slice(resultAt).some((r) => !r.hydro);
    }, {timeout: 20_000}).toBe(true).catch(() => undefined);
    await motionAtRest(page);
    const census = (await censusWitness.stop()).map((s) => s.v);
    const dump = JSON.stringify(census);
    await shoot(page, '05-back-on-the-track');

    // ① NOTHING BELOW 7 — no legal cell may light while the marker is walking.
    const early = census.filter((r) => r.cell >= 0 && r.cell < 7);
    expect(early.length, `the census watched the marker below 7 — ${dump}`).toBeGreaterThan(0);
    for (const r of early) {
      expect(r.legal, `the board offered ${r.legal} cells at stage ${r.cell} — ${dump}`).toBe(0);
    }

    // ②b THE HIGHLIGHT IS THE MARKER. While the walk runs, the magnified cell
    //     — its stage name, its connector stem — is the one the sequence is
    //     resolving, never the plan's destination. It shipped the other way:
    //     the token stood on «Гидромоделирование» with its deck pick open
    //     below while the highlight had already arrived on «Орбитальные
    //     контракты» two cells ahead. (Sampled from cell 1: at cell 0 the
    //     marker has not moved yet, so a planning sample is indistinguishable
    //     from the walk's first frame — and there the destination IS the focus.)
    // ⚠️ ONLY WHILE THE WALK IS RUNNING. Once it ends the track goes back to
    // PLANNING, and a plan's open cell is its destination — after a 0→7 move
    // that is stage 8, correctly. The walk is the span before the copy's own
    // follow-up lights the board, so the census is cut there.
    const firstLegal = census.findIndex((r) => r.legal > 0);
    const walk = firstLegal === -1 ? census : census.slice(0, firstLegal);
    const walking = walk.filter((r) => r.cell >= 1 && r.hydro === true);
    expect(walking.length, `the census watched the walk — ${dump}`).toBeGreaterThan(0);
    for (const r of walking) {
      expect(r.open, `the highlight ran ahead of the marker at cell ${r.cell} — ${dump}`)
        .toBe(r.cell);
    }

    // ③ …AND THE TRACK TOOK THE SCREEN BACK to finish its own flow.
    // The census carries the FLOW'S OWN PHASE beside the surfaces, so this
    // failure names the state machine's stall rather than the layer that did
    // not appear because of it: the shipped bug read `phase:"result"` while
    // `legal:4` — the flow walked to its terminal stage while the player was
    // still choosing a hex, and spent the result hold behind a covered
    // workspace.
    const flowDiag = JSON.stringify(await page.evaluate(
      () => (window as unknown as {__conHydroDiag?: () => unknown}).__conHydroDiag?.() ?? null));
    expect(census.some((r) => r.hydro === true && r.result === true),
      `the Hydronetwork played its own result after the placement — ${dump}
flow: ${flowDiag}`).toBe(true);
    const after = await fetchPlayerModel(request, id) as Wire;
    console.log(`[wire·after] waitingFor=${after.waitingFor?.type} title=${titleOf(after.waitingFor as Wire)}`);
    console.log(`[census] ${dump}`);

    // ── ④ THE TRACK CARRIES TOKENS; THE PANEL CARRIES THE READING. ──
    //    Re-open the Hydronetwork on a walked track and focus a stage that has
    //    history: the CELLS must show player markers and nothing else (one
    //    marker per player, in the one place that player stands), while «кто
    //    здесь и что здесь было» is read in the stage panel on the left.
    await openFromWheel(page, '.con-hydro');
    await page.waitForSelector('.con-hydro', {timeout: 20_000});
    // Walk to a stage the marker has been THROUGH (its own reward taken or
    // passed) — the roster has something to say only about a reached cell.
    // Each step act → verify on the panel's own roster.
    await pressUntil(page, 'ArrowLeft', async () => await page.locator('.con-hydro__roster-row').count() > 0,
      {tries: 12, settleMs: 420});
    // The track and its panel read AT REST (the console's quiet, then two equal reads a frame apart).
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* the read below still waits for rest */ });
    const track = await readSettled(page, () => page.evaluate(() => {
      const seats = Array.from(document.querySelectorAll('[data-hydro-marker]'))
        .flatMap((berth) => Array.from(berth.querySelectorAll('.con-hydro__stop-marker'))
          .map((m) => `${(m.className.match(/player_bg_color_(\w+)/) ?? [])[1]}@${berth.getAttribute('data-hydro-marker')}`));
      return {
        seats,
        // A cell carries what it IS plus the tokens: nothing on it wears a
        // player's colour but a marker in its marker row (or a blockade gate's
        // band), and its only badge is the stage's own grade.
        trail: Array.from(document.querySelectorAll('.con-hydro__stop [class*="player_bg_color_"]'))
          .filter((el) => el.closest('[data-hydro-marker]') === null && el.closest('.con-hydro__gate') === null).length,
        roster: Array.from(document.querySelectorAll('.con-hydro__roster-row'))
          .map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()),
      };
    }), {settle: false, message: 'the track and its stage panel'});
    await shoot(page, '06-stage-roster');
    expect(track.trail, `no per-cell history marks — ${JSON.stringify(track)}`).toBe(0);
    // ONE marker per player, in ONE position. (Solo here, so exactly one seat.)
    expect(track.seats.length, `one token per player — ${JSON.stringify(track)}`).toBe(1);
    expect(new Set(track.seats.map((x) => x.split('@')[0])).size,
      'and no player is in two places').toBe(track.seats.length);
    // …and the reading is in the panel, naming who and what.
    expect(track.roster.length, `the stage panel names who has been here — ${JSON.stringify(track)}`)
      .toBeGreaterThan(0);
    console.log(`[roster] ${JSON.stringify(track)}`);
  });
});
