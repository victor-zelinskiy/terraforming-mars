import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, playCardFromHand, playQueueCard, press, settle, walkFocusUntil} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P54 NOBEL PRIZE — the thirty-sixth Prelude 2 card (ledger FM): «Gain 5 M€. Draw 2 cards with requirements.», a WILD
 * tag, 2 VP — FULLY DECLARATIVE, the draw a NAMED search on ANY requirement (`[data-draw-search="requirement"]`).
 *
 * The FIRST start stand with a SEEDED project deck (the API road seeds nothing, so P44 / P51 could only claim «the rule
 * was seen»): fixtures `nobel-prize*` (tests/e2e/fixtures/generate.ts § P54 — each dry run proves the tape):
 *   (A) the start: A on the prelude in the queue → +5 M€ off the printed «5» into the M€ row, the +2 VP off the landed
 *       face's badge into the score cell (the first prelude whose play moves the score at the start), the search reveal
 *       with its badge «ВСКРЫТО 4 · ПОЛУЧЕНО 2 · СБРОШЕНО 2 — [MIN] с требованием», R3 on the pile → Power Plant's verdict
 *       «Не подошла · с требованием» (the rule, positively), the take → Birds + Fish in the hand;
 *   (B) the run-out: the whole deck is Asteroid + Birds → «колода вскрыта до конца», one card taken;
 *   (C) the mid-game road: WG Project deals Nobel Prize — the search reveals INSIDE the hand's outcome zone.
 * The rules are pinned by `tests/cards/prelude2/NobelPrize.spec.ts`; this stand is the JOURNEY on the TV profile.
 * Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p54/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p54', PRESET.id);
const CARD = 'Nobel Prize';
const RULE = 'requirement';
const BADGE = '[data-reveal-search]';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, victoryPointsBreakdown: {total: number}, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const handOf = (w: Wire) => (w.cardsInHand ?? []).map((c) => c.name);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
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

type Probe = {samples: number, rule: number, revealInHand: number, revealOutsideHand: number, outside: Array<string>};
/** From the press on (MutationObserver + setInterval, never rAF): the rule seen, where the reveal stood. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((rule) => {
    const p: Probe = {samples: 0, rule: 0, revealInHand: 0, revealOutsideHand: 0, outside: []};
    (window as unknown as {__p54: Probe}).__p54 = p;
    const sample = () => {
      p.samples++;
      if (document.querySelector(`[data-reveal-search] [data-draw-search="${rule}"]`) !== null) {
        p.rule++;
      }
      for (const el of document.querySelectorAll('.con-reveal:not(.con-reveal--bonus-mode)')) {
        if (el.closest('.con-hand__outcome') !== null) {
          p.revealInHand++;
        } else if ((el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true})) {
          p.revealOutsideHand++;
          if (p.outside.length < 6) {
            p.outside.push(`${(el as HTMLElement).className} start=${document.querySelector('.con-start') !== null}`);
          }
        }
      }
    };
    new MutationObserver(() => sample()).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 30);
  }, RULE);
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p54: Probe}).__p54);

/** The badge of the search, once the batch has landed: the server's numbers, the rule by its signature. */
async function expectBadge(page: Page, scope: string, want: {revealed: number, taken: number, discarded: number, exhausted: boolean}): Promise<void> {
  const badge = page.locator(`${scope} ${BADGE}`.trim()).first();
  await badge.waitFor({timeout: 60_000});
  await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
  await expect(badge, 'revealed').toHaveAttribute('data-search-revealed', String(want.revealed), {timeout: 20_000});
  await expect(badge, 'taken').toHaveAttribute('data-search-taken', String(want.taken));
  await expect(badge, 'discarded').toHaveAttribute('data-search-discarded', String(want.discarded));
  await expect(badge, 'exhausted').toHaveAttribute('data-search-exhausted', want.exhausted ? 'yes' : 'no');
  await expect(badge.locator('[data-draw-search]'), 'the rule by its signature').toHaveAttribute('data-draw-search', RULE);
  await expect(badge, 'the rule in words').toContainText(/с требованием/i);
}

/** Take the batch (A) until the server's hand holds `names`. */
async function take(page: Page, request: APIRequestContext, id: string, names: ReadonlyArray<string>): Promise<Wire> {
  for (let i = 0; i < 10; i++) {
    const wire = await wireOf(request, id);
    if (names.every((n) => handOf(wire).includes(n)) && await page.locator('.con-reveal').count() === 0) {
      return wire;
    }
    if (await page.locator('.con-reveal').count() > 0) {
      await press(page, 'Enter', 900);
    } else {
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    }
  }
  return wireOf(request, id);
}

async function bootQueue(page: Page, request: APIRequestContext, fixture: 'nobel-prize' | 'nobel-prize-exhausted'): Promise<string> {
  const id = await bootFixture(page, request, fixture, {query: PRESET.query, landing: 'prompt'});
  await settle(page, {timeoutMs: 30_000});
  await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
  await settle(page, {timeoutMs: 30_000});
  return id;
}

test.describe(`P54 Nobel Prize · the named search «с требованием» on a seeded deck · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A) the start: +5 M€ and +2 VP each off its printed cause, the badge «4 · 2 · 2 — с требованием», the verdict of a discard, Birds + Fish taken', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootQueue(page, request, 'nobel-prize');
    const before = await wireOf(request, id);
    await shoot(page, 'A-01-queue');

    await armTransferWitness(page);
    await armProbe(page);
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expectBadge(page, '', {revealed: 4, taken: 2, discarded: 2, exhausted: false});
    await shoot(page, 'A-02-reveal');

    // R3: the pile — Power Plant thrown away for the rule it did not meet, said POSITIVELY.
    const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
    for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
      await press(page, 'KeyV', 1200);
    }
    await expect(verdict, 'a positive filter\'s discard names the RULE it missed').toHaveAttribute('data-verdict-kind', 'rule', {timeout: 10_000});
    await expect(verdict.locator('[data-draw-search]'), 'the verdict reads the same rule').toHaveAttribute('data-draw-search', RULE);
    await expect(verdict, 'never «без требования»').toContainText(/Не подошла/i);
    await expect(verdict).not.toContainText(/без треб/i);
    await shoot(page, 'A-03-verdict');
    await press(page, 'Escape', 1200);

    const after = await take(page, request, id, ['Birds', 'Fish']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-04-after');

    // The server: +5 M€, the two cards WITH a requirement in the hand, +2 VP on the table.
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '+5 M€').toBe(5);
    expect(handOf(after), 'Birds and Fish taken').toEqual(expect.arrayContaining(['Birds', 'Fish']));
    expect(handOf(after).length - handOf(before).length, 'exactly two cards drawn').toBe(2);
    expect(after.thisPlayer.victoryPointsBreakdown.total - before.thisPlayer.victoryPointsBreakdown.total, '+2 VP').toBe(2);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the prelude on the table').toContain(CARD);
    // The rail: the WILD cell counts the prelude's printed «?».
    await expect.poll(async () => (await page.locator('[data-tag-cell="wild"]').first().textContent().catch(() => '') ?? '').replace(/\s+/g, ''),
      {timeout: 10_000, message: 'the МЕТКИ panel: the wild cell reads 1'}).toContain('1');

    // The witness: the M€ off the card into its row, the points off the printed badge into the score cell.
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'A-trail.txt'), `${trail}\n`);
    expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `the 5 M€ landed on the M€ row (trail:\n${trail})`).toBe(true);
    const vpBirth = witness.births.find((b) => b.under === 'vp-badge');
    expect(vpBirth, `the points were born on the landed face's printed badge (trail:\n${trail})`).toBeDefined();
    expect(witness.landings.find((l) => l.id === vpBirth!.id)?.under, `the VP token landed on the score cell (trail:\n${trail})`).toBe('rail:vp');
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p54-probe', description: JSON.stringify(probe)});
    expect(probe.samples, 'the probe sampled').toBeGreaterThan(10);
    expect(probe.rule, 'the reveal named its rule «с требованием»').toBeGreaterThan(0);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) the run-out: the whole deck is Asteroid + Birds — «колода вскрыта до конца», one card taken', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootQueue(page, request, 'nobel-prize-exhausted');
    const before = await wireOf(request, id);
    const stop = await storyboard(page, 'runout');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expectBadge(page, '', {revealed: 2, taken: 1, discarded: 1, exhausted: true});
    await expect(page.locator('[data-search-end]').first(), 'the run-out is NAMED').toBeVisible();
    await shoot(page, 'B-01-runout');
    const after = await take(page, request, id, ['Birds']);
    await stop();
    expect(handOf(after).length - handOf(before).length, 'one card — all the deck had').toBe(1);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '+5 M€ all the same').toBe(5);
  });

  test('(C) mid-game: WG Project deals Nobel Prize — the search reveals INSIDE the hand, the points off the badge', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'nobel-prize-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    const pick = '.con-hand__outcome .con-deckpick--play';
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
    await press(page, 'Enter', 400);
    await armTransferWitness(page);
    await armProbe(page);
    const stop = await storyboard(page, 'wg');
    const sent = posts.length;
    for (let attempt = 0; attempt < 3 && posts.length === sent; attempt++) {
      await press(page, 'Period', 300); // RT — the commit
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(sent).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(sent + 1);
    await expectBadge(page, '.con-hand__outcome', {revealed: 4, taken: 2, discarded: 2, exhausted: false});
    await shoot(page, 'C-01-reveal-in-hand');
    const after = await take(page, request, id, ['Birds', 'Fish']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    expect(after.thisPlayer.victoryPointsBreakdown.total - before.thisPlayer.victoryPointsBreakdown.total, '+2 VP').toBe(2);
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p54-probe', description: JSON.stringify(probe)});
    expect(probe.revealOutsideHand, `the search never left the hand (${probe.outside.join(' | ')})`).toBe(0);
    expect(probe.rule, 'the rule was named').toBeGreaterThan(0);
    const witness = await transferWitness(page);
    expect(witness.births.some((b) => b.under === 'vp-badge'), `the points off the printed badge (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });
});
