/*
 * «КОНФЕРЕНЦИЯ НА ОЛИМПЕ» × «МАРСИАНСКИЙ УНИВЕРСИТЕТ» — A DISCARD BEHIND A DRAW: ANSWER NOW, OR AFTER THE DRAW
 * (the owner's photo of 2026-10-14 22:21 and his decision of 2026-10-15).
 *
 * Playing Mars University (a science tag) under Olympus Conference holding a science wakes two table questions in one
 * queue: Olympus asks first («remove a science to draw a card, or add one»), the university after it («discard a card
 * to draw one»). When Olympus' answer DRAWS, the card it brings is in the hand by the time the university asks — and it
 * may be the very card worth giving up. Until 2026-10-15 the composer then turned the university's row into a «ДАЛЕЕ»
 * line with no way to answer it before the press. Now (`common/models/tableQuestionDeferral.ts`,
 * `client/console/tableQuestionRow.ts`):
 *  · the university's row WAITS for Olympus' answer — «Ждёт ответа: «Конференция на Олимпе»», no cursor stop;
 *  · Olympus answered «remove to draw»: the row MAY WAIT — «Спросят после добора», «МОЖНО ПОЗЖЕ», who draws first and
 *    the cards chip; the cursor is OFFERED to it once (A = «Выбрать сейчас»), the commit rail is open;
 *  · left for after the draw: nothing is posted for it — the server asks it live once Olympus' card is in the hand,
 *    the hand album marks that card «НОВАЯ КАРТА», and the post-commit witness counts it handed on;
 *  · answered now: its album carries «R3 Решить после добора» beside «RT Не сбрасывать» (the way back), the answer lands
 *    after the draw, and BOTH draws of the one press are stages of the same flow;
 *  · Olympus answered «add a science»: nothing draws — the row is owed like any pre-select.
 *
 * (A) left for after the draw (fhd + tv4k) · (B) answered now, changed, answered again (fhd) · (C) «add» (fhd).
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, crumbText, focusCard, press, pressUntil, readiness, settle} from './consoleStart';

const OUT = path.resolve('screenshots', 'table-question-defer');
const OLYMPUS = 'Olympus Conference';
const MU = 'Mars University';
const COMPOSER = '.con-hand__stage .con-composer--play';
const ALBUM = '.con-hand[data-flow="picking"]';
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, cards: Array<{name: string}>}>,
  waitingFor?: {type: string, choiceContext?: {source?: {card?: string}}},
  thisPlayer: {tableau: Array<{name: string, resources?: number}>},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}
const handOf = (wire: Wire): Array<string> => (wire.cardsInHand ?? []).map((c) => c.name);
const olympusScience = (wire: Wire): number => wire.thisPlayer.tableau.find((c) => c.name === OLYMPUS)?.resources ?? -1;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const rowOf = (page: Page, card: string) => page.locator(`.con-composer--play .con-composer__row--reaction[data-reaction-card="${card}"]`);
const focusedRowOf = (page: Page, card: string) =>
  page.locator(`.con-composer--play .con-composer__row--reaction.con-composer__row--focused[data-reaction-card="${card}"]`);

async function barText(page: Page): Promise<string> {
  return await page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
}

/** RT → «КАРТЫ» → Mars University → A: its play composer, nothing sent. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${MU}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, MU, slots * 2 + 6), 'the cursor reached Mars University in the hand').toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    'A opens the play composer').toBe(true);
  await settle(page);
}

/** Olympus' question — its row holds the cursor on open; A opens its list; the first answer draws, the second adds. */
async function answerOlympus(page: Page, answer: 'draw' | 'add'): Promise<void> {
  await expect(focusedRowOf(page, OLYMPUS), 'Olympus\' question holds the cursor — the question the university waits for').toHaveCount(1);
  const options = page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt');
  expect(await pressUntil(page, 'Enter', async () => await options.count() > 0, {tries: 3, settleMs: 900}), 'A opens Olympus\' answers').toBe(true);
  if (answer === 'add') {
    await press(page, 'ArrowDown', 300);
  }
  expect(await pressUntil(page, 'Enter', async () => await options.count() === 0, {tries: 3, settleMs: 900}), 'the answer closes the list').toBe(true);
  await settle(page);
}

/** The university's row WAITS for Olympus: no cursor stop, nothing «missing» about it, its words say why. */
async function expectUniversityWaits(page: Page): Promise<void> {
  const mu = rowOf(page, MU);
  await expect(mu).toHaveAttribute('data-tq-state', 'locked');
  await expect(mu).not.toHaveClass(/con-composer__row--missing/);
  await expect(mu.locator('[data-tq-value]')).toContainText('Ждёт ответа');
  await expect(mu.locator('[data-tq-value]')).toContainText('Конференция на Олимпе');
  // The walk steps over it: ↓ from Olympus moves nothing (the commit rail is withheld while Olympus is unanswered).
  await press(page, 'ArrowDown', 300);
  await expect(focusedRowOf(page, OLYMPUS), 'a waiting question is no cursor stop').toHaveCount(1);
}

/** Olympus drew: the university MAY WAIT — offered to the cursor, valid as it is, the commit rail open. */
async function expectUniversityMayWait(page: Page): Promise<void> {
  const mu = rowOf(page, MU);
  await expect(mu).toHaveAttribute('data-tq-state', 'deferred');
  await expect(focusedRowOf(page, MU), 'the cursor is OFFERED the next question').toHaveCount(1);
  await expect(mu.locator('.con-composer__tq-badge--on'), '«МОЖНО ПОЗЖЕ»').toHaveCount(1);
  await expect(mu.locator('[data-tq-value]')).toContainText('Спросят после добора');
  await expect(mu.locator('[data-tq-note]')).toContainText('Сначала добор');
  await expect(mu.locator('[data-tq-note]')).toContainText('Конференция на Олимпе');
  await expect(page.locator('.con-composer__cta--ready'), 'nothing holds the commit up').toHaveCount(1);
  expect(await barText(page), 'A is «Выбрать сейчас» here').toContain('Выбрать сейчас');
}

/** From the offered row to the commit rail, then A: the play's ONE POST. */
async function commit(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
    await press(page, 'ArrowDown', 300);
  }
  await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
  await page.keyboard.press('Enter');
}

/**
 * The standing reveal as the PAD sees it: the overlay is mounted, not leaving, and the ONE command bar's A is its
 * «Взять» — i.e. the reveal is the surface a press reaches. `undefined` otherwise. The signature changes when a take
 * lands (a «Взято» mark, the next card, another batch), which is how a press is VERIFIED.
 */
async function takeableReveal(page: Page): Promise<string | undefined> {
  return await page.evaluate(() => {
    const r = document.querySelector('.con-reveal');
    if (r === null || r.classList.contains('con-task-swap-leave-active')) {
      return undefined;
    }
    const bar = (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ');
    if (!/Взять(?! всё)/.test(bar)) {
      return undefined;
    }
    return `${(r.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80)}|taken=${r.querySelectorAll('.con-reveal__takenmark').length}`;
  }) ?? undefined;
}

/**
 * Take every drawn card the flow presents until `done()` holds; returns the crumb under each DISTINCT card taken.
 *
 * ⚠ ACT → VERIFY, never a press budget spent blind (the CI flake of 2026-10-30 — 1/10 on the box, 3/12 under
 * `TM_E2E_CPU_THROTTLE=4`): the old loop spent a fixed THREE presses, each a fixed 900 ms after the reveal node
 * appeared — and the embedded reveal ABSORBS A until its batch has landed (`ConsoleRevealOverlay.handleIntent`: the
 * arrival gate), while the console already reads quiet and the bar already says «A Взять». On a starved renderer all
 * three fell inside that window: Olympus' card stood untaken («ДОБОР КАРТ», taken 0, no holds, the server asking the
 * university), the album could never rise, and the spec waited 60 s. So a press goes only to a reveal the PAD
 * reaches (`takeableReveal`), after the console is quiet, and is VERIFIED by the reveal changing; a swallowed one
 * is retried while the SAME reveal provably still stands (bounded) — never a second press on whatever the first
 * one opened (the album rises in the same hand right after the take).
 */
async function takeRevealsUntil(page: Page, done: () => Promise<boolean>, limit = 4): Promise<Array<string>> {
  const crumbs: Array<string> = [];
  const seen = new Set<string>();
  let presses = 0;
  let retries = 0;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !await done()) {
    if (seen.size > limit || retries > 4 || await takeableReveal(page) === undefined) {
      // STATE, not a sleep: the next batch (or the question) — whichever stands first.
      await page.locator('.con-reveal').first().waitFor({timeout: 500}).catch(() => undefined);
      continue;
    }
    await settle(page, {timeoutMs: 10_000}).catch(() => undefined); // the deal lands before its take
    const before = await takeableReveal(page);
    if (before === undefined || await done()) {
      continue;
    }
    const card = before.replace(/\|taken=\d+$/, '');
    if (!seen.has(card)) {
      seen.add(card);
      crumbs.push(await crumbText(page));
    }
    presses++;
    await press(page, 'Enter', 900);
    // VERIFY: the take changed the reveal (a mark, the next card, the overlay leaving) — else it was swallowed.
    const t = Date.now();
    let changed = false;
    while (!changed && Date.now() - t < 10_000) {
      changed = await done() || await takeableReveal(page) !== before;
      if (!changed) {
        await page.locator('.con-reveal').first().waitFor({state: 'detached', timeout: 250}).catch(() => undefined);
      }
    }
    retries = changed ? 0 : retries + 1;
  }
  if (!await done()) {
    const state = await page.evaluate(() => {
      const r = document.querySelector('.con-reveal');
      return {
        reveal: r === null ? null : {cls: r.className, cursorPending: r.getAttribute('data-cursor-pending'),
          taken: r.querySelectorAll('.con-reveal__takenmark').length, slots: r.querySelectorAll('[data-zoom-slot]').length},
        hand: document.querySelector('.con-hand')?.getAttribute('data-flow') ?? null,
        surfaces: [...document.querySelectorAll('.con-ws, .con-task, .con-hand, .con-composer, .con-deckdraw')].map((e) => e.className.split(' ')[0]),
      };
    });
    console.log(`[takeRevealsUntil] not done after ${presses} takes — ${JSON.stringify(state)} ready=${JSON.stringify(await readiness(page))}`);
  }
  return crumbs;
}

test.describe('a discard behind a draw — answer now, or after the draw', () => {
  test.setTimeout(300_000);

  for (const preset of PRESETS) {
    test(`(A) left for after the draw: asked live with Olympus' card in the hand, marked «НОВАЯ КАРТА» · ${preset.id}`, async ({page, request}) => {
      await page.setViewportSize(preset.viewport);
      const id = await bootFixture(page, request, 'mu-olympus', {query: preset.query});
      await openComposer(page);
      await expectUniversityWaits(page);
      await shoot(page, preset.id, '01-university-waits');

      await answerOlympus(page, 'draw');
      await expectUniversityMayWait(page);
      await shoot(page, preset.id, '02-university-may-wait');

      const before = handOf(await wireOf(request, id)).filter((n) => n !== MU);
      await commit(page);
      // Olympus' card comes first (a stage of the play), then the university's question — LIVE, as the album.
      const albumUp = async () => await page.locator(`${ALBUM} .con-hand__question [data-decline-plate]`).count() > 0;
      await takeRevealsUntil(page, albumUp, 1);
      await expect(page.locator(`${ALBUM} .con-hand__question [data-decline-plate]`), 'the university asks live, as the hand album').toHaveCount(1, {timeout: 60_000});
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
      const wire = await wireOf(request, id);
      expect(wire.waitingFor?.choiceContext?.source?.card, 'the server asks the university now').toBe(MU);
      expect(olympusScience(wire), 'Olympus spent its science on the draw').toBe(0);
      const drawn = handOf(wire).filter((n) => !before.includes(n));
      expect(drawn.length, `Olympus' card is in the hand (${handOf(wire).join(', ')})`).toBe(1);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${drawn[0]}"] [data-hand-fresh="draw"]`),
        'the card the player waited for wears «НОВАЯ КАРТА»').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot--selected[data-zoom-slot="${drawn[0]}"]`),
        'the album OPENS on it — the last card of the hand, on whichever page it stands').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot--selected[data-zoom-slot="${drawn[0]}"]`)).toBeInViewport();
      expect(await crumbText(page), 'the album is a stage of the play').toContain('Сброс карты');
      await shoot(page, preset.id, '03-live-album-new-card');

      // The player gives up the card Olympus just brought.
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, drawn[0], slots * 2 + 6), 'the cursor reached the new card').toBe(true);
      const answered = page.waitForResponse((r) => r.request().method() === 'POST' && /\/player\/input/.test(r.url()));
      await press(page, 'Enter', 900);
      await answered;
      const settledWire = async () => {
        const w = await wireOf(request, id);
        return !handOf(w).includes(drawn[0]) && w.waitingFor?.choiceContext?.source?.card !== MU;
      };
      await takeRevealsUntil(page, settledWire, 2);
      const after = handOf(await wireOf(request, id));
      expect(after.includes(drawn[0]), 'the new card discarded').toBe(false);
      expect(before.every((n) => after.includes(n)), 'the rest of the hand kept').toBe(true);
      expect(after.length, 'one card drawn back for the discard').toBe(before.length + 1);
    });
  }

  test('(B) answered now, changed back to «after the draw», answered again — the answer lands after the draw, both draws stages of one flow', async ({page, request}) => {
    await page.setViewportSize(PRESETS[0].viewport);
    const id = await bootFixture(page, request, 'mu-olympus', {query: PRESETS[0].query});
    await openComposer(page);
    await answerOlympus(page, 'draw');
    await expectUniversityMayWait(page);

    // A — «Выбрать сейчас»: the album, with BOTH buttons in its question line.
    expect(await pressUntil(page, 'Enter', async () => await page.locator(ALBUM).isVisible(), {tries: 3, settleMs: 900}), 'A opens the album').toBe(true);
    await settle(page);
    await expect(page.locator(`${ALBUM} .con-hand__question [data-defer-plate]`), '«R3 Решить после добора»').toHaveCount(1);
    await expect(page.locator(`${ALBUM} .con-hand__question [data-defer-plate]`)).toContainText('Конференция на Олимпе');
    await expect(page.locator(`${ALBUM} .con-hand__question [data-decline-plate]`), '«RT Не сбрасывать»').toHaveCount(1);
    expect(await barText(page), 'the bar names R3 too (its short form)').toContain('После добора');
    await shoot(page, 'tv4k', 'B1-album-two-buttons');
    const chosen = await page.locator('.con-hand__slot--selected').first().getAttribute('data-zoom-slot') ?? '';
    expect(chosen, 'a card under the cursor').not.toBe('');
    expect(await pressUntil(page, 'Enter', async () => await page.locator(`${COMPOSER}:visible`).count() > 0, {tries: 3, settleMs: 1200}),
      'A answers — the composer takes the row back').toBe(true);
    await settle(page);
    const mu = rowOf(page, MU);
    await expect(mu).toHaveAttribute('data-tq-state', 'early');
    await expect(mu.locator('[data-tq-value]')).toContainText('Сбросить');
    await expect(mu.locator('[data-tq-note]')).toContainText('до добора');
    await shoot(page, 'tv4k', 'B2-answered-now');

    // Changed mind: back into the album, R3 — the answer let go, the row may wait again.
    for (let i = 0; i < 6 && await focusedRowOf(page, MU).count() === 0; i++) {
      await press(page, 'ArrowUp', 300);
    }
    expect(await pressUntil(page, 'Enter', async () => await page.locator(ALBUM).isVisible(), {tries: 3, settleMs: 900}), 'A re-opens the album').toBe(true);
    await settle(page);
    expect(await pressUntil(page, 'KeyV', async () => await page.locator(`${COMPOSER}:visible`).count() > 0, {tries: 3, settleMs: 1200}),
      'R3 — «Решить после добора» returns to the composer').toBe(true);
    await settle(page);
    await expect(mu).toHaveAttribute('data-tq-state', 'deferred');

    // …and answered again, for real.
    for (let i = 0; i < 6 && await focusedRowOf(page, MU).count() === 0; i++) {
      await press(page, 'ArrowUp', 300);
    }
    expect(await pressUntil(page, 'Enter', async () => await page.locator(ALBUM).isVisible(), {tries: 3, settleMs: 900}), 'A opens the album').toBe(true);
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, chosen, slots * 2 + 6), `the cursor reached ${chosen}`).toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(`${COMPOSER}:visible`).count() > 0, {tries: 3, settleMs: 1200}),
      'A answers').toBe(true);
    await settle(page);
    await expect(mu).toHaveAttribute('data-tq-state', 'early');

    const before = handOf(await wireOf(request, id)).filter((n) => n !== MU);
    await commit(page);
    // The server answers the whole batch at once; the flow then PRESENTS it — the first batch rises in the play's zone…
    await expect(page.locator('.con-reveal').first(), 'the first draw is presented').toBeVisible({timeout: 60_000});
    // …and the flow is over only when the server is settled AND the workspace has let go (no batch left, no frame).
    const done = async () => {
      const w = await wireOf(request, id);
      return !handOf(w).includes(MU) && !handOf(w).includes(chosen) && w.waitingFor?.choiceContext === undefined &&
        await page.locator('.con-reveal').count() === 0 && await page.locator('.con-hand__frame').count() === 0;
    };
    // «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» (2026-10-26): both answers landed with the press, so the two draws of the one
    // press are ONE batch — Olympus' card and the one the discard buys stand in one row, taken once.
    await expect(page.locator('[data-reveal-received] .con-ws-stage-badge__num'), 'ПОЛУЧЕНО 2 — one batch of both draws').toHaveText('2', {timeout: 30_000});
    const batches = (await wireOf(request, id)).cardDrawReveals ?? [];
    expect(batches.length, 'ONE batch on the wire for the press').toBe(1);
    const crumbs = await takeRevealsUntil(page, done, 3);
    expect(crumbs.length, 'the one batch presented (and taken) as a stage of the play').toBeGreaterThan(0);
    for (const crumb of crumbs) {
      expect(crumb, 'each draw is a stage of the play — never a standalone band over the board').toContain('Марсианский университет');
    }
    const after = handOf(await wireOf(request, id));
    expect(after.includes(chosen), `${chosen} discarded`).toBe(false);
    expect(after.length, 'Olympus drew one, the university swapped one').toBe(before.length + 1);
  });

  test('(C) «add a science» — nothing draws: the university is owed like any pre-select', async ({page, request}) => {
    await page.setViewportSize(PRESETS[0].viewport);
    await bootFixture(page, request, 'mu-olympus', {query: PRESETS[0].query});
    await openComposer(page);
    await answerOlympus(page, 'add');
    const mu = rowOf(page, MU);
    await expect(mu).toHaveAttribute('data-tq-state', 'plain');
    await expect(mu).toHaveClass(/con-composer__row--missing/);
    await expect(focusedRowOf(page, MU), 'the owed question takes the cursor').toHaveCount(1);
    await expect(mu.locator('[data-tq-note]')).toContainText('Новая карта до вопроса не придёт');
    await expect(page.locator('.con-composer__cta--ready'), 'the commit waits for it').toHaveCount(0);
    await shoot(page, 'tv4k', 'C1-owed');
  });
});
