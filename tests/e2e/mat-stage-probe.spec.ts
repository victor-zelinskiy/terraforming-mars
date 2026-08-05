import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

async function key(page: Page, code: string, settleMs = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function activeSubject(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-wshead__layer--deep .con-wshead__subject');
    return (el?.textContent ?? '').trim().toLowerCase();
  });
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

    // Walk: corp (A+RT) → preludes (A,→,A,RT) → projects (A,→,A,→,A,RT) → summary.
    for (let round = 0; round < 20; round++) {
      const subject = await activeSubject(page);
      const summaryUp = await page.locator('.con-start > .con-start__frame .con-start__summary').isVisible().catch(() => false);
      if (summaryUp) {
        break;
      }
      await page.waitForSelector('.con-start__status-inner:not(.con-start__status-inner--held)', {timeout: 25_000});
      await page.waitForTimeout(300);
      if (subject.includes('корпорац')) {
        await key(page, 'Enter', 600);
        await key(page, 'Period', 1500);
      } else if (subject.includes('пролог')) {
        await key(page, 'Enter', 500);
        await key(page, 'ArrowRight', 300);
        await key(page, 'Enter', 500);
        await key(page, 'Period', 1500);
      } else if (subject.includes('проект')) {
        await key(page, 'Enter', 400);
        await key(page, 'ArrowRight', 250);
        await key(page, 'Enter', 400);
        await key(page, 'ArrowRight', 250);
        await key(page, 'Enter', 400);
        await key(page, 'Period', 1500);
      } else {
        await key(page, 'Enter', 800);
      }
    }
    await expect(page.locator('.con-start > .con-start__frame .con-start__summary')).toBeVisible();
    await page.waitForTimeout(600);

    // THE PRESS — projects were bought, so one A submits (no skip warning).
    await page.keyboard.press('Enter');

    const series: Array<Sample> = [];
    const SHOT_AT = new Set([3, 7, 11, 15, 21, 30]);
    for (let i = 0; i < 38; i++) {
      series.push(await sample(page, i * 100));
      if (SHOT_AT.has(i)) {
        await page.screenshot({path: path.join(OUT_DIR, `t${String(i * 100).padStart(4, '0')}.png`)});
      }
      await page.waitForTimeout(80);
    }
    for (const s of series) {
      console.log(`[t${String(s.t).padStart(4, '0')}] hold=${s.barshold ? 1 : 0} cer=${s.ceremony ? 1 : 0} ` +
        `frz=${s.freeze ? s.freezeOp.toFixed(2) : '--'} res=${s.resOp.toFixed(2)} hud=${s.statusOp.toFixed(2)} ` +
        `buy=${s.buy ? 1 : 0} bgA=${s.buyBgA.toFixed(2)} meta=${s.buyMetaOp.toFixed(2)} prox=${s.proxies}`);
    }

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
