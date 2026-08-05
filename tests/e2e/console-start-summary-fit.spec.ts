import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fillPicks, press, submitSummary, summaryVisible, walkToSummary} from './consoleStart';

/**
 * THE SUMMARY FITS — AT EVERY COUNT, and the convoy that fills it never
 * degrades.
 *
 * Two shipped bugs this pins down:
 *  1. the fit was an ANALYTIC model of a layout it did not fully know (the
 *     counts shelf, paddings), so at SOME counts (6 bought projects) it
 *     guessed one row too optimistically and the pane grew a SCROLLBAR —
 *     while 12 projects, needing a smaller zoom anyway, fit fine;
 *  2. the projects → summary convoy read its destination tiles ONCE, so a
 *     big batch's later tiles (still laying out) had no target and silently
 *     degraded to «the card just appears» — the physicality was lost exactly
 *     when there was the most of it to enjoy.
 *
 * Runs the counts that used to break, on the two profiles that matter.
 */

const OUT_DIR = path.resolve('screenshots', 'summary-fit');

function newGameConfig() {
  return {
    players: [{name: 'FitTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    // testMode deals a big buy pool (20 projects) so the 12-card case exists.
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
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

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The pane's own overflow — a console-native scrollbar is a BUG. */
async function summaryOverflow(page: Page): Promise<{v: number, h: number, zoom: string}> {
  return page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('.con-start > .con-start__frame .con-start__summary');
    const col = pane?.querySelector<HTMLElement>('.con-start__summary-cards');
    return {
      v: pane === null || pane === undefined ? -1 : pane.scrollHeight - pane.clientHeight,
      h: col === null || col === undefined ? -1 : col.scrollWidth - col.clientWidth,
      zoom: pane?.style.getPropertyValue('--con-start-mini-zoom') ?? '',
    };
  });
}

const CASES = [
  {tag: 'fhd-6', width: 1920, height: 1080, buy: 6},
  {tag: 'fhd-12', width: 1920, height: 1080, buy: 12},
  {tag: 'tv4k-9', width: 3840, height: 2160, buy: 9},
] as const;

for (const c of CASES) {
  test.describe(`start summary fit · ${c.tag}`, () => {
    test.use({viewport: {width: c.width, height: c.height}, screen: {width: c.width, height: c.height}});

    test(`${c.buy} bought projects: no scroll, every card flies`, async ({page, request}) => {
      test.setTimeout(300_000);
      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      await page.goto(`/player?id=${model.players[0].id}&console=1`);
      await page.waitForSelector('.con-start__frame', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

      // A per-frame witness of the projects → summary convoy: how many cards
      // were ever AIRBORNE (a proxy), against how many were bought.
      await page.evaluate(() => {
        const w = window as unknown as {__conv: {maxProxies: number, frames: number, everFlew: number}};
        const state = {maxProxies: 0, frames: 0, everFlew: 0};
        w.__conv = state;
        const seen = new Set<string>();
        const tick = () => {
          state.frames++;
          const proxies = document.querySelectorAll('.con-startdock-layer .con-startdock-proxy');
          state.maxProxies = Math.max(state.maxProxies, proxies.length);
          proxies.forEach((p, i) => seen.add(`${(p as HTMLElement).style.transform ?? ''}#${i}`));
          state.everFlew = seen.size;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      await walkToSummary(page, {
        onStep: async (p, kind) => {
          if (kind === 'corporation') {
            await press(p, 'Enter', 600);
          } else if (kind === 'prelude') {
            await fillPicks(p, 2);
          } else if (kind === 'project') {
            const picked = await fillPicks(p, c.buy, 40);
            expect(picked.length, 'the buy step offered enough cards').toBe(c.buy);
          }
        },
      });
      expect(await summaryVisible(page)).toBeTruthy();
      await page.waitForTimeout(2500); // the convoy lands + the fit settles
      await shoot(page, c.tag);

      // 1 · THE FIT: the pane does not scroll, in either axis.
      const of = await summaryOverflow(page);
      expect(of.v, `summary scrolls vertically (zoom ${of.zoom})`).toBeLessThanOrEqual(1);
      expect(of.h, `summary scrolls horizontally (zoom ${of.zoom})`).toBeLessThanOrEqual(1);
      // …and every bought card is really rendered in it.
      await expect(page.locator('.con-start__summary .con-start__minirow--wrap .con-start__mini'))
        .toHaveCount(c.buy);

      // 2 · THE CONVOY: the batch flew as ONE physical group — the peak
      //     proxy count matches the whole batch (corp + preludes + projects),
      //     never a first handful with the rest appearing on their own.
      const conv = await page.evaluate(() => (window as unknown as {
        __conv: {maxProxies: number, frames: number}}).__conv);
      console.log(`[convoy ${c.tag}] ${JSON.stringify(conv)}`);
      expect(conv.frames, 'the witness ran').toBeGreaterThan(30);
      expect(conv.maxProxies, 'the whole batch was airborne together')
        .toBeGreaterThanOrEqual(c.buy);

      // …and the convoy CLOSED: nothing is left airborne and no tile is
      // still held invisible under a proxy that never arrived.
      await expect(page.locator('.con-startdock-layer .con-startdock-proxy')).toHaveCount(0);
      await expect(page.locator('.con-start__summary .con-deal-hold')).toHaveCount(0);

      // The summary still submits (the fit must not break the flow).
      await submitSummary(page);
    });
  });
}
