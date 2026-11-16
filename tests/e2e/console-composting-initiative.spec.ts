import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, openQuickWheel, press, pressUntil, settle,
  waitForBoardHome,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {readSettled} from './settledRead';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {startTrace} from './traceProbe';
import {armWitness, witnessOf} from './witness';

/**
 * TR45 «КОМПОСТНАЯ ИНИЦИАТИВА» — a play COUNTED off the board: «1 microbe for
 * each tile on Mars», of ANY player. The owner's accent (2026-10-12): the player
 * sees HOW MANY microbes before the play, and WHY. Against a real server, on two
 * profiles, three fixtures:
 *
 *   (A) THE BOARD OF 14 (`composting-initiative`: a stack of 2, a Nuclear Zone,
 *       four oceans, Ganymede off Mars; Topsoil + Decomposers on blue's table):
 *       · «СКОЛЬКО» before the composer — the hand tile's plate «+14» (the
 *         server's `countedPlay`, `data-hand-count`);
 *       · «ПОЧЕМУ» in the composer — the strip «[glyph] 14 = [город] 4 +
 *         [озеленение] 5 + [океан] 4 + [спецтайл] 1 → +14 [микроб]», the
 *         uncounted city on Ganymede NAMED; steel offered in the payment;
 *       · «ПОЧЕМУ НА ПОЛЕ» — L3: the workspace recedes over the board, the 14
 *         counted cells marked, Ganymede amber, the strip on the HUD; L3 again
 *         → the SAME composer back (nothing re-asked, nothing sent);
 *       · A → ONE POST; the server: 14 microbes on the card (+ Decomposers 1,
 *         Topsoil +15 M€); every flight's ends visible; red's notification
 *         carries the basis.
 *   (B) THE ZERO (`composting-initiative-zero`): the plate «0», muted; the
 *       strip names the zero; the card plays; no warning, no skip.
 *   (C) THE ACTION (`composting-initiative-action`): «Действия карт» → 2
 *       microbes off the card → 6 heat on the rail.
 *
 * Fixtures `composting-initiative`, `-zero`, `-action`. Heavy 4K: run with
 * `--workers=1`. Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Composting Initiative';
const OUT = path.resolve('screenshots', 'composting-initiative');
const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, heat: number, steel: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
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

async function openHand(page: Page, card: string): Promise<void> {
  // Each press waits for ITS effect: the wheel up, then the hand (or the wheel gone — the press took).
  await openQuickWheel(page);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0 || await page.locator('.con-quick').count() === 0,
    {tries: 1, settleMs: 1600});
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  await pressUntil(page, 'Enter', async () => await page.locator(PLAY_COMPOSER).count() > 0, {tries: 3, settleMs: 900});
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

async function commit(page: Page, posts: Array<string>): Promise<void> {
  await pressUntil(page, 'ArrowDown', async () => await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() > 0, {tries: 8, settleMs: 250});
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

/** The composer's «ПОЧЕМУ» strip, read off its own DOM: the count, each share, the named uncounted. */
async function whyOf(page: Page, root: string): Promise<{total: string | null, parts: Array<[string, string]>, excluded: string, glyph: number}> {
  return page.locator(`${root} [data-count-why]`).evaluate((el) => ({
    total: el.getAttribute('data-count-why-total'),
    parts: Array.from(el.querySelectorAll('[data-count-part]')).map((p) => [p.getAttribute('data-count-part') ?? '', p.getAttribute('data-count-part-n') ?? ''] as [string, string]),
    excluded: (el.querySelector('[data-count-excluded]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    glyph: el.querySelectorAll('[data-count-glyph] .pcard-ic--hex').length,
  }));
}

/** The board's peek marks: which cells wear the counted / uncounted tint. */
async function peekCells(page: Page): Promise<{counted: Array<string>, excluded: Array<string>}> {
  return page.evaluate(() => {
    const ids = (sel: string) => Array.from(document.querySelectorAll(sel)).map((el) => el.getAttribute('data_log_highlight_id') ?? '');
    return {
      counted: ids('.board-log-highlight.con-peek-cell:not(.con-peek-cell--excluded)'),
      excluded: ids('.board-log-highlight.con-peek-cell--excluded'),
    };
  });
}

type Box = {l: number, t: number, w: number, h: number};
const BOARD = '.con-main > .con-board';
const HAND = '.con-main > .con-hand';
const RAIL = '.con-main > .con-strat';
/** A shown element's box (undefined while `display: none`). */
async function boxOf(page: Page, sel: string): Promise<Box | null> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el?.getBoundingClientRect();
    return r === undefined || r.width <= 0 ? null : {l: r.left, t: r.top, w: r.width, h: r.height};
  }, sel);
}
/** …read AT REST (FLAKE ZERO — `readSettled`: a box taken once is wherever the machine had got to). */
async function settledBoxOf(page: Page, sel: string): Promise<Box | undefined> {
  return (await readSettled(page, () => boxOf(page, sel), {message: `the box of ${sel}`})) ?? undefined;
}
const sameBox = (a: Box | undefined, b: Box | undefined) => a !== undefined && b !== undefined &&
  Math.abs(a.l - b.l) <= 0.5 && Math.abs(a.t - b.t) <= 0.5 && Math.abs(a.w - b.w) <= 0.5 && Math.abs(a.h - b.h) <= 0.5;

/**
 * PL-199's witness: the composer's box and the board's, RECORDED through the peek's whole round trip (FLAKE ZERO —
 * `armWitness`: every box the product lays out, observed in the task that changes it and on every frame a transition
 * paints; a still layout writes nothing new — a recording holds every DISTINCT box, never a count of samples).
 */
const PEEK_LAYOUT = 'ci-peek-layout';
type PeekLayoutSeen = {hand?: Box, board?: Box};
async function armPeekLayoutProbe(page: Page): Promise<void> {
  await armWitness<PeekLayoutSeen, {hand: string, board: string}>(page, PEEK_LAYOUT, ({hand, board}) => {
    const boxOfEl = (s: string) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return r === undefined || r.width <= 0 ? undefined : {l: r.left, t: r.top, w: r.width, h: r.height};
    };
    return {hand: boxOfEl(hand), board: boxOfEl(board)};
  }, {args: {hand: HAND, board: BOARD}});
}
async function readPeekLayout(page: Page): Promise<{hand: Array<Box>, board: Array<Box>}> {
  const seen = await witnessOf<PeekLayoutSeen>(page, PEEK_LAYOUT).stop();
  return {
    hand: seen.flatMap((s) => s.v.hand === undefined ? [] : [s.v.hand]),
    board: seen.flatMap((s) => s.v.board === undefined ? [] : [s.v.board]),
  };
}

type RedNote = {at: number, text: string};
/**
 * RED'S WITNESS: every notification card as it APPEARS (a card lives a TTL — read late, it is gone). A RECORDING
 * (FLAKE ZERO — `armWitness`): the cards on screen, each change; a card's first appearance is folded on the Node side.
 */
const RED_NOTES = 'ci-red-notes';
async function armRedProbe(page: Page): Promise<void> {
  await armWitness<Array<{id: string, text: string}>>(page, RED_NOTES, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll<HTMLElement>('.con-notif')).map((el) => ({id: el.getAttribute('data-notif-id') ?? text(el), text: text(el)}));
  });
}
async function readRedProbe(page: Page): Promise<Array<RedNote>> {
  const samples = await witnessOf<Array<{id: string, text: string}>>(page, RED_NOTES).samples();
  const t0 = samples[0]?.t ?? 0;
  const seen = new Set<string>();
  const notes: Array<RedNote> = [];
  for (const s of samples) {
    for (const n of s.v) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        notes.push({at: s.t - t0, text: n.text});
      }
    }
  }
  return notes;
}

/**
 * PL-191's witness, RECORDED (FLAKE ZERO — `armWitness`): the capsule the eye reads on the played card — the flying
 * proxy's face and the landed front card — every change; folded into a SEQUENCE of distinct values on the Node side
 * (it may only climb: 0, then 14 at the touchdown). (The page sampler it replaces also kept each chip's birth pose for
 * PL-190; nothing ever asserted on it, so the recording keeps only what the spec reads.)
 */
const CAPSULE = 'ci-capsule';
async function armBirthProbe(page: Page): Promise<void> {
  await armWitness<Array<string>>(page, CAPSULE, () =>
    Array.from(document.querySelectorAll('.con-played-hero__proxy .pcard__res-count, .con-recv [data-recv-front] .pcard__res-count'))
      .map((el) => (el.textContent ?? '').trim()).filter((t) => t !== ''));
}
async function readCapsules(page: Page): Promise<Array<string>> {
  const caps: Array<string> = [];
  for (const sample of await witnessOf<Array<string>>(page, CAPSULE).stop()) {
    for (const v of sample.v) {
      if (caps[caps.length - 1] !== v) {
        caps.push(v);
      }
    }
  }
  return caps;
}

for (const preset of PRESETS) {
  test.describe(`TR45 Composting Initiative · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) 14 tiles on Mars: «+14» on the hand tile, «why» in the composer, L3 on the board, ONE POST (${preset.id})`, async ({page, request, browser}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'composting-initiative', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      // The board home's layout — the peek must show the board EXACTLY here (PL-199).
      const homeBoard = await settledBoxOf(page, BOARD);
      const homeRail = await settledBoxOf(page, RAIL);
      expect(homeBoard !== undefined && homeRail !== undefined, 'the board home stands with its strategy rail').toBe(true);

      // Red in its OWN browser context: a second page of the same context is a background tab, and the feed
      // presents only on a visible page — the play's card would wait for a focus the test never gives it.
      const redContext = await browser.newContext({viewport: preset.viewport});
      const red = await redContext.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await armRedProbe(red);
      await page.bringToFront();

      // ── 1. «СКОЛЬКО» before the composer: the hand tile's plate.
      await openHand(page, CARD);
      const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
      await expect(plate, 'the counted play wears its plate').toHaveAttribute('data-hand-count', '14');
      await expect(plate).not.toHaveClass(/con-hand__plate--zero/);
      await shoot(page, preset.id, 'a-01-hand');

      // ── 2. «ПОЧЕМУ» in the composer.
      await openPlayComposerOf(page, CARD);
      const why = await whyOf(page, PLAY_COMPOSER);
      expect(why.total, 'the strip counts 14').toBe('14');
      expect(why.parts, 'the composition by kind — the server\'s partition').toEqual([['city', '4'], ['greenery', '5'], ['ocean', '4'], ['special', '1']]);
      expect(why.excluded, 'the city on Ganymede is NAMED, not silently dropped').toMatch(/1/);
      expect(why.glyph, 'the strip begins with the card\'s printed hex glyph').toBe(1);
      await expect(page.locator(`${PLAY_COMPOSER} [data-pay-unit="steel"], ${PLAY_COMPOSER} .con-payrow[data-pay-unit="steel"]`).first(), 'steel is offered for the Building tag').toBeVisible();
      await shoot(page, preset.id, 'a-02-composer');

      // ── 3. «ПОЧЕМУ НА ПОЛЕ»: L3 → the board under the receding workspace, the cells marked, the strip on the HUD.
      const handBox = await settledBoxOf(page, HAND);
      await armPeekLayoutProbe(page);
      const stopPeek = await storyboard(page, preset.id, 'peek');
      await press(page, 'KeyC', 900);
      await expect(page.locator('.con-root.con-root--board-peek'), 'the peek is open').toHaveCount(1, {timeout: 6000});
      // PL-199: the peeked board is the board HOME — its box, its strategy rail beside it, surfaced.
      expect(sameBox(await settledBoxOf(page, RAIL), homeRail), 'the strategy rail stands where it stands at home').toBe(true);
      await expect.poll(() => page.locator(RAIL).evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.visibility + ' ' + cs.opacity;
      }), {timeout: 3000}).toBe('visible 1');
      expect(await page.locator(`${RAIL} .con-strat__key`).first().evaluate((el) => getComputedStyle(el).visibility),
        'the rail\'s bumper keys open nothing inside the peek — not drawn').toBe('hidden');
      await expect(page.locator('[data-board-peek] [data-count-why]'), 'the strip stands on the HUD').toHaveCount(1);
      const cells = await peekCells(page);
      expect(cells.excluded, 'Ganymede stands amber — named, not counted').toEqual(['c01']);
      expect(cells.counted.length, 'the counted cells are marked (a stack is ONE cell of 2 tiles)').toBe(13);
      await shoot(page, preset.id, 'a-03-peek');
      await press(page, 'KeyC', 900);
      await expect(page.locator('.con-root.con-root--peeking'), 'the peek is closed').toHaveCount(0, {timeout: 6000});
      await stopPeek();
      // PL-199: not one sample of the round trip re-laid the composer out, and the board never stood anywhere but home.
      const layout = await readPeekLayout(page);
      const movedHand = layout.hand.filter((h) => !sameBox(h, handBox));
      const movedBoard = layout.board.filter((bx) => !sameBox(bx, homeBoard));
      console.log(`[${preset.id} peek layout] hand ${layout.hand.length} samples (moved ${movedHand.length}) · board ${layout.board.length} samples (off home ${movedBoard.length})`);
      expect(movedHand.slice(0, 3), `the composer kept its box (${JSON.stringify(handBox)}) in every sample`).toEqual([]);
      expect(layout.board.length, 'the board was on screen during the peek').toBeGreaterThan(0);
      expect(movedBoard.slice(0, 3), `the peeked board stood in the board home's box (${JSON.stringify(homeBoard)})`).toEqual([]);
      await expect(page.locator(PLAY_COMPOSER), 'the SAME composer is back').toHaveCount(1);
      expect(seen.posts, 'nothing sent by the peek').toEqual([]);

      // ── 4. A → ONE POST; the server's numbers.
      await armTransferWitness(page);
      await armBirthProbe(page);
      const stopPlay = await storyboard(page, preset.id, 'play');
      await commit(page, seen.posts);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: '14 microbes on the card'}).toBe(14);
      const after = await wireOf(request, playerId);
      expect(resourcesOf(after, 'Decomposers'), 'Decomposers answered the microbe tag').toBe(1);
      // Topsoil: +1 M€ per microbe gained on ANY of blue's cards — the card's 14 AND Decomposers' 1; the price 4 M€ + 2 steel.
      expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'M€: −4 (the price) + 15 (Topsoil)').toBe(11);
      expect(after.thisPlayer.steel, 'the 2 steel paid').toBe(before.thisPlayer.steel - 2);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stopPlay();
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/composting-initiative-a-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      const caps = await readCapsules(page);
      expect(caps, 'the capsule on the played card only climbs — never the result before its token (PL-191)').toEqual(['0', '14']);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-04-board');

      // ── 5. Red reads the gain WITH ITS REASON — the journal's row «+14 микробов … за 14 тайлов на Марсе» (the
      //       executor's basis rides the event to every seat). The toast itself presents only on a FOCUSED page.
      await red.bringToFront();
      await settle(red, {timeoutMs: 30_000});
      const notes = await readRedProbe(red);
      console.log(`[red ${preset.id}] toasts: ${notes.map((n) => `${n.at}ms «${n.text}»`).join(' · ') || 'none'}`);
      // PL-189: the play's MODEL on red sums blue's M€ as the server paid it — −4 (the price) + 14 + 1 (Topsoil, the
      // second answering Decomposers' microbe — an effect of an effect) = +11 (`notificationModel.spec`). TR59 «ОДИН
      // ВЗГЛЯД» (decision 5a): what the ACTOR got is one quiet line of ≤ 2 chips in event order under «Кратко» — the
      // counted microbes lead it; the whole sum is the journal's (hold X).
      const play = notes.find((n) => /Компостная инициатива/.test(n.text));
      if (play !== undefined) {
        expect(play.text, 'the card of red names the counted gain').toContain('+14');
        expect(play.text, 'the actor is named once (the head chip)').not.toMatch(/player1.*player1/);
      }
      await press(red, 'KeyR', 900);
      await expect(red.locator('.con-journal'), 'the journal of red opens').toBeVisible({timeout: 10_000});
      await expect.poll(async () => (await red.locator('.con-journal').innerText()).replace(/\s+/g, ' '), {timeout: 20_000, message: 'the journal of red names the reason'}).toMatch(/14 тайлов на Марсе/);
      await shoot(red, preset.id, 'a-05-red-journal');
      expect(redErrors, 'no page errors on red').toEqual([]);
      await redContext.close();
    });

    test(`(B) the zero: «0» on the plate, the strip names it, the card plays — no warning, no skip (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'composting-initiative-zero', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      await openHand(page, CARD);
      const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
      await expect(plate, 'the zero is a plate too').toHaveAttribute('data-hand-count', '0');
      await expect(plate).toHaveClass(/con-hand__plate--zero/);
      await openPlayComposerOf(page, CARD);
      await expect(page.locator(`${PLAY_COMPOSER} [data-count-why].con-cwhy--zero`), 'the strip names the zero').toHaveCount(1);
      await expect(page.locator(`${PLAY_COMPOSER} .con-composer__warn`), 'no warning — a zero is a rule').toHaveCount(0);
      await shoot(page, preset.id, 'b-01-composer');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000}).toBe(true);
      expect(resourcesOf(await wireOf(request, playerId), CARD)).toBe(0);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(C) the action: «Действия карт» → 2 microbes off the card → 6 heat on the rail (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'composting-initiative-action', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, CARD), 'the fixture: 3 microbes on the card').toBe(3);
      await openCardActions(page);
      const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 18 && await focused() !== CARD; i++) {
        await press(page, moves[i % moves.length], 260);
      }
      expect(await focused(), 'the action tile of the card is focused').toBe(CARD);
      await openActionFocus(page);
      await settle(page);
      await pressUntil(page, 'ArrowDown', async () => await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() > 0, {tries: 8, settleMs: 200});
      await shoot(page, preset.id, 'c-01-composer');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'action');
      // PL-149 (reproduce, the owner's call 2026-10-12): the renderer's own account of the press and of the board's
      // return on THIS route (`TM_E2E_TRACE=1` only) — `LayerTreeHost::WaitForCommitCompletion` is the number.
      const stopTrace = await startTrace(page);
      const probeT0 = await page.evaluate(() => performance.now());
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one input').toBe(1);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.heat, {timeout: 30_000, message: '+6 heat'}).toBe(before.thisPlayer.heat + 6);
      expect(resourcesOf(await wireOf(request, playerId), CARD), '3 − 2 microbes').toBe(1);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const probeEnd = await page.evaluate(() => performance.now());
      await stopTrace([{from: 0, to: 1500, label: 'press'}, {from: 1500, to: probeEnd - probeT0, label: 'commit → board'}], probeT0,
        (tag, value) => console.log(`[${preset.id} c trace] ${tag} ${JSON.stringify(value)}`));
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/composting-initiative-c-${preset.id}.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible
${transferTrail(witness)}`).toEqual([]);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'c-02-board');
    });
  });
}
