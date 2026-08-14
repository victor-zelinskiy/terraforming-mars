import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {openConsole, press, seedGameOverApi, waitForBoardHome} from './consoleStart';

/**
 * THE GREEN NUMBERS DESCRIBE THE POSITION, NOT THE CLOCK.
 *
 * The shipped defect: the RT wheel's counts were read off the LIVE prompt tree
 * (`waitingFor`), which exists only on the viewer's own turn — so «КАРТЫ 4»
 * vanished the instant an opponent took over and came back when the turn
 * returned. The wheel stopped being a planning instrument exactly when the
 * player had time to plan, and «Гидросеть» / «Торговля» never carried a number
 * at all, so one wheel spoke two languages.
 *
 * This probe reads the counts on the viewer's own turn, hands the turn to the
 * opponent WITHOUT changing anything else about the game, and reads them again.
 * They must be identical. It also pins the presentation half: off-turn nothing
 * may paint the danger register — «Сейчас не ваш ход» is an EXECUTION GATE
 * («НЕ СЕЙЧАС», amber), never a verdict on a card / action / trade / advance.
 *
 * Contract: `docs/claude/console/potential-availability.md`.
 */

const OUT_DIR = path.resolve('screenshots', 'potential-availability');

/** 4 M€, no requirement, no placement — playable in generation 1 by construction. */
const POWER_PLANT = 'Power Plant';

function twoPlayerConfig() {
  return {
    players: [
      {name: 'Viewer', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Rival', color: 'green', beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: true,
    },
    board: 'tharsis', seed: 0.31, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Open the RT wheel and read every slot's badge (id → number, absent = 0). */
async function wheelBadges(page: Page): Promise<Record<string, number>> {
  await press(page, 'Period', 900); // RT — the action-category wheel
  await page.waitForSelector('.con-quick', {timeout: 8_000});
  const badges = await page.evaluate(() => {
    const out: Record<string, number> = {};
    // The slot's IDENTITY is its spatial class (`--center` / `--up` / …), which
    // is the model's own slot map — never the translated label.
    for (const slot of ['center', 'up', 'right', 'down', 'left']) {
      const el = document.querySelector(`.con-quick__slot--${slot} .con-quick__slot-badge`);
      out[slot] = el === null ? 0 : Number((el as HTMLElement).innerText.trim() || '0');
    }
    return out;
  });
  await press(page, 'Escape', 700);
  return badges;
}

/** Whichever seat the server is currently asking for input. */
async function activeSeat(request: APIRequestContext, ids: ReadonlyArray<string>): Promise<string | undefined> {
  for (const id of ids) {
    const model = await (await request.get(`/api/player?id=${id}`)).json();
    if (model.waitingFor !== undefined) {
      return id;
    }
  }
  return undefined;
}

test.describe('potential availability — the counts survive the turn', () => {
  test('the wheel reads the same before and after the turn passes, and off-turn nothing goes red', async ({page, request}) => {
    test.setTimeout(180_000);

    // ── the table ────────────────────────────────────────────────────────
    // Deal until the viewer is OFFERED «Power Plant» — 4 M€, no requirement,
    // no placement, so it is playable in generation 1 whatever else lands. The
    // probe's whole subject is a card whose ONLY blocker is the turn, and a
    // random deal of two requirement-heavy cards (the first run drew «Великая
    // плотина» ≥4 oceans and «Губернатор Луны» ≥3 Earth tags) has no such card
    // to show. `createGameWithCards` does this for a solo game; here both seat
    // ids are needed, so the same loop runs inline.
    let viewer = '';
    let rival = '';
    for (let attempt = 0; attempt < 60 && viewer === ''; attempt++) {
      const created = await request.post('/api/creategame',
        {data: {...twoPlayerConfig(), seed: 0.31 + attempt * 0.017}});
      expect(created.ok(), 'the game server accepted the config').toBeTruthy();
      const {players} = await created.json();
      const model = await (await request.get(`/api/player?id=${players[0].id}`)).json();
      const dealt: Array<string> = (model.waitingFor?.options ?? [])
        .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
      if (dealt.includes(POWER_PLANT)) {
        [viewer, rival] = players.map((p: {id: string}) => p.id);
      }
    }
    expect(viewer, `no deal in 60 tries offered ${POWER_PLANT}`).not.toBe('');

    // Both seats answer their pregame over the API — the subject starts at the
    // action menu, so the wizard is setup, never the story.
    //
    // CONCURRENTLY, and that is not an optimisation: the pregame phases are
    // SIMULTANEOUS, so a sequential seed leaves the first seat waiting for a
    // table-mate who is not being driven yet, and its own wait budget expires
    // «the table never came back to this player (phase research)».
    await Promise.all([
      // Buy the unconditional card by NAME (plus one more for company): the
      // wallet has to survive the research phase with something genuinely
      // playable in generation 1, or every count is honestly 0 and the probe
      // proves nothing.
      seedGameOverApi(request, viewer, {cards: [POWER_PLANT], buy: 2}),
      // The rival needs only its PREGAME answered. Once the action phase opens
      // the FIRST player moves, so this seat legitimately has nothing left to
      // answer and the shared seeder's «the table never came back» is its
      // expected ending, not a failure. The state it was driving to is
      // asserted positively below, so nothing is swallowed.
      seedGameOverApi(request, rival, {buy: 2}).catch(() => undefined),
    ]);
    await expect.poll(async () => activeSeat(request, [viewer, rival]), {timeout: 30_000}).toBe(viewer);

    await openConsole(page, viewer, '');
    await waitForBoardHome(page, 25);

    // ── 1 · the viewer's OWN turn ────────────────────────────────────────
    const onTurn = await wheelBadges(page);
    await shoot(page, '01-own-turn');
    // The premise of the whole probe: there IS something to count. WHICH
    // category carries it depends on the deal and the corporation, so the
    // premise is the total — a run where everything is honestly 0 would pass
    // the equality below without testing anything.
    const total = (b: Record<string, number>) => Object.values(b).reduce((n, v) => n + v, 0);
    expect(total(onTurn), `the wheel counts something on the viewer's own turn: ${JSON.stringify(onTurn)}`)
      .toBeGreaterThan(0);

    // ── 2 · hand the turn over — and change NOTHING else ─────────────────
    // «Пропустить поколение» (LT ▼ + its confirm card): the only turn-ending
    // verb available before the round's FIRST action («Пропустить ход» is
    // offered only after one, which is the LT wheel's own honest reason). It
    // costs nothing and touches no resource, card, fleet or track — so every
    // count below MUST be unchanged, and the rival, whom nobody is driving,
    // holds the turn for the rest of the run.
    await press(page, 'Comma', 900); // LT — basic actions
    await page.waitForSelector('.con-quick', {timeout: 8_000});
    await press(page, 'ArrowDown', 1200); // pass
    await page.waitForSelector('.con-confirm', {timeout: 8_000});
    await press(page, 'Enter', 1600);
    await expect.poll(async () => activeSeat(request, [viewer, rival]), {timeout: 20_000}).toBe(rival);

    // ── 3 · the SAME numbers ─────────────────────────────────────────────
    const offTurn = await wheelBadges(page);
    await shoot(page, '02-off-turn');
    expect(offTurn, 'passing the turn is not a change of game state').toEqual(onTurn);

    // ── 4 · …and off-turn nothing wears the danger register ──────────────
    // The hand: every card that is legal by the rules keeps its bright pose and
    // the calm «НЕ СЕЙЧАС» verdict; only a real rules block may dim.
    await press(page, 'Period', 900);
    await press(page, 'Enter', 1600); // RT centre — «КАРТЫ»
    await page.waitForSelector('.con-hand', {timeout: 10_000});
    await shoot(page, '03-hand-off-turn');
    const hand = await page.evaluate(() => ({
      notNow: document.querySelectorAll('.con-hand__slot--notnow').length,
      unplayable: document.querySelectorAll('.con-hand__slot--unplayable').length,
      redVerdict: document.querySelectorAll('.con-hand__verdictbar--blocked').length,
      calmVerdict: document.querySelectorAll('.con-hand__verdictbar--notnow').length,
    }));
    expect(hand.notNow, 'a legal card off-turn is «НЕ СЕЙЧАС», not dimmed').toBeGreaterThan(0);
    // The FOCUSED card is one of them (the shelf sorts potential-first), so the
    // status rail must be the calm one and never the red block.
    expect(hand.calmVerdict, 'the info bar takes the warning register').toBe(1);
    expect(hand.redVerdict, '…and never the danger one for a turn gate').toBe(0);
    await press(page, 'Escape', 900);

    // The card actions: the «НЕ СЕЙЧАС» badge and an AMBER diagnostics line —
    // the salmon ✕ line beside an amber badge was the screen contradicting
    // itself about the same fact.
    await press(page, 'Period', 900);
    await press(page, 'ArrowUp', 1600);
    await page.waitForSelector('.con-cardactions', {timeout: 10_000});
    await shoot(page, '04-card-actions-off-turn');
    const actions = await page.evaluate(() => ({
      soft: document.querySelectorAll('.con-cardactions__tile-status--soft').length,
      warnLines: document.querySelectorAll('.con-cardactions__tile-reason--warning').length,
      dangerLines: document.querySelectorAll('.con-cardactions__tile-reason:not(.con-cardactions__tile-reason--warning)').length,
    }));
    if (actions.soft > 0) {
      expect(actions.warnLines, 'every off-turn slot explains itself in the calm register').toBe(actions.soft);
      expect(actions.dangerLines, 'and none of them shows the red ✕').toBe(0);
    }
    await press(page, 'Escape', 900);
  });
});
