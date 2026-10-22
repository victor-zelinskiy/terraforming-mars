/*
 * THE FINAL GREENERY IS ONE CONTEXT ON THE BOARD (the owner's decisions of 2026-10-14 — ledger section AH:
 * PL-295 / PL-296 «финал на поле», PL-303 / PL-304 / PL-305 «единый контекст»).
 *
 * The finale used to be a small dialog over a dimmed planet, then (PL-295) a chain of board PICKS — and between two
 * greeneries everything that reads «is a placement on?» let go: the planet shrank and grew again around every
 * landing, the dossier slid out and in, a surface blinked behind it. What this spec pins, on a real two-seat table
 * driven to the viewer's final greenery:
 *
 *  ① A on the announce puts the BOARD into placement at once — no dialog; the dossier carries the finale's block
 *    (`[data-finale-bank]`): the stock as hexes SIZED BY THEIR COUNT (two greeneries = two big hexes), the yield
 *    tail, the FINALE ORDER with the viewer «placing», «Конец партии» as the kicker, the finish verb a HOLD, and the
 *    top strip's own chip reading «ОЗЕЛЕНЕНИЕ»;
 *  ② a landing is ONE context: the dossier never re-mounts, no plate and no task band rises, the planet focus never
 *    exits, the stage walks pick → landing → pick, and the bank is one hex shorter by the server's own stock;
 *  ③ B MINIMIZES (the board home's plate), A on the plate returns to the board pick;
 *  ④ a TAP of RT finishes nothing (the stop is irreversible); a HOLD finishes the seat's game — the server's prompt
 *    is gone, the context with it, and the chip reads «ЗАВЕРШЕНО».
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {cinematicBeat, openConsole, press} from './consoleStart';
import {
  FINALE_BLOCK, armFinaleWitness, armPriceProbe, disarmFinaleWitness, finaleStage, fixtureTable, forceFrame, getModel, holdFinishFinale,
  openFinaleOnBoard, placeFinaleGreenery, postInput, readFinaleWitness, readPriceProbe, shoot, storyboard, terraformAnswer, titleOf, waitWithFrames, WireModel,
} from './consoleEndgameHarness';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const PROFILES = [
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

async function bankShape(page: Page): Promise<{full: number, part: number, tier: string, text: string}> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return {
      full: root?.querySelectorAll('[data-finale-hex="full"]').length ?? -1,
      part: root?.querySelectorAll('[data-finale-hex="part"]').length ?? -1,
      tier: (root?.querySelector('[data-finale-tier]') as HTMLElement | null)?.dataset.finaleTier ?? '',
      text: ((root as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' '),
    };
  }, FINALE_BLOCK);
}

async function onBoardPick(page: Page): Promise<boolean> {
  return page.evaluate((sel) => document.querySelector(sel) !== null && document.querySelector('.con-board--placing') !== null, FINALE_BLOCK);
}

/** The viewer's own chip in the top strip — its status word. */
async function viewerChipStatus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const chip = document.querySelector('.con-status__player');
    return (chip?.querySelector('.con-status__pstatus-text')?.textContent ?? '').trim();
  });
}

for (const profile of PROFILES) {
  test.describe(`console final greenery · ${profile.tag}`, () => {
    test.use({viewport: {width: profile.width, height: profile.height}, deviceScaleFactor: 1});
    test.setTimeout(420_000);

    test('the finale is ONE board context: bank sized by count + the order, a landing changes nothing around it, B minimizes, RT HOLD finishes', async ({page, request}) => {
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
      expect(await finaleStage(page), 'the context stands at the pick').toBe('pick');
      const bank = await bankShape(page);
      const affordable = Math.floor(before.plants / before.cost);
      expect(bank.full, `one hex per greenery the stock pays for (${before.plants} ÷ ${before.cost}) — ${bank.text}`).toBe(Math.min(24, affordable));
      expect(bank.part, 'a part-filled hex exactly when there is a rest').toBe(before.plants % before.cost > 0 ? 1 : 0);
      expect(bank.tier, 'the hexes take their size from their count (PL-305)').toBe(bank.full + bank.part <= 2 ? 'xl' : bank.full + bank.part <= 4 ? 'lg' : 'md');
      await expect(page.locator('.con-context__task-kicker')).toContainText(/Конец партии/i);
      await expect(page.locator('[data-finale-yield]'), 'what one greenery is worth stands in the formula').toContainText(/\+1 (ПО|РТ)/);
      await expect(page.locator('[data-finale-queue] [data-finale-seat="placing"]'), 'the order names the viewer as the one placing').toHaveCount(1);
      await expect(page.locator('.con-cmdbar'), 'the bar carries the finish verb').toContainText(/Завершить свою партию/i);
      expect(await viewerChipStatus(page), 'the strip names the phase on the viewer\'s own chip').toMatch(/Озеленение/i);
      await forceFrame(page);
      await shoot(page, shots, '01-finale-on-board');

      // ── ② one greenery lands; the context is ONE — nothing around the board lets go ──
      // …and its PRICE is a departure (PL-306): the plants leave the rail for the cell, the tile grows out of it.
      const spacesBefore = (await getModel(request, ids[0]) as unknown as {game: {spaces: Array<{id: string, tileType?: number}>}}).game.spaces;
      await armFinaleWitness(page);
      await armTransferWitness(page);
      await armPriceProbe(page);
      const stopStory = await storyboard(page, shots, 'price-into-cell');
      expect(await placeFinaleGreenery(page, request, ids[0]), 'a greenery is placed through the board').toBe(true);
      await waitWithFrames(page, async () => (await finaleStage(page)) === 'pick' && await onBoardPick(page),
        60_000, 'the board back in the finale placement after the landing');
      // The landing's whole story has played by now (the hero, the bonus beats): read the witness after a calm beat.
      await cinematicBeat(page, 1_200, "the landing's whole story (the hero, the bonus beats) settles before the witness is read");
      await stopStory();
      const witness = await readFinaleWitness(page);
      await disarmFinaleWitness(page);
      expect(witness.panelRemounts, 'the dossier never re-mounted').toBe(0);
      expect(witness.panelLeaves, 'the dossier never played its leave').toBe(0);
      expect(witness.plateSeen, 'no plate rose between two greeneries').toBe(0);
      expect(witness.hostSeen, 'no task band rose between two greeneries').toBe(0);
      expect(witness.focusExits, 'the planet never shrank between two greeneries').toBe(0);
      expect(witness.stages, 'the stage walked pick → landing → pick').toEqual(['landing', 'pick']);
      // ── PL-306: the price of the greenery, off the rail, INTO the cell — and the tile born there ──
      const flights = await transferWitness(page);
      const priceProbe = await readPriceProbe(page);
      const placed = (await getModel(request, ids[0]) as unknown as {game: {spaces: Array<{id: string, tileType?: number}>}}).game.spaces
        .find((s) => s.tileType !== undefined && spacesBefore.find((b) => b.id === s.id)?.tileType === undefined)?.id;
      expect(placed, 'the server placed the greenery on a fresh cell').toBeDefined();
      const trail = `${transferTrail(flights)}\nrows ${JSON.stringify(priceProbe.rows)} chips ${JSON.stringify(priceProbe.chips)} price ${JSON.stringify(priceProbe.price)} tile ${JSON.stringify(priceProbe.tileFirst)}`;
      const born = flights.births.filter((b) => b.under === 'rail:plants');
      expect(born.length, `ONE price token born on the plants row's ink (${trail})`).toBe(1);
      expect(born[0].value, `it reads the price, minus ${before.cost} (${trail})`).toMatch(new RegExp(`^[−-]${before.cost}$`));
      const landing = flights.landings.find((l) => l.id === born[0].id);
      expect(landing?.under, `…and is drawn into the CELL the greenery grows out of (${trail})`).toBe(`cell:${placed}`);
      expect(endsOverGlass(flights), 'no end of any flight over glass').toEqual([]);
      const tick = priceProbe.rows.find(([, text]) => text === String(before.plants - before.cost));
      expect(tick, `the row reads ${before.plants - before.cost} — the price left it (${trail})`).toBeDefined();
      expect(tick![0], `…ticking on the DEPARTURE, not before the birth (${trail})`).toBeGreaterThanOrEqual(born[0].t - 40);
      expect(tick![0], `…and not after the touchdown (${trail})`).toBeLessThanOrEqual(landing!.t);
      // …and its own «−N» chip says so AT that tick — never a beat later, in the commit's frame (the departure IS the cause).
      const chip = priceProbe.chips.find(([, text]) => /^[−-]\d+$/.test(text));
      expect(chip?.[1], `the row's delta chip names the price (${trail})`).toMatch(new RegExp(`^[−-]${before.cost}$`));
      expect(chip![0] - tick![0], `…painted with the departure's tick, not with the commit (${trail})`).toBeLessThan(250);
      expect(priceProbe.price.map(([, a]) => a), `the hero's own account: the price was flown (${trail})`).toContain('flown');
      const cell = await page.evaluate((id) => {
        const r = document.querySelector(`.board-space[data_space_id="${id}"]`)?.getBoundingClientRect();
        return r === undefined ? undefined : {cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width};
      }, placed);
      expect(priceProbe.tileFirst, `the tile proxy was painted (${trail})`).toBeDefined();
      expect(Math.hypot(priceProbe.tileFirst!.cx - cell!.cx, priceProbe.tileFirst!.cy - cell!.cy),
        `the greenery is BORN on its cell — never carried in from the table (${trail})`).toBeLessThan(cell!.w * 0.5);
      // The greenery grows out of the token AS it is absorbed (PL-140 — the result is born out of the quick absorb),
      // so its first frame is the price's TOUCHDOWN, never before it; one sampler quantum of slack on each clock.
      expect(landing!.touched, `the price token touched its cell down (${trail})`).toBeDefined();
      expect(priceProbe.tileFirst!.t, `…and only once the price has reached it (${trail})`).toBeGreaterThanOrEqual(landing!.touched! - 40);
      const after = await viewerStock(request, ids[0]);
      expect(after.plants, 'the stock moved by the server\'s own number').toBeLessThan(before.plants);
      const bankAfter = await bankShape(page);
      expect(bankAfter.full, `the bank reads the server's stock after the answer — ${bankAfter.text}`)
        .toBe(Math.min(24, Math.floor(after.plants / after.cost)));
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
      // The seat is DONE by the server's own word; while the table's finale still runs (another seat placing), the
      // viewer's chip reads «ЗАВЕРШЕНО» — once nobody can place any more the game ENDS instead, and the endgame
      // workspace is the screen (the strip is gone with the board).
      const finished = await getModel(request, ids[0]);
      const viewerColor = (finished as unknown as {thisPlayer: {color: string}}).thisPlayer.color;
      expect(finished.game.phase === 'end' || (finished.game.finalGreenery?.done ?? []).includes(viewerColor),
        'the server marks the seat done (or the game ended with it)').toBe(true);
      if (finished.game.phase !== 'end') {
        await waitWithFrames(page, async () => /Завершено/i.test(await viewerChipStatus(page)), 15_000, 'the chip reads «ЗАВЕРШЕНО» once the seat is done');
      }
      await shoot(page, shots, '04-finished');
    });
  });
}
