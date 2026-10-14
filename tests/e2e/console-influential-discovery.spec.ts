import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR51 «СУДЬБОНОСНОЕ ОТКРЫТИЕ» — «1 science OR 6 data to ANY card», and the stand of the choice-grammar iteration
 * (the owner's decisions of 2026-10-12: the option IS the card's printed row; «strictly pre-select» includes the
 * player's own table). Against a real server, on two profiles, three tables:
 *
 *   (A) BOTH KINDS (Physics Complex · Search for Life · TR15 with 1 data · TR48 · Martian Fiber): two live tiles, each
 *       leading with the card's OWN printed row of its branch, the data tile carrying the table's answer (Fiber's M€);
 *       the cursor on the unchosen tile reads apart from the answer (the ONE seal); the data option → the embedded
 *       target step → TR15 → A → EXACTLY ONE POST, the branch pick and the target ADDRESSED; the server: TR15 7 data,
 *       Fiber +6 M€.
 *   (B) THE TABLE ASKS (Olympus Conference with 1 science · Mars University · Supercomputer): two «⚡ Сработает · <карта>
 *       · ваш выбор» rows answered BEFORE the press; Olympus' «remove to draw» hands Mars University's discard on as a
 *       named follow-up (a card that draw brings may be the one to discard) and «add» brings the row back; Mars
 *       University «do nothing», Olympus «add» → ONE POST carrying both table answers ADDRESSED to their askers; the
 *       server applied them as chosen; nothing asked after the press.
 *   (C) NO HOLDER: both tiles refused (the loss named ONCE, in the strip — PL-171), the card still plays; one POST.
 *
 * Every test also runs the harness's witnesses: RE-ASKED PRE-SELECT and POST-COMMIT CHOICE (a choice asked after the
 * press whose answer was known before it). Fixtures `influential-discovery`, `-askers`, `-none`. Heavy 4K: `--workers=1`.
 */

const CARD = 'Influential Discovery';
const CARD_RU = 'Судьбоносное открытие';
const OUT = path.resolve('screenshots', 'influential-discovery');
const PLAY = '.con-composer--play';
const TILES = `${PLAY} .con-composer__variants .con-vchoice__opt`;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {thisPlayer: {megacredits: number, tableau: Array<{name: string, resources?: number}>, cardsInHandNbr?: number}};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  return out;
}

async function openPlayComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** The «ИЛИ» group as the player reads it: each tile's print, words, state. */
async function tiles(page: Page): Promise<Array<{text: string, print: boolean, off: boolean, selected: boolean, focused: boolean, sealed: boolean}>> {
  return page.locator(TILES).evaluateAll((els) => els.map((el) => ({
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    print: el.querySelector('[data-vchoice-print] .pcard-mi') !== null,
    off: el.classList.contains('con-vchoice__opt--off'),
    selected: el.classList.contains('con-vchoice__opt--selected'),
    focused: el.classList.contains('con-vchoice__opt--focused'),
    sealed: el.querySelector('.con-vchoice__seal--on') !== null,
  })));
}

/** Walk the cursor onto tile `n` of the group (←/→ side by side, ↑/↓ stacked). */
async function focusTile(page: Page, n: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const at = (await tiles(page)).findIndex((t) => t.focused);
    if (at === n) {
      return;
    }
    await press(page, at < 0 ? 'ArrowUp' : at < n ? 'ArrowRight' : 'ArrowLeft', 350);
  }
  expect((await tiles(page)).findIndex((t) => t.focused), `the cursor reaches tile ${n}`).toBe(n);
}

/** Focus the decision row of `card`'s table question and answer it with option `index` (A opens, the cursor walks, A takes). */
async function answerReaction(page: Page, card: string, index: number): Promise<void> {
  const row = page.locator(`${PLAY} .con-composer__row--reaction[data-reaction-card="${card}"]`);
  await expect(row, `the «Сработает · ${card}» row stands`).toHaveCount(1);
  // The row may stand ABOVE the cursor (a later question is offered the cursor once the one above is answered).
  for (let i = 0; i < 6 && await row.evaluate((el) => !el.classList.contains('con-composer__row--focused')); i++) {
    await press(page, 'ArrowUp', 300);
  }
  for (let i = 0; i < 10 && await row.evaluate((el) => !el.classList.contains('con-composer__row--focused')); i++) {
    await press(page, 'ArrowDown', 300);
  }
  for (let i = 0; i < 3 && await page.locator(`${PLAY} .con-composer__sublist`).count() === 0; i++) {
    await press(page, 'Enter', 700);
  }
  const options = page.locator(`${PLAY} .con-composer__sublist .con-vchoice__opt`);
  await expect(options.first(), `${card}'s options open`).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const at = await options.evaluateAll((els) => els.findIndex((el) => el.classList.contains('con-vchoice__opt--focused')));
    if (at === index) {
      break;
    }
    await press(page, at < index ? 'ArrowDown' : 'ArrowUp', 300);
  }
  await press(page, 'Enter', 800);
  await expect(page.locator(`${PLAY} .con-composer__sublist`), 'the answer closes the list').toHaveCount(0);
}

/**
 * DECLINE `card`'s table question whose one answer is a card from the hand (Mars University): A on its row opens the
 * HAND ALBUM directly — no option list (2026-10-13) — and RT there is the refusal, named by the plate in the album's
 * question line; the composer takes the row back, answered.
 */
async function declineHandReaction(page: Page, card: string): Promise<void> {
  const row = page.locator(`${PLAY} .con-composer__row--reaction[data-reaction-card="${card}"]`);
  await expect(row, `the «Сработает · ${card}» row stands`).toHaveCount(1);
  for (let i = 0; i < 10 && await row.evaluate((el) => !el.classList.contains('con-composer__row--focused')); i++) {
    await press(page, 'ArrowDown', 300);
  }
  const album = page.locator('.con-hand[data-flow="picking"]');
  for (let i = 0; i < 3 && await album.count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(album, `${card}'s question opens the hand album directly`).toBeVisible({timeout: 15_000});
  expect(await page.locator(`${PLAY} .con-composer__sublist`).count(), 'no option list before the album').toBe(0);
  await expect(page.locator('.con-hand__question [data-decline-plate]'), 'the decline is named in the album\'s question line').toBeVisible();
  await settle(page);
  for (let i = 0; i < 3 && await page.locator(`${PLAY}:visible`).count() === 0; i++) {
    await press(page, 'Period', 1400);
  }
  await expect(page.locator(`${PLAY}:visible`), 'RT declines and hands the row back').toHaveCount(1, {timeout: 15_000});
  await expect(row).not.toHaveClass(/con-composer__row--missing/);
  await settle(page);
}

async function openTargetStep(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 6 && await step.count() === 0; i++) {
    if (await page.locator(`${PLAY} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 600);
    }
    if (await page.locator(`${TILES}.con-vchoice__opt--focused`).count() > 0) {
      await press(page, 'ArrowDown', 600);
    }
    await press(page, 'Enter', 1200);
  }
  await expect(step, 'the embedded played-target step opens').toHaveCount(1, {timeout: 10_000});
  await settle(page);
}

async function pickTarget(page: Page, card: string): Promise<void> {
  const step = page.locator('.con-ptsel');
  const focused = () => page.evaluate(() => document.querySelector('.con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 10 && !(await focused()).includes(card); i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await focused(), `the cursor reaches «${card}»`).toContain(card);
  for (let i = 0; i < 4 && await step.count() > 0; i++) {
    await press(page, 'Enter', 1100);
  }
  await expect(step, 'A on the candidate answers the target').toHaveCount(0, {timeout: 8000});
  await settle(page);
}

async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 10 && await page.locator(`${PLAY} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  await expect(page.locator(`${PLAY} .con-composer__cta--ready`), 'the commit rail is ready — every question answered').toHaveCount(1);
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

type Answer = {type: string, index?: number, cards?: Array<string>, for?: {role: string, source?: {card?: string}}};
const batchOf = (post: string) => (JSON.parse(post) as {responses?: Array<Answer>}).responses ?? [];

for (const preset of PRESETS) {
  test.describe(`TR51 Influential Discovery · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) both kinds: two printed tiles, the cursor apart from the answer, the data option → TR15 — ONE POST, addressed; Fiber +6 M€ (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'influential-discovery', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, 'Martian Census'), 'the fixture: TR15 holds 1 data').toBe(1);

      await openPlayComposer(page);
      let group = await tiles(page);
      expect(group.length, 'two options').toBe(2);
      expect(group.every((t) => t.print), 'each option leads with the card\'s printed row of its branch').toBe(true);
      expect(group.every((t) => !t.off), 'both options live').toBe(true);
      expect(group.some((t) => t.selected), 'nothing is chosen for the player').toBe(false);
      await expect(page.locator(`${PLAY} .con-composer__variants .con-vchoice__or-medal`), 'ONE «ИЛИ» medallion on the seam').toHaveCount(1);
      await expect(page.locator(TILES).nth(1).locator('[data-forecast-vfx]'), 'the data option carries the table\'s answer (Fiber)').toHaveCount(1);
      await shoot(page, preset.id, 'a-01-composer');

      // The science option chosen, the cursor walked onto the data option: two facts, two paints.
      await focusTile(page, 0);
      await press(page, 'Enter', 600);
      await focusTile(page, 1);
      group = await tiles(page);
      expect([group[0].selected, group[0].sealed, group[0].focused], 'the answer wears the seal').toEqual([true, true, false]);
      expect([group[1].selected, group[1].sealed, group[1].focused], 'the cursor reads apart from it').toEqual([false, false, true]);
      await shoot(page, preset.id, 'a-02-answer-and-cursor');

      // …then the data option is the answer.
      await press(page, 'Enter', 700);
      group = await tiles(page);
      expect(group.map((t) => t.selected), 'A on the data option moves the answer').toEqual([false, true]);
      await openTargetStep(page);
      await expect(page.locator('.con-ptsel [data-zoom-slot]'), 'the data holders are the candidates').not.toHaveCount(0);
      await shoot(page, preset.id, 'a-03-target');
      await pickTarget(page, 'Martian Census');
      expect(seen.posts, 'nothing sent before the play\'s own A').toEqual([]);

      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      const pick = batch.find((r) => r.type === 'or' && r.for?.source?.card === CARD);
      const target = batch.find((r) => r.type === 'card');
      expect(pick?.for, 'the branch pick is ADDRESSED to the card\'s own choice').toMatchObject({role: 'or'});
      expect(target?.cards, 'the target is TR15').toEqual(['Martian Census']);
      expect(target?.for, 'the target is ADDRESSED to the card\'s own pick').toMatchObject({role: 'card', source: {card: CARD}});

      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Martian Census'), {timeout: 30_000, message: 'TR15 holds 7 data'}).toBe(7);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'Martian Fiber +6 M€ against the card\'s 4').toBe(2);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-04-board');
    });

    test(`(B) the table asks — Olympus and Mars University answered in the composer; a draw above lets the discard wait; ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'influential-discovery-askers', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);

      await openPlayComposer(page);
      const rows = page.locator(`${PLAY} .con-composer__row--reaction`);
      await expect(rows, 'two questions of the table, before any variant is chosen').toHaveCount(2);
      await expect(rows.first()).toHaveAttribute('data-reaction-card', 'Olympus Conference');
      await expect(rows.nth(1)).toHaveAttribute('data-reaction-card', 'Mars University');
      // The discard WAITS for Olympus' answer (2026-10-15): whether a card arrives before it depends on it.
      await expect(rows.nth(1), 'the discard waits for Olympus').toHaveAttribute('data-tq-state', 'locked');
      await expect(page.locator(`${PLAY} .con-composer__cta--ready`), 'the play waits for its questions').toHaveCount(0);
      await shoot(page, preset.id, 'b-01-rows');

      // Olympus «remove a science to draw» — the discard below it MAY WAIT for that card: still a row, never a «ДАЛЕЕ».
      await answerReaction(page, 'Olympus Conference', 0);
      const universityRow = page.locator(`${PLAY} .con-composer__row--reaction[data-reaction-card="Mars University"]`);
      await expect(universityRow, 'the discard stays a row').toHaveCount(1);
      await expect(universityRow, '«Спросят после добора» — answerable now, or after the draw').toHaveAttribute('data-tq-state', 'deferred');
      await expect(page.locator(`${PLAY} .con-composer__next`).filter({hasText: /Марсианский университет/i}), 'no «ДАЛЕЕ» line for it').toHaveCount(0);
      await shoot(page, preset.id, 'b-02-may-wait');
      // …and «add a science» makes it an ordinary question again (nothing draws before it).
      await answerReaction(page, 'Olympus Conference', 1);
      await expect(universityRow, 'the discard is owed again').toHaveAttribute('data-tq-state', 'plain');
      await declineHandReaction(page, 'Mars University');

      // The card's own choice: the data option → Supercomputer.
      await focusTile(page, 1);
      await press(page, 'Enter', 700);
      await openTargetStep(page);
      await pickTarget(page, 'Supercomputer');
      // The table's answers are the PLAY's: choosing a variant after them keeps both answers AND their words.
      await expect(page.locator(`${PLAY} .con-composer__row--reaction .con-composer__row-empty`), 'no answered question reads «choose» again').toHaveCount(0);
      await shoot(page, preset.id, 'b-03-answered');

      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      const olympus = batch.find((r) => r.for?.source?.card === 'Olympus Conference');
      const university = batch.find((r) => r.for?.source?.card === 'Mars University');
      expect(olympus, 'Olympus\' answer rides the batch, ADDRESSED').toMatchObject({type: 'or', index: 1, for: {role: 'or'}});
      expect(university, 'Mars University\'s answer rides the batch, ADDRESSED').toMatchObject({type: 'or', index: 1, for: {role: 'or'}});

      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Supercomputer'), {timeout: 30_000, message: 'Supercomputer holds 6 data'}).toBe(6);
      const after = await wireOf(request, playerId);
      expect(resourcesOf(after, 'Olympus Conference'), 'Olympus: «add» — the answer given before the press').toBe(resourcesOf(before, 'Olympus Conference') + 1);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.posts.length, 'nothing was asked after the press — one POST for the whole play').toBe(1);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(C) no holder: both options refused, the loss named once, the card still plays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'influential-discovery-none', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);

      await openPlayComposer(page);
      const group = await tiles(page);
      expect(group.map((t) => t.off), 'both options refused — shown, never hidden').toEqual([true, true]);
      await expect(page.locator(`${PLAY} .con-composer__warn`), 'the two losses NAMED in the strip').toHaveCount(2);
      await expect(page.locator(`${TILES} .con-vchoice__reason`), 'one loss, one voice — no second reason on the tiles').toHaveCount(0);
      await shoot(page, preset.id, 'c-01-composer');

      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD),
        {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      void CARD_RU;
    });
  });
}
