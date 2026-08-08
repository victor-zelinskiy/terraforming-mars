import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {walkToSummary, fillPicks, press, StepKind} from './consoleStart';

/**
 * THE STAGED MATERIALIZATION probe — the Summary → deployment scene
 * transition is sampled as a SERIES (~100ms cadence) and asserted on
 * ORDERING, never on absolute times (headless frame pacing drifts):
 *   · the standard bars (Top HUD + Player Rail) hold at opacity 0 through
 *     the swap — the frozen summary is all the player sees — and run their
 *     entrance keyframes only from the flight beat (the barshold release);
 *   · the «КУПЛЕНО» box chrome stays away until every bought project has
 *     landed, then materializes around the landed row via its own animation;
 *   · everything settles: bars in, chrome in, snapshot disposed, no hold.
 */

const OUT_DIR = path.resolve('screenshots', 'mat-stage');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'StageProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: {difficulty: 'normal'},
  };
}

type Sample = {
  t: number,
  barshold: boolean, ceremony: boolean,
  freeze: boolean, freezeOp: number,
  resOp: number, statusOp: number,
  buy: boolean, buyBgA: number, buyMetaOp: number,
  proxies: number,
};

async function sample(page: Page, t: number): Promise<Sample> {
  return page.evaluate((tt) => {
    const op = (sel: string): number => {
      const el = document.querySelector(sel);
      return el === null ? -1 : parseFloat(getComputedStyle(el).opacity);
    };
    const buy = document.querySelector('.con-start__buy');
    let buyBgA = -1;
    if (buy !== null) {
      const bg = getComputedStyle(buy).backgroundColor;
      const m = bg.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\)/);
      buyBgA = m === null ? -1 : (m[1] === undefined ? 1 : parseFloat(m[1]));
    }
    const freezeEl = document.querySelector('.con-start-freeze--live');
    return {
      t: tt,
      barshold: document.body.classList.contains('con-start-barshold'),
      ceremony: document.body.classList.contains('con-start-ceremony'),
      freeze: freezeEl !== null,
      freezeOp: freezeEl === null ? -1 : parseFloat(getComputedStyle(freezeEl).opacity),
      resOp: op('.con-res'),
      statusOp: op('.con-status'),
      buy: buy !== null,
      buyBgA,
      buyMetaOp: op('.con-start__buy-meta'),
      proxies: document.querySelector('.con-startdock-layer')?.childElementCount ?? 0,
    };
  }, t);
}

test.describe('materialization staging probe', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('bars enter at the flight beat; the buy chrome only after the projects land', async ({page, request}) => {
    test.setTimeout(240_000);
    fs.mkdirSync(OUT_DIR, {recursive: true});

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};

    await page.goto(`/player?id=${model.players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
    await page.waitForTimeout(3500);

    // THE WALK IS SETUP — the SHARED DRIVER owns it (consoleStart.ts). The
    // hand-rolled key script this replaces («A, →, A» per step) drifted the
    // moment the deal put the cursor on the row's last card: `→` does not wrap
    // there, so the second A DESELECTED the pick instead of adding one and the
    // preludes step sat at «Выбрано 1 из 2» forever, refusing RT. The probe
    // then failed on its setup, three screens before its actual subject.
    // `fillPicks` reads the picked set after every press, so it cannot drift.
    await walkToSummary(page, {
      onStep: async (p: Page, kind: StepKind) => {
        if (kind === 'corporation') {
          await press(p, 'Enter', 600);
        } else if (kind === 'prelude') {
          await fillPicks(p, 2);
        } else if (kind === 'project') {
          // Bought projects are load-bearing here: the «КУПЛЕНО» chrome
          // assertion below is about a box that frames LANDED cards.
          await fillPicks(p, 3);
        }
      },
    });
    await expect(page.locator('.con-start > .con-start__frame .con-start__summary')).toBeVisible();
    await page.waitForTimeout(600);

    // THE PER-FRAME WITNESS. The sampling series below is ~100ms coarse; the
    // load-bearing claim — «a visible bar never overlaps a card in flight» —
    // is checked EVERY FRAME in page, so no pacing can hide a violation.
    await page.evaluate(() => {
      const w = window as unknown as {__barWatch: {frames: number, violations: number,
        firstVisibleAt: number, lastFlightAt: number, worst: string}};
      const state = {frames: 0, violations: 0, firstVisibleAt: -1, lastFlightAt: -1, worst: ''};
      w.__barWatch = state;
      const t0 = performance.now();
      const tick = () => {
        state.frames++;
        const t = Math.round(performance.now() - t0);
        // PAINTED, not merely "opacity > 0": through the preparation the bars
        // are `visibility: hidden` on an ANCESTOR (body.con-start-prep), so an
        // opacity-only read calls a bar that nobody can see "visible".
        const bars = ['.con-status', '.con-res']
          .map((s) => document.querySelector(s))
          .filter((el): el is HTMLElement => el !== null)
          .filter((el) => el.checkVisibility({opacityProperty: true, visibilityProperty: true}));
        const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-startdock-proxy'));
        if (proxies.length > 0) {
          state.lastFlightAt = t;
        }
        if (bars.length > 0 && state.firstVisibleAt < 0) {
          state.firstVisibleAt = t;
        }
        for (const bar of bars) {
          const b = bar.getBoundingClientRect();
          for (const p of proxies) {
            const r = p.getBoundingClientRect();
            if (r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom) {
              state.violations++;
              if (state.worst === '') {
                state.worst = `t${t} ${bar.className.split(' ')[0]} × proxy`;
              }
            }
          }
        }
        if (performance.now() - t0 < 6000) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    // THE PRESS — projects were bought, so one A submits (no skip warning).
    await page.keyboard.press('Enter');

    const series: Array<Sample> = [];
    const SHOT_AT = new Set([3, 7, 11, 15, 21, 30]);
    for (let i = 0; i < 38; i++) {
      series.push(await sample(page, i * 100));
      if (SHOT_AT.has(i)) {
        await page.screenshot({path: path.join(OUT_DIR, `t${String(i * 100).padStart(4, '0')}.png`)});
      }
      // Absorbed-press belt: a press during the summary's reveal convoy is
      // eaten by the flow gate (double-submit guard) — press again, exactly
      // like a real player, and keep the sampling cadence intact.
      if (i === 8 && !series.some((s) => s.ceremony)) {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(80);
    }
    for (const s of series) {
      console.log(`[t${String(s.t).padStart(4, '0')}] hold=${s.barshold ? 1 : 0} cer=${s.ceremony ? 1 : 0} ` +
        `frz=${s.freeze ? s.freezeOp.toFixed(2) : '--'} res=${s.resOp.toFixed(2)} hud=${s.statusOp.toFixed(2)} ` +
        `buy=${s.buy ? 1 : 0} bgA=${s.buyBgA.toFixed(2)} meta=${s.buyMetaOp.toFixed(2)} prox=${s.proxies}`);
    }

    const watch = await page.evaluate(() =>
      (window as unknown as {__barWatch: {frames: number, violations: number,
        firstVisibleAt: number, lastFlightAt: number, worst: string}}).__barWatch);
    console.log('[bar-watch]', JSON.stringify(watch));

    // 0 · THE LOAD-BEARING CLAIM: no frame ever painted a visible bar over a
    //     card in flight, and the bars did not enter before the convoy was
    //     deep in its carry (they may not appear at take-off).
    // Sanity only — a parallel worker's rAF is throttled hard (47 frames over
    // the same 6s window has been observed), so this proves the witness ran,
    // nothing more. The claims below are what matter.
    expect(watch.frames, 'per-frame witness ran').toBeGreaterThan(20);
    expect(watch.violations, `bar painted over an airborne card (${watch.worst})`).toBe(0);
    expect(watch.firstVisibleAt, 'bars entered').toBeGreaterThan(0);
    // …and they entered ON THE APPROACH, never at take-off (the swap, the
    // stability wait and the lift alone already take ~600ms).
    expect(watch.firstVisibleAt, 'bars entered late enough to be an arrival beat').toBeGreaterThan(700);

    // a · The hold engaged after the swap (ceremony + barshold together).
    expect(series.some((s) => s.ceremony && s.barshold), 'bars were held through the swap').toBeTruthy();
    // b · While held, the bars are INVISIBLE — never standing over the snapshot.
    for (const s of series.filter((x) => x.barshold)) {
      expect(s.resOp, `rail visible during hold at t${s.t}`).toBeLessThanOrEqual(0.05);
      expect(s.statusOp, `HUD visible during hold at t${s.t}`).toBeLessThanOrEqual(0.05);
    }
    // c · The buy chrome outlives the bars release: some sample AFTER the
    //     release still has the box chrome fully away (cards mid-flight).
    expect(series.some((s) => s.ceremony && !s.barshold && s.buy && s.buyMetaOp <= 0.05),
      'buy chrome held past the bars release').toBeTruthy();
    // d · Everything settles: bars in, chrome in, snapshot gone, no hold left.
    const last = series[series.length - 1];
    expect(last.barshold, 'hold cleared').toBeFalsy();
    expect(last.resOp, 'rail settled visible').toBeGreaterThan(0.9);
    expect(last.statusOp, 'HUD settled visible').toBeGreaterThan(0.9);
    expect(last.freeze, 'snapshot disposed').toBeFalsy();
    expect(last.buy, 'buy box present').toBeTruthy();
    expect(last.buyMetaOp, 'buy caption settled visible').toBeGreaterThan(0.9);
    expect(last.buyBgA, 'buy plate settled visible').toBeGreaterThan(0.3);
  });
});
