/*
 * THE FINALE'S HAND-OFF TO ANOTHER SEAT (PL-301 / PL-303 / PL-304 — the owner's field report of 2026-10-14).
 *
 * A greenery landing next to Philares' tile hands a resource pick to ITS OWNER in the middle of the first seat's
 * finale. Two things went wrong in the field: the first seat's whole context vanished (a bare board, no sign of
 * what they were in the middle of), and once the owner answered, the first seat waited ≈20 s for its prompt to
 * come back — the input route broadcast nothing on either hop, and the stretched fallback poll was the only
 * messenger. What this spec pins, on the `two-player-finale-trigger` fixture (the first seat asked, the second
 * seat Philares with a greenery on the board):
 *
 *  ① the greenery lands next to Philares' tile → the owner holds a resource pick, the viewer holds nothing — and
 *    the viewer's CONTEXT STANDS: the dossier in its WAIT stage naming the seat («Ждём ответа: …»), the planet
 *    focus held, the bar's finish disabled with B «Свернуть», the strip reading the owner as acting; no plate, no
 *    task band, no re-mount through the whole hand-off;
 *  ② RT in the wait stage finishes nothing (a notice names why);
 *  ③ B in the wait stage minimizes to the plate; A brings the context back, still waiting;
 *  ④ the owner answers over the API → the viewer's pick is back on the board within the socket's beat (seconds,
 *    never the fallback poll's twenty), through the same standing context.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {cinematicBeat, openConsole, press, walkToSpace} from './consoleStart';
import {
  FINALE_BLOCK, armFinaleWitness, disarmFinaleWitness, finaleStage, forceFrame, getModel, openFinaleOnBoard, placeFinaleGreenery,
  postInput, readFinaleWitness, shoot, waitWithFrames,
} from './consoleEndgameHarness';

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  waitingFor?: {type: string, finalGreeneryPrompt?: unknown, options?: Array<{type: string, spaces?: Array<string>}>},
  game: {spaces: Array<{id: string, tileType?: number, color?: string}>, finalGreenery?: {done: Array<string>}},
  thisPlayer: {color: string, plants: number},
  players: Array<{color: string, name: string, isWaitingForInput: boolean}>,
};

/** The Philares owner's greenery on the board and one LEGAL cell of the viewer's pick adjacent to it. */
async function targetNextToPhilares(request: APIRequestContext, viewerId: string, ownerColor: string): Promise<string> {
  const m = await getModel(request, viewerId) as unknown as Wire;
  const pick = m.waitingFor?.options?.find((o) => o.type === 'space');
  expect(pick?.spaces, 'the viewer holds the finale\'s board pick').toBeDefined();
  const ownerTiles = m.game.spaces.filter((s) => s.color === ownerColor && s.tileType !== undefined).map((s) => s.id);
  expect(ownerTiles.length, 'Philares\' seat has a tile on the board').toBeGreaterThan(0);
  // Adjacency is the BOARD's rule, replicated from `Board.computeAdjacentSpaces` on the fixture's own grid
  // (an odd number of rows; the rows above the middle lean one way, below it the other).
  const file = path.resolve(__dirname, 'fixtures', 'two-player-finale-trigger.json');
  const serialized = JSON.parse(fs.readFileSync(file, 'utf8')) as {board: {spaces: Array<{id: string, x: number, y: number, spaceType: string}>}};
  const grid = serialized.board.spaces.filter((s) => s.spaceType !== 'colony');
  const byId = new Map(grid.map((s) => [s.id, s]));
  const maxY = Math.max(...grid.map((s) => s.y));
  const middle = maxY / 2;
  const neighbours = (id: string): Array<string> => {
    const s = byId.get(id);
    if (s === undefined) {
      return [];
    }
    const coords: Array<[number, number]> = [[s.x - 1, s.y], [s.x + 1, s.y]];
    if (s.y < middle) {
      coords.push([s.x, s.y - 1], [s.x + 1, s.y - 1], [s.x - 1, s.y + 1], [s.x, s.y + 1]);
    } else if (s.y === middle) {
      coords.push([s.x, s.y - 1], [s.x + 1, s.y - 1], [s.x, s.y + 1], [s.x + 1, s.y + 1]);
    } else {
      coords.push([s.x - 1, s.y - 1], [s.x, s.y - 1], [s.x, s.y + 1], [s.x + 1, s.y + 1]);
    }
    return grid.filter((g) => coords.some(([x, y]) => g.x === x && g.y === y)).map((g) => g.id);
  };
  const adjacent = (a: string, b: string): boolean => neighbours(a).includes(b);
  const legal = (pick?.spaces ?? []).find((id) => ownerTiles.some((t) => adjacent(t, id)));
  expect(legal, `a legal cell next to Philares' tile (owner tiles ${ownerTiles.join(',')})`).toBeDefined();
  return legal!;
}

async function waitLine(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('[data-finale-wait]') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '');
}

async function chipStatuses(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.con-status__player'))
    .map((chip) => (chip.querySelector('.con-status__pstatus-text')?.textContent ?? '').trim()));
}

async function barText(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('.con-cmdbar') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? '');
}

for (const profile of PROFILES) {
  test.describe(`console final greenery · the hand-off to another seat · ${profile.tag}`, () => {
    test.use({viewport: {width: profile.width, height: profile.height}, deviceScaleFactor: 1});
    test.setTimeout(300_000);

    test('the context stands through Philares\' pick, and the prompt comes back over the socket', async ({page, request}) => {
      const shots = `screenshots/console-final-greenery-trigger/${profile.tag}`;
      const file = path.resolve(__dirname, 'fixtures', 'two-player-finale-trigger.json');
      const res = await request.post('/api/dev/load-game', {data: JSON.parse(fs.readFileSync(file, 'utf8'))});
      expect(res.ok(), `dev load-game accepted the trigger fixture (status ${res.status()})`).toBeTruthy();
      const ids = (await res.json() as {players: Array<{id: string}>}).players.map((p) => p.id);
      const [viewer, owner] = ids;
      const ownerModel = await getModel(request, owner) as unknown as Wire;
      const ownerColor = ownerModel.thisPlayer.color;
      const ownerName = ownerModel.players.find((p) => p.color === ownerColor)?.name ?? '';
      expect((await getModel(request, viewer)).waitingFor?.finalGreeneryPrompt, 'the fixture resumes on the viewer\'s finale').toBeDefined();

      await openConsole(page, viewer, profile.query);
      await openFinaleOnBoard(page);
      expect(await finaleStage(page)).toBe('pick');
      const target = await targetNextToPhilares(request, viewer, ownerColor);
      await walkToSpace(page, target);
      await forceFrame(page);
      await shoot(page, shots, '01-aiming-next-to-philares');

      // ── ① the landing hands a pick to the OWNER; the viewer's context STANDS in its wait stage ──
      await armFinaleWitness(page);
      expect(await placeFinaleGreenery(page, request, viewer), 'the greenery landed').toBe(true);
      await waitWithFrames(page, async () => {
        const om = await getModel(request, owner) as unknown as Wire;
        return om.waitingFor !== undefined && om.waitingFor.finalGreeneryPrompt === undefined;
      }, 15_000, 'Philares\' owner holds the triggered pick');
      expect((await getModel(request, viewer)).waitingFor, 'the viewer holds nothing while the owner decides').toBeUndefined();
      await waitWithFrames(page, async () => (await finaleStage(page)) === 'wait', 20_000, 'the dossier in its WAIT stage');
      await cinematicBeat(page, 1_500, "the landing's story settles and the wait line reads the live poll's answer");
      const line = await waitLine(page);
      expect(line, 'the wait line names the seat the table waits on').toContain(ownerName);
      expect(await page.locator(FINALE_BLOCK).count(), 'the finale block stands').toBe(1);
      expect(await page.evaluate(() => document.querySelector('.con-board--pfocus-settled') !== null), 'the planet focus is held').toBe(true);
      // The bar absorbs input (and shows nothing) for the landing's own holds; the finale's run stands once they let go.
      await waitWithFrames(page, async () => /Завершить свою партию/i.test(await barText(page)) && /Свернуть/i.test(await barText(page)),
        15_000, 'the bar keeps the finish (disabled) and offers «Свернуть» in the wait stage');
      const chips = await chipStatuses(page);
      expect(chips[0], 'the viewer\'s chip: waiting').toMatch(/Ожидает/i);
      expect(chips[1], 'the owner\'s chip: acting').toMatch(/Действие/i);
      await forceFrame(page);
      await shoot(page, shots, '02-waiting-on-owner');

      // ── ② RT in the wait stage finishes nothing ──
      await press(page, 'Period', 700);
      expect((await getModel(request, viewer)).game.finalGreenery?.done ?? [], 'the viewer is not done — nothing was submitted').not.toContain((await getModel(request, viewer) as unknown as Wire).thisPlayer.color);
      expect(await finaleStage(page)).toBe('wait');

      // ── ③ B minimizes to the plate; A brings the context back, still waiting ──
      const witnessBeforeCollapse = await readFinaleWitness(page);
      await disarmFinaleWitness(page);
      expect(witnessBeforeCollapse.panelRemounts, 'the dossier never re-mounted through the hand-off').toBe(0);
      expect(witnessBeforeCollapse.plateSeen, 'no plate rose through the hand-off').toBe(0);
      expect(witnessBeforeCollapse.hostSeen, 'no task band rose through the hand-off').toBe(0);
      expect(witnessBeforeCollapse.focusExits, 'the planet never shrank through the hand-off').toBe(0);
      await press(page, 'Escape', 900);
      await waitWithFrames(page, async () => (await page.locator(FINALE_BLOCK).count()) === 0 &&
        (await page.locator('.con-mandatory').count()) > 0, 15_000, 'the wait stage minimized to the plate');
      await expect(page.locator('.con-mandatory')).toContainText(/Финальное озеленение/i);
      await shoot(page, shots, '03-minimized-while-waiting');
      await press(page, 'Enter', 900);
      await waitWithFrames(page, async () => (await finaleStage(page)) === 'wait', 15_000, 'A on the plate returns the waiting context');

      // ── ④ the owner answers → the viewer's pick is back within the socket's beat, through the same context ──
      await armFinaleWitness(page);
      const t0 = Date.now();
      await postInput(request, owner, {type: 'resources', units: {megacredits: 1, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0}});
      await waitWithFrames(page, async () => (await finaleStage(page)) === 'pick' &&
        await page.evaluate(() => document.querySelector('.con-board--placing') !== null),
      30_000, 'the pick back on the board after the owner\'s answer');
      const backAfterMs = Date.now() - t0;
      const witness = await readFinaleWitness(page);
      await disarmFinaleWitness(page);
      expect(witness.panelRemounts, 'the dossier never re-mounted on the way back').toBe(0);
      expect(witness.plateSeen, 'no plate rose on the way back').toBe(0);
      expect(witness.hostSeen, 'no task band rose on the way back').toBe(0);
      expect(witness.focusExits, 'the planet never shrank on the way back').toBe(0);
      expect(backAfterMs, `the prompt returned over the socket (${backAfterMs} ms), not the 20 s fallback poll`).toBeLessThan(8_000);
      await forceFrame(page);
      await shoot(page, shots, '04-pick-is-back');
      test.info().annotations.push({type: 'hand-off', description: `the pick returned ${backAfterMs} ms after the owner's answer`});
    });
  });
}
