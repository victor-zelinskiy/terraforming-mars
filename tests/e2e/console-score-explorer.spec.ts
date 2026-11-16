import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, playCardFromHand, press, pressUntil, settle, soloGameConfig, visibleSurfaces} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

/**
 * THE SCORE EXPLORER — the Information workspace's victory-points subtree:
 *
 *   summary tile → (shared-element entry) → scoring OVERVIEW (no scroll)
 *     → a CATEGORY's detail (TR provenance / the cards hub / fact rows)
 *       → a card FAMILY's table + the live PREVIEW column
 *         → X — the ONE console fullscreen inspector (physical origin,
 *           B lands the card back in the preview, no duplicates ever)
 *
 * This spec drives a real human+MarsBot game with three guaranteed no-req
 * VP starters played from the hand (Ganymede Colony · Vesta Shipyard ·
 * Asteroid Mining — a conditional jovian scorer + two fixed printers, so
 * the families, the formulas and the sorting are real), then walks the
 * whole vertical and asserts the load-bearing contracts:
 *
 *  1. NO SCROLL on the overview — the whole scoring picture in one viewport
 *     (asserted at 1080, 4K and the Deck profile).
 *  2. ONE BAR SEMANTIC — the share fill is value/positiveTotal (23 of 39
 *     may never read as a full bar again).
 *  3. TR PROVENANCE — Σ of the named rows ≡ the displayed rating.
 *  4. FORMULAS — a conditional row speaks its own arithmetic («3 × 1 ПО»),
 *     never one universal sentence; rows sort by current VP desc.
 *  5. FULLSCREEN PHYSICALITY — X lifts the PREVIEW card itself (the slot
 *     holds empty under the flight), B returns it, focus/scroll survive.
 *  6. PARITY — LB/RB keeps the semantic depth for the bot (same grid, same
 *     order, no «Подсчёт бота»), and switches back without a jump.
 *
 * Also the screenshot + video source (screenshots/score-explorer/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'score-explorer');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others sweep fit + parity. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

/** Conditional (1 VP / jovian) + two fixed printers — all requirement-free. */
const VP_CARDS = ['Ganymede Colony', 'Vesta Shipyard', 'Asteroid Mining'];

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ScoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.31,
  automa: {difficulty: 'normal'},
  // The dev guaranteed-cards mechanism: the named projects go ON TOP of the
  // deck (Deck.putOnTop, applied after the solo neutral player's draws), so
  // the FIRST deal offers all three — no random-deal retries.
  customProjectCards: VP_CARDS,
});

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await press(page, code, settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const crumbStage = (page: Page) => page.locator('.con-info .con-wshead__step');
const botOnStage = (page: Page) => page.locator('.con-info .con-info__corp--bot');

/**
 * RB along the seat ring until `want` is on stage — act → verify: each press gets its whole window to show the seat
 * before another goes (a ring of two: a second press on a seat that is merely late flips it straight back).
 */
async function cycleTo(page: Page, want: 'bot' | 'human'): Promise<void> {
  const onStage = async () => (await botOnStage(page).count() > 0) === (want === 'bot');
  expect(await pressUntil(page, 'KeyE', onStage, {tries: 4, settleMs: 900}),
    `the seat ring must reach the ${want} participant`).toBeTruthy();
}

/** Open the Information workspace, acknowledging whatever cinematic stands. */
async function openInfo(page: Page): Promise<void> {
  const workspace = page.locator('.con-info');
  for (let i = 0; i < 10 && await workspace.count() === 0; i++) {
    if (i > 0) {
      await key(page, 'Enter', 700);
      await key(page, 'Escape', 500);
    }
    await key(page, 'KeyY', 1100);
  }
  await expect(workspace,
    `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
}

/** A container proves «no scroll»: its content fits its own box — measured AT REST (an entrance's transform is
 *  scrollable overflow while it runs). */
async function expectFits(page: Page, selector: string, label: string): Promise<void> {
  const verdict = await readSettled(page, () => page.locator(selector).first().evaluate((el) => ({
    sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth,
  })), {message: `${label}: its box`});
  expect(verdict.sh, `${label}: content height ${verdict.sh} must fit ${verdict.ch}`)
    .toBeLessThanOrEqual(verdict.ch + 2);
  expect(verdict.sw, `${label}: content width ${verdict.sw} must fit ${verdict.cw}`)
    .toBeLessThanOrEqual(verdict.cw + 2);
}

/**
 * THE TABLE'S TEXT SCALES WITH THE PROFILE (PL-095). A text node with no size
 * of its own inherits the page's UNSCALED root size (23px): right at 1080 by
 * coincidence (1.15rem), half-size on a 4K TV and too big — cut — on the Deck.
 * The preview column's card name did exactly that while the profile ladders
 * sized the row's name. Two claims: the preview names the focused card at its
 * ROW's size (one card, one name, one size), and on the TV no text of the table
 * renders below the couch type floor (`--con-t-floor`, 0.8rem) — the runtime
 * twin of `consoleTvTypeFloor.spec`, which reads declarations and cannot see an
 * inherited size. The card face in the preview is not table text (its own zoom).
 */
async function expectTableTextScales(page: Page, label: string): Promise<void> {
  // Read AT REST (the rows' entrance cascade over): the same sizes twice, a frame apart.
  const v = await readSettled(page, () => tableTextSizes(page), {message: `${label}: the table's text sizes`});
  expect(v.row, `${label}: a focused row`).toBeDefined();
  expect(v.preview, `${label}: the preview column names the focused card at its row's size`).toBe(v.row);
  expect(v.small, `${label}: on the TV no table text renders below the couch type floor`).toEqual([]);
}

/** The focused row's and the preview's font sizes, and every painted table text below the couch floor. */
function tableTextSizes(page: Page): Promise<{row: string | undefined, preview: string | undefined, small: Array<string>}> {
  return page.locator('.con-vpx__table').first().evaluate((table) => {
    const px = (el: Element | null) => el === null ? undefined : getComputedStyle(el).fontSize;
    const tv = document.documentElement.classList.contains('con-profile-tv');
    const floor = tv ? 0.8 * parseFloat(getComputedStyle(document.documentElement).fontSize) : 0;
    const small: Array<string> = [];
    table.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.closest('.con-vpx__preview-card') !== null) {
        return;
      }
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (ownText && el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < floor - 0.5) {
        small.push(`${el.className.toString().split(' ')[0]} ${getComputedStyle(el).fontSize}`);
      }
    });
    return {
      row: px(table.querySelector('.con-vpx__row--focused .con-vpx__row-name')),
      preview: px(table.querySelector('.con-vpx__preview-name')),
      small,
    };
  });
}

/** Walk the overview grid cursor onto a category tile (row/col arithmetic —
 *  the grid is row-major with a profile-fixed column count). Each step is
 *  act → verify: the press gets its whole window to MOVE the focus before the
 *  next one is computed from where it stands (a late focus re-read as «not
 *  moved» walked one tile too far, then back). */
async function focusTile(page: Page, tileKey: string): Promise<void> {
  const keys = await page.locator('.con-vpx__tile').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-vpx-tile') ?? ''));
  const target = keys.indexOf(tileKey);
  expect(target, `the ${tileKey} tile must exist (have: ${keys.join(', ')})`).toBeGreaterThanOrEqual(0);
  const cols = await page.locator('.con-vpx__grid').evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  const focusedAt = () => page.locator('.con-vpx__tile').evaluateAll(
    (els) => els.findIndex((el) => el.classList.contains('con-vpx__tile--focused')));
  for (let guard = 0; guard < 16; guard++) {
    const at = await focusedAt();
    if (at === target) {
      return;
    }
    const [ar, ac] = [Math.floor(at / cols), at % cols];
    const [tr, tc] = [Math.floor(target / cols), target % cols];
    const dir = tr > ar ? 'ArrowDown' : tr < ar ? 'ArrowUp' : tc > ac ? 'ArrowRight' : 'ArrowLeft';
    await pressUntil(page, dir, async () => await focusedAt() !== at, {tries: 1, settleMs: 260});
  }
  expect.soft(false, `could not reach the ${tileKey} tile`).toBeTruthy();
}

const focusedRowName = (page: Page) =>
  page.locator('.con-vpx__row--focused .con-vpx__row-name').textContent();

/** What the zero-state probe sees in one state of the page: the zero categories ON SCREEN, and how many paint bright. */
type ZeroSeen = {shown: number, hot: number};

/**
 * THE ZERO-STATE PROBE, RECORDED (FLAKE ZERO — `armWitness`, armed before the B that runs the reverse morph): every
 * zero category on screen (a box of at least 4 px) and how many of them paint above 0.75 opacity, in every state the
 * product writes and every frame. «Never bright» is a claim about what a frame paints, so the record is `settled`
 * (the state a task LEAVES — never an element mounted at its default opacity a microtask before its cascade starts).
 */
function armZeroWitness(page: Page, name: string): Promise<Witness<ZeroSeen>> {
  return armWitness<ZeroSeen>(page, name, () => {
    let shown = 0;
    let hot = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-infovp__cat--zero'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        continue;
      }
      shown++;
      if (parseFloat(getComputedStyle(el).opacity) > 0.75) {
        hot++;
      }
    }
    return {shown, hot};
  }, {settled: true});
}

/** Stop the zero record and fold it: the states with a zero category on screen, and those with one painting bright. */
async function zeroQuietVerdict(w: Witness<ZeroSeen>): Promise<{samples: number, hot: number}> {
  const seen = (await w.stop()).filter((s) => s.v.shown > 0);
  return {samples: seen.length, hot: seen.filter((s) => s.v.hot > 0).length};
}

// The flow video (the journey preset's run is the deliverable) — a per-
// describe `video` forces a new worker, so it rides the top-level use.
test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});

for (const preset of PRESETS) {
  test.describe(`score explorer · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: 1,
      screen: preset.viewport,
    });

    test('the victory-points vertical: overview → category → table → fullscreen', async ({page, request}) => {
      test.setTimeout(560_000);

      // A page error anywhere in the vertical is a finding, not noise.
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        cards: VP_CARDS, // guaranteed in the deal AND bought by the seeder
        query: preset.profileQuery,
      });

      // ── MATERIAL: play the three starters through the real hand flow. ──
      for (const card of VP_CARDS) {
        expect(await playCardFromHand(page, card), `${card} must play`).toBeTruthy();
      }
      // The plays' scenes are over — the board at rest before the next workspace.
      await settle(page, {timeoutMs: 30_000});

      // ── MATERIAL: fund an award through the real MA workspace (RB →
      // descend → commit past the 400ms arm) — the podium the awards
      // collection and the X inspection will read. A 0–0 metric is a
      // SHARED first place: both seats then hold a real scoring row. ──
      if (preset.journey) {
        const maScreen = page.locator('.con-ma');
        for (let i = 0; i < 6 && await maScreen.count() === 0; i++) {
          if (i > 0) {
            await key(page, 'Enter', 600);
            await key(page, 'Escape', 500);
          }
          await key(page, 'KeyE', 1300); // RB → «НАГРАДЫ»
        }
        await expect(maScreen, 'the awards workspace must open').toHaveCount(1);
        await key(page, 'Enter', 1000); // descend into the focused award
        await key(page, 'Enter', 1000); // fund (the commit sits past the arm)
        await page.waitForSelector('.con-ma', {state: 'detached', timeout: 40_000});
        // The funding's ceremony and its VP token are over — the board at rest.
        await settle(page, {timeoutMs: 30_000});
      }

      // ── LEVEL 0 → 1: the summary tile opens into the overview. ────────
      await openInfo(page);
      await shoot(page, preset, '01-summary');
      await expect(page.locator('.con-info__zone--vp.con-info__zone--focused')).toHaveCount(1);
      // The tile's total is the reference the hero must repeat — read AT REST (never a count-up caught mid-way).
      const summaryTotal = await readSettled(page, async () => (await page.locator('.con-infovp__total').textContent() ?? '').trim(),
        {message: 'the summary tile\'s total'});
      expect(Number(summaryTotal), 'the summary total is a real number').toBeGreaterThan(20);

      // THE SHARED-ELEMENT ENTRY, recorded: a TOTAL-carrying node (the
      // tile's, the flight PROXY's — a clone carries the same anchor — or
      // the hero's) must be PAINTED in every state of the transition. A
      // RECORD from before the press (FLAKE ZERO — `armWitness`, the
      // product's own writes and every frame), `settled` — «never dark» is a
      // claim about what a frame can paint, so a sample is the state a task
      // LEAVES, never the gap between the tile's hand-off and the proxy's
      // mount inside one task.
      const gap = await armWitness(page, 'vpx-total-painted', () => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-vpx-total]'));
        return nodes.some((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 4 && r.height > 4;
        });
      }, {settled: true});
      await key(page, 'Enter', 1100); // A → the score explorer
      const gapSamples = await gap.stop();
      const dark = gapSamples.filter((s) => !s.v);
      // The floor only catches a DEAD recorder (it keeps a value only when it
      // CHANGES — its count is the number of distinct states, never of frames).
      expect(gapSamples.length, 'the frame probe must have sampled the entry').toBeGreaterThan(0);
      expect(dark.length, `the total never misses a frame (${dark.length}/${gapSamples.length} dark states)`).toBe(0);
      const explorer = page.locator('.con-vpx');
      await expect(explorer).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки/i);
      // THE SAME TOTAL — the hero carries the number the tile showed.
      await expect(page.locator('.con-vpx__total')).toHaveText(summaryTotal);

      // NO SCROLL: the whole scoring picture fits one viewport.
      await expectFits(page, '.con-vpx__overview', 'the overview');
      await expectFits(page, '.con-vpx__grid', 'the category grid');
      const tileCount = await page.locator('.con-vpx__tile').count();
      expect(tileCount, 'every core category is a door').toBeGreaterThanOrEqual(6);
      // NO FALSE PROGRESS: a category card never draws a share track — the
      // top segmented bar is the ONE place shares live; every card explains
      // its own subtotal through the source ledger instead.
      await expect(page.locator('.con-vpx__tile-ledger')).toHaveCount(tileCount);
      const trLedgerText = (await page.locator('[data-vpx-tile="tr"] .con-vpx__tile-ledger').textContent() ?? '').trim();
      expect(trLedgerText, 'the TR card speaks its arithmetic (start term present)').toMatch(/20\s*старт/i);
      // THE FOCUS↔SEGMENT LINK: the focused tile's stripe stays lit, the
      // rest recede; the share line names the share as secondary info. A
      // ZERO category has no stripe — the bar rests whole, «0 ПО» answers.
      await expect(page.locator('.con-vpx__seg.con-eg-cat--tr')).not.toHaveClass(/--dim/);
      await expect(page.locator('.con-vpx__shareline')).toContainText(/\/\s*\d+\s*·\s*\d+%/);
      // The bar's width, both sides of the comparison read AT REST (a tenth of a pixel — subpixel noise is not motion).
      const barWidth = () => readSettled(page, async () => Math.round(((await page.locator('[data-vpx-bar]').boundingBox())?.width ?? 0) * 10) / 10,
        {message: 'the share bar\'s width'});
      const barWidthBefore = await barWidth();
      await key(page, 'ArrowRight', 350); // → «Достижения» (zero)
      await expect(page.locator('.con-vpx__seg--dim'), 'a zero focus dims nothing — no stripe to link').toHaveCount(0);
      await expect(page.locator('.con-vpx__shareline')).toContainText(/0\s*ПО/);
      await focusTile(page, 'cards'); // a SCORING category
      await expect(page.locator('.con-vpx__seg:not(.con-vpx__seg--dim)'), 'exactly one stripe is lit for the focused scoring card').toHaveCount(1);
      await expect(page.locator('.con-vpx__seg.con-eg-cat--cards')).not.toHaveClass(/--dim/);
      const barWidthAfter = await barWidth();
      expect(Math.abs(barWidthAfter - barWidthBefore),
        'focus never moves the bar\'s geometry').toBeLessThanOrEqual(1);
      await focusTile(page, 'tr');
      // Zero categories stay IN the list, compact ink.
      await expect(page.locator('.con-vpx__tile--zero').first()).toBeVisible();
      await shoot(page, preset, '02-overview');

      if (!preset.journey) {
        // The sweep presets: parity + fit at depth, then home.
        await cycleTo(page, 'bot');
        await expect(page.locator('.con-vpx__grid')).toHaveCount(1);
        await expect(page.locator('.con-vpx__tile')).toHaveCount(tileCount);
        await expect(explorer).not.toContainText('Подсчёт бота');
        await expectFits(page, '.con-vpx__overview', 'the bot overview');
        await shoot(page, preset, '03-overview-bot');
        await cycleTo(page, 'human');
        await focusTile(page, 'cards');
        await key(page, 'Enter', 1000);
        await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
        await shoot(page, preset, '04-cards-hub');
        // The CONDITIONAL family door (Ganymede Colony's row): the first door is the resource family,
        // dead in this game — Enter there opens nothing, and every table claim below used to skip.
        // Act → verify: each → gets its whole window to land the focus on the door before another goes.
        await pressUntil(page, 'ArrowRight',
          async () => await page.locator('[data-vpx-group="cards-conditional"].con-vpx__group--focused').count() > 0, {tries: 3, settleMs: 300});
        await key(page, 'Enter', 1100);
        await expect(page.locator('.con-vpx__table'), 'the conditional family table opens').toHaveCount(1);
        if (await page.locator('.con-vpx__table').count() > 0) {
          await expectFits(page, '.con-vpx__table', 'the family table');
          if (await page.locator('.con-vpx__row').count() > 0) {
            await expectTableTextScales(page, 'the family table');
          }
          await shoot(page, preset, '05-table');
        }
        await key(page, 'KeyY', 900);
        await expect(page.locator('.con-info')).toHaveCount(0);
        return;
      }

      // ── LEVEL 2: TR provenance — Σ rows ≡ the displayed rating. ───────
      await focusTile(page, 'tr');
      const trTileValue = Number(await page.locator('[data-vpx-tile="tr"] .con-vpx__tile-value').textContent());
      await key(page, 'Enter', 1100);
      await expect(page.locator('.con-vpx__cat')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки.*Рейтинг/i);
      // The rows are a live list (their cascade may still be arriving) — the sum is POLLED, the rows read after it.
      await expect.poll(async () => (await page.locator('.con-vpx__trrow-value').allTextContents()).reduce((a, t) => a + Number(t), 0),
        {message: 'Σ of the named TR rows ≡ the rating'}).toBe(trTileValue);
      const trRows = await page.locator('.con-vpx__trrow-value').allTextContents();
      await expect(page.locator('.con-vpx__trsum b')).toHaveText(String(trTileValue));
      await expect(page.locator('.con-vpx__trrow--base')).toContainText(/Стартовый рейтинг/i);
      // The ARITHMETIC STORY: the first term bare, «+» past it, the running
      // chain ends exactly at the displayed rating.
      expect(trRows[0], 'the start term renders bare').not.toMatch(/^\+/);
      const running = await page.locator('.con-vpx__trrow-run').allTextContents();
      expect(running[running.length - 1]).toMatch(new RegExp(`→\\s*${trTileValue}$`));
      await shoot(page, preset, '03-tr-provenance');
      await key(page, 'Escape', 1000); // B → the overview, cursor back on TR
      // A starved parallel worker finishes the fold late (the guarded
      // episode's safety timer), never NOT — budget for load, not for hope.
      await expect(page.locator('.con-vpx__cat')).toHaveCount(0, {timeout: 15_000});
      await expect(page.locator('[data-vpx-tile="tr"].con-vpx__tile--focused')).toHaveCount(1);

      // ── LEVEL 2: CITIES — ACTUAL tiles only: exactly ONE row for the one
      // real city, named honestly («Город» — the engine records `tile.card`
      // only where a rule needs it, e.g. Capital; the model names the card
      // whenever the server knows it), with its true contribution. No
      // future slots, no placeholder rows, ever. ─────────────────────────
      await focusTile(page, 'city');
      await key(page, 'Enter', 1100);
      await expect(page.locator('.con-vpx__factrow')).toHaveCount(1);
      await expect(page.locator('.con-vpx__factrow-label')).toHaveText(/^(Город|Колония на Ганимеде)$/);
      await expect(page.locator('.con-vpx__factrow-note')).toContainText(/озеленений рядом/i);
      await shoot(page, preset, '03b-cities');
      await key(page, 'Escape', 1000);
      await expect(page.locator('.con-vpx__cat')).toHaveCount(0, {timeout: 15_000});

      // ── LEVEL 2: the cards hub — three family doors, honest counts. ───
      await focusTile(page, 'cards');
      await key(page, 'Enter', 1100);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки.*Карты/i);
      // The resource family holds nothing in this game — a DEAD door, told.
      await expect(page.locator('[data-vpx-group="cards-resource"]')).toHaveClass(/--dead/);
      await shoot(page, preset, '04-cards-hub');

      // ── LEVEL 3: the conditional family — formula + preview. ──────────
      await key(page, 'ArrowRight', 300); // → conditional (door 2)
      await key(page, 'Enter', 1200);
      await expect(page.locator('.con-vpx__table')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Карты.*Условные/i);
      // Ganymede Colony: ITS OWN live formula (N = the jovian count, which the
      // random corporation may raise — the deal is not reproducible, so the
      // probe reads the row's own value). The ROW says «N × 1 ПО · ваши метки
      // Юпитера» and lets its VP cell state the result (PL-098); the preview
      // column, which has no VP cell, keeps «= N ПО».
      await expect(page.locator('.con-vpx__row').first()).toContainText('Колония на Ганимеде');
      const ganyVp = Number(((await page.locator('.con-vpx__row').first().locator('.con-vpx__row-vp').textContent()) ?? '').trim());
      expect(ganyVp).toBeGreaterThanOrEqual(3);
      await expect(page.locator('.con-vpx__row-formula').first())
        .toContainText(new RegExp(`${ganyVp}\\s*×\\s*1\\s*ПО\\s*·\\s*ваши метки Юпитера`));
      await expect(page.locator('.con-vpx__row-formula').first(), 'the row never prints its result twice').not.toContainText('=');
      await expect(page.locator('.con-vpx__preview-formula'))
        .toContainText(new RegExp(`${ganyVp}\\s*×\\s*1\\s*ПО\\s*=\\s*${ganyVp}\\s*ПО`));
      // The preview column shows the REAL premium card of the focused row.
      await expect(page.locator('.con-vpx__preview-card .pcard')).toHaveCount(1);
      await expect(page.locator('.con-vpx__preview-card')).toHaveAttribute('data-zoom-slot', 'Ganymede Colony');
      await expectFits(page, '.con-vpx__table', 'the conditional table');
      await expectTableTextScales(page, 'the conditional table');
      await shoot(page, preset, '05-conditional-table');

      // ── X: the fullscreen inspector — the PREVIEW CARD ITSELF flies. ──
      await key(page, 'KeyX', 1400);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom).toHaveCount(1);
      // NO DUPLICATE: the preview slot holds EMPTY under the lifted card
      // (the zoom-hold contract — the same physicality the hand ships).
      await expect.poll(async () => Number(await page.locator('.con-vpx__preview-card').evaluate((el) => getComputedStyle(el).opacity)),
        {message: 'the origin slot yields its card to the viewer'}).toBeLessThanOrEqual(0.01);
      await shoot(page, preset, '06-fullscreen');
      await key(page, 'Escape', 1400); // B → the card lands back in the preview
      await expect(zoom).toHaveCount(0, {timeout: 15_000});
      await expect(page.locator('.con-vpx__preview-card .pcard')).toBeVisible();
      await expect.poll(async () => (await focusedRowName(page))?.trim() ?? '', {message: 'row focus survives the round trip'})
        .toContain('Колония на Ганимеде');
      await shoot(page, preset, '07-back-from-fullscreen');

      // ── B → the hub; the FIXED family: sorted by current VP desc. ─────
      await key(page, 'Escape', 1000);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await key(page, 'ArrowRight', 300); // → fixed (door 3)
      await key(page, 'Enter', 1200);
      await expect(crumbStage(page)).toHaveText(/Карты.*Фиксированные/i);
      // The VP column read AT REST — the rows' entrance over, the same column twice a frame apart.
      const vps = await readSettled(page, async () => (await page.locator('.con-vpx__row-vp').allTextContents()).map(Number),
        {message: 'the fixed family\'s VP column'});
      expect(vps.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < vps.length; i++) {
        expect(vps[i], 'rows sort by current VP, descending').toBeLessThanOrEqual(vps[i - 1]);
      }
      await shoot(page, preset, '08-fixed-table');

      // ── PARITY AT DEPTH: LB/RB keeps the semantic place for the bot. ──
      await cycleTo(page, 'bot');
      await expect(page.locator('.con-vpx__table'), 'the family route survives the seat ring').toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Карты.*Фиксированные/i);
      await expect(page.locator('.con-vpx')).not.toContainText('Подсчёт бота');
      await shoot(page, preset, '09-table-bot');
      await cycleTo(page, 'human');
      await expect(page.locator('.con-vpx__table')).toHaveCount(1);

      // ── AWARDS: the funded award's REAL medallion, the collection, and
      // the X inspection (fold back without a duplicate). The place lands
      // on whoever leads the metric — the seat ring finds the holder. ──
      await key(page, 'Escape', 900); // → the hub
      await key(page, 'Escape', 900); // → the overview
      let holder: 'human' | 'bot' | undefined;
      for (const seat of ['human', 'bot'] as const) {
        await cycleTo(page, seat);
        await focusTile(page, 'awards');
        // The earned emblems stand in the tile's medallion (the dossier's disc, PL-574).
        const meds = await page.locator('[data-vpx-tile="awards"] .con-dscore__emblem').count();
        if (meds > 0) {
          holder = seat;
          break;
        }
      }
      expect(holder, 'somebody holds the funded award\'s first place').not.toBe(undefined);
      await shoot(page, preset, '10-overview-medallions');
      await key(page, 'Enter', 1100); // → the awards collection
      await expect(page.locator('.con-vpx__maent').first()).toBeVisible();
      await expect(page.locator('.con-vpx__maent-art').first()).toBeVisible();
      await shoot(page, preset, '11-award-collection');
      // X — the dossier: the emblem FLIPs in; the source slot yields it
      // (one physical object, never two).
      const focusedEntryKey = await page.locator('.con-vpx__maent--focused').getAttribute('data-vpx-ma');
      await key(page, 'KeyX', 1000);
      await expect(page.locator('.con-vpx__inspect')).toHaveCount(1);
      await expect(page.locator('.con-vpx__inspect-standrow').first()).toBeVisible();
      await expect(page.locator('.con-vpx__inspect-rule')).toContainText(/5 ПО/);
      await expect.poll(() => page.locator('.con-vpx__maent--focused [data-vpx-ma-art]').evaluate((el) => getComputedStyle(el).visibility),
        {message: 'the source emblem yields to its flying twin'}).toBe('hidden');
      await shoot(page, preset, '12-award-inspect');
      await key(page, 'Escape', 900); // B → fold back into the entry
      await expect(page.locator('.con-vpx__inspect')).toHaveCount(0, {timeout: 15_000});
      await expect(page.locator('.con-vpx__maent--focused')).toHaveAttribute('data-vpx-ma', focusedEntryKey ?? '');
      await expect.poll(() => page.locator('.con-vpx__maent--focused [data-vpx-ma-art]').evaluate((el) => getComputedStyle(el).visibility),
        {message: 'the emblem is home again'}).toBe('visible');
      await expect(crumbStage(page), 'the inspection never moved the route').toHaveText(/Награды/i);
      await key(page, 'Escape', 900); // → the overview
      await cycleTo(page, 'human');

      // ── THE B CHAIN home + the ZERO-STATE FRAME PROBE: on no sample of
      // the reverse may a zero category paint bright (the cascade animates
      // to each element's OWN resting opacity now). ─────────────────────
      await expect(page.locator('.con-vpx__grid')).toBeVisible();
      const zero = await armZeroWitness(page, 'vpx-zero-quiet');
      // The SHARED TOTAL keeps ONE structure through the morph: no label
      // appears on either side of the handoff (the same «<n> ПО» signature).
      const heroSig = await page.locator('.con-vpx [data-vpx-total]')
        .evaluate((el) => `${el.children.length}:${(el.textContent ?? '').replace(/\s+/g, '')}`);
      await key(page, 'Escape', 1200);
      await expect(page.locator('.con-info__layout')).toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-info__zone--vp.con-info__zone--focused'),
        'B lands the ring on the zone the player descended from').toHaveCount(1);
      const zeroVerdict = await zeroQuietVerdict(zero);
      expect(zeroVerdict.samples, 'the zero probe must have sampled the reverse').toBeGreaterThan(0);
      expect(zeroVerdict.hot, `a zero category never paints bright (${zeroVerdict.hot}/${zeroVerdict.samples} hot states)`).toBe(0);
      await expect.poll(() => page.locator('.con-info__layout [data-vpx-total]')
        .evaluate((el) => `${el.children.length}:${(el.textContent ?? '').replace(/\s+/g, '')}`),
      {message: 'the shared total has ONE structure on both sides'}).toBe(heroSig);
      await shoot(page, preset, '13-back-at-summary');

      // ── REDUCED MOTION: the whole vertical still walks cleanly. ───────
      await page.emulateMedia({reducedMotion: 'reduce'});
      await key(page, 'Enter', 500);
      await expect(page.locator('.con-vpx')).toHaveCount(1);
      await focusTile(page, 'cards');
      await key(page, 'Enter', 500);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await key(page, 'Escape', 400);
      await key(page, 'Escape', 400);
      await expect(page.locator('.con-info__layout'),
        `the reduced-motion B chain lands home (page errors: ${pageErrors.join(' | ') || 'none'})`).toHaveCount(1);
      await page.emulateMedia({reducedMotion: 'no-preference'});

      // ── Y closes from any depth; the board comes back. ────────────────
      await key(page, 'KeyY', 900);
      await expect(page.locator('.con-info')).toHaveCount(0);
      expect(pageErrors, 'the whole vertical runs without a page error').toEqual([]);
    });

    if (preset.journey) {
      // The SLOW-MOTION reverse source (calm preset ≈ ×1.3): a fresh game
      // full of zero categories, one forward + reverse morph — the video
      // deliverable for the frame-by-frame zero-state check, with the same
      // sampler asserting it in-page.
      test('the reverse morph keeps zero categories quiet (slow source)', async ({page, request}) => {
        test.setTimeout(300_000);
        await bootIntoGame(page, request, {
          config: soloGameConfig({
            players: [{name: 'ZeroTester', color: 'red', beginner: false, handicap: 0, first: true}],
            seed: 0.37,
            automa: {difficulty: 'normal'},
          }),
          query: preset.profileQuery + '&motion=calm',
        });
        await openInfo(page);
        await key(page, 'Enter', 1600);
        await expect(page.locator('.con-vpx')).toHaveCount(1);
        const zero = await armZeroWitness(page, 'vpx-zero-quiet-slow');
        await key(page, 'Escape', 2000);
        await expect(page.locator('.con-info__layout')).toHaveCount(1);
        const verdict = await zeroQuietVerdict(zero);
        expect(verdict.samples, 'the slow probe must have sampled').toBeGreaterThan(0);
        expect(verdict.hot, `zero rows stay quiet on EVERY frame (${verdict.hot}/${verdict.samples})`).toBe(0);
        await key(page, 'KeyY', 800);
      });
    }
  });
}
