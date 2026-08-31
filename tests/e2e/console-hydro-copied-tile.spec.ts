import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, placeTile, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

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
    for (let attempt = 0; attempt < 4; attempt++) {
      await press(page, 'Period', 1400);
      await press(page, 'ArrowLeft', 1800);
      if (await page.locator('.con-hydro').count() > 0) {
        break;
      }
    }
    await page.waitForSelector('.con-hydro', {timeout: 20_000});
    await press(page, 'Period', 900); // RT — «К дальнему»
    const focused = () => page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    for (let i = 0; i < 8 && await focused() !== '7'; i++) {
      await press(page, 'ArrowLeft', 500);
    }
    expect(await focused(), 'the plan targets the reuse stage').toBe('7');
    await shoot(page, '01-plan');

    // ── THE CENSUS: the marker's cell and the BOARD's legal cells, together.
    //    The board is always mounted, so «did stage 7 start early» is a
    //    question about the PLACEMENT HIGHLIGHT, not about a surface. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __c?: Array<Record<string, unknown>>, __stop?: () => void,
      };
      w.__c = [];
      const sample = () => {
        const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
        const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
        const row = {
          cell: cellAttr === undefined || cellAttr === null ? -1 : Number(cellAttr),
          // The placement's own surface: the legal cells it lit.
          legal: document.querySelectorAll('.board-space--available').length,
          // …and whether the workspace is still standing over the board.
          hydro: document.querySelector('.con-hydro') !== null,
          result: document.querySelector('.con-hydro__layer--result') !== null,
        };
        const c = w.__c;
        if (c === undefined) {
          return;
        }
        const prev = c[c.length - 1];
        if (prev === undefined || JSON.stringify(prev) !== JSON.stringify(row)) {
          c.push(row);
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

    // ── THE RAIL: answer every crossed stage that asks, including the reuse. ──
    let planShot = false;
    for (let round = 0; round < 20; round++) {
      const st = await page.evaluate(() => ({
        rows: document.querySelectorAll('.con-hydro__pickrow').length,
        ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
        picker: document.querySelector('.con-cardactions') !== null,
        composer: document.querySelector('.con-composer') !== null,
      }));
      if (st.rows > 0 && st.ticks >= st.rows) {
        break;
      }
      if (st.picker && !st.composer) {
        const tiles = await page.evaluate(() => Array.from(
          document.querySelectorAll('.con-cardactions__tile')).map((t) => ({
          card: t.getAttribute('data-action-card') ?? '',
          reason: (t.querySelector('.con-cardactions__tile-reason')?.textContent ?? '').trim(),
        })));
        expect(tiles.map((t) => t.card), `the used action is on offer — ${JSON.stringify(tiles)}`)
          .toContain(NOMADS);
        expect(tiles.find((t) => t.card === NOMADS)?.reason,
          `the move is available — ${JSON.stringify(tiles)}`).toBe('');
        await press(page, 'Enter', 2200); // A — descend into the move
        continue;
      }
      if (st.composer) {
        // THE PLAN'S OWN VERB. The move's target is a SPACE, which does not
        // exist until the copy runs — a composer that tried to ask for it here
        // would have nothing to offer and no way forward.
        const cta = await page.evaluate(() => {
          const el = document.querySelector('.con-composer__cta');
          return {
            label: (el?.querySelector('.con-composer__cta-label')?.textContent ?? '').trim(),
            held: el?.classList.contains('con-composer__cta--held') ?? false,
            disabled: el?.getAttribute('aria-disabled') ?? '',
            body: (document.querySelector('.con-composer')?.textContent ?? '')
              .replace(/\s+/g, ' ').trim().slice(0, 260),
          };
        });
        if (!planShot) {
          await shoot(page, '02-repeat-plan-composer');
          planShot = true;
        }
        expect(cta.held, `the commit is not withheld — ${cta.body}`).toBe(false);
        expect(cta.disabled, `…and it is pressable — ${cta.body}`).toBe('false');
        await press(page, 'Enter', 2500); // A — «Выбрать это действие»
        await page.waitForSelector('.con-hydro', {timeout: 20_000});
        await page.waitForTimeout(900);
        continue;
      }
      await press(page, 'Enter', 1200);
    }
    const rail = await page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__pickrow').length,
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
    }));
    expect(rail.ticks, `every rail decision is captured (${JSON.stringify(rail)})`).toBe(rail.rows);
    await shoot(page, '03-plan-complete');

    // ── COMMIT — one press. ──
    await press(page, 'Enter', 1500);

    // ── The stage-5 stop: keep 2 of the four dealt cards. This is also what
    //    makes the scenario real — the copy's prompt rides the very response
    //    that answers this pick. ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 120_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // ── THE PLACEMENT. It is the copy's honest follow-up, so it may only exist
    //    once the marker has taken cell 7 — and when it does, the board must be
    //    reachable. ──
    await expect(page.locator('.board-space--available').first())
      .toBeVisible({timeout: 180_000});
    await page.waitForTimeout(800);
    await shoot(page, '04-placement-on-the-board');
    const wire = await fetchPlayerModel(request, id) as Wire;
    console.log(`[wire] waitingFor=${wire.waitingFor?.type} stamp=${wire.waitingFor?.copiedActionSource}`);
    expect(wire.waitingFor?.type, 'the copy is asking for a space').toBe('space');
    expect(wire.waitingFor?.copiedActionSource,
      'and the server attributes it to the copied card').toBe(NOMADS);

    const atPlacement = await page.evaluate(() => ({
      hydro: document.querySelector('.con-hydro') !== null,
      legal: document.querySelectorAll('.board-space--available').length,
    }));
    // ② THE WORKSPACE YIELDS. A tile is chosen ON the board; a screen standing
    //    over it would make the choice unreachable.
    expect(atPlacement.hydro, 'the track let the board through').toBe(false);
    expect(atPlacement.legal, 'and the move has real destinations').toBeGreaterThan(0);

    // ── ANSWER IT, then let the flow finish on its own. ──
    expect(await placeTile(page), 'the space was placed').toBe(true);
    for (let i = 0; i < 40; i++) {
      const done = await page.evaluate(() => (window as unknown as {
        __c?: Array<Record<string, unknown>> }).__c?.some((r) => r.result === true) ?? false);
      if (done) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2500);
    await page.evaluate(() => (window as unknown as {__stop?: () => void}).__stop?.());
    const census = await page.evaluate(() =>
      (window as unknown as {__c?: Array<Record<string, unknown>>}).__c ?? []);
    const dump = JSON.stringify(census);
    await shoot(page, '05-back-on-the-track');

    // ① NOTHING BELOW 7 — no legal cell may light while the marker is walking.
    const early = census.filter((r) => (r.cell as number) >= 0 && (r.cell as number) < 7);
    expect(early.length, `the census watched the marker below 7 — ${dump}`).toBeGreaterThan(0);
    for (const r of early) {
      expect(r.legal, `the board offered ${r.legal} cells at stage ${r.cell} — ${dump}`).toBe(0);
    }

    // ③ …AND THE TRACK TOOK THE SCREEN BACK to finish its own flow.
    expect(census.some((r) => r.hydro === true && r.result === true),
      `the Hydronetwork played its own result after the placement — ${dump}`).toBe(true);
    const after = await fetchPlayerModel(request, id) as Wire;
    console.log(`[wire·after] waitingFor=${after.waitingFor?.type} title=${titleOf(after.waitingFor as Wire)}`);
    console.log(`[census] ${dump}`);

    // ── ④ THE TRACK CARRIES TOKENS; THE PANEL CARRIES THE READING. ──
    //    Re-open the Hydronetwork on a walked track and focus a stage that has
    //    history: the CELLS must show player markers and nothing else (one
    //    marker per player, in the one place that player stands), while «кто
    //    здесь и что здесь было» is read in the stage panel on the left.
    for (let attempt = 0; attempt < 4; attempt++) {
      await press(page, 'Period', 1400);
      await press(page, 'ArrowLeft', 1800);
      if (await page.locator('.con-hydro').count() > 0) {
        break;
      }
    }
    await page.waitForSelector('.con-hydro', {timeout: 20_000});
    // Walk to a stage the marker has been THROUGH (its own reward taken or
    // passed) — the roster has something to say only about a reached cell.
    for (let i = 0; i < 12 && await page.evaluate(() =>
      document.querySelectorAll('.con-hydro__roster-row').length) === 0; i++) {
      await press(page, 'ArrowLeft', 420);
    }
    const track = await page.evaluate(() => {
      const seats = Array.from(document.querySelectorAll('[data-hydro-marker]'))
        .flatMap((berth) => Array.from(berth.querySelectorAll('.con-hydro__stop-marker'))
          .map((m) => `${(m.className.match(/player_bg_color_(\w+)/) ?? [])[1]}@${berth.getAttribute('data-hydro-marker')}`));
      return {
        seats,
        // The reverted marks: nothing of the kind may exist on a cell.
        trail: document.querySelectorAll('.con-hydro__stop-trail, .con-hydro__trailmark').length,
        badges: document.querySelectorAll(
          '.con-hydro__stop-badge--done, .con-hydro__stop-badge--crossed, .con-hydro__stop-badge--skip').length,
        roster: Array.from(document.querySelectorAll('.con-hydro__roster-row'))
          .map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()),
      };
    });
    await shoot(page, '06-stage-roster');
    expect(track.trail, `no per-cell history marks — ${JSON.stringify(track)}`).toBe(0);
    expect(track.badges, `and no per-cell verdict badges either — ${JSON.stringify(track)}`).toBe(0);
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
