/*
 * ONE PLACEMENT, TWO DEMANDS — AND ONLY EVER ONE OF THEM ON SCREEN.
 *
 * Placing an ocean on a card-draw hex while Dynamic Ocean Barrier is in play
 * makes the server produce TWO things in a single response: the hex's own draw
 * (`grantSpaceBonus` → `player.drawCard`, synchronous) and the card's bonus-move
 * offer (`BonusDeltaAdvance`, queued at BACK_OF_THE_LINE). The server is right
 * to ask immediately, so the ORDER the player experiences is the client's to
 * guarantee — and the guarantee is the door asking `admits('followUp')`, whose
 * policy waits out the whole arrival chain («processed» for a draw means every
 * card TAKEN).
 *
 * This watches that order in the real DOM. The claim is about the MIDDLE of the
 * episode, not its end state, so the probe is RECORDED from BEFORE the
 * confirming press (FLAKE ZERO — `armWitness`: the product's own writes + a
 * frame tick, replace-proof; an order / coexistence claim records the state a
 * task LEAVES, `settled`) — never a `setInterval` sampler, and never a
 * `waitForTimeout` standing in for a state.
 *
 * The deterministic sibling — `tests/client/components/console/hydroBonusDoorOrder.spec.ts`
 * — proves the same order at the policy seam and names the exact missing block
 * when it regresses. This one proves the product really behaves that way.
 */
import {expect, test, Page, APIRequestContext} from './consoleTest';
import {bootSeededGame, commitFocusedSpace, openConsole, playCardFromHand, press, pressUntil, pressUntilGone, settle,
  walkToSpace} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

/** The card that grants the bonus move — and, conveniently, a BUILDING tag,
 *  which is exactly what track position 1 requires, so the offer is FREE. */
const BARRIER = 'Dynamic Ocean Barrier';
/** Cost 11, no requirement, `behavior: {ocean: {}}` — the whole play is the ocean. */
const OCEAN_CARD = 'Subterranean Reservoir';
/** Cost 23, no requirement, `ocean: {count: 2}` — the SECOND ocean source. */
const OCEAN_CARD_2 = 'Ice Asteroid';
const FILLER = ['Acquired Company'];

/** Tharsis y=1, last space: `ocean(DRAW_CARD, DRAW_CARD)` — two cards, so the
 *  reveal is unmistakable. `shuffleMapOption: false` keeps the printed layout. */
const DRAW_OCEAN_SPACE = '13';

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: true,
  };
  return {
    players: [{name: 'HydroOrder', color: 'red', beginner: false, handicap: 0, first: true}],
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
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['CrediCor'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    customProjectCards: [BARRIER, OCEAN_CARD, OCEAN_CARD_2, ...FILLER],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await press(page, code, settleMs);
}

/**
 * Create the probe's game and open the console on its board with the probe's
 * cards in hand. The pregame is SETUP, never this spec's subject, so it rides
 * the shared API road (`bootSeededGame` — the same responses the wizard sends,
 * CrediCor taken by name, the four cards bought) instead of a private key
 * script over the wizard that paced itself with fixed pauses.
 */
async function openAtBoard(page: Page, request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  const playerId = model.players[0].id;
  await bootSeededGame(page, request, playerId, {cards: [BARRIER, OCEAN_CARD, OCEAN_CARD_2, ...FILLER], corporation: 'CrediCor'});
  // The player id is what lets a spec RELOAD the page mid-flow.
  return playerId;
}

/**
 * Play `card` from the hand — the shared driver (`playCardFromHand`: the hand
 * opened, the card FOCUSED by identity, never A on whatever the cursor sat on,
 * each A on the sheet verified by its effect), done when the SERVER's hand no
 * longer holds it or its placement stands. The private walk this replaces
 * confirmed with up to twelve blind A presses whenever the play put no tile down.
 */
async function playFromHand(page: Page, card: string): Promise<void> {
  expect(await playCardFromHand(page, card), `${card} was never played from the hand`).toBe(true);
}

/** The leak detector's own 1 Hz passes so far — the screen shadow counts every one it judges (`none` verdicts too). */
async function detectorPasses(page: Page): Promise<number> {
  return page.evaluate(() => {
    const s = (window as unknown as {__conScreenShadow?: () => {stats?: {verdicts?: Record<string, number>}}}).__conScreenShadow?.();
    return Object.values(s?.stats?.verdicts ?? {}).reduce((a, n) => a + n, 0);
  }).catch(() => 0);
}

/** Wait (bounded, never a throw) until the detector has run `passes` more passes — the product's own clock. */
async function awaitDetectorPasses(page: Page, passes: number): Promise<void> {
  const from = await detectorPasses(page);
  await expect.poll(() => detectorPasses(page), {timeout: passes * 1000 + 10_000}).toBeGreaterThanOrEqual(from + passes)
    .catch(() => undefined);
}

/**
 * «The amber stranded guard never rose» over a WINDOW — recorded from its start (`armWitness`), and the window is the
 * DETECTOR's own passes: it runs on a 1 s clock with a 3-pass debounce, so a single read proves nothing and a fixed
 * pause is a guess at its clock.
 */
async function expectNeverStranded(page: Page, key: string, passes: number, message: string): Promise<void> {
  const stranded = await armWitness(page, key, () => document.querySelector('.con-stranded') !== null);
  await awaitDetectorPasses(page, passes);
  expect(await stranded.ever((up) => up), message).toBe(false);
  await stranded.stop();
}

/**
 * DRIVE THE PLACEMENT'S OWN CHAIN until the bonus offer stands.
 *
 * One loop, three states, because the presses are NOT interchangeable:
 *  · a live reveal is answered with A (take / OK);
 *  · a live PLACEMENT is committed with the two-phase pair — and must never
 *    be met with B, which CANCELS it (the old rotation pressed B every 300 ms
 *    and un-locked the very cell it was waiting on, so the ocean was never
 *    placed and the failure read «the bonus layer never appeared»);
 *  · anything else is a presenting toast, dismissed with B.
 */
async function driveToBonusOffer(page: Page, rounds = 90): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    const state = await page.evaluate(() => ({
      reveal: document.querySelector('.con-reveal, .con-deckpick') !== null,
      bonus: document.querySelector('.con-hydro__layer--bonus') !== null,
      placing: document.querySelector('.con-context__task-kicker') !== null,
    }));
    if (state.bonus) {
      return;
    }
    if (state.reveal) {
      await key(page, 'Enter', 700);
    } else if (state.placing) {
      await commitFocusedSpace(page, 900);
    } else {
      await key(page, 'Escape', 300);
    }
  }
}

type Sample = {t: number, reveal: boolean, bonusZone: boolean, hydro: boolean, modal: boolean, stranded: boolean};

/** One state of the COMMIT episode: is the workspace still standing, and is
 *  anything of the advance still physically moving? */
type MoveSample = {t: number, hydro: boolean, marker: boolean, transfer: boolean, commitScene: boolean};
/**
 * One state of the INSPECT episode. `visible` counts every PAINTED face of the
 * source card; `apart` counts them only when they are NOT standing on the same
 * rect — which is the distinction that matters. The canonical close flight
 * deliberately cross-fades the returning stage OVER the revealed slot card for
 * ~60 ms («the card materializes back into its slot», the same handoff language
 * the deal uses), and that is ONE card arriving, not two on screen. Two faces
 * in DIFFERENT places is the defect: a fullscreen copy while the original still
 * sits in the source zone.
 */
type CardSample = {t: number, visible: number, apart: number, zoom: boolean, where: string};

/** Every recorded value with the page's time beside it — ms since the record's first sample (the witness's `t`). */
function stamped<T>(samples: ReadonlyArray<{t: number, v: T}>): Array<T & {t: number}> {
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({...s.v, t: s.t - t0}));
}

const ORDER_WITNESS = 'hydro-order';
/**
 * Arm the order probe BEFORE the press that starts the episode — RECORDED, as the
 * state each task LEAVES (`settled`: «never both at once», «first after last» are
 * coexistence / order claims), so a state that exists only between two mutations
 * of the product is still seen and one that no frame ever painted is not.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness(page, ORDER_WITNESS, () => ({
    // Any drawn-cards presentation: the overlay, or the workspace-embedded one.
    reveal: document.querySelector('.con-reveal, .con-deckpick, .con-deckdraw') !== null,
    bonusZone: document.querySelector('.con-hydro__layer--bonus') !== null,
    hydro: document.querySelector('.con-hydro') !== null,
    // The generic contextual-choice surface — the thing a dedicated
    // workspace must make impossible.
    modal: document.querySelector('.con-decision, .con-task-host .con-task') !== null,
    // The leak detector's amber guard. It rose OVER a Hydronetwork that was
    // rendering the offer perfectly underneath, because the detector read
    // the registry's DEFAULT `serves` and never the frame's earned one.
    stranded: document.querySelector('.con-stranded') !== null,
  }), {settled: true});
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return stamped(await witnessOf<Omit<Sample, 't'>>(page, ORDER_WITNESS).stop());
}

const CARD_WITNESS = 'hydro-card-frames';
/**
 * The INSPECT probe, RECORDED (settled — «never two places at once» is a coexistence claim). While two faces are
 * painted the reader stamps its 30 ms tick (`tickMs`), so a co-located overlap that STANDS is still one sample per tick
 * of a free main thread — the span of a run is measured as the old 30 ms sampler measured it, from its first sample to
 * its last, never stretched to the next change.
 */
async function armCardProbe(page: Page): Promise<void> {
  await armWitness(page, CARD_WITNESS, () => {
    /**
     * PAINTED, not merely present — and that question is asked of the whole
     * ANCESTOR CHAIN, never of the element alone. `opacity` does not inherit
     * as a computed value, so a card inside a transparent parent still
     * reports `opacity: 1`: the zoom flight proxy is authored `opacity: 0`
     * and revealed by its tween's from-state, and reading only the inner
     * `.pcard` counted an invisible proxy as a second card on screen.
     */
    const shown = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) {
        return false;
      }
      let node: Element | null = el;
      while (node !== null && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.02) {
          return false;
        }
        node = node.parentElement;
      }
      return true;
    };
    /** Do two rects stand on top of each other (a dissolve) or apart? */
    const overlaps = (a: DOMRect, b: DOMRect): boolean => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w <= 0 || h <= 0) {
        return false;
      }
      const inter = w * h;
      return inter / Math.min(a.width * a.height, b.width * b.height) > 0.5;
    };
    // Every rendered face of the SOURCE card, anywhere on screen: the dock,
    // the flight proxy, the dialog. The hold empties the dock via a
    // `:has(.con-zoom-hold)` rule on the wrapper, so a held slot no longer
    // paints its card — which is exactly what this counts.
    const zones: ReadonlyArray<[string, string]> = [
      ['dock', '.con-hydro__bonus-source :is(.card-container, .pcard)'],
      ['proxy', '.con-zoom-flight-proxy :is(.card-container, .pcard)'],
      ['stage', '.card-zoom-stage :is(.card-container, .pcard)'],
    ];
    const painted: Array<{zone: string, rect: DOMRect}> = [];
    for (const [zone, sel] of zones) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (shown(el)) {
          painted.push({zone, rect: el.getBoundingClientRect()});
        }
      }
    }
    let apart = 0;
    for (let i = 0; i < painted.length; i++) {
      for (let j = i + 1; j < painted.length; j++) {
        if (!overlaps(painted[i].rect, painted[j].rect)) {
          apart++;
        }
      }
    }
    return {
      visible: painted.length,
      apart,
      zoom: document.querySelector('.card-zoom-stage') !== null,
      where: painted.map((f) =>
        `${f.zone}@${Math.round(f.rect.left)},${Math.round(f.rect.top)} ${Math.round(f.rect.width)}x${Math.round(f.rect.height)}`).join(' + '),
      // The tick while two faces stand (see above) — absent otherwise, so a single face records only its changes.
      ...(painted.length > 1 ? {tick: Math.floor(performance.now() / 30)} : {}),
    };
  }, {settled: true, tickMs: 30});
}

const MOVE_WITNESS = 'hydro-move';
/** The COMMIT probe, RECORDED (settled — «never closed while something still moved» is an order claim). */
async function armMoveProbe(page: Page): Promise<void> {
  await armWitness(page, MOVE_WITNESS, () => ({
    hydro: document.querySelector('.con-hydro') !== null,
    marker: document.querySelector('.con-hydromarker') !== null,
    transfer: document.querySelector('.con-transfer') !== null,
    commitScene: document.querySelector('.con-hydro__layer--commit, .con-hydro__layer--result') !== null,
  }), {settled: true});
}

test.describe('the bonus offer never stands over the cards the placement drew', () => {
  test.setTimeout(420_000);

  test('reveal first, taken, gone — and ONLY THEN the Hydronetwork', async ({page, request}) => {
    await openAtBoard(page, request);

    // The barrier must be IN PLAY before the ocean, or there is no offer at all.
    await playFromHand(page, BARRIER);
    await settle(page);

    // …then the ocean, onto the two-card hex.
    await playFromHand(page, OCEAN_CARD);
    await expect(page.locator('.board-space--available').first()).toBeVisible({timeout: 25_000});
    await walkToSpace(page, DRAW_OCEAN_SPACE);

    // ⭐ ARM BEFORE THE PRESS — the claim is about the middle of the episode.
    //    The LOCK half of the two-phase confirm is pure presentation (no
    //    request, no events), so arming before it still brackets the whole
    //    server-visible episode.
    await armProbe(page);
    expect(await commitFocusedSpace(page, 0), 'the ocean never committed').toBeTruthy();

    // Let the whole chain play out: the reveal comes up, we take the cards,
    // the intake lands, and the offer follows.
    await driveToBonusOffer(page);
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 30_000});
    await page.locator('.con-hydro__layer--bonus').screenshot({path: 'screenshots/hydro-bonus/free.png'}).catch(() => {});

    const samples = await readProbe(page);
    // A DEAD probe must fail loudly rather than pass vacuously. The record keeps DISTINCT states (never frames), so
    // its floor only catches a recorder that never ran — the claims below judge the episode.
    expect(samples.length, `the probe never sampled (${samples.length})`).toBeGreaterThan(0);

    const firstBonus = samples.findIndex((s) => s.bonusZone);
    const lastReveal = samples.map((s) => s.reveal).lastIndexOf(true);
    expect(firstBonus, 'the bonus zone never appeared in the samples').toBeGreaterThan(-1);
    expect(lastReveal, 'the placement never drew any cards — wrong hex?').toBeGreaterThan(-1);

    // ── THE ORDER ITSELF ──────────────────────────────────────────────────
    // 1. The reveal was up while the bonus zone was NOT: the cards came first.
    const revealAlone = samples.filter((s) => s.reveal && !s.bonusZone).length;
    expect(revealAlone, 'the drawn cards were never shown on their own').toBeGreaterThan(0);

    // 2. NOT ONE frame had both — the whole point of the door.
    const overlap = samples.filter((s) => s.reveal && s.bonusZone);
    expect(overlap.map((s) => s.t), 'the reveal and the bonus zone overlapped').toEqual([]);

    // 3. The zone's first appearance is strictly AFTER the reveal's last.
    expect(firstBonus, `bonus at #${firstBonus} vs last reveal at #${lastReveal}`)
      .toBeGreaterThan(lastReveal);

    // 4. THE BLOCKER: the offer has a dedicated workspace, so the generic
    //    contextual-choice modal must never rise beside it. Not once.
    const modalFrames = samples.filter((s) => s.modal);
    expect(modalFrames.map((s) => s.t), 'the legacy choice modal rose over the workspace').toEqual([]);

    // 5. …and the stranded guard never masked the zone either.
    expect(samples.filter((s) => s.stranded).map((s) => s.t),
      'the leak detector called a served prompt stranded').toEqual([]);

    // ══ NO FALSE «FINISH YOUR CURRENT ACTION FIRST» ══════════════════
    //
    // The player is standing in the workspace THIS PROMPT opened. Telling them
    // to go and finish the current action is telling them to finish the thing
    // they are looking at.
    // Read AT REST — the chip as it stands, never a frame of its arrival.
    const status = await readSettled(page, () => page.evaluate(() => ({
      busy: document.querySelector('[data-hydro-status="busy"]') !== null,
      text: document.querySelector('.con-hydro__act')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    })), {message: 'the offer\'s status chip'});
    expect(status.busy, `the status chip read «${status.text}»`).toBe(false);
    expect(status.text, `the status chip read «${status.text}»`).not.toMatch(/завершите/i);

    // ══ X — ONE PHYSICAL CARD, NEVER TWO ══════════════════════════
    //
    // The fullscreen viewer LIFTS the card out of the source dock and the dock
    // slot is held empty for the whole flight (`con-zoom-hold`). RECORDED from
    // before the first press, because the end states of a FLIP and of a second
    // card fading in are identical — only the middle tells them apart.
    await armCardProbe(page);

    // Two full open/close cycles — a repeated inspect must not leave a hidden
    // card behind or lose the cursor.
    for (let cycle = 0; cycle < 2; cycle++) {
      await key(page, 'KeyX', 1400);
      await expect(page.locator('.card-zoom-stage')).toHaveCount(1, {timeout: 10_000});
      await key(page, 'Escape', 1400);
      await expect(page.locator('.card-zoom-stage')).toHaveCount(0, {timeout: 10_000});
    }

    const cardFrames: Array<CardSample> = stamped(await witnessOf<Omit<CardSample, 't'>>(page, CARD_WITNESS).stop());
    // The record keeps distinct states: its floor only catches a recorder that never ran.
    expect(cardFrames.length, `the inspect probe never sampled (${cardFrames.length})`).toBeGreaterThan(0);
    // THE CLAIM: not one sampled frame shows the card in TWO PLACES. The only
    // frames where two faces are painted at all are the landing dissolve, where
    // they stand on the same rect and one is fading out over the other — the
    // console's own materialize-into-the-slot handoff.
    const doubled = cardFrames.filter((f) => f.apart > 0);
    expect(doubled.map((f) => `${f.t}ms → ${f.where}`),
      'the source card was painted in two different places').toEqual([]);
    // …and even the CO-LOCATED overlap must be a BEAT, not a state: it belongs
    // to the landing cross-fade of a flight, never to a standing fullscreen or
    // a standing dock. Measured as the ELAPSED span of each contiguous run of
    // overlapping samples — counting samples and multiplying by the interval
    // measures how often the observer fired, which during a GSAP tween is
    // «very often» and says nothing about how long anything was on screen.
    const runs: Array<number> = [];
    let runStart: number | undefined;
    let runEnd = 0;
    for (const f of cardFrames) {
      if (f.visible > 1) {
        runStart = runStart ?? f.t;
        runEnd = f.t;
      } else if (runStart !== undefined) {
        runs.push(runEnd - runStart);
        runStart = undefined;
      }
    }
    if (runStart !== undefined) {
      runs.push(runEnd - runStart);
    }
    const longest = runs.length > 0 ? Math.max(...runs) : 0;
    expect(longest, `the longest co-located overlap ran ${longest}ms (runs: ${runs.join(', ')}ms)`)
      .toBeLessThan(300);
    // …and the viewer really did open (a dead probe must not pass vacuously).
    expect(cardFrames.some((f) => f.zoom), 'the fullscreen viewer never opened').toBe(true);
    // …and the card came back: the dock paints it again once the flight is over.
    await expect(page.locator('.con-hydro__bonus-source :is(.card-container, .pcard)')).toBeVisible({timeout: 10_000});
    // The inspection answered nothing — the decision is still standing.
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible();

    // ══ B IS «СВЕРНУТЬ» — IT MUST NOT ANSWER THE PROMPT ═══════════════
    const posBefore = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id');
      const r = await fetch(`/api/player?id=${id}`);
      const v = await r.json();
      return {pos: v.thisPlayer.deltaProject?.position ?? 0, waiting: v.waitingFor !== undefined};
    });
    // The bar is a LIVE string (it republishes a frame after what changes it) — asserted by a poll.
    const barLabels = () => page.evaluate(() => Array.from(
      document.querySelectorAll('.con-cmdbar__label'))
      .map((e) => e.textContent?.trim() ?? '').join(' | '));
    await expect.poll(barLabels, {message: `the command bar offers «Пропустить» (it read «${await barLabels()}»)`})
      .not.toMatch(/Пропустить/i);

    await key(page, 'Escape', 1600);
    // The workspace is gone…
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
    // …the decision is NOT: the server is still asking, and nothing moved.
    const posAfter = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id');
      const r = await fetch(`/api/player?id=${id}`);
      const v = await r.json();
      return {
        pos: v.thisPlayer.deltaProject?.position ?? 0,
        bonus: v.waitingFor?.deltaBonusPrompt !== undefined,
      };
    });
    expect(posBefore.waiting, 'the offer was not on the wire to begin with').toBe(true);
    expect(posAfter.pos, 'B moved the marker — it answered the prompt').toBe(posBefore.pos);
    expect(posAfter.bonus, 'B resolved the offer instead of minimizing it').toBe(true);

    // …and the board-home mandatory card is the way back INTO THE SAME PROMPT.
    await expect(page.locator('.con-mandatory')).toBeVisible({timeout: 20_000});
    await key(page, 'Enter', 2000);
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 20_000});
    // No duplicate: exactly one workspace, one offer, one source card.
    await expect.poll(() => page.locator('.con-hydro').count()).toBe(1);
    await expect.poll(() => page.locator('.con-hydro__layer--bonus').count()).toBe(1);
    // …and no false warning on the way back in either.
    await expect.poll(() => page.locator('[data-hydro-status="busy"]').count(), {message: 'the re-entered workspace nagged about the current action'}).toBe(0);

    // ══ THE MOVE IS PRESENTED — AND THE WORKSPACE OUTLIVES IT ════════════
    //
    // A free bonus step must look exactly like a paid advance: the marker
    // glides, the landed stage pays out, the counters tick — and only then may
    // the workspace go. It used to submit and close in the same breath.
    await armMoveProbe(page);

    // ══ THE PAID OFFER — the same flow, one stage further up the track ══
    //
    // Take the free step (it lands on position 1, «building», which the barrier's
    // OWN tag covers), then place another ocean. The next stage wants POWER,
    // which this player has not got — so the offer is no longer free: the server
    // decides it costs 1 energy to waive that one tag, and the zone must say so.
    // A on the focused CONFIRM takes the free step. Landing on position 1 asks
    // WHICH reward — and it asks INSIDE this workspace (the whole point), so
    // keep answering until the move is fully resolved.
    // Each A is act → verify: it gets its whole window for the workspace to answer (its layer / focused row / cta
    // changing, or the workspace gone) before the next one — never a second A on a step that was merely slow.
    const hydroSignature = () => page.evaluate(() => {
      const root = document.querySelector('.con-hydro');
      if (root === null) {
        return 'gone';
      }
      return JSON.stringify({
        layers: Array.from(root.querySelectorAll('[class*="con-hydro__layer--"]')).map((el) => el.className).join('|'),
        focused: root.querySelector('[class*="--focused"]')?.className ?? '',
      });
    }).catch(() => 'gone');
    for (let i = 0; i < 20 && await page.locator('.con-hydro').count() > 0; i++) {
      const zone = await page.evaluate(() => ({
        bonus: document.querySelector('.con-hydro__layer--bonus') !== null,
        choice: document.querySelector('.con-hydro__layer--choice') !== null,
      }));
      // …and a reward asked here is NEVER a modal beside the workspace.
      await expect.poll(() => page.locator('.con-decision').count(), {message: 'a modal rose for the reward'}).toBe(0);
      const before = await hydroSignature();
      await pressUntil(page, 'Enter', async () => (await hydroSignature()) !== before,
        {tries: 1, settleMs: zone.bonus || zone.choice ? 1400 : 900});
    }

    // The offer was a visit the player did not ask for, so answering it HANDS
    // THE SCREEN BACK: the Hydronetwork must leave by itself.
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 30_000});

    // ══ …AND THE CLOSE CAME LAST ═══════════════════════════════
    const move: Array<MoveSample> = stamped(await witnessOf<Omit<MoveSample, 't'>>(page, MOVE_WITNESS).stop());
    // The record keeps distinct states: its floor only catches a recorder that never ran.
    expect(move.length, `the move probe never sampled (${move.length})`).toBeGreaterThan(0);

    // 1. The marker ACTUALLY GLIDED. A bonus step that skips this is the
    //    original defect: the position simply changed while nobody looked.
    const glided = move.filter((m) => m.marker);
    expect(glided.length, 'the marker never glided for the free bonus step').toBeGreaterThan(0);

    // 2. The commit scene stood — the workspace narrated its own move.
    expect(move.some((m) => m.commitScene),
      'the workspace never showed the move it was making').toBe(true);

    // 3. THE CLAIM: the workspace never closed while the move was still
    //    physically happening. Not one frame with the marker (or a reward
    //    chip) in the air and no Hydronetwork under it.
    const closedEarly = move.filter((m) => !m.hydro && (m.marker || m.transfer));
    expect(closedEarly.map((m) => `${m.t}ms`),
      'the workspace closed while the advance was still animating').toEqual([]);

    // 4. …and the LAST frame in which anything was moving comes BEFORE the
    //    workspace's last frame: the close is the chain's completion event.
    const lastMoving = move.map((m) => m.marker || m.transfer).lastIndexOf(true);
    const lastHydro = move.map((m) => m.hydro).lastIndexOf(true);
    expect(lastHydro, `last moving #${lastMoving}, last workspace #${lastHydro}`)
      .toBeGreaterThanOrEqual(lastMoving);
    await playFromHand(page, OCEAN_CARD_2);
    await expect(page.locator('.board-space--available').first()).toBeVisible({timeout: 25_000});
    expect(await commitFocusedSpace(page, 1500), 'the ocean never committed').toBeTruthy();
    await driveToBonusOffer(page);
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 30_000});

    // THE SERVER'S OWN VERDICT, rendered: the price is on the CTA and in the
    // body, and the free wording is gone. The client decided none of it. Read
    // AT REST — the offer as it stands, never a frame of its arrival.
    const paid = await readSettled(page, () => page.evaluate(() => ({
      // Direct child only — the permanent glyph slot nests `.gp-glyph`, itself
      // a last-of-type span, so an unscoped query reads the badge's «A».
      confirm: document.querySelector('.con-hydro__ctazone .con-hydro__cta > span:last-of-type')?.textContent?.trim() ?? '',
      body: document.querySelector('.con-hydro__bonus-text')?.textContent?.trim() ?? '',
      cost: document.querySelector('.con-hydro__route-cost')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      free: document.querySelector('.con-hydro__route-cost--free') !== null,
      // THE PRICE AS A PREMIUM «сейчас → станет» ROW — the same grammar the
      // plan panel states an ordinary advance with.
      spendRow: document.querySelector('.con-hydro__payline-mix')
        ?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      spendLabel: document.querySelector('.con-hydro__payline .con-hydro__section-label')
        ?.textContent?.trim() ?? '',
    })), {message: 'the paid offer'});
    // THE PARITY LAW: the primary is the DECISION's own vocabulary — the
    // same «Укрепить гидросеть» the player's advance commits with, no price
    // folded in, whatever the offer's shape (the source-only «Продвинуться»
    // dialect is retired).
    expect(paid.confirm, `paid CTA read «${paid.confirm}»`).not.toMatch(/энерги|продвин/i);
    expect(paid.confirm, `paid CTA read «${paid.confirm}»`)
      .toMatch(/УКРЕПИТЬ ГИДРОСЕТЬ|ВЫБЕРИТЕ НАГРАДУ/i);
    expect(paid.body, `paid body read «${paid.body}»`).toMatch(/метк/i);
    expect(paid.cost, `paid cost chip read «${paid.cost}»`).toContain('1');
    // …and the PRICE is stated through the plan panel's OWN payment line.
    expect(paid.spendLabel, `the payment row read «${paid.spendLabel}»`).toMatch(/оплат/i);
    expect(paid.spendRow, `the payment row read «${paid.spendRow}»`).toMatch(/\d+\s*→\s*\d+/);
    expect(paid.spendRow, `the payment row read «${paid.spendRow}»`).toContain('−1');
    await page.locator('.con-hydro__layer--bonus').screenshot({path: 'screenshots/hydro-bonus/paid.png'}).catch(() => {});
    expect(paid.free, 'the paid offer must not advertise itself as free').toBe(false);
  });

  /**
   * ══ THE TWO EDGES A CHANGE WATCHER CANNOT SEE ══════════════════════
   *
   * The door that puts a card-granted offer on screen is a watcher on a
   * computed. Two live states never make that computed CHANGE, and both
   * shipped:
   *
   *  1. A RELOAD with the offer already on the wire evaluates the door as
   *     `open` on its FIRST computation — so nothing ever fires, the workspace
   *     never opens, and the leak detector correctly reports «STRANDED PROMPT:
   *     waitingFor "or" (task kind "choice") has NO serving surface». The amber
   *     guard was the only thing on screen.
   *  2. OPENING «ГИДРОСЕТЬ» FROM THE WHEEL while the offer is parked leaves
   *     the door at `queue` (a parked frame is still «known») while creating a
   *     BRAND-NEW live frame that never earned its `serves` — so the screen the
   *     player is standing in did not count as the prompt's home and the top
   *     chip flashed for attention at somebody standing on the decision.
   */
  test('a RELOAD and a WHEEL entry both land on the offer — never stranded, never nagged', async ({page, request}) => {
    const playerId = await openAtBoard(page, request);

    await playFromHand(page, BARRIER);
    await settle(page);
    await playFromHand(page, OCEAN_CARD);
    await expect(page.locator('.board-space--available').first()).toBeVisible({timeout: 25_000});
    await walkToSpace(page, DRAW_OCEAN_SPACE);
    expect(await commitFocusedSpace(page, 1500), 'the ocean never committed').toBeTruthy();

    // Work the placement's own chain (a reveal, if the hex drew) to the offer.
    await driveToBonusOffer(page);
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 30_000});

    // ══ 1. THE RELOAD ══════════════════════════════════════
    // A fresh document on the same player (the shared boot: shell → load → veil — no key races the veil).
    await openConsole(page, playerId);

    // The workspace comes up BY ITSELF, on the mount edge — no press.
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 45_000});
    // …and the amber guard never rose. Checked over a WINDOW: the detector runs
    // on a 1 s clock with a 3-tick debounce, so a single read proves nothing —
    // recorded over five of its own passes.
    await expectNeverStranded(page, 'hydro-stranded-reload', 5, 'the stranded guard rose over a live offer');
    // The offer is still the SAME unanswered prompt — a reload resolves nothing.
    const afterReload = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id');
      const v = await (await fetch(`/api/player?id=${id}`)).json();
      return v.waitingFor?.deltaBonusPrompt !== undefined;
    });
    expect(afterReload, 'the reload answered the prompt').toBe(true);

    // ══ 2. COLLAPSE → THE WHEEL ════════════════════════════════
    // B is act→verify→retry, never a single blind press: a VISIBLE TOAST
    // overrides B everywhere in this console (the press closes the card and
    // is consumed — the screen's own «свернуть» is the NEXT B), and after a
    // reload the ordinary feed is exactly what is replaying.
    expect(await pressUntilGone(page, 'Escape', '.con-hydro', {tries: 5, settleMs: 1600}),
      'B never collapsed the Hydronetwork').toBeTruthy();

    // RT (`Period`) opens the action-category wheel; the guard must not rise
    // over it either — that is the screen the reported strand was seen on.
    await key(page, 'Period', 1200);
    await expect(page.locator('.con-quick')).toBeVisible({timeout: 10_000});
    await expectNeverStranded(page, 'hydro-stranded-wheel', 4, 'the stranded guard rose over the wheel');

    // POSITIVE CONTROL for the beacon assertion below: with the decision parked
    // and the player looking at something else, the top chip IS the reminder —
    // that is what it is for. (The strip debounces engagement by 1200 ms; the
    // guard window above has already spent four detector passes.)
    await expect.poll(() => page.locator('.con-status__beacon').count(), {message: 'the beacon must light while the player is away from the decision'}).toBeGreaterThan(0);

    // The wheel is PRESS→RELEASE (wheelArmModel): the DOWN edge of a d-pad
    // direction ARMS its slot and the UP edge COMMITS it — a tap is the whole
    // gesture, and there is no confirm press to wait for. A slot's IDENTITY is
    // its SPATIAL class (the model's own map: `hydro` is `left`), never the
    // translated label.
    await expect(page.locator('.con-quick__slot--left')).toBeVisible({timeout: 8_000});
    await key(page, 'ArrowLeft', 2500);
    await expect(page.locator('.con-quick'), 'the wheel committed and closed')
      .toHaveCount(0, {timeout: 10_000});

    // The offer is on screen again…
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 20_000});
    // …and the player is standing in the prompt's own home, so the top chip
    // must NOT be flashing for attention. (The strip debounces engagement by
    // 1200 ms — wait past it, or the assertion proves only that it is slow:
    // three of the console's own 1 Hz passes, never a guessed pause.)
    await awaitDetectorPasses(page, 3);
    await expect.poll(() => page.locator('.con-status__beacon').count(), {message: 'the chip beaconed at a player standing on the decision'}).toBe(0);
    // …and still no guard.
    await expect.poll(() => page.locator('.con-stranded').count()).toBe(0);
  });
});
