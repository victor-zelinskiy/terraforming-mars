import {test, expect, Page} from './consoleTest';
import {
  press, stepSubject, stepKind, waitPressable, summaryVisible, fillPicks, pickedCards, settle, waitStepDealSettled,
} from './consoleStart';
import {armWitness, Witness} from './witness';

/**
 * THE START-FLOW MOTION ORDER — the two artefacts this probe exists to catch,
 * both of which are invisible to every other spec because they are about WHEN
 * things happen, not what is on screen when the dust settles:
 *
 *  ① THE STAGE OPENED TOO EARLY. The stage used to commit in the same tick as
 *     the press, so the next step's card grid was already standing while the
 *     card just taken from the previous step was still flying over it.
 *  ② THE SUMMARY TELEPORT. Two convoys shared one proxy layer that each of
 *     them CLEARED on completion, so the shorter one wiped the longer one's
 *     airborne cards — their timelines kept revealing destinations, and the
 *     tail of a big project buy popped into place one card at a time. Its
 *     signature is exact and machine-checkable: a summary tile turning
 *     visible while NOTHING is in the air.
 *
 * The probe RECORDS the live DOM through a real transition (`armWitness`,
 * FLAKE ZERO — every state the product writes, in the task that writes it,
 * plus a frame tick for what only a computed style moves) and asserts on the
 * SEQUENCE. It is deliberately one spec with two transitions (a step advance
 * and the summary convoy) — the setup is the expensive part.
 */

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'MotionProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
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
    // A RICH corporation on purpose: the buy limit is the corp's own M€, and
    // the convoy bug this probe exists for scales with the number of bought
    // projects. Credicor's 57 M€ buys ~19 cards at 3 M€ each.
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
  };
}

/** One recorded state of the start scene (the time is the record's own — `t` below is ms since the arm). */
type Seen = {
  subject: string,
  /** Cards physically in the air right now. */
  proxies: number,
  /** Grid slots painting a card (a held slot is `con-deal-hold`). */
  gridCards: number,
  /** Summary tiles painting a card. */
  summaryCards: number,
  /** The summary pane is on screen at all. */
  summaryUp: boolean,
  /**
   * WHICH step pane is the live one — the STRUCTURAL stage signal. The
   * breadcrumb text is not usable for this: its stage segment crossfades, so
   * the rendered word lags the commit by the length of that transition and
   * could mask an early commit by exactly that much.
   */
  pane: number,
  /** The Selection Dock's per-pile counts, in shelf order. */
  dock: Array<number>,
  /** The flyer's projection — `none` here means the turn is orthographic. */
  persp: string,
  /** The 3D body's live transform (a real turn is a `matrix3d`). */
  tf: string,
  /** The paper edge is painting (it only does so mid-turn). */
  edge: number,
};
type Sample = Seen & {t: number};

/**
 * Arm the RECORD of the start scene from before the press (`armWitness`). `settled`: the claims are about ORDER and
 * COEXISTENCE («the stage never changes while a card is in the air», «no tile turns visible with nothing in the air»),
 * so each state is the one a task LEAVES — the state a frame can paint, never one between two writes of one task.
 */
async function armStartRecord(page: Page, key: string): Promise<Witness<Seen>> {
  return armWitness<Seen>(page, key, () => {
    const visible = (el: Element): boolean => {
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.02;
    };
    const shown = (sel: string): number => Array.from(document.querySelectorAll(sel))
      .filter((el) => !el.classList.contains('con-deal-hold') && visible(el) &&
        (el.closest('.con-start__steppane, .con-start__summary') === null ||
          visible(el.closest('.con-start__steppane, .con-start__summary') as Element)))
      .length;
    const pane = document.querySelector('.con-start__summary');
    const panes = Array.from(document.querySelectorAll('.con-start__steppane'));
    const p0 = document.querySelector('.con-startdock-proxy');
    const body = p0?.querySelector('.con-card3d');
    const edgeEl = p0?.querySelector('.con-card3d__edge');
    return {
      pane: panes.findIndex((p) => getComputedStyle(p).display !== 'none'),
      subject: (document.querySelector('.con-wshead__layer--deep .con-wshead__subject')
        ?.textContent ?? '').trim().toLowerCase(),
      proxies: document.querySelectorAll('.con-startdock-proxy').length,
      gridCards: shown('.con-start__steppane .con-cards__slot'),
      summaryCards: shown('.con-start__summary .con-start__mini'),
      summaryUp: pane !== null && visible(pane),
      dock: Array.from(document.querySelectorAll('.con-startdock__count'))
        .map((el) => Number((el.textContent ?? '0').trim()) || 0),
      persp: p0 === null ? '' : getComputedStyle(p0).perspective,
      tf: body === null || body === undefined ? '' : getComputedStyle(body).transform,
      edge: edgeEl === null || edgeEl === undefined ? 0 : Number(getComputedStyle(edgeEl).opacity),
    };
  }, {settled: true, max: 20_000});
}

/** Stop a record and read it as the series the verdicts were written for — `t` in ms since the arm (page clock). */
async function stopStartRecord(record: Witness<Seen>): Promise<Array<Sample>> {
  const samples = await record.stop();
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({...s.v, t: s.t - t0}));
}

test.describe('console start — the physical motion order', () => {
  test('a stage never opens before its cards have left, and no summary card teleports', async ({page, request}) => {
    test.setTimeout(240_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok()).toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await waitPressable(page);
    // The boot's veil is gone and the step's deal stands still — the state the old fixed pause stood for.
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
    await waitStepDealSettled(page);

    // ── ① A STEP ADVANCE: corporation → the next step ────────────────────
    await expect.poll(async () => stepKind(await stepSubject(page))).toBe('corporation');
    await press(page, 'Enter', 600); // pick the focused corporation
    const corpSubject = await stepSubject(page);

    const advanceRecord = await armStartRecord(page, 'start-motion-advance');
    const armedPane = (await advanceRecord.samples())[0]?.v.pane ?? -1;
    await page.keyboard.press('Period'); // RT
    // The advance is OVER when the next step's pane stands with nothing left in the air and its deal has stopped moving —
    // the END state, waited for (never a fixed window: on a starved renderer the flight outlasts any guess), then the
    // scene at rest. The record runs through all of it.
    await advanceRecord.waitFor((s) => s.pane > -1 && s.pane !== armedPane && s.proxies === 0,
      {message: 'the stage did change eventually (the next pane, nothing in the air)'});
    await waitStepDealSettled(page);
    await settle(page);
    const advance = await stopStartRecord(advanceRecord);

    const airborne = advance.filter((s) => s.proxies > 0);
    // «It flew» is an EVER claim (a count of sampled frames was a statement about the machine's frame rate).
    expect(airborne.length, 'the pick physically flew (proxies were recorded)')
      .toBeGreaterThan(0);
    const startPane = advance[0].pane;
    expect(startPane, 'a live step pane at the press').toBeGreaterThan(-1);
    // ① THE ORDER: while a card is in the air the live pane is still the one
    // it was taken from — the next stage's grid cannot exist yet.
    const early = airborne.filter((s) => s.pane !== startPane);
    expect(early.length,
      `the stage changed while ${early.length} samples still had cards in the air ` +
      `(panes ${early.map((s) => s.pane).join(', ')} at ${early.map((s) => s.t).join('/')}ms)`).toBe(0);
    // …and the next surface's cards only paint after the flight is over.
    const firstNewPane = advance.findIndex((s) => s.pane !== startPane);
    const lastAirborne = advance.map((s) => s.proxies > 0).lastIndexOf(true);
    expect(firstNewPane, 'the stage did change eventually').toBeGreaterThan(-1);
    expect(firstNewPane, 'the new stage came after the last card landed')
      .toBeGreaterThan(lastAirborne);
    // The crumb never shows a transitional word: it is the OLD stage's text
    // for the whole flight and the new one afterwards, nothing in between.
    const crumbs = new Set(advance.map((s) => s.subject).filter((s) => s !== ''));
    expect([...crumbs].length, `the crumb showed ${[...crumbs].join(' / ')}`)
      .toBeLessThanOrEqual(2);
    expect(airborne.every((s) => s.subject === corpSubject || s.subject === ''),
      'the crumb kept naming the stage the cards are leaving').toBeTruthy();
    // THE SHELF FOLLOWS THE CARDS. Its count is a physical readout, so it may
    // never run ahead of the cards (a pile claiming more backs than the player
    // has picked) and never leave the landed card nowhere: once the flight is
    // over the corporation is ON the shelf, in every single frame.
    for (const s of advance) {
      expect(s.dock[0] ?? 0, `the corp pile claimed ${s.dock[0]} at ${s.t}ms`).toBeLessThanOrEqual(1);
    }
    for (const s of advance.slice(lastAirborne + 1)) {
      expect(s.dock[0], `the landed corporation vanished at ${s.t}ms`).toBe(1);
    }
    // THE TURN IS REAL 3D, not a picture swap. Two structural facts prove it:
    // the flyer PROJECTS (a perspective — without one a rotateY is
    // orthographic and reads exactly like one image replacing another), and
    // the body is genuinely rotated (a `matrix3d`, not a flat `matrix`). The
    // paper edge lights up while it passes through its own plane.
    // (EVER claims: how many recorded frames showed it is the machine's frame rate, not the product.)
    const projected = airborne.filter((s) => s.persp !== '' && s.persp !== 'none');
    expect(projected.length, `the flyer never projected (perspective: ` +
      `${[...new Set(airborne.map((s) => s.persp))].join(', ')})`).toBeGreaterThan(0);
    const turning = airborne.filter((s) => s.tf.startsWith('matrix3d'));
    expect(turning.length, 'the card body was never in a 3D rotation').toBeGreaterThan(0);
    expect(Math.max(...airborne.map((s) => s.edge)),
      'the paper edge never showed during the turn').toBeGreaterThan(0.25);
    console.log(`[probe] turn: perspective=${projected[0].persp} ` +
      `matrix3d samples=${turning.length} peakEdge=${Math.max(...airborne.map((s) => s.edge)).toFixed(2)}`);
    console.log(`[probe] advance: airborne ${advance[advance.findIndex((s) => s.proxies > 0)].t}–` +
      `${advance[lastAirborne].t}ms, pane flipped at ${advance[firstNewPane].t}ms ` +
      `(peak proxies ${Math.max(...advance.map((s) => s.proxies))})`);

    // ── ② THE SUMMARY CONVOY with a LARGE buy ───────────────────────────
    for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
      await waitPressable(page);
      // The step's deal stands still (its live pane, nothing arriving) before its crumb is read — the state the old
      // fixed pause stood for.
      await waitStepDealSettled(page);
      const kind = stepKind(await stepSubject(page));
      if (kind === 'prelude') {
        await fillPicks(page, 2);
      } else if (kind === 'project') {
        // As big a buy as the corporation's budget allows.
        await fillPicks(page, 18, 60);
        const bought = (await pickedCards(page)).length;
        expect(bought, 'a genuinely large buy to stress the convoy').toBeGreaterThan(6);
        const convoyRecord = await armStartRecord(page, 'start-motion-convoy');
        await page.keyboard.press('Period'); // RT → the summary
        // The convoy is OVER when the summary stands and the dust has settled in the record itself: nothing in the air,
        // every bought card on the summary — the END state, then the scene at rest; never a fixed window. (The summary
        // has no status rail of its own — the wizard's rail is a step's — so the rail is no witness of it.)
        await convoyRecord.waitFor((s) => s.summaryUp, {message: 'the summary appeared'});
        await expect.poll(async () => {
          const now = await convoyRecord.last();
          return now !== undefined && now.proxies === 0 && now.summaryCards >= bought;
        }, {message: 'the convoy came to rest with every bought project on the summary', timeout: 30_000}).toBe(true);
        await settle(page);
        const convoy = await stopStartRecord(convoyRecord);

        const flew = convoy.filter((s) => s.proxies > 0);
        expect(flew.length, 'the buy physically flew').toBeGreaterThan(0);
        // The shelf never claims more than the player actually picked, not
        // even for the frame in which the stage flips (a drift applied one
        // tick early doubled every earlier pile's count for ~300 ms).
        for (const s of convoy) {
          expect(s.dock[0] ?? 0, `corp pile = ${s.dock[0]} at ${s.t}ms`).toBeLessThanOrEqual(1);
          expect(s.dock[1] ?? 0, `prelude pile = ${s.dock[1]} at ${s.t}ms`).toBeLessThanOrEqual(2);
          expect(s.dock[2] ?? 0, `projects pile = ${s.dock[2]} at ${s.t}ms`).toBeLessThanOrEqual(bought);
        }
        console.log(`[probe] bought=${bought} peakProxies=${Math.max(...convoy.map((s) => s.proxies))} ` +
          `airborneSamples=${flew.length} span=${flew[flew.length - 1].t - flew[0].t}ms ` +
          `finalSummaryCards=${convoy[convoy.length - 1].summaryCards}`);
        // The summary opens EMPTY — no tile paints before its card lands.
        const firstUp = convoy.findIndex((s) => s.summaryUp);
        expect(firstUp, 'the summary appeared').toBeGreaterThan(-1);
        expect(convoy[firstUp].summaryCards, 'the summary opened with no cards on it').toBe(0);
        // ② THE TELEPORT SIGNATURE: a tile turning visible with nothing in
        // the air. (Allow the very last sample pair, where the final card's
        // proxy is already retired in the same frame it revealed.)
        const teleports: Array<string> = [];
        for (let i = 1; i < convoy.length; i++) {
          const grew = convoy[i].summaryCards > convoy[i - 1].summaryCards;
          const dead = convoy[i].proxies === 0 && convoy[i - 1].proxies === 0;
          if (grew && dead) {
            teleports.push(`t=${convoy[i].t}ms ${convoy[i - 1].summaryCards}→${convoy[i].summaryCards}`);
          }
        }
        expect(teleports.length,
          `cards appeared with nothing in the air: ${teleports.join('; ')}`).toBe(0);
        // EVERY bought card is on the summary when the dust settles.
        const settled = convoy[convoy.length - 1];
        expect(settled.proxies, 'no proxy is left behind').toBe(0);
        expect(settled.summaryCards, 'every bought project reached the summary')
          .toBeGreaterThanOrEqual(bought);
        // The old grid is gone by then — never two card surfaces.
        expect(settled.gridCards, 'the previous grid is retired').toBe(0);
        break;
      }
      await press(page, 'Period', 1600);
      // Let the step actually change before looking again — a STATE, polled (bounded; a step that did not change is
      // simply looked at again by the next round, as before).
      await expect.poll(async () => await summaryVisible(page) || stepKind(await stepSubject(page)) !== kind,
        {timeout: 5_000}).toBe(true).catch(() => undefined);
    }
    await expect.poll(() => summaryVisible(page), {message: 'the walk reached the summary'}).toBe(true);

    // ── ③ BACK OFF THE SUMMARY: every card physically returns ───────────
    const backRecord = await armStartRecord(page, 'start-motion-back');
    await page.keyboard.press('Comma'); // LT
    // The return is OVER when the summary is gone, the grid stands with nothing in the air and the step's deal has
    // stopped moving (no card still arriving) — the END state, then the scene at rest; never a fixed window.
    await backRecord.waitFor((s) => !s.summaryUp && s.gridCards > 0 && s.proxies === 0,
      {message: 'the project grid is standing again'});
    await waitStepDealSettled(page);
    await settle(page);
    const back = await stopStartRecord(backRecord);
    expect(back.filter((s) => s.proxies > 0).length, 'the return physically flew')
      .toBeGreaterThan(0);
    const home = back[back.length - 1];
    expect(home.summaryUp, 'the summary is gone').toBeFalsy();
    expect(home.gridCards, 'the project grid is standing again').toBeGreaterThan(0);
    expect(home.proxies, 'no proxy is left behind').toBe(0);
  });
});
