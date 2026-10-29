import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, reloadConsole, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P76 «ЭКСПЕДИЦИЯ ИШТАР» — THE FIRST PRELUDE 2 CARD, and the witness of a class that had none: a play FROM THE HAND whose
 * result is a RESOURCE (3 titanium, born on the landed card — an event face-down on its pile) AND a SEARCH BY TAG (the deck turned over
 * until two Venus cards show — the tape, the one discard pile, the finds), taken into the dock, the flow LEAVING
 * (docs/claude/prompts/prelude2-p76-ishtar-expedition.md §3; docs/PRELUDE2_ADAPTATION.md).
 *
 *   A · `ishtar-expedition-locked` (Venus 8 %): the hand's verdict refuses the play and names Venus with both numbers;
 *       A on the card sends nothing.
 *   B · `ishtar-expedition` (Venus 10 %; the deck's top Ants ✗ → Venusian Insects ✓ → Birds ✗ → Aerial Mappers ✓):
 *       the composer names the rule on its draw chip, nothing is sent before A, ONE POST plays; the crumb keeps its root
 *       and the card while the tail only grows to «ДОБОР КАРТ»; the titanium is born on the landed card and lands on the
 *       titanium row; the search's reveal stands INSIDE the hand with «вскрыто 4 · получено 2 · сброшено 2», the pile
 *       reads 2; X inspects a find over the stage and B returns to the same stage; B takes both into the dock and the
 *       workspace LEAVES; the server: 14 M€, 3 titanium, the two Venus cards in hand; the journal names the search.
 *   C · the same table, a reload while the reveal stands: the batch is still there with the same two cards, one take.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P76 (the dry run there proves the batch). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Ishtar Expedition';
const CARD_RU = 'Экспедиция Иштар';
const ROOT_RU = 'Карты в руке';
const RULE = 'with:venus';
const FOUND = ['Venusian Insects', 'Aerial Mappers'];
const OUT = path.resolve('screenshots', 'p76');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const ZONE = '.con-hand__outcome';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{cards: Array<{name: string}>}>,
  thisPlayer: {megacredits: number, titanium: number, tableau: Array<{name: string}>},
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

type Series = Array<[number, string]>;
type Probe = {
  ticks: number,
  steps: Array<string>,
  crumbMisses: Array<string>,
  pile: Series,
  titanium: Series,
  revealInHand: boolean,
  revealOutsideHand: boolean,
  wsMax: number,
  stranded: boolean,
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root}) => {
    const p: Probe = {ticks: 0, steps: [], crumbMisses: [], pile: [], titanium: [], revealInHand: false, revealOutsideHand: false, wsMax: 0, stranded: false};
    (window as unknown as {__p76: Probe}).__p76 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const head = document.querySelector('.con-hand .con-wshead');
      if (head !== null) {
        const rootText = text(head.querySelector('.con-wshead__root'));
        const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
        if (rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) {
          if (p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${Date.now() - t0}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
        }
        head.querySelectorAll('.con-wshead__step').forEach((el) => {
          const step = text(el);
          if (step !== '' && !p.steps.includes(step)) {
            p.steps.push(step);
          }
        });
      }
      note(p.pile, document.querySelector('[data-discard-pile]')?.getAttribute('data-discard-pile-count') ?? '');
      note(p.titanium, text(document.querySelector('.con-res__row--titanium .con-res__digits')));
      document.querySelectorAll('.con-reveal').forEach((el) => {
        if (el.closest('.con-hand__outcome') !== null) {
          p.revealInHand = true;
        } else if (el.getBoundingClientRect().width > 1) {
          p.revealOutsideHand = true;
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU});
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p76: Probe}).__p76);

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

/** Play up to the search's reveal standing in the hand — the walk C reloads in the middle of. */
async function playToReveal(page: Page, posts: Array<string>): Promise<void> {
  await focusInHand(page);
  await press(page, 'Enter', 1200);
  await page.locator(COMPOSER).waitFor({timeout: 15_000});
  await settle(page);
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
  await page.locator(`${ZONE} .con-reveal [data-reveal-search]`).waitFor({timeout: 60_000});
  await expect(page.locator(`${ZONE} .con-reveal__namebar:not(.con-reveal__namebar--held)`), 'the batch has landed').toHaveCount(1, {timeout: 30_000});
  await settle(page, {timeoutMs: 40_000});
}

test.describe(`P76 Ishtar Expedition · a play from the hand with a reward and a search by tag · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · Venus 8 %: the verdict refuses the play and names Venus 8 / 10; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'ishtar-expedition-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    await expect(verdict, 'Venus with both numbers').toContainText('8/10');
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · the play: the rule before A, ONE POST, the titanium from the card, the search inside the hand, the take, the flow leaves', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'ishtar-expedition', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect(before.thisPlayer.titanium, 'the fixture: no titanium').toBe(0);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'Venus 10 %: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await shoot(page, 'a-open');

    // ── the composer: the rule named BEFORE the press ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const draw = page.locator(`${COMPOSER} .action-effect-chip`).filter({has: page.locator('.resource_icon--cards')});
    await expect(draw, 'one draw chip').toHaveCount(1);
    await expect(draw.locator('.action-effect-chip__amount')).toHaveText('+2');
    await expect(draw.locator('[data-draw-search]'), 'the chip carries the server\'s rule').toHaveAttribute('data-draw-search', RULE);
    const next = page.locator(`${COMPOSER} .con-composer__next`).filter({has: page.locator('[data-draw-search]')});
    await expect(next, 'the «Далее» row names the search').toHaveCount(1);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST, the scene ──
    await armProbe(page);
    await armTransferWitness(page);
    const stopStory = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);

    const summary = page.locator(`${ZONE} .con-reveal [data-reveal-search]`);
    await summary.waitFor({timeout: 60_000});
    await expect(page.locator(`${ZONE} .con-reveal__namebar:not(.con-reveal__namebar--held)`), 'the batch has landed').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 40_000});
    await stopStory();
    await expect(summary).toHaveAttribute('data-search-revealed', '4');
    await expect(summary).toHaveAttribute('data-search-taken', '2');
    await expect(summary).toHaveAttribute('data-search-discarded', '2');
    await expect(summary).toHaveAttribute('data-search-exhausted', 'no');
    await expect(summary.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', RULE);
    await expect(page.locator(`${ZONE} .con-reveal [data-zoom-slot]`), 'the two finds').toHaveCount(2);
    for (const name of FOUND) {
      await expect(page.locator(`${ZONE} .con-reveal [data-zoom-slot^="${name}#"]`), `«${name}» found`).toHaveCount(1);
    }
    await expect(page.locator('[data-discard-pile]'), 'the pile: the server\'s two').toHaveAttribute('data-discard-pile-count', '2');
    await cinematicBeat(page, 700, 'the row settles for the frame');
    await shoot(page, 'd-search');

    const probe = await readProbe(page);
    test.info().annotations.push({type: 'probe', description: JSON.stringify({steps: probe.steps, pile: probe.pile, titanium: probe.titanium, wsMax: probe.wsMax})});
    expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
    expect(probe.crumbMisses, 'the crumb keeps its root and the card on every sample').toEqual([]);
    expect(probe.steps[probe.steps.length - 1], 'the last stage: the draw').toMatch(/добор карт/i);
    expect(probe.revealInHand, 'the reveal stands inside the hand').toBe(true);
    expect(probe.revealOutsideHand, 'never a band of its own').toBe(false);
    expect(probe.wsMax, 'one workspace').toBeLessThanOrEqual(1);
    expect(probe.stranded, 'nothing stranded').toBe(false);

    // The titanium: born on the landed card where it lies — an EVENT lands face-down on the «События» pile and its
    // rewards emerge from it (`consolePlayedHero` § heroRewardSourceSelectors: «the card's honest on-table location»),
    // so the birth is the card (`recv:front`), never a printed icon its face no longer shows; landed on the titanium
    // row with its contact beat.
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-trail.txt'), transferTrail(witness) + '\n');
    const landedTi = witness.landings.filter((e) => e.under === 'rail:titanium');
    expect(landedTi.length, `the titanium landed on its row (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    for (const landing of landedTi) {
      const birth = witness.births.find((b) => b.id === landing.id);
      expect(birth?.under, `born on the landed card (trail:\n${transferTrail(witness)})`).toMatch(/^(recv:front|printed:.*titanium)$/);
      expect(landing.touched, 'its contact beat played').toBeDefined();
    }
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // ── M: X inspects a find OVER the stage; B returns to the same stage ──
    const zoom = page.locator('.con-zoom');
    for (let i = 0; i < 3 && await zoom.count() === 0; i++) {
      await press(page, 'KeyX', 1200);
    }
    await expect(zoom, 'X opens the viewer').toHaveCount(1, {timeout: 10_000});
    await expect(page.locator(`${ZONE} .con-reveal`), 'the stage stays mounted under the viewer').toHaveCount(1);
    await shoot(page, 'g-inspect');
    await press(page, 'Escape', 1200);
    await expect(zoom, 'B closes the viewer').toHaveCount(0, {timeout: 10_000});
    await expect(page.locator(`${ZONE} .con-reveal [data-zoom-slot]`), 'the same stage, the same two cards').toHaveCount(2);
    expect(posts.length, 'inspecting sends nothing').toBe(1);

    // ── the take: B → the dock, the workspace LEAVES ──
    const dockBefore = Number(await page.locator('[data-hand-total]').getAttribute('data-hand-total') ?? 'NaN');
    await press(page, 'Escape', 600);
    await expect(page.locator('.con-hand'), 'the workspace leaves after the last card').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    const dockAfter = Number(await page.locator('[data-hand-total]').getAttribute('data-hand-total') ?? 'NaN');
    if (Number.isFinite(dockBefore) && Number.isFinite(dockAfter)) {
      expect(dockAfter - dockBefore, 'two cards landed in the dock').toBe(2);
    }
    expect(await page.locator('.con-ws').count(), 'no workspace left standing').toBe(0);
    const after = await wireOf(request, id);
    for (const name of FOUND) {
      expect(after.cardsInHand?.map((c) => c.name), `«${name}» in hand`).toContain(name);
    }
    expect(after.cardDrawReveals ?? [], 'nothing left to take').toEqual([]);
    expect(after.thisPlayer.titanium, '+3 titanium').toBe(3);
    expect(after.thisPlayer.megacredits, '6 M€ paid').toBe(before.thisPlayer.megacredits - 6);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);
    await shoot(page, 'f-after');

    // ── the journal: the play's row names the search ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'f-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('C · a reload while the search\'s reveal stands: the same two cards, one take', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ishtar-expedition', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await playToReveal(page, posts);
    const mid = await wireOf(request, id);
    expect(mid.cardDrawReveals?.[0]?.cards.map((c) => c.name), 'the batch on the wire').toEqual(FOUND);

    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000});
    const reveal = page.locator('.con-reveal');
    await expect(reveal, 'the reveal stands again after the reload').toHaveCount(1, {timeout: 60_000});
    for (const name of FOUND) {
      await expect(reveal.locator(`[data-zoom-slot^="${name}#"]`), `«${name}» still there`).toHaveCount(1);
    }
    test.info().annotations.push({type: 'reload-host', description: await page.evaluate(() =>
      document.querySelector('.con-reveal')?.closest('.con-hand__outcome') !== null ? 'hand' : 'standalone')});
    await shoot(page, 'l-reloaded');
    await press(page, 'Escape', 600);
    await expect.poll(async () => ((await wireOf(request, id)).cardDrawReveals ?? []).length, {timeout: 30_000}).toBe(0);
    const after = await wireOf(request, id);
    for (const name of FOUND) {
      expect(after.cardsInHand?.map((c) => c.name), `«${name}» in hand`).toContain(name);
    }
    expect(posts.length, 'the play stayed ONE POST').toBe(1);
  });
});
