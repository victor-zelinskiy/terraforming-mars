import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, playCardFromHand, playQueueCard, press, settle, walkFocusUntil} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P56 PLANETARY ALLIANCE — the thirty-eighth Prelude 2 card (ledger FP): «Raise your TR 2 steps. Draw 1 Jovian card and
 * 1 Venus card.» — DECLARATIVE (`drawCard: [jovian, venus]`), the first card whose ONE play runs TWO named searches with
 * different rules: one batch, two segments, each with its rule — ONE badge naming both rules in order, ONE tape (R4),
 * and every discard judged by the rule of the search that threw it away.
 *
 * Fixtures `planetary-alliance*` (tests/e2e/fixtures/generate.ts § P56 — each dry run proves the tape):
 *   (A) the start: A on the prelude in the queue → +2 TR off the played face into the rating cell (the first start
 *       stand to witness `rail:tr`), the reveal IN the start's zone, the badge «ВСКРЫТО 4 · ПОЛУЧЕНО 2 · СБРОШЕНО 2 —
 *       с меткой [Юпитер] · [Венера]», R3 on the pile → Power Plant «Не подошла · с меткой Юпитер» and Ganymede Colony
 *       — a JOVIAN card — «Не подошла · с меткой Венера» (the lie detector: the batch-level rule is the first search's);
 *       the take → Io Mining Industries + Aerial Mappers in the hand;
 *   (B) the Venus run-out: the whole deck is Io Mining + Ganymede Colony — the Venus search finds nothing, its tape rides
 *       the batch as an EMPTY exhausted segment: «колода вскрыта до конца», its discard judged «с меткой Венера»;
 *   (C) the mid-game road: WG Project deals Planetary Alliance — the same badge INSIDE the hand's outcome zone.
 * The rules are pinned by `tests/cards/prelude2/PlanetaryAlliance.spec.ts`, the readings by `drawSearchReading.spec`;
 * this stand is the JOURNEY on the TV profile. Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p56/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p56', PRESET.id);
const CARD = 'Planetary Alliance';
const RULES = 'with:jovian with:venus';
const BADGE = '[data-reveal-search]';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {terraformRating: number, tableau: Array<{name: string}>},
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

type Probe = {samples: number, rules: number, firstOnly: number, revealInHand: number, revealOutsideHand: number, outside: Array<string>};
/**
 * From the press on (MutationObserver + setInterval, never rAF): the badge naming BOTH rules, a badge ever naming the
 * first rule ALONE (the lie — must stay 0), where the reveal stood.
 */
async function armProbe(page: Page, scope: 'start' | 'hand'): Promise<void> {
  await page.evaluate(({rules, scope}) => {
    const p: Probe = {samples: 0, rules: 0, firstOnly: 0, revealInHand: 0, revealOutsideHand: 0, outside: []};
    (window as unknown as {__p56: Probe}).__p56 = p;
    const sample = () => {
      p.samples++;
      for (const rule of document.querySelectorAll('[data-reveal-search] [data-draw-search]')) {
        const signature = rule.getAttribute('data-draw-search');
        if (signature === rules) {
          p.rules++;
        } else if (signature === 'with:jovian') {
          p.firstOnly++;
        }
      }
      for (const el of document.querySelectorAll('.con-reveal:not(.con-reveal--bonus-mode)')) {
        const home = scope === 'hand' ? '.con-hand__outcome' : '[data-embed-slot="start"], .con-start';
        if (el.closest(home) !== null) {
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
  }, {rules: RULES, scope});
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p56: Probe}).__p56);

/** The badge of the searches, once the batch has landed: the server's numbers, BOTH rules by their signature, in order. */
async function expectBadge(page: Page, scope: string, want: {revealed: number, taken: number, discarded: number, exhausted: boolean}): Promise<void> {
  const badge = page.locator(`${scope} ${BADGE}`.trim()).first();
  await badge.waitFor({timeout: 60_000});
  await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
  await expect(badge, 'revealed').toHaveAttribute('data-search-revealed', String(want.revealed), {timeout: 20_000});
  await expect(badge, 'taken').toHaveAttribute('data-search-taken', String(want.taken));
  await expect(badge, 'discarded').toHaveAttribute('data-search-discarded', String(want.discarded));
  await expect(badge, 'exhausted').toHaveAttribute('data-search-exhausted', want.exhausted ? 'yes' : 'no');
  const rule = badge.locator('[data-draw-search]');
  await expect(rule, 'ONE rule phrase in the badge').toHaveCount(1);
  await expect(rule, 'both rules by their signature, in segment order').toHaveAttribute('data-draw-search', RULES);
  await expect(rule.locator('.con-dsearch__tag'), 'two medallions').toHaveCount(2);
  await expect(rule.locator('.con-dsearch__tag').nth(0)).toHaveAttribute('data-tag', 'jovian');
  await expect(rule.locator('.con-dsearch__tag').nth(1)).toHaveAttribute('data-tag', 'venus');
  await expect(rule.locator('.con-dsearch__label'), 'the word «с меткой» once').toHaveCount(1);
  await expect(badge, 'the rule in words').toContainText(/с меткой/i);
}

/** R3 on the pile, then each discard's verdict in the tray's order: the rule of the search that threw it away. */
async function expectVerdicts(page: Page, rules: ReadonlyArray<'with:jovian' | 'with:venus'>, shotPrefix: string): Promise<void> {
  const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
  for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
    await press(page, 'KeyV', 1200);
  }
  for (let i = 0; i < rules.length; i++) {
    await expect(verdict, `discard ${i + 1}: a positive filter's discard names the RULE it missed`).toHaveAttribute('data-verdict-kind', 'rule', {timeout: 10_000});
    await expect(verdict.locator('[data-draw-search]'), `discard ${i + 1} is judged by ITS OWN search`).toHaveAttribute('data-draw-search', rules[i], {timeout: 10_000});
    await expect(verdict).toContainText(/Не подошла/i);
    await shoot(page, `${shotPrefix}-${i + 1}`);
    if (i + 1 < rules.length) {
      await press(page, 'ArrowRight', 900);
    }
  }
  await press(page, 'Escape', 1200);
  await expect(page.locator('.con-zoom'), 'B returns to the reveal').toHaveCount(0, {timeout: 10_000});
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

async function bootQueue(page: Page, request: APIRequestContext, fixture: 'planetary-alliance' | 'planetary-alliance-exhausted'): Promise<string> {
  const id = await bootFixture(page, request, fixture, {query: PRESET.query, landing: 'prompt'});
  await settle(page, {timeoutMs: 30_000});
  await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
  await settle(page, {timeoutMs: 30_000});
  return id;
}

test.describe(`P56 Planetary Alliance · two named searches of one play, a rule per segment · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A) the start: +2 TR off the card into the rating cell, ONE badge naming both rules, each discard by its own search, Io Mining + Aerial Mappers taken', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootQueue(page, request, 'planetary-alliance');
    const before = await wireOf(request, id);
    await shoot(page, 'A-01-queue');

    await armTransferWitness(page);
    await armProbe(page, 'start');
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expectBadge(page, '', {revealed: 4, taken: 2, discarded: 2, exhausted: false});
    await shoot(page, 'A-02-reveal');

    // R3: the pile — Power Plant thrown away by the JOVIAN search, Ganymede Colony (a Jovian card!) by the VENUS one.
    await expectVerdicts(page, ['with:jovian', 'with:venus'], 'A-03-verdict');

    const after = await take(page, request, id, ['Io Mining Industries', 'Aerial Mappers']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-04-after');

    // The server: +2 TR, the Jovian card and the Venus card in the hand, the prelude on the table.
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, '+2 TR').toBe(2);
    expect(handOf(after), 'Io Mining Industries and Aerial Mappers taken').toEqual(expect.arrayContaining(['Io Mining Industries', 'Aerial Mappers']));
    expect(handOf(after).length - handOf(before).length, 'exactly two cards drawn').toBe(2);
    expect(handOf(after), 'the discards stay discarded').not.toContain('Ganymede Colony');
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the prelude on the table').toContain(CARD);

    // The witness: the rating off the played card into the rating cell — never out of nothing, never over glass.
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'A-trail.txt'), `${trail}\n`);
    const trLandings = witness.landings.filter((l) => l.under === 'rail:tr');
    expect(trLandings.length, `the TR landed on the rating cell (trail:\n${trail})`).toBeGreaterThan(0);
    for (const landing of trLandings) {
      const birth = witness.births.find((b) => b.id === landing.id);
      expect(birth, `the TR token ${landing.id} was born (trail:\n${trail})`).toBeDefined();
      expect(birth!.under, `the TR token was born on the card, never on the rail (trail:\n${trail})`).not.toMatch(/^rail:/);
    }
    test.info().annotations.push({type: 'p56-tr-births', description: trLandings.map((l) => witness.births.find((b) => b.id === l.id)?.under).join(', ')});
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p56-probe', description: JSON.stringify(probe)});
    expect(probe.samples, 'the probe sampled').toBeGreaterThan(10);
    expect(probe.rules, 'the badge named both rules').toBeGreaterThan(0);
    expect(probe.firstOnly, 'the badge NEVER named the first rule alone').toBe(0);
    expect(probe.revealOutsideHand, `the reveal stood in the start's zone (${probe.outside.join(' | ')})`).toBe(0);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) the Venus run-out: the deck is Io Mining + Ganymede Colony — «колода вскрыта до конца», the discard judged by the Venus search, one card taken', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootQueue(page, request, 'planetary-alliance-exhausted');
    const before = await wireOf(request, id);
    const stop = await storyboard(page, 'runout');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    // The EMPTY Venus segment's tape is counted: 2 turned over (Io ✓, Ganymede ✗), 1 taken, 1 thrown away, run out.
    await expectBadge(page, '', {revealed: 2, taken: 1, discarded: 1, exhausted: true});
    await expect(page.locator('[data-search-end]').first(), 'the run-out is NAMED').toBeVisible();
    await shoot(page, 'B-01-runout');
    await expectVerdicts(page, ['with:venus'], 'B-02-verdict');
    const after = await take(page, request, id, ['Io Mining Industries']);
    await stop();
    expect(handOf(after).length - handOf(before).length, 'one card — all the deck had').toBe(1);
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, '+2 TR all the same').toBe(2);
  });

  test('(C) mid-game: WG Project deals Planetary Alliance — the same badge INSIDE the hand, the TR into the rating cell', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'planetary-alliance-wg', {query: PRESET.query});
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
    await armProbe(page, 'hand');
    const stop = await storyboard(page, 'wg');
    const sent = posts.length;
    for (let attempt = 0; attempt < 3 && posts.length === sent; attempt++) {
      await press(page, 'Period', 300); // RT — the commit
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(sent).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(sent + 1);
    await expectBadge(page, '.con-hand__outcome', {revealed: 4, taken: 2, discarded: 2, exhausted: false});
    await shoot(page, 'C-01-reveal-in-hand');
    const after = await take(page, request, id, ['Io Mining Industries', 'Aerial Mappers']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, '+2 TR').toBe(2);
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p56-probe', description: JSON.stringify(probe)});
    expect(probe.revealOutsideHand, `the search never left the hand (${probe.outside.join(' | ')})`).toBe(0);
    expect(probe.rules, 'both rules were named').toBeGreaterThan(0);
    expect(probe.firstOnly, 'never the first rule alone').toBe(0);
    const witness = await transferWitness(page);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });
});
