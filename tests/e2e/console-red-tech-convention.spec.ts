import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, press, settle, walkFocusUntil} from './consoleStart';

/**
 * TR32 «ТЕХНОКОНВЕНТ КРАСНЫХ» — THE DRAW'S NEGATIVE FILTER, named everywhere by
 * ONE server descriptor (docs/claude/console/card-draw-motion.md § the search's
 * rule; docs/claude/turmoil-redux-cards-progress.md § TR32).
 *
 * The card searches the project deck for three cards WITHOUT a plant, microbe
 * or animal tag. The family's scene (cards off the HUD deck → judged → the
 * tray / the hold → the reveal assembles → the take) is UNCHANGED; what is new
 * is that every surface says the RULE and every thrown-away card says WHY.
 * The contract under test, against a real server, two profiles:
 *
 *   1. The composer BEFORE the press: the draw chip carries the rule («+3 взять |
 *      без меток [P̸][M̸][A̸]»), the «Далее» row names the process with the same
 *      rule, «Сработает» is absent (nothing on the table answers); 0 POST.
 *   2. A → exactly ONE POST; the crumb keeps its root and the card, the tail only
 *      grows (РОЗЫГРЫШ → … → ДОБОР КАРТ); the reveal stands INSIDE the hand's
 *      outcome zone — never a band of its own.
 *   3. The scene in the SERVER's order: the HUD deck counter falls by ONE per
 *      card, six times; Algae goes to the tray, Research is found, Ants and Fish
 *      go to the tray, Mining Area and Comet are found — the tray count and the
 *      «found» marks in that order; no `settle` phase (law 1 of the family).
 *   4. The reveal's summary: «ВСКРЫТО 6 · ПОЛУЧЕНО 3 · СБРОШЕНО 3 — без меток …».
 *   5. R3 → the pile: Algae / Ants / Fish face up, each with ITS tag — the verdict
 *      plate names it and the card's own printed medallion is marked; B back.
 *   6. B (take all) → three cards to the dock, the dock's count +3, the
 *      workspace gone; the server: the three in hand, 5 M€ paid.
 *   7. RED, without reloading: its view carries no reveal; its journal carries
 *      the public lines (the discards by name, the revealed cards by name).
 *   8. `-clean-top`: three clean cards on top → no tray, the plain language, the
 *      summary still names the rule, no R3.
 *
 * Fixtures `red-tech-convention` / `-clean-top` (tests/e2e/fixtures/generate.ts —
 * the dry run there checks the search). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Red Tech Convention';
const CARD_RU = 'Техноконвент Красных';
const ROOT_RU = 'Карты в руке';
const RULE = 'without:plant,microbe,animal';
const KEPT = ['Research', 'Mining Area', 'Comet'];
const THROWN = [['Algae', 'plant'], ['Ants', 'microbe'], ['Fish', 'animal']] as const;
const OUT = path.resolve('screenshots', 'red-tech-convention');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  cardDrawReveals?: Array<unknown>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

type LogLine = {message: string, data: Array<{type: number, value: string | ReadonlyArray<string>}>, playerId?: string};
async function logsOf(request: APIRequestContext, playerId: string): Promise<Array<LogLine>> {
  const res = await request.get(`/api/game/logs?id=${playerId}`);
  expect(res.ok(), 'the logs route answers').toBeTruthy();
  return await res.json() as Array<LogLine>;
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
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  phases: Series;
  deck: Series;
  /** Every text the deck counter cell showed that carried a «+» (a delta chip UP — the deck never gains cards here). */
  deckUp: Array<string>;
  tray: Series;
  found: Series;
  revealOutsideHand: boolean;
  revealInHand: boolean;
  wsMax: number;
  dock: Series;
  stranded: boolean;
  /** The lowest top of any deck-draw proxy, ever (a card above the screen is a defect) — with WHICH card, WHEN, in which phase. */
  minProxyY: number;
  minProxyH: number;
  minProxyAt: string;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root}) => {
    const w = window as unknown as {__tr32: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], phases: [], deck: [], deckUp: [], tray: [], found: [],
      revealOutsideHand: false, revealInHand: false, wsMax: 0, dock: [], stranded: false, minProxyY: Infinity, minProxyH: 0, minProxyAt: '',
    };
    w.__tr32 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
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
      note(p.phases, document.querySelector('.con-deckdraw')?.getAttribute('data-dd-phase') ?? undefined);
      // The SHOWN count (the widget's own aria value — never the flip's two digit rows or its delta chip).
      note(p.deck, document.querySelector('.con-deckstack')?.getAttribute('aria-label')?.match(/(\d+)\s*$/)?.[1]);
      const cell = text(document.querySelector('.con-deckstack__count'));
      if (cell.includes('+') && !p.deckUp.includes(cell) && p.deckUp.length < 8) {
        p.deckUp.push(cell);
      }
      note(p.tray, text(document.querySelector('.con-deckdraw__tray-count')));
      const found = Array.from(document.querySelectorAll('.con-deckdraw-proxy.con-deckdraw-proxy--found'))
        .map((el) => el.getAttribute('data-dd-card') ?? '?');
      note(p.found, found.join(','));
      document.querySelectorAll('.con-reveal').forEach((el) => {
        if (el.closest('.con-hand__outcome') !== null) {
          p.revealInHand = true;
        } else if (el.getBoundingClientRect().width > 1) {
          p.revealOutsideHand = true;
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      note(p.dock, document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? undefined);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (tick) {
        document.querySelectorAll<HTMLElement>('.con-deckdraw-proxy').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 1 && r.top < p.minProxyY) {
            p.minProxyY = r.top;
            p.minProxyH = r.height;
            p.minProxyAt = `${Date.now() - t0}ms ${el.getAttribute('data-dd-card')} h=${Math.round(r.height)} phase=${document.querySelector('.con-deckdraw')?.getAttribute('data-dd-phase')}`;
          }
        });
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr32: Probe}).__tr32);

const composer = '.con-composer--play';

/** The wheel → the hand → the card → its composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];

for (const preset of PRESETS) {
  test.describe(`TR32 Red Tech Convention · the search's rule · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → six cards in the server's order → the reveal with its rule → R3 reasons → the dock; red reads the journal (${preset.id})`, async ({page, request, context}) => {
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

      const {playerId, seats} = await bootFixtureSeats(page, request, 'red-tech-convention', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.megacredits, 'the fixture: 10 M€').toBe(10);
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card in hand').toContain(CARD);

      // RED watches — its own console, no reload later.
      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await page.bringToFront();

      // ── 1. the composer: the rule named BEFORE the press ──
      await openComposer(page);
      const chip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--cards')});
      await expect(chip, 'one draw chip').toHaveCount(1);
      await expect(chip.locator('.action-effect-chip__amount')).toHaveText('+3');
      await expect(chip.locator('[data-draw-search]'), 'the chip carries the server\'s rule').toHaveAttribute('data-draw-search', RULE);
      await expect(chip.locator('.con-dsearch__tag--struck'), 'three struck tags').toHaveCount(3);
      const next = page.locator(`${composer} .con-composer__next`).filter({has: page.locator('[data-draw-search]')});
      await expect(next, 'the «Далее» row names the process').toHaveCount(1);
      await expect(next).toContainText('Добор — колода вскрывается, пока не наберётся совпадений: 3');
      await expect(next.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', RULE);
      await expect(page.locator(`${composer} [data-forecast-row]`), '«Сработает» is empty and honest').toHaveCount(0);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '01-composer');

      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'search');

      // ── 2. A: the play's ONE POST ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      expect(posts[0], 'the POST is the card\'s play').toContain(CARD);

      // ── 3–4. the scene, then the reveal inside the hand with its summary ──
      const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
      await summary.waitFor({timeout: 60_000});
      await expect(page.locator('.con-hand__outcome .con-reveal__namebar:not(.con-reveal__namebar--held)'), 'the batch has landed').toHaveCount(1, {timeout: 30_000});
      await settle(page, {timeoutMs: 40_000});
      await expect(summary).toHaveAttribute('data-search-revealed', '6');
      await expect(summary).toHaveAttribute('data-search-taken', '3');
      await expect(summary).toHaveAttribute('data-search-discarded', '3');
      await expect(summary).toHaveAttribute('data-search-exhausted', 'no');
      await expect(summary.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', RULE);
      await expect(summary).toContainText(/Вскрыто\s*6/i);
      await expect(summary).toContainText(/Сброшено\s*3/i);
      await expect(page.locator('.con-hand__outcome .con-reveal__discard-count'), 'the tray: the server\'s three').toHaveText('3');
      await stopStory();
      await shoot(page, preset.id, '02-reveal');

      const probe = await readProbe(page);
      expect(probe.ticks, 'the probe sampled (a dead sampler proves nothing)').toBeGreaterThan(10);
      expect(probe.crumbMisses, 'the crumb keeps its root and the card on every sample').toEqual([]);
      expect(probe.steps.length, 'the tail only grows').toBeGreaterThan(0);
      expect(probe.steps[probe.steps.length - 1], 'the last stage: the draw').toMatch(/добор карт/i);
      expect(probe.revealInHand, 'the reveal stands inside the hand').toBe(true);
      expect(probe.revealOutsideHand, 'never a band of its own').toBe(false);
      expect(probe.wsMax, 'one workspace').toBeLessThanOrEqual(1);
      expect(probe.phases.map(([, v]) => v), 'no settle wave over the found cards (law 1)').not.toContain('settle');
      // PL-089 (the owner's decision 2026-10-07): the HUD deck lives on the screen's top edge, so the PEEL separates
      // the card DOWN, into the screen — no card off the pile ever crosses the top edge (it used to, by ~10.7 px).
      test.info().annotations.push({type: 'peel', description: `min top ${probe.minProxyY.toFixed(1)} px (${probe.minProxyAt})`});
      expect(probe.minProxyY, `no card above the screen (${probe.minProxyAt})`).toBeGreaterThanOrEqual(-1);
      // PL-088: the counter never flips UP with a «+N» chip (the cards a draw turned over stay on it until dealt).
      expect(probe.deckUp, 'the deck never reads as GAINING cards').toEqual([]);
      // The HUD deck falls by ONE per card, six times (`onCardPeeled`).
      const deckValues = probe.deck.map(([, v]) => Number(v)).filter((n) => Number.isFinite(n));
      // Peels that land in ONE task (4K) coalesce into one sample — the counter still only ever falls, and in steps.
      const drops = deckValues.slice(1).map((n, i) => deckValues[i] - n);
      expect(drops.every((d) => d >= 1), `only ever down: ${JSON.stringify(probe.deck)}`).toBe(true);
      expect(deckValues.length, `it ticks, never one jump: ${JSON.stringify(probe.deck)}`).toBeGreaterThanOrEqual(4);
      expect(deckValues[0] - deckValues[deckValues.length - 1], 'six cards turned over').toBe(6);
      // The SERVER's order: tray 1 (Algae) < Research found < tray 2 (Ants) < tray 3 (Fish) < Mining Area < Comet.
      const tray1 = at(probe.tray, '1');
      const tray2 = at(probe.tray, '2');
      const tray3 = at(probe.tray, '3');
      const research = at(probe.found, 'Research');
      const mining = at(probe.found, 'Research,Mining Area');
      const comet = at(probe.found, 'Research,Mining Area,Comet');
      // Two tosses that land in ONE task (Ants and Fish at 4K) are one sample: «2» may be swallowed — never «3» or the order.
      const order = [tray1, research, tray2, tray3, mining, comet].filter((t, i) => i !== 2 || t !== undefined);
      const trace = JSON.stringify({tray: probe.tray, found: probe.found});
      expect([tray1, research, tray3, mining, comet].every((t) => t !== undefined), `every beat was seen: ${trace}`).toBe(true);
      expect(order, `the server's order: ${trace}`).toEqual([...order as Array<number>].sort((a, b) => a - b));

      // ── 5. R3: the pile, each card with ITS tag ──
      await expect(page.locator('.con-cmdbar')).toContainText(/сброшенные/i);
      const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
      for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
        await press(page, 'KeyV', 1200);
      }
      for (const [name, tag] of THROWN) {
        await expect(verdict, `the verdict of «${name}»`).toHaveAttribute('data-verdict-tags', tag, {timeout: 10_000});
        await expect(page.locator('.con-zoom'), 'the face marks its own medallion').toHaveClass(new RegExp(`con-zoom--reject-${tag}`));
        await expect(page.locator(`.con-zoom .card-zoom-stage .pcard-tag[data-tag="${tag}"]`), 'the medallion exists on the face').toHaveCount(1);
        await shoot(page, preset.id, `03-tray-${name.toLowerCase()}`);
        if (tag !== 'animal') {
          await press(page, 'ArrowRight', 900);
        }
      }
      await press(page, 'Escape', 1200);
      await expect(page.locator('.con-zoom'), 'B returns to the reveal').toHaveCount(0, {timeout: 10_000});

      // ── 6. take all → the dock; the workspace leaves ──
      const dockBefore = Number(await page.locator('[data-hand-total]').getAttribute('data-hand-total') ?? 'NaN');
      await press(page, 'Escape', 600);
      await expect(page.locator('.con-hand'), 'the workspace leaves after the last card').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      const dockAfter = Number(await page.locator('[data-hand-total]').getAttribute('data-hand-total') ?? 'NaN');
      if (Number.isFinite(dockBefore) && Number.isFinite(dockAfter)) {
        expect(dockAfter - dockBefore, 'three cards landed in the dock').toBe(3);
      }
      const after = await wireOf(request, playerId);
      for (const name of KEPT) {
        expect(after.cardsInHand?.map((c) => c.name), `«${name}» in hand`).toContain(name);
      }
      expect(after.thisPlayer.megacredits, 'the price paid').toBe(5);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card on the table').toContain(CARD);
      await shoot(page, preset.id, '04-after');
      // The journal (PL-033): what the play's root says about the search, on both seats.
      await press(page, 'KeyR', 1200);
      await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
      await settle(page);
      await shoot(page, preset.id, '04b-journal');
      test.info().annotations.push({type: 'journal-blue', description: (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ').slice(0, 900)});
      await press(page, 'KeyR', 1000);

      // ── 7. red: no reveal of its own, the journal's public lines ──
      const redWire = await wireOf(request, seats[1]);
      expect(redWire.cardDrawReveals ?? [], 'the faces are blue\'s alone').toEqual([]);
      const redLogs = await logsOf(request, seats[1]);
      const discardLine = redLogs.find((l) => l.message === 'Discarded ${0} cards ${1}');
      expect(discardLine, 'red reads the discards').toBeDefined();
      expect(JSON.stringify(discardLine?.data), 'by name').toContain('Algae');
      const drewLine = redLogs.find((l) => l.message === '${0} drew ${1}' && l.playerId === undefined);
      expect(drewLine, 'red reads the revealed cards (a search reveals them — public by the rules)').toBeDefined();
      await shoot(red, preset.id, '05-red');
      await red.bringToFront();
      await press(red, 'KeyR', 1200);
      await expect(red.locator('.con-journal'), 'red\'s journal opened').toHaveCount(1);
      await settle(red);
      await shoot(red, preset.id, '05b-red-journal');
      test.info().annotations.push({type: 'journal-red', description: (await red.locator('.con-journal').innerText()).replace(/\s+/g, ' ').slice(0, 900)});

      expect(pageErrors, 'no page errors').toEqual([]);
      expect(redErrors, 'no page errors on red').toEqual([]);
      expect(overflow, 'no overflow').toEqual([]);
      expect(probe.stranded, 'nothing stranded').toBe(false);
    });
  });
}

test.describe('TR32 · the class on a neighbour — TR05 Vector Computations (a Space search from an action)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the chip names the rule; the bar and the crumb say ONE stage through the draw (PL-090); the tray names the rule', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixtureSeats(page, request, 'red-tech-convention-neighbours', {query: '&consoleProfile=auto'});
    await settle(page);
    await openCardActions(page);
    const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === 'Vector Computations', focused, 30), 'focused TR05').toBeTruthy();
    await openActionFocus(page);
    await settle(page);
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    await expect(stage.locator('.action-effect-chip [data-draw-search]'), 'PL-021: the chip names the Space rule').toHaveAttribute('data-draw-search', 'with:space');
    // The bar's context and the crumb's tail, sampled through the whole beat: never two different words.
    await page.evaluate(() => {
      const w = window as unknown as {__stageMisses: Array<string>, __stageSamples: number};
      w.__stageMisses = [];
      w.__stageSamples = 0;
      const text = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      window.setInterval(() => {
        // The tail CROSSFADES in one cell: the leaving word stands beside the arriving one for the swap — read the arriving one.
        const crumb = text('.con-cardactions .con-wshead__step:not(.con-wshead-swap-leave-active)');
        const bar = text('.con-cmdbar__context');
        if (crumb === '' || bar === '') {
          return;
        }
        w.__stageSamples++;
        if (crumb !== bar && w.__stageMisses.length < 6) {
          w.__stageMisses.push(`crumb «${crumb}» bar «${bar}»`);
        }
      }, 30);
    });
    await press(page, 'Enter', 400);
    await expect(page.locator('.con-cmdbar'), 'the batch landed: R3 is offered').toContainText(/сброшенные/i, {timeout: 30_000});
    await settle(page);
    const misses = await page.evaluate(() => (window as unknown as {__stageMisses: Array<string>}).__stageMisses);
    const samples = await page.evaluate(() => (window as unknown as {__stageSamples: number}).__stageSamples);
    expect(samples, 'the stage sampler ran').toBeGreaterThan(10);
    expect(misses, 'the bar never names a stage the crumb has left').toEqual([]);
    await expect(page.locator('[data-reveal-search]'), 'the summary').toHaveAttribute('data-search-discarded', '1');
    const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
    for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
      await press(page, 'KeyV', 1200);
    }
    await expect(verdict, 'a positive filter\'s discard names the RULE it missed').toHaveAttribute('data-verdict-kind', 'rule');
    await expect(verdict.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', 'with:space');
    await shoot(page, 'fhd', '07-tr05-tray');
    await press(page, 'Escape', 1200);
  });
});

test.describe('TR32 Red Tech Convention · the Deck, reduced motion', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the chip, the «Далее» row, the summary and the tray hold on the narrowest profile with motion reduced', async ({page, request}) => {
    test.setTimeout(300_000);
    const overflow: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().includes('[console-overflow]')) {
        overflow.push(m.text().slice(0, 200));
      }
    });
    await page.emulateMedia({reducedMotion: 'reduce'});
    await bootFixtureSeats(page, request, 'red-tech-convention', {query: '&consoleProfile=handheld'});
    await page.locator('html.con-reduced-motion').waitFor({state: 'attached', timeout: 15_000});
    await settle(page);
    await openComposer(page);
    await expect(page.locator(`${composer} .action-effect-chip [data-draw-search]`)).toHaveAttribute('data-draw-search', RULE);
    await expect(page.locator(`${composer} .con-composer__next [data-draw-search]`)).toHaveCount(1);
    await shoot(page, 'deck', '01-composer');
    await press(page, 'Enter', 400);
    const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
    await summary.waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 40_000});
    await expect(summary).toHaveAttribute('data-search-revealed', '6');
    await expect(page.locator('.con-hand__outcome .con-reveal__discard-count')).toHaveText('3');
    // The summary is ONE line and is never cut by its row (the head reserves one row).
    const fits = await summary.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth);
    expect(fits, 'the summary fits its own box and the screen').toBe(true);
    await shoot(page, 'deck', '02-reveal');
    const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
    for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
      await press(page, 'KeyV', 1200);
    }
    await expect(verdict).toHaveAttribute('data-verdict-tags', 'plant', {timeout: 10_000});
    await shoot(page, 'deck', '03-tray');
    await press(page, 'Escape', 1200);
    expect(overflow, 'no overflow on the Deck').toEqual([]);
  });
});

test.describe('TR32 Red Tech Convention · three clean cards on top', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the plain language: no tray, no R3 — the summary still names the rule', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'red-tech-convention-clean-top', {query: '&consoleProfile=auto'});
    await settle(page);
    await openComposer(page);
    await press(page, 'Enter', 400);
    const summary = page.locator('.con-hand__outcome .con-reveal [data-reveal-search]');
    await summary.waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 40_000});
    await expect(summary).toHaveAttribute('data-search-revealed', '3');
    await expect(summary).toHaveAttribute('data-search-discarded', '0');
    await expect(summary.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', RULE);
    await expect(page.locator('.con-reveal__discard'), 'no tray').toHaveCount(0);
    await expect(page.locator('.con-cmdbar'), 'no R3 verb').not.toContainText(/сброшенные/i);
    await shoot(page, 'fhd', '06-clean-top');
    await press(page, 'Escape', 600);
    await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
    const after = await wireOf(request, playerId);
    for (const name of KEPT) {
      expect(after.cardsInHand?.map((c) => c.name)).toContain(name);
    }
  });
});
