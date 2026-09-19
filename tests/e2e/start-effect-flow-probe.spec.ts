import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  openConsole, pickCards, playQueueCard, playQueueUntil, submitSummary,
  takeRevealCards, walkToSummary,
} from './consoleStart';

/**
 * THE START EFFECT FLOW probe — a corporation and two preludes whose play
 * runs an INTERACTIVE draw/reveal (Pharmacy Union: reveal-until-science ×1;
 * SF Memorial: draw 1; Biolab: draw 3). The contract under test (round-6):
 * one continuous play animation with a natural interactive pause —
 *
 *   «Подготовлено» → the card stops at the EFFECT-SOURCE seat → the queue
 *   scene genuinely LEAVES (never a dimmed ghost under a modal) → the
 *   embedded reveal owns the workspace room → the player finishes → the
 *   queue returns → the card continues into «РАЗЫГРАНО».
 *
 * A per-frame witness records the load-bearing invariants; assertions are
 * ORDERING-based (headless pacing drifts), never wall-clock.
 */

const OUT_DIR = path.resolve('screenshots', 'start-effect');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: true, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'EffectProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['Pharmacy Union', 'CrediCor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['SF Memorial', 'Biolab', 'Acquired Space Agency', 'Metals Company'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: {difficulty: 'normal'},
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}


test.describe('start effect flow · interactive draw is ONE play animation', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('corp + two preludes with draws run the seat → reveal → return → dock flow', async ({page, request}) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT_DIR, {recursive: true});

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};

    await openConsole(page, model.players[0].id);

    // ── The wizard walk: Pharmacy Union + [SF Memorial, Biolab] + 0 projects.
    //    Through the SHARED driver, whose picks key on the ENGLISH CardName the
    //    slot carries (`data-zoom-slot`). The hand-rolled walk this replaced
    //    matched the RU LABEL, so it silently picked nothing and failed three
    //    screens before its own subject — the exact rot `consoleStart.ts` exists
    //    to prevent («fix it HERE, once»).
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, ['Pharmacy Union']), 'the corp deal held Pharmacy Union')
            .toContain('Pharmacy Union');
        } else if (kind === 'prelude') {
          expect((await pickCards(p, ['SF Memorial', 'Biolab'])).sort(), 'both draw preludes')
            .toEqual(['Biolab', 'SF Memorial']);
        }
        // projects: buy nothing.
      },
    });
    await submitSummary(page);

    // ── The deployment stands (materialization settles).
    await page.waitForSelector('.con-start__queue [data-queue-slot]', {timeout: 30_000});
    await page.waitForTimeout(3500);

    // THE PER-FRAME WITNESS for the whole three-effect sequence.
    await page.evaluate(() => {
      type Landing = {t: number, x: number, y: number, w: number,
        sx: number, sy: number, sw: number, settled: number, prev: string};
      const w = window as unknown as {__flowWatch: {frames: Array<unknown>, ghost: number, early: number,
        standalone: number, zoom: number, handoffs: Array<Landing>}};
      const state = {frames: [] as Array<unknown>, ghost: 0, early: 0, standalone: 0, zoom: 0,
        handoffs: [] as Array<Landing>};
      w.__flowWatch = state;
      const t0 = performance.now();
      const vis = (el: Element | null): boolean =>
        el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
      // THE LANDING WITNESS — the handoff is a DOUBLE, not a dissolve, and the
      // place it is measured against is the seat's RESTING rect.
      //
      // ① `hideHeroProxyNextFrame` (playedHeroDirector, 2026-09-13) replaced the
      //    crossfade with «the real card paints UNDER the proxy and the proxy is
      //    removed on the NEXT painted frame — never faded». The window this
      //    probe used to gate on (0.02 < opacity < 0.97) was deleted together
      //    with the artefact it caused, so it can never open again: the witness
      //    reported «no hero handoff overlay was witnessed» about a handoff that
      //    runs perfectly.
      // ② The seat is NOT at its final box at that instant, and it is not
      //    supposed to be: it mounts inside a zone running `con-start-embed-in`,
      //    and the flight deliberately aims at the rect the slot COMES TO REST
      //    at (`restingRectOf` / `peekTargetRect` — the landing-rect law). The
      //    real card also fades in over the slot's own 160 ms transition, so at
      //    the handoff frame it is painted at ~0.2, not at 1. A mid-entry
      //    comparison would therefore fail the CORRECT product. (Measured on
      //    this flow: the last painted proxy frame sits within a pixel of the
      //    seat's final box while the seat's live box is still 3-10 px away.)
      //
      // So the claim is asserted where it is true and where the regression it
      // exists for shows: the proxy's LAST PAINTED box must be the box the seat
      // SETTLES at. A flight aimed at a moving rect lands short and the visible
      // card snaps by the remaining travel — measured at 9-18 px when that bug
      // shipped; only subpixel rounding is allowed.
      const paintedOpacity = (el: Element): number => {
        let op = 1;
        for (let n: Element | null = el; n !== null; n = n.parentElement) {
          op *= Number(getComputedStyle(n).opacity);
        }
        return op;
      };
      /** Is this element (or an ancestor zone) still being MOVED by a live
       *  CSS animation? The same predicate `restingRectOf` uses — a seat whose
       *  zone is mid-entry has no settled box to compare against yet. */
      const stillEntering = (el: Element): boolean => {
        for (let n: Element | null = el, d = 0; n !== null && d < 14; n = n.parentElement, d++) {
          const host = n as Element & {getAnimations?: (o?: {subtree?: boolean}) => Array<Animation>};
          if (typeof host.getAnimations !== 'function') {
            continue;
          }
          for (const anim of host.getAnimations({subtree: false})) {
            if (anim.playState !== 'running') {
              continue;
            }
            try {
              const frames = (anim.effect as KeyframeEffect).getKeyframes() as Array<{transform?: unknown}>;
              if (frames.some((f) => typeof f.transform === 'string')) {
                return true;
              }
            } catch {
              // an effect that cannot be read is not evidence of motion
            }
          }
        }
        return false;
      };
      const seatEl = () =>
        document.querySelector<HTMLElement>('[data-embed-source-slot] :is(.card-container, .pcard)') ??
        document.querySelector<HTMLElement>('[data-embed-source-slot]');
      let airborne: {t: number, x: number, y: number, w: number} | undefined;
      const heroDelta = () => {
        const hero = document.querySelector<HTMLElement>('.con-played-hero__proxy');
        const seat = seatEl();
        if (hero !== null) {
          const r = hero.getBoundingClientRect();
          const s = seat?.getBoundingClientRect();
          // Only the flight that is ENDING at the seat (the return leg dissolves
          // at the shelf, hundreds of px away). Near-gate at half a card.
          if (paintedOpacity(hero) > 0.97 && r.width > 10 && s !== undefined && s.width > 10 &&
              Math.abs(s.left - r.left) < 200 && Math.abs(s.top - r.top) < 200) {
            airborne = {t: Math.round(performance.now() - t0), x: r.left, y: r.top, w: r.width};
          }
          return;
        }
        // The proxy is gone: the last painted box IS the handoff.
        if (airborne !== undefined) {
          state.handoffs.push({...airborne, sx: NaN, sy: NaN, sw: NaN, settled: 0, prev: ''});
          airborne = undefined;
        }
        const h = state.handoffs[state.handoffs.length - 1];
        if (h === undefined || h.settled === 1 || seat === null) {
          return;
        }
        if (stillEntering(seat)) {
          h.prev = '';
          return;
        }
        const s = seat.getBoundingClientRect();
        const sig = `${Math.round(s.left * 100)},${Math.round(s.top * 100)},${Math.round(s.width * 100)}`;
        if (s.width > 10 && sig === h.prev) {
          h.sx = s.left;
          h.sy = s.top;
          h.sw = s.width;
          h.settled = 1;
        }
        h.prev = sig;
      };
      const tick = () => {
        const t = Math.round(performance.now() - t0);
        heroDelta();
        // PER-TAKE INTAKE: with a reachable dock a take flies to the hand the
        // moment it is taken — so intake proxies must exist WHILE the reveal
        // still stands (the fallback grammar only flies after the last card).
        const intakeUp = document.querySelectorAll('.con-handdelivery-layer .con-deal-proxy').length > 0;
        const queue = document.querySelector<HTMLElement>('.con-start__queue');
        const queueOp = queue === null ? -1 : parseFloat(getComputedStyle(queue).opacity);
        const reveal = document.querySelector('.con-reveal');
        const revealUp = vis(reveal);
        const inEmbed = reveal !== null && reveal.closest('.con-start__embed') !== null;
        const colCard = document.querySelector('[data-embed-source-slot]');
        const colUp = vis(colCard);
        const src = colCard?.closest('.con-start__embedsource')?.querySelector('.con-start__embedsource-card');
        void src;
        // The source card's tableau face (any played-key face that is the
        // embed source) — visible DURING the reveal = the premature dock.
        const away = document.querySelector<HTMLElement>('.con-start__played [data-played-key] .con-splayed__face');
        const dockFaceUp = vis(away);
        // The FULLSCREEN VIEWER. Nobody presses X in this run, and a card a
        // workspace owns is never presented headless — so the viewer opening
        // at all means the reveal fell back to «the fullscreen IS the reveal».
        // SF Memorial draws exactly ONE card, and its take is the seam that
        // used to trip it: the claim is released while the batch is still up.
        const zoomUp = document.querySelector('dialog.con-zoom[open]') !== null;
        state.frames.push({t, queueOp, revealUp, colUp, dockFaceUp, intakeUp, zoomUp, inEmbed,
          strip: document.querySelectorAll('.con-reveal__strip .con-cards__slot').length});
        if (revealUp && queue !== null && queueOp > 0.1 && vis(queue)) {
          state.ghost++; // the old scene ghosting under the reveal
        }
        if (revealUp && !inEmbed) {
          state.standalone++; // the reveal escaped the workspace zone
        }
        if (zoomUp) {
          state.zoom++;
        }
        if (performance.now() - t0 < 120_000) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    // ── EFFECT 1 · the corporation (Pharmacy Union — reveal 1 science card).
    expect(await playQueueUntil(page, 'Pharmacy Union'), 'the corp stands in the queue').toBeTruthy();
    expect(await playQueueCard(page, 'Pharmacy Union'), 'the corp was played').toBeTruthy();
    await shoot(page, '01-corp-departing');
    // The embedded reveal must present INSIDE the workspace zone.
    await page.waitForSelector('.con-start__embed .con-reveal', {timeout: 30_000});
    await page.waitForTimeout(900);
    await shoot(page, '02-corp-reveal');
    // The source card presides over the effect from its seat.
    await expect(page.locator('[data-embed-source-slot]')).toBeVisible();
    // Take the revealed card (A per card; the last one closes the reveal).
    await takeRevealCards(page);
    // The return: queue back, then the card continues into «РАЗЫГРАНО».
    await expect(page.locator('.con-start__embed .con-reveal')).toBeHidden({timeout: 25_000});
    await expect.poll(() => page.evaluate(() => {
      const q = document.querySelector<HTMLElement>('.con-start__queue');
      return q !== null && parseFloat(getComputedStyle(q).opacity) > 0.95;
    }), {timeout: 20_000}).toBeTruthy();
    await expect.poll(() => page.evaluate(() => {
      const face = document.querySelector<HTMLElement>('.con-start__played [data-played-key="Pharmacy Union"] .con-splayed__face');
      return face !== null && face.checkVisibility({opacityProperty: true, visibilityProperty: true});
    }), {timeout: 20_000}).toBeTruthy();
    await shoot(page, '03-corp-docked');

    // ── EFFECT 2 + 3 · the preludes. SF MEMORIAL DRAWS EXACTLY ONE CARD — the
    //    single-card case whose take used to hand the departing card to the
    //    fullscreen viewer; Biolab's three exercise the multi-card strip.
    for (const prelude of ['SF Memorial', 'Biolab']) {
      expect(await playQueueCard(page, prelude), `${prelude} was played`).toBeTruthy();
      await page.waitForSelector('.con-start__embed .con-reveal', {timeout: 30_000});
      await page.waitForTimeout(700);
      await shoot(page, `04-${prelude.replace(/\s+/g, '-').toLowerCase()}-reveal`);
      await takeRevealCards(page);
      await expect(page.locator('.con-start__embed .con-reveal')).toBeHidden({timeout: 30_000});
      await expect.poll(() => page.evaluate(() => {
        const q = document.querySelector<HTMLElement>('.con-start__queue');
        return q !== null && parseFloat(getComputedStyle(q).opacity) > 0.95;
      }), {timeout: 20_000}).toBeTruthy();
    }
    await page.waitForTimeout(1500);
    await shoot(page, '06-all-docked');

    // ── THE WITNESS VERDICT.
    const watch = await page.evaluate(() => (window as unknown as {
      __flowWatch: {frames: Array<{t: number, queueOp: number, revealUp: boolean, colUp: boolean,
        dockFaceUp: boolean, intakeUp: boolean, zoomUp: boolean, inEmbed: boolean, strip: number}>,
        ghost: number, standalone: number, zoom: number,
        handoffs: Array<{t: number, x: number, y: number, w: number,
          sx: number, sy: number, sw: number, settled: number}>}}).__flowWatch);
    const frames = watch.frames;
    console.log(`[flow-watch] frames=${frames.length} ghost=${watch.ghost} standalone=${watch.standalone} zoom=${watch.zoom}`);
    console.log(`[flow-watch] hero landings: ${watch.handoffs.map((h) =>
      `t=${h.t} proxy=${Math.round(h.x)},${Math.round(h.y)} seat=${Math.round(h.sx)},${Math.round(h.sy)} ` +
      `Δ=${(h.sx - h.x).toFixed(2)},${(h.sy - h.y).toFixed(2)} settled=${h.settled}`).join(' · ') || 'none'}`);
    if (watch.standalone > 0) {
      console.log(`[flow-watch] standalone at ${frames.filter((f) => f.revealUp && !f.inEmbed).map((f) => f.t).join(', ')} ms`);
    }

    // 1 · The reveal NEVER floats over a ghosted queue (the modal feel).
    expect(watch.ghost, 'reveal presented over a still-painted queue').toBe(0);
    // 2 · The reveal never presented OUTSIDE the workspace embed zone — INCLUDING
    //     its closing tick: when the take folds the workspace the surface loses
    //     its teleport zone, and a reveal that still renders there re-dresses as
    //     the standalone band over the board (`drawnRevealDetached`).
    expect(watch.standalone, 'reveal escaped the workspace zone').toBe(0);
    // 2b · …and never handed the card to the FULLSCREEN VIEWER. A workspace
    //      owns what it produced; the viewer is X's job, never a take's. The
    //      one-card prelude (SF Memorial) used to throw the player fullscreen
    //      the moment «A Взять карту» released the claim.
    expect(watch.zoom, 'the fullscreen viewer opened on its own during the start effects').toBe(0);
    // 3 · While a reveal was up, the source card stood in its seat…
    const revealFrames = frames.filter((f) => f.revealUp);
    expect(revealFrames.length, 'the reveal actually presented').toBeGreaterThan(5);
    expect(revealFrames.every((f) => f.colUp), 'source seat empty during a reveal').toBeTruthy();
    // 4 · …and the played card was NOT prematurely standing in «РАЗЫГРАНО»
    //     (the FIRST effect: no dock face exists at all until it completes).
    const firstReveal = frames.findIndex((f) => f.revealUp);
    const firstRevealEnd = frames.findIndex((f, i) => i > firstReveal && !f.revealUp);
    expect(frames.slice(firstReveal, firstRevealEnd).some((f) => f.dockFaceUp),
      'the corp reached the dock before its effect completed').toBeFalsy();
    // 5 · Queue fully away at SOME point of each reveal window (the release
    //     genuinely completed — 0.0, not the old 0.22 dim).
    expect(revealFrames.some((f) => f.queueOp <= 0.05), 'queue never fully released').toBeTruthy();
    // 6 · PER-TAKE INTAKE (the hand dock is reachable here): a take flies to
    //     the dock WHILE the reveal is still standing — the fallback grammar
    //     (turn in place, one stack at the end) would show zero such frames.
    expect(revealFrames.some((f) => f.intakeUp), 'no intake flight ran while the reveal stood').toBeTruthy();
    // 7 · …and the strip RE-FLOWS: the taken card leaves the row, so the slot
    //     count shrinks inside a single reveal window (Biolab draws 3).
    const stripCounts = revealFrames.map((f) => f.strip);
    expect(Math.max(...stripCounts), 'a multi-card reveal stood').toBeGreaterThan(1);
    expect(stripCounts.some((c, i) => i > 0 && c < stripCounts[i - 1] && c > 0),
      'the strip never re-flowed after a take (cards stayed in their slots)').toBeTruthy();
    // 8 · THE LANDING IS PIXEL-TRUE. The proxy's LAST PAINTED box is the box
    //     the seat SETTLES at — the flight aims at the resting rect, and a
    //     flight aimed at a moving one lands short and snaps the visible card
    //     by the remaining travel (9–18 px when that bug shipped). See the
    //     witness above for why the comparison is against the SETTLED seat and
    //     not against the seat's live box at the handoff frame.
    expect(watch.handoffs.length, 'no hero landing was witnessed at the seat').toBeGreaterThan(0);
    for (const h of watch.handoffs) {
      const where = `t=${h.t} proxy=${h.x.toFixed(2)},${h.y.toFixed(2)} seat=${h.sx.toFixed(2)},${h.sy.toFixed(2)}`;
      expect(h.settled, `the seat never came to rest after the landing (${where})`).toBe(1);
      expect(Math.abs(h.sx - h.x), `hero landing Δx (${where})`).toBeLessThan(2);
      expect(Math.abs(h.sy - h.y), `hero landing Δy (${where})`).toBeLessThan(2);
      expect(Math.abs(h.sw - h.w), `hero landing Δw (${where} w=${h.w.toFixed(2)}/${h.sw.toFixed(2)})`).toBeLessThan(2);
    }
  });
});
