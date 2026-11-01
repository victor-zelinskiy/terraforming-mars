import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle, waitForBoardHome} from './consoleStart';

/**
 * P86 «НЕОЖИДАННОЕ ПРИМЕНЕНИЕ» — the TWENTIETH Prelude 2 card (docs/claude/prompts/prelude2-p86-unexpected-application.md):
 * a Venus EVENT, 4 M€, «discard 1 card to raise Venus 1 step». The discard is the play's PRICE, pre-collected as its
 * FIRST step: the composer's row opens the hand album as a PRE-SELECT (the played card not in it, nothing leaves, no
 * POST), the answer rides the play's ONE POST addressed `{role: 'discard', source: P86}`, and the chosen card leaves
 * the DOCK at the press — before the hero lifts (PL-1128: the hero's fourth shipment, `data-hero-discard`).
 *
 *   A · `unexpected-application` (P86 + Tardigrades + Research): the row → the album in pick mode (P86 absent, the hand
 *       total stands, no POST, no discard proxy) → B back to the row (nothing answered) → A → Tardigrades → A → the row
 *       answered → the commit: ONE POST; ORDER: the first discard proxy is painted BEFORE the hero lifts, the hero reads
 *       `data-hero-discard` left; the pile ticks to ≥ 1; the server: Venus +1 step, TR +1, the card on the pile, nothing
 *       asked again.
 *   B · `unexpected-application-sole` (P86 + Tardigrades): the row is SEEDED and shown (T14) — the POST carries it.
 *   C · `unexpected-application-none` (P86 alone): not playable — the hand names the reason, no composer opens.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P86 (the dry run there proves the play). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Unexpected Application';
const DISCARD = 'Tardigrades';
const OUT = path.resolve('screenshots', 'p86');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {discardPrompt?: unknown, options?: Array<{discardPrompt?: unknown}>},
  game: {venusScaleLevel: number},
  thisPlayer: {terraformRating: number, megacredits: number, cardsInHandNbr: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
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

/** The hand in PICK mode — the shelf's own flow state (`data-flow="picking"`), or any picked slot. */
const handPicking = (page: Page) => page.locator('.con-hand[data-flow="picking"], .con-hand .con-hand__slot--select-picked');

/** RT → the hand → the card focused → A: the play composer, nothing sent. */
async function openComposer(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await page.locator(COMPOSER).waitFor({timeout: 15_000});
  await settle(page);
}

/** A on the discard row → the album in pick mode. */
async function openPick(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await handPicking(page).count() === 0; i++) {
    if (await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 600);
    }
    await press(page, 'Enter', 1400);
  }
  await expect(handPicking(page).first(), 'the discard row opens the hand in pick mode').toBeVisible({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The play's ORDER, sampled from BEFORE the press: when the first discard proxy painted, when the hero lifted. */
async function armOrderProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t0 = performance.now();
    const rec = {proxyAt: -1, liftAt: -1, discardLeft: '', pileMax: 0};
    (window as unknown as {__p86Order: typeof rec}).__p86Order = rec;
    const sample = () => {
      const now = performance.now() - t0;
      if (rec.proxyAt < 0 && document.querySelector('.con-discard-proxy') !== null) {
        rec.proxyAt = now;
      }
      const hero = document.querySelector<HTMLElement>('.con-played-hero');
      const phase = hero?.dataset.heroPhase ?? '';
      if (rec.liftAt < 0 && ['lifting', 'flying', 'landing', 'committing', 'showing-result'].includes(phase)) {
        rec.liftAt = now;
      }
      const left = hero?.dataset.heroDiscard;
      if (left !== undefined) {
        rec.discardLeft = left;
      }
      const pile = document.querySelector<HTMLElement>('[data-discard-pile]');
      rec.pileMax = Math.max(rec.pileMax, Number(pile?.dataset.discardPileCount ?? 0));
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-hero-phase', 'data-hero-discard', 'data-discard-pile-count', 'class']});
    window.setInterval(sample, 16);
  });
}
async function readOrderProbe(page: Page): Promise<{proxyAt: number, liftAt: number, discardLeft: string, pileMax: number}> {
  return page.evaluate(() => (window as unknown as {__p86Order: {proxyAt: number, liftAt: number, discardLeft: string, pileMax: number}}).__p86Order);
}

/** A on the commit → ONE POST (a retry only while nothing was sent). */
async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
}

function discardAnswerOf(post: string): {cards?: Array<string>, for?: {role?: string, source?: {card?: string}}} | undefined {
  const body = JSON.parse(post) as {responses?: Array<{type: string, cards?: Array<string>, for?: {role?: string, source?: {card?: string}}}>};
  return (body.responses ?? []).find((r) => r.type === 'card');
}

test.describe(`Unexpected Application — the discard is the play's price · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · the album opens from the play sheet as a pre-select; the card leaves the dock BEFORE the lift; Venus +1 step', async ({page, request}) => {
    test.setTimeout(300_000);
    const posts = watchPosts(page);
    const playerId = await bootFixture(page, request, 'unexpected-application', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, playerId);
    expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card and two discard candidates').toEqual(expect.arrayContaining([CARD, DISCARD, 'Research']));

    await openComposer(page);
    await shoot(page, '01-composer');
    const total = await page.locator('[data-hand-total]').first().getAttribute('data-hand-total').catch(() => null);
    await openPick(page);
    expect(await page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"]`).count(), 'the card being played is NOT in its own pick').toBe(0);
    expect(await page.locator('.con-discard-proxy').count(), 'nothing leaves at the pick').toBe(0);
    if (total !== null) {
      expect(await page.locator('[data-hand-total]').first().getAttribute('data-hand-total'), 'the hand total stands').toBe(total);
    }
    expect(posts, 'nothing sent at the pick').toEqual([]);
    await shoot(page, '02-pick');

    // B — one level back, nothing answered.
    await press(page, 'Escape', 1200);
    await expect(page.locator(`${COMPOSER}:visible`), 'B returns to the play sheet').toHaveCount(1, {timeout: 15_000});
    await expect(handPicking(page), 'the pick is gone').toHaveCount(0);
    expect(await page.locator(`${COMPOSER} .con-composer__row--missing`).count(), 'the discard row is still open').toBeGreaterThan(0);

    // A again → the discard chosen in the album.
    await openPick(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, DISCARD, slots * 2 + 6), `never focused «${DISCARD}» in the pick`).toBe(true);
    for (let i = 0; i < 3 && await page.locator(`${COMPOSER}:visible`).count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await expect(page.locator(`${COMPOSER}:visible`), 'A answers the pick and returns to the sheet').toHaveCount(1, {timeout: 15_000});
    await settle(page);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'no open question left').toHaveCount(0);
    expect(posts, 'nothing sent before the play\'s own A').toEqual([]);
    await shoot(page, '03-answered');

    await armOrderProbe(page);
    await commit(page, posts);
    const answer = discardAnswerOf(posts[0]);
    expect(answer?.cards, 'the batch carries the discard').toEqual([DISCARD]);
    expect(answer?.for, 'ADDRESSED to the card\'s own discard').toMatchObject({role: 'discard', source: {card: CARD}});

    await expect.poll(async () => (await wireOf(request, playerId)).game.venusScaleLevel, {timeout: 30_000, message: 'Venus moved'}).toBe(before.game.venusScaleLevel + 2);
    await settle(page, {timeoutMs: 40_000});
    const order = await readOrderProbe(page);
    expect(order.proxyAt, `a discard proxy was painted (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(0);
    expect(order.liftAt, `the hero lifted (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(0);
    expect(order.proxyAt, `the price leaves BEFORE the lift (${JSON.stringify(order)})`).toBeLessThan(order.liftAt);
    expect(order.discardLeft, `the hero waited for the packet's departure (${JSON.stringify(order)})`).toBe('left');
    expect(order.pileMax, `the pile read the discard (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(1);

    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.terraformRating).toBe(before.thisPlayer.terraformRating + 1);
    expect(after.cardsInHand?.map((c) => c.name)).toEqual(['Research']);
    const wf = after.waitingFor;
    expect(wf?.discardPrompt !== undefined || (wf?.options ?? []).some((o) => o.discardPrompt !== undefined), 'no discard asked again').toBe(false);
    await waitForBoardHome(page, 30);
    await expect(handPicking(page), 'the hand never comes back in pick mode').toHaveCount(0);
    await shoot(page, '04-board');
  });

  test('B · ONE candidate — seeded and shown (T14), still asked; the POST carries it', async ({page, request}) => {
    test.setTimeout(240_000);
    const posts = watchPosts(page);
    const playerId = await bootFixture(page, request, 'unexpected-application-sole', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, playerId);
    await openComposer(page);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'the sole candidate is seeded — nothing missing').toHaveCount(0);
    await shoot(page, '05-sole');
    expect(posts).toEqual([]);
    await commit(page, posts);
    expect(discardAnswerOf(posts[0])?.cards).toEqual([DISCARD]);
    await expect.poll(async () => (await wireOf(request, playerId)).game.venusScaleLevel, {timeout: 30_000}).toBe(before.game.venusScaleLevel + 2);
    await settle(page, {timeoutMs: 40_000});
    expect((await wireOf(request, playerId)).cardsInHand ?? []).toEqual([]);
  });

  test('C · no other card — not playable, with its reason; no composer', async ({page, request}) => {
    test.setTimeout(180_000);
    const posts = watchPosts(page);
    await bootFixture(page, request, 'unexpected-application-none', {query: PRESET.query});
    await settle(page);
    for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    expect(await focusCard(page, CARD, 8), `never focused «${CARD}»`).toBe(true);
    await expect(page.getByText('Нужна ещё одна карта в руке, чтобы сбросить').first(), 'the reason is named').toBeVisible({timeout: 10_000});
    await press(page, 'Enter', 1200);
    expect(await page.locator(COMPOSER).count(), 'no composer for an unplayable card').toBe(0);
    expect(posts).toEqual([]);
    await shoot(page, '06-none');
  });
});
