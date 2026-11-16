import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, press, settle, walkFocusUntil} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

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
  /** Recorded (settled) states — never a count of frames. */
  samples: number;
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

/** One recorded state of the search — what stands NOW (an observation; the probe's series are folded on the Node side). */
type SearchSeen = {
  head: {root: string, subjects: Array<string>, steps: Array<string>} | null;
  phase: string | null;
  deck: string | null;
  deckCell: string;
  tray: string;
  found: string;
  /** Every reveal on screen: inside the hand's outcome zone, or standing (laid out) outside it. */
  revealIn: boolean;
  revealOut: boolean;
  ws: number;
  dock: string | null;
  stranded: boolean;
  /** The highest deck-draw proxy now (its top, height, card, the scene's phase) — null when none is laid out. */
  topProxy: {top: number, h: number, card: string | null, phase: string | null} | null;
};
const SEARCH_WITNESS = 'tr32-search';

/**
 * THE SEARCH PROBE — RECORDED (FLAKE ZERO — `armWitness`, armed before the press, replace-proof): the reader returns
 * what stands now, every change is kept with the page's time, off the product's own writes (an observer + a frame
 * tick). Its claims are about ORDER (the server's order of the tosses and the finds) and FRAMES («no card above the
 * screen»), so the record is `settled` — the state a task LEAVES, the state a frame can paint.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness<SearchSeen>(page, SEARCH_WITNESS, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const head = document.querySelector('.con-hand .con-wshead');
    const reveals = Array.from(document.querySelectorAll('.con-reveal'));
    const revealIn = reveals.some((el) => el.closest('.con-hand__outcome') !== null);
    const revealOut = reveals.some((el) => el.closest('.con-hand__outcome') === null && el.getBoundingClientRect().width > 1);
    const phase = document.querySelector('.con-deckdraw')?.getAttribute('data-dd-phase') ?? null;
    const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-deckdraw-proxy'))
      .map((el) => ({el, r: el.getBoundingClientRect()}))
      .filter(({r}) => r.width > 1)
      .sort((x, y) => x.r.top - y.r.top);
    const topProxy = proxies.length === 0 ? null :
      {top: proxies[0].r.top, h: proxies[0].r.height, card: proxies[0].el.getAttribute('data-dd-card'), phase};
    return {
      head: head === null ? null : {
        root: text(head.querySelector('.con-wshead__root')),
        subjects: Array.from(head.querySelectorAll('.con-wshead__subject')).map(text),
        steps: Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((s) => s !== ''),
      },
      phase,
      // The SHOWN count (the widget's own aria value — never the flip's two digit rows or its delta chip).
      deck: document.querySelector('.con-deckstack')?.getAttribute('aria-label')?.match(/(\d+)\s*$/)?.[1] ?? null,
      deckCell: text(document.querySelector('.con-deckstack__count')),
      // The table's ONE discard pile (TR52, PL-260): its count ticks on each card's contact.
      tray: document.querySelector('[data-discard-pile]')?.getAttribute('data-discard-pile-count') ?? '',
      found: Array.from(document.querySelectorAll('.con-deckdraw-proxy.con-deckdraw-proxy--found')).map((el) => el.getAttribute('data-dd-card') ?? '?').join(','),
      revealIn,
      revealOut,
      ws: document.querySelectorAll('.con-ws').length,
      dock: document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? null,
      stranded: document.querySelector('.con-stranded') !== null,
      topProxy,
    };
  }, {settled: true, max: 20_000});
}

/** The record folded into the probe — times are the PAGE's, from the arm (the record's first sample is the baseline). */
async function readProbe(page: Page): Promise<Probe> {
  const samples = await witnessOf<SearchSeen>(page, SEARCH_WITNESS).stop();
  const t0 = samples[0]?.t ?? 0;
  const p: Probe = {
    samples: samples.length, steps: [], crumbMisses: [], phases: [], deck: [], deckUp: [], tray: [], found: [],
    revealOutsideHand: false, revealInHand: false, wsMax: 0, dock: [], stranded: false, minProxyY: Infinity, minProxyH: 0, minProxyAt: '',
  };
  const note = (series: Series, value: string | null, now: number) => {
    if (value !== null && value !== '' && series[series.length - 1]?.[1] !== value) {
      series.push([now, value]);
    }
  };
  for (const {t, v} of samples) {
    const now = t - t0;
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || !v.head.subjects.some((s) => s.toLowerCase() === CARD_RU.toLowerCase())) {
        if (p.crumbMisses.length < 8) {
          p.crumbMisses.push(`${now}ms root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
        }
      }
      for (const step of v.head.steps) {
        if (!p.steps.includes(step)) {
          p.steps.push(step);
        }
      }
    }
    note(p.phases, v.phase, now);
    note(p.deck, v.deck, now);
    if (v.deckCell.includes('+') && !p.deckUp.includes(v.deckCell) && p.deckUp.length < 8) {
      p.deckUp.push(v.deckCell);
    }
    note(p.tray, v.tray, now);
    note(p.found, v.found, now);
    p.revealInHand ||= v.revealIn;
    p.revealOutsideHand ||= v.revealOut;
    p.wsMax = Math.max(p.wsMax, v.ws);
    note(p.dock, v.dock, now);
    p.stranded ||= v.stranded;
    if (v.topProxy !== null && v.topProxy.top < p.minProxyY) {
      p.minProxyY = v.topProxy.top;
      p.minProxyH = v.topProxy.h;
      p.minProxyAt = `${now}ms ${v.topProxy.card} h=${Math.round(v.topProxy.h)} phase=${v.topProxy.phase}`;
    }
  }
  return p;
}

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
      await expect(page.locator('[data-discard-pile]'), 'the pile: the server\'s three').toHaveAttribute('data-discard-pile-count', '3');
      await stopStory();
      await shoot(page, preset.id, '02-reveal');

      const probe = await readProbe(page);
      // The record's own liveness floor: only a DEAD recorder fails it (recorded states, never frames).
      expect(probe.samples, 'the probe sampled (a dead sampler proves nothing)').toBeGreaterThan(0);
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
      // A toss lands on the ANIMATION clock and a found slot fills on the TASK clock: under worker load the two
      // adjacent beats of one step can swap by a sample (measured: Research found 1 ms before the tray read «1»).
      // A tie inside one scan window is not an inversion — a real reorder is hundreds of ms.
      const inversions = (order as Array<number>).map((t, i) => (i > 0 && t + 50 < (order as Array<number>)[i - 1] ? `${i}:${t}<${(order as Array<number>)[i - 1]}` : '')).filter((s) => s !== '');
      expect(inversions, `the server's order: ${trace}`).toEqual([]);

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
    // The bar's context and the crumb's tail, RECORDED through the whole beat (`armWitness`, armed before the press):
    // never two different words. A coexistence claim, so the record is `settled` — the state a task leaves; both are
    // TEXT (DOM writes), so no frame tick — a frame callback can run ahead of the product's own frame work.
    const stageWords = await armWitness(page, 'tr05-stage-words', () => {
      const text = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      // The tail CROSSFADES in one cell: the leaving word stands beside the arriving one for the swap — read the arriving one.
      const crumb = text('.con-cardactions .con-wshead__step:not(.con-wshead-swap-leave-active)');
      const bar = text('.con-cmdbar__context');
      return crumb === '' || bar === '' ? null : {crumb, bar};
    }, {settled: true, rafTick: false});
    await press(page, 'Enter', 400);
    await expect(page.locator('.con-cmdbar'), 'the batch landed: R3 is offered').toContainText(/сброшенные/i, {timeout: 30_000});
    await settle(page);
    const words = (await stageWords.stop()).map((s) => s.v).filter((v): v is {crumb: string, bar: string} => v !== null);
    const misses = words.filter((v) => v.crumb !== v.bar).slice(0, 6).map((v) => `crumb «${v.crumb}» bar «${v.bar}»`);
    // The record's own liveness floor: only a DEAD recorder fails it (recorded states, never frames).
    expect(words.length, 'the stage sampler ran').toBeGreaterThan(0);
    expect(misses, 'the bar never names a stage the crumb has left').toEqual([]);
    await expect(page.locator('[data-reveal-search]'), 'the summary').toHaveAttribute('data-search-discarded', '1');
    const verdict = page.locator('.con-zoom [data-zoom-discard-verdict]');
    for (let i = 0; i < 3 && await verdict.count() === 0; i++) {
      await press(page, 'KeyV', 1200);
    }
    await expect(verdict, 'a positive filter\'s discard names the RULE it missed').toHaveAttribute('data-verdict-kind', 'rule');
    await expect(verdict.locator('[data-draw-search]')).toHaveAttribute('data-draw-search', 'with:space');
    await shoot(page, 'tv4k', '07-tr05-tray');
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
    await expect(page.locator('[data-discard-pile]')).toHaveAttribute('data-discard-pile-count', '3');
    // The summary is ONE line and is never cut by its row (the head reserves one row).
    // Measured at REST (C — `readSettled`: the same reading twice, a frame apart).
    const fits = await readSettled(page, () => summary.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth),
      {message: 'the summary\'s fit'});
    expect(fits, 'the summary fits its own box and the screen').toBe(true);
    // PL-091 (the owner's decision 2026-10-07): no card of the row runs under the discard pile (on the Deck the last
    // card's VP badge did, under the old corner berth). Since TR52 the pile is the TABLE's, beside the HUD deck under
    // the status strip — outside the zone by construction; asserted against the plate the player sees.
    const hits = await readSettled(page, () => page.evaluate(() => {
      const plate = document.querySelector('[data-discard-pile] .con-dpile__plate')?.getBoundingClientRect();
      if (plate === undefined) {
        return ['no pile'];
      }
      return Array.from(document.querySelectorAll('.con-hand__outcome .con-reveal__strip .con-cards__slot'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.right > plate.left && r.left < plate.right && r.bottom > plate.top && r.top < plate.bottom)
        .map((r) => `slot ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} vs pile ${Math.round(plate.left)},${Math.round(plate.top)}`);
    }), {message: 'the row against the discard pile'});
    expect(hits, 'no card under the discard pile').toEqual([]);
    // PL-092: the status line's NAME yields only when the line is full — «Горнопромышленный район» (the second
    // card) used to be cut to «…рай…» by a flat 17rem cap with a whole empty line on either side. Walk the row and
    // read every name: whole while its bar has room, cut only by its own ellipsis once it has none.
    const nameCuts: Array<string> = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        await press(page, 'ArrowRight', 500);
      }
      // Read at REST (C — `readSettled`): the name of the card the cursor stands on, never a bar mid-swap.
      nameCuts.push(await readSettled(page, () => page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('.con-hand__outcome .con-reveal__namebar');
        const name = bar?.querySelector<HTMLElement>('.con-cards__verdict-name');
        if (bar === null || bar === undefined || name === null || name === undefined) {
          return 'no name';
        }
        // «Room» is the COLUMN the bar stands in, not the bar's own box: the bar is content-sized (a centred chip
        // chassis shared with the buy stage), so its own width says nothing about the line.
        const column = bar.parentElement;
        const roomy = column !== null && name.scrollWidth + 2 <= column.clientWidth;
        const cut = name.scrollWidth > name.clientWidth + 1;
        if (!(roomy && cut)) {
          return '';
        }
        const ns = getComputedStyle(name);
        const kids = Array.from(bar.children).map((k) => `${k.className.split(' ')[0]}:${k.clientWidth}/${k.scrollWidth}`).join(' ');
        return `«${name.textContent?.trim()}» cut at ${name.clientWidth} of ${name.scrollWidth} px — bar ${bar.clientWidth}/${bar.scrollWidth} in a column of ${column?.clientWidth}; kids ${kids}; name max-width ${ns.maxWidth}, flex ${ns.flex}`;
      }), {message: `the name bar of card ${i + 1}`}));
    }
    expect(nameCuts.filter((c) => c !== ''), 'no name cut while its line has room').toEqual([]);
    await press(page, 'ArrowLeft', 400);
    await press(page, 'ArrowLeft', 400);
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
    await expect(page.locator('[data-discard-pile]'), 'no pile').toHaveCount(0);
    await expect(page.locator('.con-cmdbar'), 'no R3 verb').not.toContainText(/сброшенные/i);
    await shoot(page, 'tv4k', '06-clean-top');
    await press(page, 'Escape', 600);
    await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
    const after = await wireOf(request, playerId);
    for (const name of KEPT) {
      expect(after.cardsInHand?.map((c) => c.name)).toContain(name);
    }
  });
});
