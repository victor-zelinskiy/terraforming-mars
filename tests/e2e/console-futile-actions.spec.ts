import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openActionFocus, openCardActions, press, pressUntil, settle} from './consoleStart';

/**
 * ACTIONS THAT CHANGE NOTHING — the owner's iteration of 2026-10-15: «the pass confirmation lists actions that
 * really have no point (a parameter already at its maximum, Search For Life with its science already lying there, a
 * heat conversion at the temperature's maximum) — the player sees there is something left before passing and finds
 * only actions that mean nothing». The server PROVES the verdict (`server/models/actionFutility.ts`); every surface
 * that counts or lists actions reads it, and none of them hides or blocks the action (the player may stall):
 *
 *   (A) `futile-only` — three card actions, each futile, a futile heat conversion, nothing else:
 *       · the RT badge keeps «3» and turns WHITE (no glow), the wheel's «Действия карт» badge too;
 *       · LT: the heat tile is a live verb, quiet, its reason in place of the price;
 *       · LT ↓ the pass: NO warning list — ONE quiet line «Остались только действия без эффекта: 4» (three card
 *         actions + the heat conversion); B cancels;
 *       · «Действия карт»: «можно выполнить» keeps 3 in white, every tile wears «Без эффекта» and its reason, A still
 *         descends and the composer names the verdict before the press (nothing sent);
 *       · the standard projects: the asteroid and the aquifer rows are quiet with their reason, still live.
 *   (B) `futile-mixed` — beside them a useful pair and a blocked card: the futile cards sink BELOW the blocked one,
 *       the cursor opens on a useful tile, GHG keeps its useful band with ONE futile variant, the badges stay mint.
 *   (C) `vp-threshold` — Ants' microbe lands short of the next point (0 → 1 microbe, 1 VP per 2): a USEFUL action, a
 *       neutral VP chip «ПО 0 → 0 · пока без изменений · до следующего ещё 1», never «no effect», never an amber warning.
 *
 * Two profiles (fhd + tv4k). Heavy 4K: `--workers=1`.
 */
const OUT = path.resolve('screenshots', 'futile-actions');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const FUTILE = ['Water Splitting Plant', 'Search For Life', 'Aquifer Pumping'];

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && document.querySelector('.con-quick') === null &&
    board !== null && board.offsetParent !== null;
});

async function toBoard(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 5, settleMs: 1200}), 'the viewer stands on the board').toBe(true);
}

async function openWheel(page: Page, key: 'Comma' | 'Period'): Promise<void> {
  await toBoard(page);
  expect(await pressUntil(page, key, async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}),
    'the wheel opens').toBe(true);
  await settle(page);
}

/** The groups of «Действия карт» in their painted order — the first tile's card per group. */
const groupOrder = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll<HTMLElement>('.con-cardactions__group'))
    .map((g) => g.querySelector<HTMLElement>('[data-action-card]')?.dataset.actionCard ?? ''));

for (const preset of PRESETS) {
  test.describe(`actions that change nothing · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('(A) only futile actions left: white counts, a quiet heat tile, ONE quiet pass line, the band and the composer, the projects', async ({page, request}) => {
      test.setTimeout(300_000);
      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const posts = watchPosts(page);
      await bootFixtureSeats(page, request, 'futile-only', {query: preset.query});
      await settle(page);

      // ── the RT bar badge: the number stays, the «go» goes ──
      await toBoard(page);
      const barBadge = page.locator('.con-cmdbar__badge[data-badge-tone]');
      await expect(barBadge.filter({hasText: '3'}), 'the RT badge keeps the count of allowed actions').toHaveCount(1);
      await expect(page.locator('.con-cmdbar__badge[data-badge-tone="neutral"]'), 'and turns white').toHaveCount(1);
      await expect(page.locator('.con-cmdbar__cmd--hot .con-cmdbar__badge'), 'nothing glows for an action with no effect').toHaveCount(0);

      // ── RT: the card actions slot ──
      await openWheel(page, 'Period');
      const actionsSlot = page.locator('[data-quick-id="cardActions"] [data-badge-tone]');
      await expect(actionsSlot).toHaveAttribute('data-badge-tone', 'neutral');
      await expect(actionsSlot).toHaveText('3');
      await shoot(page, preset.id, 'A1-rt-wheel');

      // ── LT: the heat tile — live, quiet, its reason ──
      await openWheel(page, 'Comma');
      const heat = page.locator('[data-quick-id="convertHeat"]');
      await expect(heat).toHaveClass(/con-quick__slot--futile/);
      await expect(heat).not.toHaveClass(/con-quick__slot--disabled/);
      await expect(heat.locator('[data-slot-futile]')).toHaveText('Температура на максимуме');
      await shoot(page, preset.id, 'A2-lt-wheel');

      // ── LT ↓ the pass: one quiet line, no warning list ──
      const confirm = page.locator('.con-confirm[data-confirm-kind="pass"]');
      expect(await pressUntil(page, 'ArrowDown', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the pass confirm stands').toBe(true);
      await settle(page);
      // Three card actions + the heat conversion — every action left, none of them worth anything.
      await expect(confirm.locator('[data-confirm-quiet]')).toHaveText(/Остались только действия без эффекта: 4/);
      await expect(confirm.locator('[data-confirm-warns]'), 'no «still available» list for actions with no effect').toHaveCount(0);
      await shoot(page, preset.id, 'A3-pass');
      await press(page, 'Escape', 900);
      await expect(confirm).toHaveCount(0);

      // ── «Действия карт»: the white count, every tile futile and live ──
      await toBoard(page);
      await openCardActions(page);
      await settle(page);
      const stat = page.locator('.con-cardactions__stat--go');
      await expect(stat).toHaveAttribute('data-stat-tone', 'neutral');
      await expect(stat.locator('b')).toHaveText('3');
      for (const card of FUTILE) {
        const tile = page.locator(`.con-cardactions__tile[data-action-card="${card}"]`);
        await expect(tile, `${card} is listed`).toHaveCount(1);
        await expect(tile, `${card} carries the verdict`).toHaveAttribute('data-action-futile', /.+/);
        await expect(tile.locator('.con-cardactions__tile-status--futile')).toHaveText(/без эффекта/i);
        await expect(tile.locator('[data-tile-futile]')).toHaveCount(1);
      }
      await expect(page.locator('.con-cardactions__verdict[data-verdict="futile"]'), 'the dossier names the verdict').toHaveCount(1);
      await shoot(page, preset.id, 'A4-card-actions');

      // A still descends; the composer names the verdict before the press — nothing sent.
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator('[data-composer-futile]')).toContainText('действие ничего не изменит');
      await shoot(page, preset.id, 'A5-composer');
      expect(posts, 'nothing was sent').toEqual([]);
      await press(page, 'Escape', 1000);

      // ── the standard projects: the asteroid and the aquifer are quiet and live ──
      await toBoard(page);
      await openWheel(page, 'Comma');
      await press(page, 'Enter', 1400);
      await expect(page.locator('.con-stdp')).toHaveCount(1);
      await settle(page);
      for (const card of ['Asteroid:SP', 'Aquifer']) {
        await expect(page.locator(`.con-stdp__card[data-stdp-card="${card}"]`), `${card} is quiet`).toHaveAttribute('data-stdp-futile', 'parameter-maxed');
      }
      await expect(page.locator('.con-stdp__card[data-stdp-card="Greenery"]'), 'a greenery still places a tile').not.toHaveAttribute('data-stdp-futile', /.*/);
      // Walk the cursor onto the asteroid row: the foot names the verdict, never a warning beside it.
      const foot = page.locator('[data-stdp-context-futile]');
      for (let i = 0; i < 8 && await foot.count() === 0; i++) {
        await press(page, i % 2 === 0 ? 'ArrowDown' : 'ArrowRight', 420);
      }
      await expect(foot, 'a futile row names its verdict in the foot').toHaveCount(1);
      await expect(page.locator('.con-stdp__context-warning'), 'the verdict supersedes the per-chip warning').toHaveCount(0);
      await shoot(page, preset.id, 'A6-std-projects');
      expect(posts, 'nothing was sent').toEqual([]);
      expect(errors).toEqual([]);
    });

    test('(B) futile beside useful: the futile cards sink below the blocked one, the cursor opens on a useful tile, the counts stay mint', async ({page, request}) => {
      test.setTimeout(240_000);
      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await bootFixtureSeats(page, request, 'futile-mixed', {query: preset.query});
      await settle(page);
      await toBoard(page);
      await expect(page.locator('.con-cmdbar__badge[data-badge-tone="neutral"]'), 'something useful is left — the badge stays mint').toHaveCount(0);

      await openCardActions(page);
      await settle(page);
      await expect(page.locator('.con-cardactions__stat--go')).toHaveAttribute('data-stat-tone', 'go');
      const order = await groupOrder(page);
      const blocked = order.indexOf('Space Elevator');
      expect(blocked, 'the blocked card is listed').toBeGreaterThanOrEqual(0);
      for (const card of FUTILE) {
        expect(order.indexOf(card), `${card} sinks below the blocked card (${order.join(' · ')})`).toBeGreaterThan(blocked);
      }
      for (const card of ['Restricted Area', 'GHG Producing Bacteria']) {
        expect(order.indexOf(card), `${card} stays in the useful band (${order.join(' · ')})`).toBeLessThan(blocked);
      }
      // GHG: one variant changes nothing (the temperature step), the other does — only that one carries the verdict.
      await expect(page.locator('.con-cardactions__tile[data-action-card="GHG Producing Bacteria"][data-action-futile]')).toHaveCount(1);
      await expect(page.locator('.con-cardactions__tile[data-action-card="GHG Producing Bacteria"]')).toHaveCount(2);
      // The cursor opens on an action that does something.
      await expect(page.locator('.con-cardactions__tile--focused'), 'the cursor opens on a useful tile').not.toHaveAttribute('data-action-futile', /.*/);
      await expect(page.locator('.con-cardactions__tile--focused')).not.toHaveClass(/con-cardactions__tile--rules/);
      await shoot(page, preset.id, 'B1-card-actions');
      expect(errors).toEqual([]);
    });

    // The owner's check (2026-10-15): a resource that lands SHORT of the card's next point is a valid action — the
    // microbe lands. Never «no effect», never the amber «value already at maximum»: a neutral VP chip saying how many
    // more buy the point.
    test('(C) a resource short of the next point: a useful action, a NEUTRAL VP chip «до следующего ещё 1», no warning', async ({page, request}) => {
      test.setTimeout(180_000);
      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const posts = watchPosts(page);
      await bootFixtureSeats(page, request, 'vp-threshold', {query: preset.query});
      await settle(page);
      await toBoard(page);
      await expect(page.locator('.con-cmdbar__badge[data-badge-tone="neutral"]'), 'a useful action — the badge stays mint').toHaveCount(0);

      await openCardActions(page);
      await settle(page);
      const ants = page.locator('.con-cardactions__tile[data-action-card="Ants"]');
      await expect(ants, 'Ants is listed').toHaveCount(1);
      await expect(ants, 'and is NOT «no effect»').not.toHaveAttribute('data-action-futile', /.*/);
      await expect(page.locator('.con-cardactions__tile--focused'), 'the cursor opens on Ants').toHaveAttribute('data-action-card', 'Ants');

      await openActionFocus(page);
      await settle(page);
      const composer = page.locator('.con-composer--stage');
      const vp = composer.locator('.action-effect-chip--steady');
      await expect(vp.first(), 'the VP reading is in the neutral register').toBeVisible();
      await expect(vp.first()).toContainText('пока без изменений · до следующего ещё 1');
      await expect(composer.locator('.action-effect-chip--noeffect'), 'nothing reads «no effect»').toHaveCount(0);
      await expect(composer.locator('[data-composer-futile]'), 'no «the action will change nothing»').toHaveCount(0);
      await expect(composer.locator('.con-composer__warn').filter({hasText: 'максимуме'}), 'no amber «already at maximum»').toHaveCount(0);
      await shoot(page, preset.id, 'C1-vp-threshold-composer');
      expect(posts, 'nothing was sent').toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
