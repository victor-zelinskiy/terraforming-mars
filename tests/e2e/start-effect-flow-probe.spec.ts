import {test, expect, Page} from '@playwright/test';
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
      const w = window as unknown as {__flowWatch: {frames: Array<unknown>, ghost: number, early: number, standalone: number, zoom: number}};
      const state = {frames: [] as Array<unknown>, ghost: 0, early: 0, standalone: 0, zoom: 0};
      w.__flowWatch = state;
      const t0 = performance.now();
      const vis = (el: Element | null): boolean =>
        el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
      const tick = () => {
        const t = Math.round(performance.now() - t0);
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
        ghost: number, standalone: number, zoom: number}}).__flowWatch);
    const frames = watch.frames;
    console.log(`[flow-watch] frames=${frames.length} ghost=${watch.ghost} standalone=${watch.standalone} zoom=${watch.zoom}`);
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
  });
});
