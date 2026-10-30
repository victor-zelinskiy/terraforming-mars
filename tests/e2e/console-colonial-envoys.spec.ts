import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';

/**
 * P70 «ДЕЛЕГАТЫ КОЛОНИЙ» — THE FIRST CARD WHOSE DELEGATES ARE A SERIES OF SEPARATE DECISIONS, and the witness of the class
 * «A SERIES OF GRANTS — ONE VISIT» (docs/claude/prompts/prelude2-p70-colonial-envoys.md, ledger DA):
 *
 *   A · `colonial-envoys-locked` (the Greens rule, ONE of blue's delegates on Unity's resolution): the verdict refuses the
 *       play with Unity's «1 / 2»; A sends nothing.
 *   B · `colonial-envoys` (Unity's law enacted; blue's cubes on three colony tiles → N = 3; reserve 6; 10 M€): the composer
 *       reads the play (the reserve chip 6 → 3, the row «3 делегата по одному … можно на разные резолюции», the price 4);
 *       ONE POST; the vote rises INSIDE the hand, the crumb «… › ГОЛОСОВАНИЕ · 1 / 3»; A on X → its cube lands → the
 *       Parliament DOES NOT FOLD: the same `.con-parl` node, the vote mode standing in every sample, the crumb «2 / 3», the
 *       cursor still on X; ▶ Y, A → «3 / 3»; ◀ X, A → the flow leaves to the board. The server: reserve 6 → 3, X 2, Y 1;
 *       1 + 3 POSTs.
 *
 * The ORDER is judged on the probe's MutationObserver record (FUNCTIONAL class — state, never a frame count).
 * Fixtures: tests/e2e/fixtures/generate.ts § P70 (the dry run there proves the numbers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Colonial Envoys';
const CARD_RU = 'Делегаты колоний';
const OUT = path.resolve('screenshots', 'p70');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const VOTE = '.con-hand .con-parl--embedded [data-parl-vote-door]';

type Wire = {
  game: {parliament?: {players: Array<{color: string, reserve: number}>}},
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const reserveOf = (wire: Wire): number => wire.game.parliament?.players.find((p) => p.color === wire.thisPlayer.color)?.reserve ?? NaN;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
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

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

type Story = {
  samples: number;
  /** The hand head's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  /** How many DISTINCT `.con-parl` nodes stood inside the hand (a re-mount is a second node). */
  parlNodes: number;
  /** A `.con-parl` stood OUTSIDE the hand (a second surface) or as a band of its own. */
  parlOutsideHand: boolean;
  /** The first moment the vote door stood (−1: never). */
  doorAt: number;
  /**
   * Samples AFTER the first door and BEFORE the last decision's press (`closed`) in which the vote mode did not stand
   * (a fold / unfold between two decisions). What follows the last press is the flow's ending (the access scene, the leave).
   */
  doorGapSamples: number;
  closed: boolean;
  /** [ms, what stood] on every change of a gap (the diagnosis). */
  gap: Array<[number, string]>;
  /** Every landed cube's first sighting (a touchdown) — [ms, seq]. */
  touches: Array<[number, number]>;
  /** [ms, value] — the viewer's reserve as the Parliament draws it: every change. */
  reserve: Array<[number, number]>;
  /** The first moment the hand was gone after the door had stood (the flow left). */
  handLeftAt: number;
  stranded: boolean;
};

/** MutationObserver + setInterval (never rAF): the story of the screen from the press on. */
async function armStory(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const w = window as unknown as {__p70: Story};
    const p: Story = {samples: 0, steps: [], parlNodes: 0, parlOutsideHand: false, doorAt: -1, doorGapSamples: 0, closed: false, gap: [], touches: [], reserve: [], handLeftAt: -1, stranded: false};
    w.__p70 = p;
    const t0 = Date.now();
    const nodes = new WeakSet<Element>();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = () => {
      p.samples++;
      const at = Date.now() - t0;
      const hand = document.querySelector('.con-hand');
      hand?.querySelectorAll('.con-wshead__step').forEach((el) => {
        const step = text(el);
        if (step !== '' && !p.steps.includes(step)) {
          p.steps.push(step);
        }
      });
      document.querySelectorAll('.con-parl').forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        } else if (!nodes.has(el)) {
          nodes.add(el);
          p.parlNodes++;
        }
      });
      const door = document.querySelector('.con-hand [data-parl-vote-door]');
      if (door !== null && p.doorAt < 0) {
        p.doorAt = at;
      }
      if (p.doorAt >= 0 && !p.closed && hand !== null && door === null) {
        p.doorGapSamples++;
        const parl = document.querySelector('.con-hand .con-parl');
        const state = parl === null ? 'no-parl' : `parl:${parl.className.toString().replace(/\s+/g, '.')}`;
        if (p.gap[p.gap.length - 1]?.[1] !== state && p.gap.length < 60) {
          p.gap.push([at, state]);
        }
      }
      if (p.doorAt >= 0 && hand === null && p.handLeftAt < 0) {
        p.handLeftAt = at;
      }
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const value = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value) && p.reserve[p.reserve.length - 1]?.[1] !== value) {
        p.reserve.push([at, value]);
      }
      document.querySelectorAll('.con-hand .con-parl__slot [data-seq][data-landed]').forEach((el) => {
        const seq = Number(el.getAttribute('data-seq'));
        if (!p.touches.some(([, seen]) => seen === seq)) {
          p.touches.push([at, seq]);
        }
      });
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 30);
  }, viewer);
}

const readStory = (page: Page): Promise<Story> => page.evaluate(() => (window as unknown as {__p70: Story}).__p70);

/** The index of the voting-area card the vote mode's cursor stands on (−1: none). */
async function cursorIndex(page: Page): Promise<number> {
  return await page.evaluate(() => Array.from(document.querySelectorAll('.con-hand .con-parl__slot[data-instance]'))
    .findIndex((slot) => slot.querySelector('[data-parl-vote-card]') !== null));
}

/** The hand head's crumb tail as it stands now. */
async function crumbTail(page: Page): Promise<string> {
  const steps = await page.locator('.con-hand .con-wshead__step').allTextContents();
  return (steps.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s !== '').pop() ?? '').toUpperCase();
}

/** The vote mode is back in its SELECTION: the door stands, the cursor on a card, the crumb counting `k / 3`. */
async function selectionAt(page: Page, k: number): Promise<void> {
  await expect.poll(async () => `${await page.locator(VOTE).count()}|${await cursorIndex(page) >= 0}|${await crumbTail(page)}`,
    {timeout: 30_000, message: `the vote mode back in its selection at decision ${k} / 3`}).toMatch(new RegExp(`^1\\|true\\|ГОЛОСОВАНИЕ · ${k} / 3$`));
}

test.describe(`P70 Colonial Envoys · a series of grants is ONE visit · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · neither road to Unity: the verdict refuses the play with «1 / 2»; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'colonial-envoys-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});
    await expect(verdict, 'Unity\'s count: 1 of 2').toContainText(/1\s*\/\s*2/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · ONE POST, then THREE decisions in ONE Parliament: no fold between them, the crumb counting 1 / 3 · 2 / 3 · 3 / 3; X Y X on the server', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'colonial-envoys', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    const reserve0 = reserveOf(before);
    const price = before.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost;
    expect([before.thisPlayer.megacredits, reserve0, price], 'the fixture: 10 M€, reserve 6, P70 at 4').toEqual([10, 6, 4]);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'Unity rules: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});

    // ── the composer reads the play ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const composerText = (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'composer', description: composerText.slice(0, 1200)});
    const next = (await page.locator(`${COMPOSER} .con-composer__next`).allTextContents()).join(' | ').replace(/\s+/g, ' ');
    expect(next, `the «next» row names the SERIES — ${next}`).toMatch(/3 делегата по одному.*разные резолюции/i);
    expect(composerText, 'the reserve chip: 6 → 3').toMatch(/6\s*→\s*3/);
    await expect(page.locator(`${COMPOSER} [aria-label^="Оплата"]`).first(), 'the payment head names the price 4')
      .toHaveAttribute('aria-label', /\b4\s*M€/);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST; the vote rises inside the hand, decision 1 / 3 ──
    await armStory(page, before.thisPlayer.color);
    const stopStory = await storyboard(page, 'series');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await page.locator(VOTE).waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await selectionAt(page, 1);
    const x = await cursorIndex(page);
    expect(x, 'the cursor stands on a resolution of the voting area').toBeGreaterThanOrEqual(0);
    await shoot(page, 'c-vote-1');

    // ── decision 1: A on X → the cube lands → the SAME Parliament returns to its selection, «2 / 3», the cursor on X ──
    await pressUntil(page, 'Enter', async () => posts.length >= 2, {tries: 3, settleMs: 1500});
    expect(posts.length, 'decision 1 is ONE POST').toBe(2);
    await selectionAt(page, 2);
    expect(await cursorIndex(page), 'the cursor stays on the resolution the cube just landed on').toBe(x);
    await shoot(page, 'd-vote-2');

    // ── decision 2: ▶ Y, A → «3 / 3» ──
    await press(page, 'ArrowRight', 400);
    const y = await cursorIndex(page);
    expect(y, 'the cursor moved to another resolution').not.toBe(x);
    await pressUntil(page, 'Enter', async () => posts.length >= 3, {tries: 3, settleMs: 1500});
    expect(posts.length, 'decision 2 is ONE POST').toBe(3);
    await selectionAt(page, 3);
    await shoot(page, 'd-vote-3');

    // ── decision 3: ◀ X, A → the flow leaves to the board ──
    for (let i = 0; i < 4 && await cursorIndex(page) !== x; i++) {
      await press(page, 'ArrowLeft', 400);
    }
    expect(await cursorIndex(page), 'back on X').toBe(x);
    // The series' gaps are counted up to here: what follows the last decision is the flow's own ending.
    await page.evaluate(() => {
      (window as unknown as {__p70: Story}).__p70.closed = true;
    });
    await pressUntil(page, 'Enter', async () => posts.length >= 4, {tries: 3, settleMs: 1500});
    expect(posts.length, 'decision 3 is ONE POST').toBe(4);
    await expect(page.locator('.con-hand'), 'the flow ends on the board').toHaveCount(0, {timeout: 30_000});
    await expect(page.locator('.con-parl'), 'the Parliament left with the flow').toHaveCount(0, {timeout: 20_000});
    await settle(page, {timeoutMs: 30_000});
    await stopStory();

    const story = await readStory(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-series.json'), JSON.stringify(story, null, 1));
    const told = JSON.stringify({steps: story.steps, parlNodes: story.parlNodes, doorGapSamples: story.doorGapSamples, gap: story.gap,
      touches: story.touches, reserve: story.reserve});
    test.info().annotations.push({type: 'series', description: told});
    expect(story.parlOutsideHand, `one Parliament, inside the hand — never a band of its own (${told})`).toBe(false);
    expect(story.parlNodes, `ONE Parliament node for the whole series — never re-mounted between decisions (${told})`).toBe(1);
    expect(story.doorGapSamples, `the vote mode stood in every sample between the decisions — no fold, no unfold (${told})`).toBe(0);
    const votes = story.steps.map((s) => s.toUpperCase()).filter((s) => s.startsWith('ГОЛОСОВАНИЕ'));
    expect(votes, `the crumb counted the series — and only moved forward, never a bare «ГОЛОСОВАНИЕ» (${told})`)
      .toEqual(['ГОЛОСОВАНИЕ · 1 / 3', 'ГОЛОСОВАНИЕ · 2 / 3', 'ГОЛОСОВАНИЕ · 3 / 3']);
    expect(story.steps.some((s) => /ЭФФЕКТ ПАРТИИ · /i.test(s)), `a later stage of the step counts nothing (${told})`).toBe(false);
    expect(story.touches.length, `three cubes touched down (${told})`).toBe(3);
    expect(story.reserve.map(([, v]) => v), `the reserve 6 → 5 → 4 → 3 (${told})`).toEqual(expect.arrayContaining([reserve0 - 1, reserve0 - 2, reserve0 - 3]));
    expect(story.stranded, 'no stranded prompt').toBe(false);

    const after = await wireOf(request, id);
    expect(reserveOf(after), 'the server: reserve 6 → 3').toBe(reserve0 - 3);
    expect(after.thisPlayer.megacredits, 'the server: 10 − 4 = 6 M€').toBe(6);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);
    await shoot(page, 'e-board');

    // ── the journal names the card ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'e-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
