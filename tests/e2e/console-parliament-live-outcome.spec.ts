import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, openCardActions, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * RX36 LIVE EXPERIMENTS · WHAT THE PLAYED CARD SETS OFF STAYS IN THE LAW'S STAGE (the owner, 2026-10-31: «результат карты,
 * разыгранной через закон, открывается отдельным окном, а не внутри рабочей области — доработать до реально премиум
 * бесшовной подачи»). The card lands in «ДЕЙСТВИЯ КАРТ › ЖИВЫЕ ЭКСПЕРИМЕНТЫ» (PL-726); its DRAW («Исследования»), its
 * keep-some PICK («Конкурс изобретений») and a repeated action's VERDICT («Инспекция проектов» copying «Поиск жизни»)
 * are that stage's next beat — the ONE shell presenter teleported into the stage's own outcome zone, the crumb only
 * gaining a tail — never a standalone band after the workspace has left. The take ends the flow on the board, with no
 * stall marker (the harness's liveness / beat-stall guards are red on one).
 *
 * Fixture `parliament-live-outcome`: Live Experiments enacted, red holding the three cards, Search For Life's action
 * spent this generation (Project Inspection's one honest candidate), 30 M€.
 */
const OUT = path.resolve('screenshots', 'console-parliament-live-outcome');
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';
const STAGE = `.con-cardactions .con-composer[data-composer-source="law:${LAW}"]`;
const READY = `${STAGE} .con-composer__cta--ready`;
const ZONE = '.con-cardactions [data-embed-slot="law-outcome"]';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The law's tile on the browse grid — steered by geometry (the grid's order differs between tables). */
async function focusLawTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
  for (let i = 0; i < 30 && await focused() !== LAW; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-resolution="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, LAW);
    await press(page, dir, 260);
  }
  expect(await focused(), 'the law\'s tile is focused').toBe(LAW);
}

type Shape = {
  card: string,
  /** The outcome surface the stage must host, and its crumb tail. */
  surface: string,
  tail: RegExp,
  /** How the player ENDS the outcome once it stands. */
  end: (page: Page) => Promise<void>,
};

const SHAPES: ReadonlyArray<Shape> = [
  {
    card: 'Research', surface: '.con-reveal--embedded', tail: /ДОБОР КАРТ/i,
    // B takes the whole batch.
    end: async (page) => {
      await press(page, 'Escape', 1500);
    },
  },
  {
    card: 'Invention Contest', surface: '.con-deckpick', tail: /ВЫБОР|ДОБОР КАРТ/i,
    // A keeps the focused card (the pick's ONE answer).
    end: async (page) => {
      await press(page, 'Enter', 1500);
    },
  },
  {
    card: 'Project Inspection', surface: '.con-verdict', tail: /ВСКРЫТ/i,
    // «ОК» on the verdict.
    end: async (page) => {
      await press(page, 'Enter', 1500);
    },
  },
];

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

for (const shape of SHAPES) {
  test(`the law plays ${shape.card} — what it sets off presents INSIDE the law's stage, and the take ends on the board`, async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-live-outcome', {query: '&consoleProfile=tv'});
    await waitForBoardHome(page, 40);
    await settle(page, {timeoutMs: 20_000});
    await openCardActions(page);
    await focusLawTile(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}), 'the law\'s stage').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} .con-hand`).count() > 0, {tries: 4, settleMs: 1200}), 'the album').toBeTruthy();
    await settle(page, {timeoutMs: 20_000});
    expect(await focusCard(page, shape.card, 24), `the cursor reaches ${shape.card}`).toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}), 'the play composer').toBeTruthy();
    await settle(page, {timeoutMs: 20_000});
    if (shape.card === 'Project Inspection') {
      // The repeat slot: A opens the shared pick (a nested ДЕЙСТВИЯ КАРТ), A recomposes the one candidate into its
      // focus stage, A confirms it — the nested grid leaves and the slot is filled.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() >= 2, {tries: 4, settleMs: 1100}), 'the repeat pick').toBeTruthy();
      await settle(page, {timeoutMs: 15_000});
      const stages = page.locator('.con-cardactions__stagewrap .con-composer--stage');
      const before = await stages.count();
      expect(await pressUntil(page, 'Enter', async () => await stages.count() > before, {tries: 4, settleMs: 1200}), 'the copied action stage').toBeTruthy();
      await settle(page, {timeoutMs: 15_000});
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 1, {tries: 4, settleMs: 1500}), 'the repeat chosen').toBeTruthy();
      await settle(page, {timeoutMs: 15_000});
    }
    expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-law-play-name]').count() > 0, {tries: 5, settleMs: 1200}), 'the slot filled').toBeTruthy();
    await settle(page, {timeoutMs: 20_000});
    expect(await page.locator(READY).count(), 'the commit is ready').toBe(1);
    const before = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {tableau: Array<{name: string}>}};

    await recordTransient(page, 'law-landing', () => {
      const el = document.querySelector<HTMLElement>('.con-cardactions [data-law-landing]');
      return el === null ? null : `${Math.round(Number(getComputedStyle(el).opacity) * 100) / 100}·${getComputedStyle(el).visibility}`;
    });

    // ── THE COMMIT: the card lands in the stage, then what it set off rises IN THE SAME STAGE. ──
    await page.keyboard.press('Enter');
    const hosted = page.locator(`${ZONE} ${shape.surface}`);
    await expect(hosted, `${shape.card}'s outcome presents inside the law's outcome zone`).toHaveCount(1, {timeout: 30_000});
    // The whole time: the workspace stands, ONE instance of the surface, nothing standalone.
    expect(await page.locator('.con-cardactions').count(), 'the workspace stands').toBe(1);
    expect(await page.locator(shape.surface).count(), 'one surface, one home').toBe(1);
    expect(await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).every((el) => el.closest('.con-cardactions') !== null), shape.surface),
      'never a standalone band over the board').toBe(true);
    // The crumb only gained a tail: the workspace root and the law stay, the stage names the outcome.
    const crumb = page.locator('.con-cardactions .con-wshead');
    await expect(crumb).toContainText(/ДЕЙСТВИЯ КАРТ/i);
    await expect(crumb).toContainText(/ЖИВЫЕ ЭКСПЕРИМЕНТЫ/i);
    // (the stage segment crossfades in a shared cell — the LEAVING span is not the tail)
    await expect(page.locator('.con-cardactions .con-wshead__step:not([class*="swap-leave"])')).toHaveText(shape.tail, {timeout: 10_000});
    // The landed tableau let go under the outcome — it does not stand over the cards. The let-go is a DISSOLVE that
    // starts on the very fact the outcome rises on (`playLandingYieldedToOutcome`), so it is read as a STATE, never
    // one-shot (tests.md ④ / ⑦): the hosted surface stands a frame before the tableau's ease has crossed half — CI
    // 42223555435 read it at that frame on a starved 4K runner. A tableau that never lets go stays red, with its record.
    const landing = page.locator('.con-cardactions [data-law-landing]');
    const landingPainted = () => landing.evaluateAll((els) =>
      els.some((el) => Number(getComputedStyle(el).opacity) > 0.5 && getComputedStyle(el).visibility !== 'hidden'));
    try {
      await expect.poll(landingPainted, {timeout: 5_000}).toBe(false);
    } catch (e) {
      const trail = (await readTransient<string | null>(page, 'law-landing')).map((x) => `${x.t % 100000}:${x.v}`).join(' ');
      throw new Error(`the landed tableau dissolved under the rising outcome — it still stands (opacity·visibility over time: ${trail})\n${String(e)}`);
    }
    const after = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {tableau: Array<{name: string}>}};
    expect(after.thisPlayer.tableau.length, 'the card is on the table').toBe(before.thisPlayer.tableau.length + 1);
    await cinematicBeat(page, 600, 'the outcome settles for the frame');
    await shoot(page, `${shape.card.replace(/\s+/g, '-')}-01-outcome-in-stage`);

    // ── THE END: the take / the pick / «ОК» — the flow LEAVES to the board, nothing stalls. ──
    await shape.end(page);
    await expect(page.locator(shape.surface), 'the outcome surface is gone').toHaveCount(0, {timeout: 20_000});
    await expect(page.locator('.con-cardactions'), 'the finished flow leaves — never back to the browse grid').toHaveCount(0, {timeout: 20_000});
    await waitForBoardHome(page, 30);
    await shoot(page, `${shape.card.replace(/\s+/g, '-')}-02-board`);
  });
}
