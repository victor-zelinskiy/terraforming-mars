import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, cinematicBeat, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P69 «ОБЛАЧНЫЙ ТУРИЗМ» — THE FIRST PAIR COUNT and the first VP threshold on the card's own resource
 * (docs/claude/prompts/prelude2-p69-cloud-tourism.md §3). The witness of the class «A SET COUNT IS ONE TERM WITH ITS
 * SIDES, THE WILD TAG DEALT AND NAMED» (ledger CV): the «ПОЧЕМУ» strip reads each side with its OWN number
 * (`[data-count-set-side]`), the wild tag and this card's own tag on the Venus side, then «→ 2 пары» — never a sum.
 *
 *   (1) `cloud-tourism` — Teractor + Cartel (Earth 2) · Sulphur-Eating Bacteria + this card (Venus 2): the hand plate
 *       «+2», the composer's chip and its set strip, ONE POST, +2 M€ production on the server; the SAME turn, «ДЕЙСТВИЯ
 *       КАРТ» › the card › the floater chip and its VP reading («до следующего ещё 2») → A → ONE POST → a floater born on the card's printed icon lands in the
 *       hero's capsule, the flow leaves, the tile reads used.
 *   (2) `cloud-tourism-wild` — no Venus card, a printed wild tag (Research Coordination): the Venus side reads
 *       «2 (в т.ч. [любая] 1 · эта карта 1)».
 *   (3) `cloud-tourism-vp` — the card on the table with 2 floaters: «2 → 3» and «ПО 0 → 1», the third floater lands and
 *       the score cell ticks on its own token, never in the frame the view applied.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P69 (the dry run proves the play's +2 and the third floater's VP).
 * Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Cloud Tourism';
const OUT = path.resolve('screenshots', 'p69');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PLAY = '.con-composer--play';
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {
    megacredits: number, megacreditProduction: number,
    tableau: Array<{name: string, resources?: number}>,
    victoryPointsBreakdown: {total: number},
    actionsThisGeneration: Array<string>,
  },
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

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

/** The hand plate «+2» → A → the play composer with its «ПОЧЕМУ» standing. */
async function openPlayComposer(page: Page, shot: string): Promise<void> {
  await focusInHand(page);
  await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
  await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`), 'the hand plate: the server\'s pairs')
    .toHaveAttribute('data-hand-count', '2');
  await shoot(page, shot);
  await press(page, 'Enter', 1200);
  await page.locator(PLAY).waitFor({timeout: 15_000});
  await settle(page);
}

/** The set strip's sides as `[tag, n]`, plus what each includes. */
async function setSides(page: Page): Promise<Array<{tag: string, n: string, wild: string | null, self: string | null}>> {
  return page.evaluate((s) => [...document.querySelectorAll(`${s} [data-count-why] [data-count-set-side]`)].map((el) => ({
    tag: el.getAttribute('data-count-set-side') ?? '',
    n: el.getAttribute('data-count-set-side-n') ?? '',
    wild: el.querySelector('[data-count-wild]')?.getAttribute('data-count-wild') ?? null,
    self: el.querySelector('[data-count-self]')?.getAttribute('data-count-self') ?? null,
  })), PLAY);
}

/** «ДЕЙСТВИЯ КАРТ» › the card focused › its composer. */
async function openTourismAction(page: Page): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  // Sulphur-Eating Bacteria's two variants stand in the row ABOVE (the fixture's Venus tag has an action of its own):
  // the card is one row down — the horizontal walk never leaves a row.
  for (let i = 0; i < 4 && await focused() !== CARD; i++) {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 30), `never focused the «${CARD}» action`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
  await page.locator(`${STAGE} .action-effect-chip__vp`).waitFor({timeout: 15_000});
}

/** The composer's two chips: the floater «N → N+1 на этой карте» and its VP reading (ledger CV — «ПО a → b» or the neutral note). */
const actionChips = (page: Page) => page.evaluate((s) => {
  const chips = [...document.querySelectorAll(`${s} .action-effect-chip`)];
  const read = (chip: Element | undefined) => {
    const t = (sel: string) => (chip?.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {cur: t('.action-effect-chip__cur'), res: t('.action-effect-chip__res'), note: t('.action-effect-chip__note')};
  };
  return {
    floater: read(chips.find((c) => c.querySelector('.action-effect-chip__vp') === null)),
    vp: read(chips.find((c) => c.querySelector('.action-effect-chip__vp') !== null)),
  };
}, STAGE);

/** A → ONE more POST (retried only while none went out). */
async function commitOnce(page: Page, posts: Array<string>, before: number): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

type ScoreProbe = {samples: number, vp: Array<[number, string]>, vpBeatAt?: number, reasons: Array<string>};

/** The score cell, sampled (MutationObserver + setInterval — never rAF), and the VP token's contact beat. */
async function armScoreProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t0 = performance.now();
    const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
    const painted = (el: Element | null) => el !== null && Number(getComputedStyle(el).opacity) > 0.05 && getComputedStyle(el).visibility !== 'hidden';
    const probe: ScoreProbe = {samples: 0, vp: [], reasons: []};
    let last = '';
    const sample = () => {
      const t = Math.round(performance.now() - t0);
      probe.samples++;
      const vp = text('.con-res .con-score__cell--vp .con-score__value');
      if (vp !== last) {
        probe.vp.push([t, vp]);
        last = vp;
      }
      if (probe.vpBeatAt === undefined && painted(document.querySelector('.con-transfer__beat--vp'))) {
        probe.vpBeatAt = t;
      }
      const reason = text('[data-vp-reason]');
      if (reason !== '' && !probe.reasons.includes(reason)) {
        probe.reasons.push(reason);
      }
    };
    window.setInterval(sample, 16);
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true});
    sample();
    (window as unknown as {__p69: ScoreProbe}).__p69 = probe;
  });
}
const readScoreProbe = (page: Page): Promise<ScoreProbe> => page.evaluate(() => {
  const p = (window as unknown as {__p69: ScoreProbe}).__p69;
  return {samples: p.samples, vp: p.vp, vpBeatAt: p.vpBeatAt, reasons: p.reasons};
});

test.describe(`P69 Cloud Tourism · the pair count, the floater action, the third floater's point · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the play (the set strip, ONE POST, +2 production) and the action of the same turn (a floater into the hero, ONE POST)', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'cloud-tourism', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect(before.thisPlayer.megacredits, 'the fixture: 15 M€').toBe(15);
    const production0 = before.thisPlayer.megacreditProduction;

    // ── (1) THE PLAY ──
    await openPlayComposer(page, 'a-hand');
    const why = page.locator(`${PLAY} [data-count-why]`);
    await expect(why, 'the «why» strip stands').toHaveCount(1);
    await expect(why.locator('[data-count-term]'), 'a set is never a sum of terms').toHaveCount(0);
    expect(await setSides(page), 'two sides, each its own number; the Venus side names this card').toEqual([
      {tag: 'earth', n: '2', wild: null, self: null},
      {tag: 'venus', n: '2', wild: null, self: '1'},
    ]);
    await expect(why.locator('[data-count-sets]'), '«→ 2 пары»').toHaveAttribute('data-count-sets-n', '2');
    await expect(why.locator('[data-count-sets]')).toContainText('2 пары');
    await expect(why, 'the total is the sets').toHaveAttribute('data-count-why-total', '2');
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+2');
    await expect(page.locator(`${PLAY} .con-payrow[data-pay-unit="steel"], ${PLAY} .con-payrow[data-pay-unit="titanium"]`), 'neither steel nor titanium is offered')
      .toHaveCount(0);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    const stopPlay = await storyboard(page, 'play');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await stopPlay();
    await waitForBoardHome(page, 30);
    const afterPlay = await wireOf(request, id);
    expect(afterPlay.thisPlayer.megacreditProduction - production0, 'the server: +2 M€ production').toBe(2);
    expect(afterPlay.thisPlayer.megacredits, '15 − 11').toBe(4);
    await shoot(page, 'c-played');

    // ── (2) THE ACTION, the same turn ──
    await openTourismAction(page);
    const chips = await actionChips(page);
    expect(chips.floater, '«0 → 1 на этой карте»').toMatchObject({cur: '0', res: '1'});
    expect(chips.vp.note, 'the first floater buys no point yet — «до следующего ещё 2»').toContain('ещё 2');
    for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await shoot(page, 'd-action');
    await armTransferWitness(page);
    const stopAction = await storyboard(page, 'action');
    await commitOnce(page, posts, 1);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.find((c) => c.name === CARD)?.resources, {timeout: 30_000, message: 'the server added the floater'}).toBe(1);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stopAction();
    await cinematicBeat(page, 500, 'the board settles for the frame');
    await shoot(page, 'e-after-action');
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'action-trail.txt'), transferTrail(witness) + '\n');
    console.log(`[p69] action trail\n${transferTrail(witness)}`);
    expect(witness.births.some((b) => b.under === 'hero'), `the floater is born on the card's printed icon (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(witness.landings.some((l) => l.under === 'hero'), `it lands in the hero's capsule (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // Used this generation — the server's own list (the browse grid's default filter «Не активированы» hides the tile).
    expect((await wireOf(request, id)).thisPlayer.actionsThisGeneration, 'the action is spent for the generation').toContain(CARD);
    expect(posts.length, 'two POSTs in all — the play and the action').toBe(2);
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('the wild tag is DEALT to the Venus side and NAMED there, beside this card\'s own tag', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'cloud-tourism-wild', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const production0 = (await wireOf(request, id)).thisPlayer.megacreditProduction;
    await openPlayComposer(page, 'w-hand');
    expect(await setSides(page), 'Earth 2 · Venus 2 (incl. [wild] 1 · this card 1)').toEqual([
      {tag: 'earth', n: '2', wild: null, self: null},
      {tag: 'venus', n: '2', wild: '1', self: '1'},
    ]);
    await expect(page.locator(`${PLAY} [data-count-why] [data-count-sets]`)).toHaveAttribute('data-count-sets-n', '2');
    await shoot(page, 'w-composer');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacreditProduction - production0, {timeout: 30_000, message: 'the server: +2 production'}).toBe(2);
  });

  test('the third floater: «2 → 3» and «ПО 0 → 1», the score cell ticks on its own token', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'cloud-tourism-vp', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const v0 = (await wireOf(request, id)).thisPlayer.victoryPointsBreakdown.total;
    await openTourismAction(page);
    const chips = await actionChips(page);
    expect(chips.floater, '«2 → 3 на этой карте»').toMatchObject({cur: '2', res: '3'});
    expect(chips.vp, '«ПО 0 → 1»').toMatchObject({cur: '0', res: '1'});
    for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await shoot(page, 'g-vp-composer');
    await armScoreProbe(page);
    await armTransferWitness(page);
    const stop = await storyboard(page, 'vp');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.victoryPointsBreakdown.total - v0, {timeout: 30_000, message: 'the server: +1 VP'}).toBe(1);
    await expect.poll(async () => (await readScoreProbe(page)).vp.at(-1)?.[1], {timeout: 40_000}).toBe(String(v0 + 1));
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'h-vp-after');
    const probe = await readScoreProbe(page);
    const witness = await transferWitness(page);
    console.log('[p69] vp probe', JSON.stringify(probe));
    console.log(`[p69] vp trail\n${transferTrail(witness)}`);
    expect(probe.samples, 'the sampler ran').toBeGreaterThan(10);
    // TR55 law 4 — an action's chain scores «on landing»: the FLOATER is the point's body (Security Fleet's fighter is
    // the same case), so the cell ticks on the floater's own touchdown in the hero's capsule — no second token, no named
    // cause. The witness and the probe arm within a few ms of each other, hence the small tolerance.
    const floater = witness.landings.find((l) => l.under === 'hero' && l.touched !== undefined);
    expect(floater, `the third floater touched down in the hero's capsule (trail:\n${transferTrail(witness)})`).toBeDefined();
    const reached = probe.vp.find(([, v]) => Number(v) === v0 + 1);
    expect(reached, `the cell reached ${v0 + 1}: ${JSON.stringify(probe.vp)}`).toBeDefined();
    expect(probe.vp.filter(([t]) => t < floater!.touched! - 40).every(([, v]) => Number(v) === v0),
      `the cell read ${v0} until the floater's touchdown (${floater!.touched}) — ${JSON.stringify(probe.vp)}`).toBe(true);
    expect(reached![0], `the cell ticks on the floater's touchdown (${floater!.touched}), never before — ${JSON.stringify(probe.vp)}`).toBeGreaterThanOrEqual(floater!.touched! - 40);
    expect(probe.reasons, 'the floater IS the cause — nothing to name').toEqual([]);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    await waitForBoardHome(page, 30);
  });
});
