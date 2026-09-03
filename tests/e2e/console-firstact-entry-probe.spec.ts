import {test, expect} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fillPicks, openConsole, pickCards, playStartQueue, submitSummary, walkToSummary,
} from './consoleStart';

/**
 * THE FIRST-ACTION STAGE ENTRY — the frame-by-frame witness.
 *
 * The player reported the stage APPEARING as a «рывок»: the briefing panel,
 * the seated corporation, the crumb tail and the room all change at once, and
 * something in that chord reads as a jump rather than as the descend phrase.
 * This probe samples every moving part of the entry at ~16 ms and prints the
 * TIMELINE, so the defect is named by measurement, not by feel:
 *
 *   · the queue's recede (opacity/scale — it must LEAVE, not blink);
 *   · the played shelf's pose (the corp face must step away only under a
 *     proxy, never a frame before);
 *   · the emerge flight (proxy count + the seat staying deal-held until
 *     touchdown);
 *   · the zone's own entry animation state;
 *   · the briefing panel's entry (opacity/transform ramp — a panel that is
 *     already opaque on its first painted frame entered as a BLINK);
 *   · layout anchors (the deploy row's rect, the shelf's rect) — nothing
 *     structural may move.
 */

const OUT_DIR = path.resolve('screenshots', 'firstact-entry');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: true, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'FirstActProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false,
    // A corporation with a MANDATORY first action (Philares: place a greenery).
    customCorporationsList: ['Philares', 'CrediCor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['SF Memorial', 'Biolab', 'Acquired Space Agency', 'Metals Company'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: {difficulty: 'normal'},
  };
}

type Frame = {
  t: number,
  queueOp: string, queueTf: string,
  zoneLive: boolean, zoneAnim: string, zoneCls: string,
  seatUp: boolean, seatHeld: boolean, seatRect: string,
  panelUp: boolean, panelOp: string, panelTf: string,
  proxies: number, heroPr: number,
  shelfFaceUp: boolean, shelfRect: string, deployRect: string,
  crumb: string,
};

test.describe('first-action stage entry · frame witness', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the stage enters as one phrase — no blink, no teleport, no layout jump', async ({page, request}) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT_DIR, {recursive: true});

    // Relay the scene's own motion dev-warns into the test log (the degraded
    // emerge names its branch there).
    page.on('console', (m) => {
      if (m.text().includes('[start-emerge]')) {
        console.log(`PAGE: ${m.text()}`);
      }
    });

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    await openConsole(page, model.players[0].id);

    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, ['Philares']), 'the corp deal held Philares').toContain('Philares');
        } else if (kind === 'prelude') {
          // The NO-DRAW pair, deterministically: with drawing preludes the
          // seat cycles during their effects and the first-action entry rides
          // a different (already-working) timing — the reported degradation
          // reproduces only on the «last hero still flying» race this pair
          // creates.
          await pickCards(p, ['Acquired Space Agency', 'Metals Company']);
          await fillPicks(p, 2);
        }
        // projects: none.
      },
    });
    await submitSummary(page);
    await page.waitForSelector('.con-start__queue [data-queue-slot]', {timeout: 30_000});
    await page.waitForTimeout(2500);

    // ARM THE WITNESS before the queue is played out — the stage entry fires
    // on the heels of the last prelude's own landing.
    await page.evaluate(() => {
      const w = window as unknown as {__fa: {frames: Array<unknown>, t0: number, timer: number}};
      const t0 = performance.now();
      const state = {frames: [] as Array<unknown>, t0, timer: 0};
      w.__fa = state as never;
      const rect = (el: Element | null): string => {
        if (el === null) {
          return '-';
        }
        const r = el.getBoundingClientRect();
        return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}`;
      };
      const sample = () => {
        const queue = document.querySelector<HTMLElement>('.con-start__queue');
        const zone = document.querySelector<HTMLElement>('.con-start__embed');
        const seat = document.querySelector<HTMLElement>('.con-start__embedsource-card');
        const panel = document.querySelector<HTMLElement>('.con-start__firstact');
        const shelfFace = document.querySelector<HTMLElement>('.con-start__played [data-played-key="Philares"] .con-splayed__face');
        const deploy = document.querySelector<HTMLElement>('.con-start__deploy');
        const shelf = document.querySelector<HTMLElement>('.con-start__played');
        const crumbEl = document.querySelector<HTMLElement>('.con-wshead__layer--deep');
        const qs = queue === null ? undefined : getComputedStyle(queue);
        const ps = panel === null ? undefined : getComputedStyle(panel);
        const zs = zone === null ? undefined : getComputedStyle(zone);
        (w.__fa.frames as Array<unknown>).push({
          t: Math.round(performance.now() - t0),
          queueOp: qs === undefined ? '-' : Number(qs.opacity).toFixed(2),
          queueTf: qs === undefined ? '-' : (qs.transform === 'none' ? 'none' : 'tf'),
          zoneLive: zone !== null && zone.classList.contains('con-start__embed--live'),
          zoneAnim: zs === undefined ? '-' : (zs.animationName === 'none' ? '-' : `${zs.animationName}@${zs.animationPlayState}`),
          zoneCls: zone === null ? '-' : Array.from(zone.classList).filter((c) => c.includes('--')).map((c) => c.slice(18)).join(','),
          seatUp: seat !== null,
          seatHeld: seat !== null && seat.classList.contains('con-deal-hold'),
          seatRect: rect(seat),
          panelUp: panel !== null,
          panelOp: ps === undefined ? '-' : Number(ps.opacity).toFixed(2),
          panelTf: ps === undefined ? '-' : (ps.transform === 'none' ? 'none' : ps.transform.slice(0, 40)),
          proxies: document.querySelectorAll('.con-startdock-proxy').length,
          heroPr: document.querySelectorAll('.con-played-hero__proxy').length,
          shelfFaceUp: shelfFace !== null && shelfFace.checkVisibility({opacityProperty: true, visibilityProperty: true}),
          shelfRect: rect(shelf),
          deployRect: rect(deploy),
          crumb: crumbEl === null ? '-' : (crumbEl.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        } satisfies Frame);
      };
      state.timer = window.setInterval(sample, 16) as unknown as number;
      new MutationObserver(sample).observe(document.body, {childList: true, subtree: true, attributes: true});
      sample();
    });

    // Play the whole queue — the first-action stage arms after the last card.
    await playStartQueue(page);

    // Wait for the briefing to stand (structural, not textual).
    await page.waitForSelector('.con-start__firstact', {timeout: 60_000});
    await page.waitForTimeout(1600); // let the entry finish + settle
    await page.screenshot({path: path.join(OUT_DIR, 'stage-standing.png')});

    const frames = await page.evaluate(() => {
      const w = window as unknown as {__fa: {frames: Array<Frame>, timer: number}};
      window.clearInterval(w.__fa.timer);
      return w.__fa.frames;
    });

    // ── THE TIMELINE around the panel's first frame ──────────────────────
    const first = frames.findIndex((f) => f.panelUp);
    expect(first, 'the briefing panel appeared').toBeGreaterThan(0);
    const from = Math.max(0, first - 14);
    const to = Math.min(frames.length, first + 26);
    console.log('[fa-entry] t | queueOp | zone | seat(held) | panelOp | prox/hero | shelfFace');
    for (let i = from; i < to; i++) {
      const f = frames[i];
      console.log(`[fa-entry] ${String(f.t).padStart(6)} | q=${f.queueOp} | z=${f.zoneCls} | seat=${f.seatUp ? (f.seatHeld ? 'held' : 'up') : '-'} ${f.seatRect} | p=${f.panelUp ? f.panelOp : '-'} | pr=${f.proxies}/${f.heroPr} | shelf=${f.shelfFaceUp ? 'face' : '-'}`);
    }
    // WHOLE-RUN aggregates — where did seat episodes actually happen?
    const seatSpans: Array<string> = [];
    let spanStart: number | undefined;
    frames.forEach((f, i) => {
      if (f.seatUp && spanStart === undefined) {
        spanStart = f.t;
      }
      if ((!f.seatUp || i === frames.length - 1) && spanStart !== undefined) {
        seatSpans.push(`${spanStart}–${f.t}`);
        spanStart = undefined;
      }
    });
    console.log(`[fa-entry] seat episodes: ${seatSpans.join(' · ') || 'NONE'} · first panel t=${frames[first]?.t}`);

    // ── The measurable half of «no рывок» ────────────────────────────────
    // 1 · The panel's FIRST painted frame is the START of its entry, never
    //     the settled state (a first frame at opacity 1 = a blink).
    const firstPanel = frames[first];
    expect(Number(firstPanel.panelOp), 'the briefing first painted mid-entry (opacity < 1)').toBeLessThan(0.9);
    // 1b · THE ENTRY IS TWO BEATS. Beat one: the corporation PHYSICALLY flies
    //      into the (held) seat — within the LAST seat episode before the
    //      panel there must be a frame with a proxy in the air over a held
    //      seat (the teleport regression shows zero such frames). Beat two:
    //      the briefing mounts only after the touchdown — no proxy may still
    //      be flying on the panel's first frame.
    let episodeStart = 0;
    for (let i = first - 1; i >= 0; i--) {
      if (!frames[i].seatUp) {
        episodeStart = i;
        break;
      }
    }
    const carryFrames = frames.slice(episodeStart, first)
      .filter((f) => f.proxies > 0 && f.seatUp && f.seatHeld);
    expect(carryFrames.length,
      'the corp EMERGE flight ran before the briefing (a teleport shows none)').toBeGreaterThan(0);
    expect(firstPanel.proxies, 'the briefing waited for the touchdown').toBe(0);
    // 2 · The corp face may not stand in the shelf AND in the seat unheld in
    //     the same frame (one physical object). Scanned over the LAST seat
    //     episode only — earlier episodes seat the PRELUDES, whose effects
    //     legitimately run while the Philares face stands in the shelf (the
    //     sampler tracks card identity by nothing, so a whole-run scan is a
    //     false positive by construction).
    for (const f of frames.slice(episodeStart)) {
      if (f.seatUp && !f.seatHeld && f.proxies === 0 && f.shelfFaceUp) {
        expect(`t=${f.t}: shelf face + unheld seat + no proxy`, 'the corp doubled during the entry').toBe('');
      }
    }
    // 3 · The deploy row's box never moves through the whole window (the
    //     entry is an overlay phrase, not a re-layout).
    const boxes = new Set(frames.filter((f) => f.deployRect !== '-').map((f) => f.deployRect));
    expect(boxes.size, `the deploy row re-laid out during the entry: ${[...boxes].join(' | ')}`).toBeLessThanOrEqual(1);
  });
});
