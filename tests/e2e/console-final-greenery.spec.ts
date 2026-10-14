/*
 * THE FINAL GREENERY IS PLAYED ON THE BOARD (the owner's decision, 2026-10-14 — ledger section AH, PL-295 / PL-296).
 *
 * The finale used to be a small dialog over a dimmed planet («Превратить растения в озеленения?» + three numbers +
 * two rows), then the board for the cell, then the dialog again — a screen change per tile, the planet the phase is
 * ABOUT hidden behind glass. What this spec pins, on a real two-seat table driven to the viewer's final greenery:
 *
 *  ① A on the announce puts the BOARD into placement at once — no dialog, the dossier carries the finale's block
 *    (`[data-finale-bank]`): one hex per greenery the stock pays for (the server's plants ÷ the server's cost), a
 *    part-filled hex for the rest, «Конец партии» as the kicker, and the bar's finish verb is a HOLD;
 *  ② a landing does NOT bring a dialog back: the board is in placement again for the next greenery by itself, the
 *    bank one hex shorter (the server's own stock after the answer);
 *  ③ B MINIMIZES (the board home's plate), A on the plate returns to the board pick;
 *  ④ a TAP of RT finishes nothing (the stop is irreversible); a HOLD finishes the seat's game — the server's prompt
 *    is gone.
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {openConsole, placeTile, press} from './consoleStart';
import {
  FINALE_BLOCK, fixtureTable, forceFrame, getModel, holdFinishFinale, openFinaleOnBoard, postInput, shoot, terraformAnswer,
  titleOf, waitWithFrames, WireModel,
} from './consoleEndgameHarness';

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

type ViewerStock = {plants: number, cost: number};

/**
 * Drive the table to the VIEWER's final greenery over the API, the viewer KEEPING its plants: the viewer passes its
 * turns (never converts — the fixture's 16 plants are the finale's stock), the other seat terraforms the last oxygen
 * step and passes. The viewer is first in order, so its final-greenery question comes first.
 */
async function driveToViewerFinale(request: APIRequestContext, ids: ReadonlyArray<string>): Promise<void> {
  const [viewer, other] = ids;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const vm = await getModel(request, viewer);
    if (vm.waitingFor?.finalGreeneryPrompt !== undefined) {
      return;
    }
    if (vm.waitingFor !== undefined) {
      await postInput(request, viewer, viewerKeepsPlants(vm));
      continue;
    }
    const om = await getModel(request, other);
    const answer = terraformAnswer(om);
    if (answer !== undefined && om.waitingFor?.finalGreeneryPrompt === undefined) {
      await postInput(request, other, answer);
      continue;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('the table never reached the final greenery of the viewer');
}

/** The viewer's answer on the way: pass when it can (keep the plants), else whatever the terraformer would answer. */
function viewerKeepsPlants(m: WireModel): Record<string, unknown> {
  const wf = m.waitingFor;
  if (wf?.type === 'or') {
    const pass = (wf.options ?? []).findIndex((o) => /^Pass/i.test(titleOf(o)));
    if (pass >= 0) {
      return {type: 'or', index: pass, response: {type: 'option'}};
    }
  }
  return terraformAnswer(m) ?? {type: 'option'};
}

async function viewerStock(request: APIRequestContext, id: string): Promise<ViewerStock> {
  const m = await getModel(request, id) as unknown as {thisPlayer: {plants: number, plantsNeededForGreenery: number}};
  return {plants: m.thisPlayer.plants, cost: Math.max(1, m.thisPlayer.plantsNeededForGreenery)};
}

async function bankShape(page: Page): Promise<{full: number, part: number, text: string}> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return {
      full: root?.querySelectorAll('[data-finale-hex="full"]').length ?? -1,
      part: root?.querySelectorAll('[data-finale-hex="part"]').length ?? -1,
      text: ((root as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' '),
    };
  }, FINALE_BLOCK);
}

async function onBoardPick(page: Page): Promise<boolean> {
  return page.evaluate((sel) => document.querySelector(sel) !== null && document.querySelector('.con-board--placing') !== null, FINALE_BLOCK);
}

for (const profile of PROFILES) {
  test.describe(`console final greenery · ${profile.tag}`, () => {
    test.use({viewport: {width: profile.width, height: profile.height}, deviceScaleFactor: 1});
    test.setTimeout(420_000);

    test('the finale is a board phase: bank in the dossier, the board stays in placement, B minimizes, RT HOLD finishes', async ({page, request}) => {
      const shots = `screenshots/console-final-greenery/${profile.tag}`;
      const ids = await fixtureTable(request);
      // Everyone is driven over the API to the VIEWER's final-greenery question (the viewer is first in order) —
      // the page opens only then: once it is open, the viewed seat's prompts are answered through the page alone.
      await driveToViewerFinale(request, ids);
      const before = await viewerStock(request, ids[0]);
      expect(Math.floor(before.plants / before.cost), 'the table must leave the viewer at least two greeneries').toBeGreaterThanOrEqual(2);
      await openConsole(page, ids[0], profile.query);

      // ── ① A on the announce → the board, in placement, with the finale's block ──
      await openFinaleOnBoard(page);
      expect(await onBoardPick(page), 'the board is in placement with the finale block').toBe(true);
      const bank = await bankShape(page);
      expect(bank.full, `one hex per greenery the stock pays for (${before.plants} ÷ ${before.cost}) — ${bank.text}`)
        .toBe(Math.min(6, Math.floor(before.plants / before.cost)));
      expect(bank.part, 'a part-filled hex exactly when there is a rest').toBe(before.plants % before.cost > 0 ? 1 : 0);
      await expect(page.locator('.con-context__task-kicker')).toContainText(/Конец партии/i);
      await expect(page.locator('.con-cmdbar'), 'the bar carries the finish verb').toContainText(/Завершить свою партию/i);
      await forceFrame(page);
      await shoot(page, shots, '01-finale-on-board');

      // ── ② one greenery lands; the board comes back into placement BY ITSELF ──
      expect(await placeTile(page), 'a greenery is placed through the board').toBe(true);
      // No dialog can come back between two greeneries: the finale has no surface of its own (the board is it).
      await waitWithFrames(page, async () => {
        // The stock moved (the cell's own bonus may pay plants back — the server's number, never «before − cost»).
        const after = await viewerStock(request, ids[0]);
        return after.plants < before.plants && await onBoardPick(page);
      }, 60_000, 'the board back in the finale placement after the landing');
      const after = await viewerStock(request, ids[0]);
      const bankAfter = await bankShape(page);
      expect(bankAfter.full, `the bank reads the server's stock after the answer — ${bankAfter.text}`)
        .toBe(Math.min(6, Math.floor(after.plants / after.cost)));
      await shoot(page, shots, '02-next-greenery');

      // ── ③ B minimizes; A on the plate returns to the board pick ──
      await press(page, 'Escape', 900);
      await waitWithFrames(page, async () => (await page.locator(FINALE_BLOCK).count()) === 0 &&
        (await page.locator('.con-mandatory').count()) > 0, 15_000, 'the finale minimized to the board home plate');
      await shoot(page, shots, '03-minimized');
      await press(page, 'Enter', 900);
      await waitWithFrames(page, () => onBoardPick(page), 15_000, 'A on the plate returns to the finale');

      // ── ④ a TAP of RT finishes nothing; a HOLD finishes the seat's game ──
      await press(page, 'Period', 900);
      expect(await onBoardPick(page), 'a tap is not the irreversible stop').toBe(true);
      expect((await getModel(request, ids[0])).waitingFor?.finalGreeneryPrompt, 'the server still asks').toBeDefined();
      await holdFinishFinale(page);
      await waitWithFrames(page, async () => (await page.locator(FINALE_BLOCK).count()) === 0 &&
        (await getModel(request, ids[0])).waitingFor?.finalGreeneryPrompt === undefined, 30_000, 'the finish answered by the server');
      await shoot(page, shots, '04-finished');
    });
  });
}
