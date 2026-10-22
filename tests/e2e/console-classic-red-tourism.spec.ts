/*
 * T12 RED TOURISM WAVE («Наплыв туристов») — the first classic Turmoil card whose result is a SET OF CELLS: «+1 M€ for
 * each EMPTY area adjacent to your tiles». Its ONE e2e (the checklist §5 — a new wiring: the board peek of a
 * SINGLE-TERM count that carries its cells, `ActionEffectBasis.spaces` → `peekGroupsOf` one group), tv4k:
 *
 *   A · `red-tourism` — the Reds rule; blue's two greeneries, red's city on one of their neighbours: the hand plate
 *       reads the server's count, the composer's «ПОЧЕМУ» says the same number, L3 «Показать на поле» lights EXACTLY the
 *       server's cells on the board (red's tile is not among them) and gives the composer back; A plays it: the server
 *       pays − 3 + N.
 *   B · `red-tourism-zero` — blue has no tile: the plate reads 0 (muted, never hidden), the composer names the zero in
 *       words («Рядом с вашими тайлами нет пустых клеток») and offers no peek.
 *
 * Frames: `screenshots/t12/tv4k/card-*.png`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const T12 = 'Red Tourism Wave';
const OUT = path.resolve('screenshots', 't12');

type Basis = {count: number, spaces?: Array<string>};
type Wire = {
  thisPlayer: {megacredits: number},
  cardsInHand?: Array<{name: string, countedPlay?: Array<{icon: string, amount: number, basis?: Array<Basis>}>}>,
};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The server's counted reading of T12 in blue's hand — the number and its cells. */
async function serverCount(request: APIRequestContext, playerId: string): Promise<{n: number, spaces: Array<string>}> {
  const card = (await serverModel(request, playerId)).cardsInHand?.find((c) => c.name === T12);
  const gain = card?.countedPlay?.find((e) => e.icon === 'megacredits');
  return {n: gain?.amount ?? -1, spaces: gain?.basis?.[0]?.spaces ?? []};
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `card-${name}.png`)});
}

/** RT wheel → the hand, the cursor on T12. */
async function focusT12(page: Page): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, T12, Math.max(14, slots * 3)), 'the cursor stands on T12').toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

async function openComposer(page: Page): Promise<void> {
  await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

for (const preset of PROFILES) {
  test.describe(`T12 Red Tourism Wave · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the count, its cells on the board, and the payment (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'red-tourism', {query: preset.query});
      const before = await serverModel(request, playerId);
      const {n, spaces} = await serverCount(request, playerId);
      expect(n, 'the server counts at least five empty areas').toBeGreaterThanOrEqual(5);
      expect(spaces.length, 'one cell per counted area').toBe(n);
      await focusT12(page);
      const slot = page.locator(`.con-hand__slot[data-zoom-slot="${T12}"]`);
      await expect(slot.locator('[data-hand-count]'), 'the plate reads the server\'s count').toHaveAttribute('data-hand-count', String(n));
      expect(await slot.locator('img').evaluateAll((imgs) => imgs.some((i) => (i as HTMLImageElement).src.includes('T12'))), 'the face wears the T12 art').toBe(true);
      await shot(page, preset.id, 'A-hand');
      await openComposer(page);
      const why = page.locator('.con-composer--play .con-cwhy');
      await expect(why, 'the composer says how many — and why').toHaveCount(1);
      await expect(why.locator('.con-cwhy__num').first()).toHaveText(String(n));
      await shot(page, preset.id, 'A-composer');

      // L3 «Показать на поле»: the board under the composer, EXACTLY the server's cells marked.
      await pressUntil(page, 'KeyC', async () => await page.locator('.con-root--board-peek').count() > 0, {tries: 3, settleMs: 900});
      await expect.poll(() => page.locator('.con-peek-space[data_space_id]').count(), {timeout: 10_000, message: 'the counted cells are marked'}).toBe(n);
      const marked = await page.locator('.con-peek-space[data_space_id]').evaluateAll((els) => els.map((e) => e.getAttribute('data_space_id') ?? ''));
      expect([...marked].sort(), 'the marked cells ARE the server\'s cells').toEqual([...spaces].sort());
      await shot(page, preset.id, 'A-peek');
      await pressUntil(page, 'KeyC', async () => await page.locator('.con-root--board-peek').count() === 0, {tries: 3, settleMs: 900});
      await expect(page.locator('.con-composer--play'), 'the composer comes back').toBeVisible();

      for (let i = 0; i < 5 && await page.locator('.con-composer--play').count() > 0; i++) {
        await press(page, 'Enter', 900);
      }
      let after = await serverModel(request, playerId);
      for (let i = 0; i < 120 && after.cardsInHand?.some((c) => c.name === T12) === true; i++) {
        await new Promise((r) => setTimeout(r, 250));
        after = await serverModel(request, playerId);
      }
      expect(after.cardsInHand?.some((c) => c.name === T12), 'T12 left the hand').toBe(false);
      expect(after.thisPlayer.megacredits, `the server: − 3 + ${n}`).toBe(before.thisPlayer.megacredits - 3 + n);
      await settle(page, {timeoutMs: 30_000});
      await shot(page, preset.id, 'A-played');
    });

    test(`B · no tile of yours: the zero is named, no peek (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId} = await bootFixtureSeats(page, request, 'red-tourism-zero', {query: preset.query});
      expect((await serverCount(request, playerId)).n, 'the server counts nothing').toBe(0);
      await focusT12(page);
      const plate = page.locator(`.con-hand__slot[data-zoom-slot="${T12}"] [data-hand-count]`);
      await expect(plate, 'a zero is a reading — on the plate, muted').toHaveAttribute('data-hand-count', '0');
      await openComposer(page);
      await expect(page.locator('.con-composer--play .con-cwhy [data-count-zero]'), 'the zero in words').toHaveText(/Рядом с вашими тайлами нет пустых клеток/);
      await shot(page, preset.id, 'B-zero');
      await press(page, 'KeyC', 900);
      expect(await page.locator('.con-root--board-peek').count(), 'nothing to show on the board — L3 opens nothing').toBe(0);
    });
  });
}
