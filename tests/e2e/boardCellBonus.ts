/*
 * THE BOARD CELL'S CARD BONUS, driven over the real pad — shared by the specs that walk a placement onto a printed
 * card bonus (Terra Cimmeria Nova: cell '36' STEEL + DRAW_CARD, cell '38' DRAW_CARD × 2): a fresh game whose target
 * cell is untiled, the convert-plants placement, the d-pad walk to a cell. The PAD path is the point —
 * `handleSectionConfirm` is where the card-bonus cover ARMS at submit.
 */
import {expect, Page, APIRequestContext} from './consoleTest';
import {createGameWithCards, fetchPlayerModel, press, soloGameConfig} from './consoleStart';

/** STEEL + DRAW_CARD — the single-card + resource cell (y=4, 8th space). */
export const STEEL_CARD_CELL = '36';
/** DRAW_CARD + DRAW_CARD — the multi-card cell (y=5, 1st space). */
export const TWO_CARDS_CELL = '38';

const CONFIG = soloGameConfig({board: 'terra cimmeria nova'});

/**
 * Create games until the target cell is untiled. The solo neutral setup
 * (2 cities + 2 greeneries) lands RANDOMLY — the create-config seed is
 * ignored by the server — so the board is re-rolled over the API (cheap)
 * rather than asserted against luck.
 */
export async function createCleanTcnGame(request: APIRequestContext, cellId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const playerId = await createGameWithCards(request, [], {config: CONFIG});
    const model = await fetchPlayerModel(request, playerId) as unknown as {
      game: {spaces: Array<{id: string, tileType?: unknown}>},
    };
    const target = model.game.spaces.find((s) => s.id === cellId);
    if (target !== undefined && target.tileType === undefined) {
      return playerId;
    }
  }
  throw new Error(`10 boards in a row had a neutral tile on cell ${cellId}`);
}

/** The pad cursor's current cell (the spotlight class the board section applies). */
export async function cursorCell(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.querySelector('.board-space.con-cell-sel')?.getAttribute('data_space_id') ?? '');
}

/**
 * Walk the board cursor to `target` with the d-pad — the PAD path is the
 * point: `handleSectionConfirm` is where the card-bonus cover ARMS at
 * submit. Greedy per-axis walk with a stuck-detector (rows clamp at their
 * ends; a wall means «switch axis», never «press harder»).
 */
export async function walkBoardCursorTo(page: Page, target: string, maxSteps = 70): Promise<boolean> {
  let lastCur = '';
  let stuck = 0;
  for (let i = 0; i < maxSteps; i++) {
    const cur = await cursorCell(page);
    if (cur === target) {
      return true;
    }
    if (cur === '') {
      // The board seeds its cursor a beat after the placement opens — wait for the spotlight, never a duration.
      await page.waitForFunction(() => document.querySelector('.board-space.con-cell-sel') !== null,
        undefined, {timeout: 3_000, polling: 100}).catch(() => undefined);
      continue;
    }
    const centers = await page.evaluate(([a, b]) => {
      const centerOf = (id: string) => {
        const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
        if (el === null) {
          return null;
        }
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      };
      return [centerOf(a), centerOf(b)];
    }, [cur, target] as const);
    const [c, t] = centers;
    if (c === null || t === null) {
      return false;
    }
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    const vertical = Math.abs(dy) > 18;
    let key = vertical ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    stuck = cur === lastCur ? stuck + 1 : 0;
    if (stuck >= 1) {
      key = vertical ?
        (Math.abs(dx) < 2 ? 'ArrowRight' : (dx > 0 ? 'ArrowRight' : 'ArrowLeft')) :
        (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    lastCur = cur;
    await press(page, key, 240);
  }
  return (await cursorCell(page)) === target;
}

/** Open the basic convert-plants placement (LT wheel, LEFT slot). */
export async function openConvertPlants(page: Page): Promise<void> {
  await press(page, 'Comma', 1400);
  await press(page, 'ArrowLeft', 2600);
  await expect(page.locator('.con-context__task-kicker'),
    'the convert-plants placement never opened').toHaveCount(1, {timeout: 20_000});
}
