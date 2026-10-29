import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P85 «ЛОГИСТИКА САММИТА» — THE FIRST POLITICAL PRELUDE 2 CARD, and the witness of three classes that had none
 * (docs/claude/prompts/prelude2-p85-summit-logistics.md §3):
 *   · a PARTY REQUIREMENT in the hand — the verdict names the Scientists and refuses the play while neither road is open;
 *   · a COUNTED CHIP WITH TWO BASES that explains itself — «ПОЧЕМУ»: the planet tags as a ROW of their icons with the
 *     Scientists' wild tag named as its share, «+» the colonies (`countedPlay` — a summed basis; the server's `tags` / `wild`);
 *   · a PAYMENT WITH TWO ALTERNATIVE SOURCES on one card (steel for the Building tag, titanium for the Space tag).
 *
 *   A · `summit-logistics-locked` (the Scientists' resolution up for the vote, blue with no delegate on it): the hand's
 *       verdict refuses the play and names the party; A on the card sends nothing.
 *   B · `summit-logistics` (the Scientists rule; blue's Earth (Teractor) + Jovian + Mars tags, the Scientists' wild tag,
 *       one colony; 20 M€, 2 steel, 1 titanium): the hand plate reads «+5»; the composer's «ПОЧЕМУ» reads the two terms
 *       (tags 4 · of them wild 1 · + colonies 1) and the chip no longer prints its own basis; the payment takes 2 steel +
 *       1 titanium + 3 M€; ONE POST; the crumb keeps «Карты в руке › Логистика саммита» while the tail grows to «ДОБОР
 *       КАРТ»; the M€ lands on its row; the two cards stand INSIDE the hand; B takes them, the flow LEAVES; the server:
 *       22 M€, 0 steel, 0 titanium, two more cards, the card in the tableau.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P85 (the dry run there proves the payment and the count). Storyboard:
 * `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Summit Logistics';
const CARD_RU = 'Логистика саммита';
const ROOT_RU = 'Карты в руке';
const OUT = path.resolve('screenshots', 'p85');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const ZONE = '.con-hand__outcome';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{cards: Array<{name: string}>}>,
  thisPlayer: {megacredits: number, steel: number, titanium: number, tableau: Array<{name: string}>},
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

type Probe = {
  ticks: number,
  steps: Array<string>,
  crumbMisses: Array<string>,
  revealInHand: boolean,
  revealOutsideHand: boolean,
  wsMax: number,
  stranded: boolean,
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root}) => {
    const p: Probe = {ticks: 0, steps: [], crumbMisses: [], revealInHand: false, revealOutsideHand: false, wsMax: 0, stranded: false};
    (window as unknown as {__p85: Probe}).__p85 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p85: Probe}).__p85);

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

const usedOf = async (page: Page, unit: string): Promise<number> =>
  Number((await page.locator(`${COMPOSER} .con-payrow[data-pay-unit="${unit}"] .con-payrow__used`).innerText()).replace(/\D+/g, '') || 'NaN');

test.describe(`P85 Summit Logistics · a political requirement, a two-term count, two alternative sources · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · neither road open: the verdict refuses the play and names the Scientists; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'summit-logistics-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    // The compact counter of the reason grammar: the party by its EMBLEM (`requirementPartyEmblem` — the card's own
    // plate mark) and the standing «0/2»; the full sentence is the fullscreen panel's.
    const reason = verdict.locator('.con-hand__reason').filter({has: page.locator('[data-reason-emblem]')});
    await expect(reason, 'one reason: the party').toHaveCount(1);
    await expect(reason.locator('[data-reason-emblem]'), 'the Scientists\' emblem').toHaveAttribute('src', /scientists/);
    await expect(reason, 'the standing: 0 of 2').toContainText('0/2');
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · the play: the count explains itself, two alternative sources, ONE POST, the draw inside the hand, the flow leaves', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'summit-logistics', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, before.thisPlayer.steel, before.thisPlayer.titanium], 'the fixture: 20 M€, 2 steel, 1 titanium').toEqual([20, 2, 1]);
    const handBefore = before.cardsInHand?.length ?? 0;

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'the Scientists rule: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
    await expect(plate, 'the hand plate: the server\'s count').toHaveAttribute('data-hand-count', '5');
    await shoot(page, 'a-open');

    // ── the composer: «ПОЧЕМУ» reads the two terms, the payment two sources ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const why = page.locator(`${COMPOSER} [data-count-why]`);
    await expect(why, 'the «why» strip stands').toHaveCount(1);
    const tags = why.locator('[data-count-term="Your tags"]');
    await expect(tags, 'the planet tags: Earth + Jovian + Mars + the Scientists\' wild tag').toHaveAttribute('data-count-term-n', '4');
    await expect(tags.locator('[data-count-glyph] > *'), 'the planet tags as a ROW of four icons (J · E · V · M)').toHaveCount(4);
    await expect(tags.locator('[data-count-wild]'), 'the wild share is NAMED').toHaveAttribute('data-count-wild', '1');
    await expect(why.locator('[data-count-term="Your colonies"]'), 'the colonies').toHaveAttribute('data-count-term-n', '1');
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+5');
    await expect(page.locator(`${COMPOSER} .action-effect-chip__basis`), 'the chip does not print its basis twice').toHaveCount(0);

    for (let i = 0; i < 2 && (await usedOf(page, 'steel') < 2 || await usedOf(page, 'titanium') < 1); i++) {
      await press(page, 'Period', 500); // RT — fill the alternative sources
    }
    expect(await usedOf(page, 'steel'), 'steel: both').toBe(2);
    expect(await usedOf(page, 'titanium'), 'titanium: the one').toBe(1);
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
    expect(posts[0], 'paid with steel').toMatch(/"steel":2/);
    expect(posts[0], 'paid with titanium').toMatch(/"titanium":1/);

    await page.locator(`${ZONE} .con-reveal [data-zoom-slot]`).first().waitFor({timeout: 60_000});
    await expect(page.locator(`${ZONE} .con-reveal [data-zoom-slot]`), 'the two drawn cards').toHaveCount(2, {timeout: 30_000});
    await settle(page, {timeoutMs: 40_000});
    await stopStory();
    await cinematicBeat(page, 700, 'the row settles for the frame');
    await shoot(page, 'd-draw');

    const probe = await readProbe(page);
    test.info().annotations.push({type: 'probe', description: JSON.stringify({steps: probe.steps, wsMax: probe.wsMax})});
    expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
    expect(probe.crumbMisses, 'the crumb keeps its root and the card on every sample').toEqual([]);
    expect(probe.steps[probe.steps.length - 1], 'the last stage: the draw').toMatch(/добор карт/i);
    expect(probe.revealInHand, 'the draw stands inside the hand').toBe(true);
    expect(probe.revealOutsideHand, 'never a band of its own').toBe(false);
    expect(probe.wsMax, 'one workspace').toBeLessThanOrEqual(1);
    expect(probe.stranded, 'nothing stranded').toBe(false);

    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-trail.txt'), transferTrail(witness) + '\n');
    expect(witness.landings.filter((e) => e.under === 'rail:megacredits').length, `the M€ landed on its row (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // ── the take: B → the dock, the workspace LEAVES ──
    await press(page, 'Escape', 600);
    await expect(page.locator('.con-hand'), 'the workspace leaves after the take').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    expect(await page.locator('.con-ws').count(), 'no workspace left standing').toBe(0);
    const after = await wireOf(request, id);
    expect(after.cardDrawReveals ?? [], 'nothing left to take').toEqual([]);
    expect(after.thisPlayer.megacredits, '20 − 3 + 5').toBe(22);
    expect(after.thisPlayer.steel, 'the steel paid').toBe(0);
    expect(after.thisPlayer.titanium, 'the titanium paid').toBe(0);
    expect((after.cardsInHand?.length ?? 0) - (handBefore - 1), 'two cards came in').toBe(2);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the card in the tableau').toContain(CARD);
    await shoot(page, 'f-after');

    // ── the journal names the card ──
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
});
