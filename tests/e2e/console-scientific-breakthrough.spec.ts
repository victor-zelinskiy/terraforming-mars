import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR52 «НАУЧНЫЙ ПРОРЫВ» and THE DISCARD PILE — ONE OBJECT OF THE TABLE (docs/claude/prompts/project-tr52-scientific-
 * breakthrough.md; the ledger's section AF, PL-260…270; `.claude/rules/console-ui.md` § «СБРОС — ОБЪЕКТ СТОЛА»).
 *
 * The card: a MANDATORY attack — 2 data off ONE card of ANY player (a holder with fewer is not a candidate) — buying
 * a search of the project deck for 2 Science cards. The polish: every card a draw or a hand throws away lands on ONE
 * pile, «СБРОШЕННЫЕ», hanging from the status strip beside the HUD deck — the same place in every host, never a
 * second pile, never a card that vanishes. Against a real server, two profiles:
 *
 *   journey (the hand) — the composer names both candidates (the 1-data Supercomputer is not one), never pre-picks,
 *     and the chosen rival's census reads what the loss costs it («Делегат больше не готов: 3 → 1 / 3», the falling
 *     counter in the spend tone) beside its miniature (PL-269); A = ONE POST; the −2 tokens leave that miniature into
 *     the card's printed icons (PL-268, both ends painted); the deck turns five cards over, the three thrown-away ones
 *     land on the pile beside it (its count ticking 0 → 3, the pile standing still and never doubled), the two found
 *     ones come down into the hand's zone; R3 opens the viewer OUT of the pile; the take; the pile slides home.
 *   clean — two Science cards on top: no pile at all, no R3.
 *   actions («Действия карт», TR05) — the action's own search threw two cards away BEFORE the found one: they leave
 *     the HUD deck onto the same pile (`stream:`), the deck ticks once per card, then the Comet comes down (PL-261).
 *   pluto (the colonies) — a card leaving the HAND (Pluto's «discard 1») lands on the same pile in the same place.
 *
 * Fixtures `scientific-breakthrough*` (tests/e2e/fixtures/generate.ts — each one's dry run checks its deck) and
 * `pluto-settlements-2`. Storyboard: `TM_E2E_STORYBOARD=1` (acceptance is the 4K GPU storyboard, `TM_E2E_GPU=1`).
 */

const CARD = 'Scientific Breakthrough';
const COMPOSER = '.con-composer--play';
const OUT = path.resolve('screenshots', 'scientific-breakthrough');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {megacredits: number};
  players: Array<{color: string, tableau: Array<{name: string, resources?: number}>}>;
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

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

type Series = Array<[number, string]>;
/** THE PILE PROBE — MutationObserver + setInterval (never rAF): the pile as the player sees it, every change. */
type PileProbe = {
  samples: number;
  ticks: number;
  /** The most piles ever in the DOM at once (the law: one). */
  maxPiles: number;
  /** Its count, every change. */
  counts: Series;
  /** Its holders, every change. */
  holders: Series;
  /** The resting stack's centre, every change of more than a pixel. */
  places: Series;
  /** The plate UNDER the HUD deck: below the strip's chip lane (never over the deck's count or its «−N» chip), its
   *  stack under the deck's stack, inside the screen — false once a resting sample is not. */
  besideDeck: boolean;
  /** Where it failed «under the deck» (empty while it holds). */
  besideMiss: string;
  /** The HUD deck counter (its aria value), every change. */
  deck: Series;
};

async function armPileProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__pile: PileProbe};
    const p: PileProbe = {samples: 0, ticks: 0, maxPiles: 0, counts: [], holders: [], places: [], besideDeck: true, besideMiss: '', deck: []};
    w.__pile = p;
    const t0 = Date.now();
    const note = (series: Series, value: string | undefined) => {
      if (value === undefined) {
        return;
      }
      if (series.length === 0 || series[series.length - 1][1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const piles = document.querySelectorAll('[data-discard-pile]');
      p.maxPiles = Math.max(p.maxPiles, piles.length);
      const pile = piles[0];
      note(p.counts, pile === undefined ? '-' : pile.getAttribute('data-discard-pile-count') ?? '?');
      note(p.holders, pile === undefined ? '-' : pile.getAttribute('data-discard-pile-holders') ?? '?');
      note(p.deck, document.querySelector('.con-deckstack')?.getAttribute('aria-label')?.match(/(\d+)\s*$/)?.[1]);
      const resting = document.querySelector('.con-dpile-enter-active, .con-dpile-leave-active') === null;
      const stack = pile?.querySelector('.con-dpile__stack')?.getBoundingClientRect();
      if (stack !== undefined && resting) {
        note(p.places, `${Math.round(stack.left + stack.width / 2)},${Math.round(stack.top + stack.height / 2)}`);
        // Its home: UNDER the deck — below the strip and its chip lane (never over the deck's count nor over the
        // deck's own «−N» chip, which must stay readable while the cards come off), the stack under the deck's stack
        // (within a card's width of it), inside the screen.
        const plate = pile?.querySelector('.con-dpile__plate')?.getBoundingClientRect();
        const count = document.querySelector('.con-deckstack__count')?.getBoundingClientRect();
        const deck = document.querySelector('.con-deckstack__pile')?.getBoundingClientRect();
        const chip = document.querySelector('.con-deckstack__count .metric-feedback-host > *')?.getBoundingClientRect();
        const strip = document.querySelector('.con-status')?.getBoundingClientRect();
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
        const hits = (a: DOMRect, b: DOMRect | undefined) => b !== undefined && b.width > 0 &&
          a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const farFromDeck = deck !== undefined && stack !== undefined &&
          Math.abs((stack.left + stack.width / 2) - (deck.left + deck.width / 2)) > 3 * rem;
        if (plate !== undefined && strip !== undefined &&
            (plate.top < strip.bottom - 1 || plate.right > window.innerWidth + 1 || hits(plate, count) || hits(plate, chip) || farFromDeck)) {
          p.besideDeck = false;
          p.besideMiss = `plate ${Math.round(plate.left)},${Math.round(plate.top)}–${Math.round(plate.right)} · strip bottom ${Math.round(strip.bottom)}` +
            ` · deck ${deck === undefined ? '-' : `${Math.round(deck.left)}–${Math.round(deck.right)}`}` +
            ` · count ${count === undefined ? '-' : `${Math.round(count.left)}–${Math.round(count.right)}`}` +
            ` · chip ${chip === undefined ? '-' : `${Math.round(chip.left)}–${Math.round(chip.right)},${Math.round(chip.top)}–${Math.round(chip.bottom)}`}`;
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
  });
}

const readPile = (page: Page): Promise<PileProbe> => page.evaluate(() => (window as unknown as {__pile: PileProbe}).__pile);

/** The resting pile moved at most `px` from where it first rested. */
function pileTravel(probe: PileProbe): number {
  const pts = probe.places.map(([, v]) => v.split(',').map(Number));
  if (pts.length === 0) {
    return 0;
  }
  return Math.max(...pts.map(([x, y]) => Math.hypot(x - pts[0][0], y - pts[0][1])));
}

/** The wheel → the hand → TR52 → its composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  expect(await focusCard(page, CARD, 12), `never focused «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 1000);
  }
  await expect(page.locator(COMPOSER)).toHaveCount(1);
  await settle(page);
}

/** The composer's target row → the step → the candidate named `target` → A (the step closes on the answer). */
async function pickTarget(page: Page, target: string, check?: (page: Page) => Promise<void>): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 6 && await step.count() === 0; i++) {
    if (await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 600);
    }
    await press(page, 'Enter', 1200);
  }
  await expect(step, 'the target step opened').toHaveCount(1, {timeout: 10_000});
  await settle(page);
  if (check !== undefined) {
    await check(page);
  }
  const focused = () => page.evaluate(() => document.querySelector('.con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 10 && !(await focused()).includes(target); i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await focused(), `focused «${target}»`).toContain(target);
  for (let i = 0; i < 4 && await step.count() > 0; i++) {
    await press(page, 'Enter', 1100);
  }
  await expect(step, 'the step closed on the answer').toHaveCount(0, {timeout: 8000});
  await settle(page);
  for (let i = 0; i < 10 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
}

for (const preset of PRESETS) {
  test.describe(`TR52 Scientific Breakthrough · the discard pile · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`journey: a rival's census pays 2 data, the thrown-away cards land beside the deck, R3 opens the pile (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'scientific-breakthrough', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card in hand').toContain(CARD);

      // ── 1. the composer: the candidates, no pre-pick, what the loss costs ──
      await openComposer(page);
      await pickTarget(page, 'Martian Census', async (p) => {
        const open = await p.locator('.con-ptsel__slot:not([data-ptsel-blocked])').evaluateAll((els) => els.map((el) => el.getAttribute('data-zoom-slot') ?? ''));
        expect(open.some((s) => s.includes('Research Startups')), 'the blue\'s own 2-data card is a candidate').toBe(true);
        expect(open.some((s) => s.includes('Martian Census')), 'the rival\'s 3-data census is a candidate').toBe(true);
        // A holder of ONE data is no target — SHOWN with its reason, never hidden (the prompt's rule 3).
        const near = p.locator('.con-ptsel__slot[data-ptsel-blocked][data-zoom-slot="Supercomputer"]');
        await expect(near, 'the 1-data Supercomputer stands as a near miss').toHaveCount(1);
        await expect(near.locator('.con-ptsel__blocked'), 'its refusal on the card: have / need').toContainText('1 / 2');
        await expect(p.locator('.con-ptsel__slot--locked'), 'nothing is pre-picked').toHaveCount(0);
        // The cursor on it: the rail reads WHY, and A chooses nothing.
        const focusedSlot = () => p.evaluate(() => document.querySelector('.con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
        for (let i = 0; i < 10 && !(await focusedSlot()).includes('Supercomputer'); i++) {
          await press(p, 'ArrowRight', 350);
        }
        expect(await focusedSlot(), 'the cursor reaches the near miss').toContain('Supercomputer');
        await expect(p.locator('[data-ptsel-rail-blocked]'), 'the rail reads the server\'s reason').toContainText('Недостаточно ресурсов на этой карте');
        await shoot(p, preset.id, '00-target-near-miss');
        await press(p, 'Enter', 700);
        await expect(p.locator('.con-ptsel'), 'A on a near miss chooses nothing — the step stands').toHaveCount(1);
        await expect(p.locator('.con-ptsel__slot--locked')).toHaveCount(0);
        for (let i = 0; i < 4 && !(await focusedSlot()).includes('Martian Census'); i++) {
          await press(p, 'ArrowLeft', 350);
        }
      });
      const row = page.locator(`${COMPOSER} .con-composer__target`);
      await expect(row, 'the answered row stands').toHaveCount(1);
      await expect(row, 'the loss reads what it costs the census').toContainText('Делегат больше не готов');
      await expect(row.locator('.con-ptsel__imp--lost'), 'LOST is its own state').toHaveCount(1);
      await expect(row.locator('.con-ptsel__imp--down'), 'the falling counter reads in the spend tone').not.toHaveCount(0);
      const thumb = await row.locator('.con-composer__target-thumb').boundingBox();
      expect(thumb !== null && thumb.width > 8 && thumb.height > 8, `the target's miniature is painted (PL-269): ${JSON.stringify(thumb)}`).toBe(true);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '01-composer');

      // ── 2. A: ONE POST; the tokens leave the miniature; the scene ──
      await armPileProbe(page);
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'journey');
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
      await summary.waitFor({timeout: 60_000});
      await settle(page, {timeoutMs: 40_000});
      await expect(summary).toHaveAttribute('data-search-taken', '2');
      await expect(summary).toHaveAttribute('data-search-discarded', '3');
      const pile = page.locator('[data-discard-pile]');
      await expect(pile, 'the pile stands beside the deck while the reveal is up').toHaveCount(1);
      await expect(pile).toHaveAttribute('data-discard-pile-count', '3');
      await expect(pile).toHaveAttribute('data-discard-pile-holders', /reveal:/);
      await expect(pile.locator('[data-discard-pile-hint] .gp-glyph'), 'R3 on the pile').toHaveText('R3');
      await shoot(page, preset.id, '02-reveal');

      const probe = await readPile(page);
      test.info().annotations.push({type: 'pile', description: JSON.stringify({counts: probe.counts, holders: probe.holders, deck: probe.deck})});
      expect(probe.ticks, 'the probe sampled (a dead sampler proves nothing)').toBeGreaterThan(10);
      expect(probe.maxPiles, 'never two piles').toBe(1);
      expect(probe.counts.map(([, v]) => v).filter((v) => v !== '-').map(Number).every((n, i, a) => i === 0 || n >= a[i - 1]),
        `the count only climbs: ${JSON.stringify(probe.counts)}`).toBe(true);
      expect(probe.holders.some(([, v]) => v.includes('scene:')), 'the scene held the pile while it dealt').toBe(true);
      expect(pileTravel(probe), `the pile stands still: ${JSON.stringify(probe.places)}`).toBeLessThan(3);
      expect(probe.besideDeck, `the pile hangs under the HUD deck: ${probe.besideMiss}`).toBe(true);
      const deckValues = probe.deck.map(([, v]) => Number(v)).filter((n) => Number.isFinite(n));
      expect(deckValues[0] - deckValues[deckValues.length - 1], `five cards turned over: ${JSON.stringify(probe.deck)}`).toBe(5);
      const witness = await transferWitness(page);
      test.info().annotations.push({type: 'transfers', description: transferTrail(witness)});
      expect(endsOverGlass(witness), 'every token\'s ends were painted').toEqual([]);

      // ── 3. R3: the viewer rises out of the pile — the thrown cards, each with why ──
      const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
      for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
        await press(page, 'KeyV', 1200);
      }
      await expect(verdict, 'R3 opened the pile').toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '03-pile-viewer');
      await press(page, 'Escape', 1200);
      await expect(page.locator('.con-zoom')).toHaveCount(0, {timeout: 10_000});

      // ── 4. the take: the cards to the dock, the workspace and the pile leave ──
      await press(page, 'Escape', 600);
      await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
      await expect(pile, 'the pile slid home once nobody held it').toHaveCount(0, {timeout: 15_000});
      await stop();
      await settle(page, {timeoutMs: 30_000});
      const after = await wireOf(request, playerId);
      const hand = after.cardsInHand?.map((c) => c.name) ?? [];
      expect(hand, 'the two Science cards are in hand').toEqual(expect.arrayContaining(['Research', 'Physics Complex']));
      const census = after.players.flatMap((p) => p.tableau).find((c) => c.name === 'Martian Census');
      expect(census?.resources, 'the census lost exactly 2 data').toBe(1);
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });

    test(`clean: two Science cards on top — no pile, no R3 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'scientific-breakthrough-clean', {query: preset.query});
      await settle(page);
      await openComposer(page);
      await pickTarget(page, 'Martian Census');
      await armPileProbe(page);
      await press(page, 'Enter', 400);
      const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
      await summary.waitFor({timeout: 60_000});
      await settle(page, {timeoutMs: 40_000});
      await expect(summary).toHaveAttribute('data-search-discarded', '0');
      const probe = await readPile(page);
      expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
      expect(probe.maxPiles, 'nothing was thrown away — the pile never came out').toBe(0);
      await expect(page.locator('.con-cmdbar'), 'no R3 verb').not.toContainText(/сброшенные/i);
      await shoot(page, preset.id, '04-clean');
      await press(page, 'Escape', 600);
      await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
    });

    test(`bot: the card option of [cards, MarsBot] opens the SAME grouped target step — never a flat list (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'scientific-breakthrough-bot', {query: preset.query});
      await settle(page);
      await openComposer(page);
      // The removal row is an `or`: A opens its option list — the card pick (a door) beside the bot.
      const list = page.locator(`${COMPOSER} .con-composer__sublist`);
      for (let i = 0; i < 6 && await list.count() === 0; i++) {
        if (await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() > 0) {
          await press(page, 'ArrowUp', 600);
        }
        await press(page, 'Enter', 1200);
      }
      await expect(list, 'the option list opened').toHaveCount(1, {timeout: 10_000});
      await expect(list.locator('.con-vchoice__door'), 'the card option is a door').toHaveCount(1);
      // A on the card option: the embedded step — the Predators pattern — never the list of names one level deeper.
      const step = page.locator('.con-ptsel');
      await press(page, 'Enter', 1200);
      await expect(step, 'the card option opened the grouped target step').toHaveCount(1, {timeout: 10_000});
      await expect(list, 'no flat list stands beside it').toHaveCount(0);
      await expect(step.locator('.con-ptsel__slot[data-zoom-slot="Research Startups"]'), 'the candidate stands in its owner\'s group').toHaveCount(1);
      await shoot(page, preset.id, '05-bot-step');
      // B is ONE level: back to the option list, nothing captured.
      await press(page, 'Escape', 1200);
      await expect(step, 'B closed the step').toHaveCount(0, {timeout: 8000});
      await expect(list, 'B returned to the option list').toHaveCount(1, {timeout: 8000});
      await press(page, 'Enter', 1200);
      await expect(step, 'the step re-opened').toHaveCount(1, {timeout: 10_000});
      for (let i = 0; i < 4 && await step.count() > 0; i++) {
        await press(page, 'Enter', 1100);
      }
      await expect(step, 'the step closed on the answer').toHaveCount(0, {timeout: 8000});
      // The answered `or` reads as the target row — the same row a bare pick fills.
      const row = page.locator(`${COMPOSER} .con-composer__target`);
      await expect(row, 'the answered row is the target row').toHaveCount(1);
      await expect(row.locator('.con-composer__target-thumb'), 'with the chosen card\'s miniature').toHaveCount(1);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '06-bot-answered');
      for (let i = 0; i < 10 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 250);
      }
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      expect(posts[0], 'the card pick nests into the or-option').toMatch(/"type":"or","index":0,"response":\{"type":"card","cards":\["Research Startups"\]/);
      const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
      await summary.waitFor({timeout: 60_000});
      await settle(page, {timeoutMs: 40_000});
      await press(page, 'Escape', 600);
      await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      const after = await wireOf(request, playerId);
      expect(after.cardsInHand?.map((c) => c.name) ?? [], 'the two Science cards are in hand').toEqual(expect.arrayContaining(['Research', 'Physics Complex']));
      const startups = after.players.flatMap((p) => p.tableau).find((c) => c.name === 'Research Startups');
      expect(startups?.resources, 'Research Startups lost exactly 2 data').toBe(0);
    });

    test(`actions: the action's thrown-away cards leave the HUD deck onto the same pile before the find (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'scientific-breakthrough-actions', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      expect(await walkFocusUntil(page, async () => await focused() === 'Vector Computations', focused, 30), 'focused Vector Computations').toBeTruthy();
      await openActionFocus(page);
      await settle(page);
      await armPileProbe(page);
      const stop = await storyboard(page, preset.id, 'actions');
      await press(page, 'Enter', 300);
      // The found card stands named in the action's own draw stage, the deck's dealer gone.
      await page.locator('.con-reveal__namebar:not(.con-reveal__namebar--held)').first().waitFor({timeout: 60_000});
      await page.locator('.con-deckdraw').waitFor({state: 'detached', timeout: 30_000});
      await settle(page, {timeoutMs: 40_000});
      await expect(page.locator('.con-reveal__namebar').first(), 'the find is the Comet').toContainText('Комета');
      await stop();
      await shoot(page, preset.id, '05-actions');
      const probe = await readPile(page);
      test.info().annotations.push({type: 'pile', description: JSON.stringify({counts: probe.counts, holders: probe.holders, deck: probe.deck})});
      expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
      expect(probe.maxPiles, 'never two piles').toBe(1);
      expect(probe.holders.some(([, v]) => v.includes('stream:')), 'the action\'s stream held the pile').toBe(true);
      expect(probe.counts.some(([, v]) => v === '2'), `both thrown cards landed on it: ${JSON.stringify(probe.counts)}`).toBe(true);
      expect(probe.besideDeck, `the same place as every other host: ${probe.besideMiss}`).toBe(true);
      const deckValues = probe.deck.map(([, v]) => Number(v)).filter((n) => Number.isFinite(n));
      expect(deckValues[0] - deckValues[deckValues.length - 1], `three cards left the deck: ${JSON.stringify(probe.deck)}`).toBe(3);
      expect(deckValues.length, `one tick per card, never one jump: ${JSON.stringify(probe.deck)}`).toBeGreaterThanOrEqual(3);
    });

    test(`pluto: a card leaving the HAND lands on the same pile (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      await bootFixtureSeats(page, request, 'pluto-settlements-2', {query: preset.query, keepColony: 'Pluto'});
      await settle(page);
      const colonies = page.locator('.con-colonies');
      for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
        await press(page, 'Period', 1100);
        await press(page, 'ArrowRight', 1300);
      }
      await expect(colonies, 'the colonies opened').not.toHaveCount(0);
      const tile = page.locator('.con-coltile--focused[data-test="con-colony-Pluto"]');
      for (let i = 0; i < 10 && await tile.count() === 0; i++) {
        await press(page, 'ArrowRight', 380);
      }
      for (let i = 0; i < 4 && await tile.count() === 0; i++) {
        await press(page, 'ArrowDown', 380);
        for (let j = 0; j < 5 && await tile.count() === 0; j++) {
          await press(page, 'ArrowLeft', 320);
        }
      }
      await expect(tile, 'Pluto focused').not.toHaveCount(0);
      await press(page, 'Enter', 2000);
      await expect(page.locator('.con-colfocus'), 'the trade stage').not.toHaveCount(0);
      await armPileProbe(page);
      const stop = await storyboard(page, preset.id, 'pluto');
      await press(page, 'KeyX', 300); // confirm the trade
      const embeddedHand = page.locator('.con-colonies .con-hand--embedded');
      const active = page.locator('.con-colonies .con-reveal__bonus-zone--active');
      let discards = 0;
      for (let cycle = 1; cycle <= 2; cycle++) {
        await active.first().waitFor({state: 'visible', timeout: 45_000});
        await cinematicBeat(page, 2600, 'the payout lands before it is taken');
        for (let i = 0; i < 14 && await embeddedHand.count() === 0 && await active.count() > 0; i++) {
          await press(page, 'Enter', 2000);
        }
        if (await embeddedHand.count() > 0) {
          // The album is READY once its open flight has landed (`--live` arms after the mount settles and is held off
          // through a reveal episode); at 4K on SwiftShader that flight outlasts any fixed beat, and a press inside it
          // is absorbed by design — so A is repeated until the throw has visibly begun (the hand leaving, the discard
          // proxy born, the pile ARMED for the hand's card), never counted by the press.
          await page.locator('.con-colonies .con-hand--embedded .con-hand__pagestrip--live').first()
            .waitFor({state: 'visible', timeout: 20_000}).catch(() => undefined);
          await cinematicBeat(page, 600, 'the hand is open');
          const thrown = async () => await embeddedHand.count() === 0 ||
            await page.locator('.con-discard-proxy, [data-discard-pile] .con-dpile__plate--armed').count() > 0;
          expect(await pressUntil(page, 'Enter', thrown, {tries: 4, settleMs: 2500}), `cycle ${cycle}: the discard press took`).toBe(true);
          discards++;
          await cinematicBeat(page, 900, 'the discarded card is on its way to the pile');
          if (cycle === 1) {
            await shoot(page, preset.id, '06-pluto-discard');
          }
          await page.locator('.con-colonies .con-hand').waitFor({state: 'detached', timeout: 25_000}).catch(() => undefined);
        }
      }
      await expect.poll(async () => page.locator('.con-colonies').count(), {timeout: 60_000, message: 'the resolution leaves for the board'}).toBe(0);
      await stop();
      const probe = await readPile(page);
      test.info().annotations.push({type: 'pile', description: JSON.stringify({counts: probe.counts, holders: probe.holders})});
      expect(discards, 'the hand discarded').toBeGreaterThan(0);
      expect(probe.maxPiles, 'never two piles').toBe(1);
      expect(probe.holders.some(([, v]) => v.includes('hand-discard')), 'the hand\'s throw held the pile').toBe(true);
      expect(probe.counts.some(([, v]) => Number(v) >= 1), `the card landed on it: ${JSON.stringify(probe.counts)}`).toBe(true);
      expect(probe.besideDeck, `the same place as the search's pile: ${probe.besideMiss}`).toBe(true);
      await expect(page.locator('[data-discard-pile]'), 'the pile slid home with the resolution').toHaveCount(0, {timeout: 15_000});
    });
  });
}
