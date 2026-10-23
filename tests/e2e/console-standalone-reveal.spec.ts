/*
 * TR57 «НАГРАДА ВНЕ WORKSPACE — СЦЕНА, А НЕ ФОРМА»: the standalone received-cards reveal (a board cell's printed card
 * bonus — Terra Cimmeria Nova '38' DRAW_CARD × 2, '36' STEEL + DRAW_CARD), fhd and tv4k, on the real server.
 *
 * What it replaced: a fixed `min(70rem, 94vw) × min(42rem, …)` plate at full width over both rails under a full-bleed
 * dim, a head saying «Получены карты» twice with a boilerplate subtitle and a source chip that never named the cell,
 * the card's name floating under an empty plate, a frame that «materialized around the landed covers», and for ONE
 * card a different interface entirely (the fullscreen inspector with its own command bar).
 *
 * The contract pinned here, by the server's batch and the live DOM:
 *   A · two cards — the scene is INSIDE the central opening (its box ⊂ the opening's; the player rail and the
 *       strategy rail are not crossed and stay LIT — no rail digit under the dim or the scene), the head is ONE row
 *       that says «Получены карты» once and names the paying cell by its printed bonuses, the status line stands
 *       right under the row, the cards are at least a third of the opening; the ENTRY is assembled by the cards
 *       (a `MutationObserver` + `setInterval` sampler armed before the press — never rAF): no frame where the scene's
 *       chrome is visible before a cover has touched its slot, none where a real card shows while the head is unseen;
 *       L3 shows the paying cell on the board (the scene recedes, the cell is ringed) and L3 brings the cards back;
 *       A takes a card into the hand — one per press, the second closes the scene.
 *   B · one card + steel — the SAME scene: one slot, no fullscreen viewer opens on its own, the hero ≥ ⅓ of the
 *       opening; X opens the viewer, B returns to the scene, A takes the card.
 */
import {expect, test, Page} from './consoleTest';
import {bootSeededGame, closeZoomViewer, fetchPlayerModel, forceSwiftPlacement, openZoomViewer, press, pressUntil} from './consoleStart';
import {STEEL_CARD_CELL, TWO_CARDS_CELL, createCleanTcnGame, openConvertPlants, walkBoardCursorTo} from './boardCellBonus';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Sample = {
  t: number,
  /** Covers / proxies painted. */
  proxies: number,
  /** …of which stand ON a slot of the scene (their box within a few px of a slot card's box). */
  landed: number,
  /** The scene frame's effective opacity (head · status · floor), 0 when absent. */
  frame: number,
  /** A REAL received card is painted (opacity > .5). */
  cards: boolean,
};

async function armEntrySampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<unknown> = [];
    const t0 = performance.now();
    const op = (el: Element | null): number => {
      let v = 1;
      for (let e: Element | null = el; e !== null; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        v *= Number(cs.opacity);
      }
      return el === null ? 0 : v;
    };
    const sample = () => {
      const proxies = Array.from(document.querySelectorAll('.con-bonusfly-proxy'))
        .filter((p) => getComputedStyle(p).visibility !== 'hidden' && Number(getComputedStyle(p).opacity) > 0.05);
      const slotCards = Array.from(document.querySelectorAll('.con-reveal [data-zoom-slot] :is(.card-container, .pcard)'));
      const slotBoxes = slotCards.map((c) => c.getBoundingClientRect());
      const landed = proxies.filter((p) => {
        const r = p.getBoundingClientRect();
        return slotBoxes.some((s) => Math.abs(s.left - r.left) < 6 && Math.abs(s.top - r.top) < 6 && Math.abs(s.width - r.width) < 8);
      }).length;
      samples.push({
        t: Math.round(performance.now() - t0),
        proxies: proxies.length,
        landed,
        frame: op(document.querySelector('.con-reveal--scene .con-reveal__card')),
        cards: slotCards.some((c) => op(c) > 0.5),
      });
    };
    const timer = window.setInterval(sample, 25);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
    (window as unknown as {__scene: unknown}).__scene = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  });
}

async function readEntrySampler(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => {
    const w = window as unknown as {__scene: {samples: Array<unknown>, stop: () => void}};
    w.__scene.stop();
    return w.__scene.samples;
  }) as Array<Sample>;
}

type Geometry = {
  opening: {l: number, t: number, r: number, b: number},
  reveal: {l: number, t: number, r: number, b: number},
  rail: {r: number},
  strat: {l: number} | undefined,
  shade: {l: number, r: number, t: number, b: number, on: boolean},
  digitsCovered: number,
  digits: number,
  head: string,
  cellIcons: number,
  received: string,
  slots: Array<{t: number, b: number, h: number}>,
  namebarTop: number,
  rem: number,
};

async function geometry(page: Page): Promise<Geometry> {
  return await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const px = (k: string) => parseFloat(html.getPropertyValue(k)) || 0;
    const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const reveal = box('.con-reveal')!;
    const card = box('.con-reveal__card')!;
    const shadeEl = document.querySelector('.con-shade')!;
    const shade = shadeEl.getBoundingClientRect();
    const shadeOn = Number(getComputedStyle(shadeEl).opacity) > 0.05;
    const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    const digits = Array.from(document.querySelectorAll('.con-res .con-res__digits')).map((d) => d.getBoundingClientRect());
    const strat = box('.con-strat');
    return {
      opening: {l: px('--con-stage-l'), t: px('--con-stage-t'), r: window.innerWidth - px('--con-stage-r'), b: window.innerHeight - px('--con-stage-b')},
      reveal: {l: reveal.left, t: reveal.top, r: reveal.right, b: reveal.bottom},
      rail: {r: box('.con-res')!.right},
      strat: strat === undefined || strat.width === 0 ? undefined : {l: strat.left},
      shade: {l: shade.left, r: shade.right, t: shade.top, b: shade.bottom, on: shadeOn},
      digitsCovered: digits.filter((d) => {
        const cx = d.left + d.width / 2;
        const cy = d.top + d.height / 2;
        return (shadeOn && inside(shade, cx, cy)) || inside(card, cx, cy);
      }).length,
      digits: digits.length,
      head: (document.querySelector('.con-reveal__head') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      cellIcons: document.querySelectorAll('.con-reveal [data-reveal-source-cell] .con-reveal__sourcebadge-icon').length,
      received: (document.querySelector('.con-reveal [data-reveal-received]') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      slots: Array.from(document.querySelectorAll('.con-reveal [data-zoom-slot]')).map((s) => {
        const r = s.getBoundingClientRect();
        return {t: r.top, b: r.bottom, h: r.height};
      }),
      namebarTop: box('.con-reveal__namebar')?.top ?? -1,
      rem: parseFloat(html.fontSize) || 20,
    };
  });
}

/** The scene stands: unveiled, its cards handed over (no cover left painted), the status line live and opaque. */
async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('.con-reveal--scene');
    const namebar = document.querySelector('.con-reveal__namebar:not(.con-reveal__namebar--held)');
    const proxiesGone = Array.from(document.querySelectorAll('.con-bonusfly-proxy'))
      .every((p) => getComputedStyle(p).visibility === 'hidden' || Number(getComputedStyle(p).opacity) < 0.05);
    const name = namebar?.firstElementChild ?? null;
    return root !== null && !root.classList.contains('con-reveal--bonus-veiled') && !root.classList.contains('con-reveal--bonus-held') &&
      proxiesGone && name !== null && Number(getComputedStyle(name).opacity) > 0.95;
  }, undefined, {timeout: 30_000, polling: 100});
}

function expectInOpening(g: Geometry, label: string): void {
  expect(g.reveal.l, `${label}: the scene starts right of the player rail`).toBeGreaterThanOrEqual(g.rail.r - 1);
  expect(g.reveal.l, `${label}: the scene's left edge IS the opening's`).toBeGreaterThanOrEqual(g.opening.l - 1);
  expect(g.reveal.r, `${label}: the scene's right edge IS the opening's`).toBeLessThanOrEqual(g.opening.r + 1);
  expect(g.reveal.t).toBeGreaterThanOrEqual(g.opening.t - 1);
  expect(g.reveal.b).toBeLessThanOrEqual(g.opening.b + 1);
  if (g.strat !== undefined) {
    expect(g.reveal.r, `${label}: the strategy rail stays clear`).toBeLessThanOrEqual(g.strat.l + 1);
  }
  if (g.shade.on) {
    expect(g.shade.l, `${label}: the dim never greys the player rail`).toBeGreaterThanOrEqual(g.rail.r - 2);
    if (g.strat !== undefined) {
      expect(g.shade.r, `${label}: the dim never greys the strategy rail`).toBeLessThanOrEqual(g.strat.l + 2);
    }
  }
  expect(g.digits, `${label}: the rail's digits are on screen`).toBeGreaterThan(3);
  expect(g.digitsCovered, `${label}: no rail digit under the dim or the scene`).toBe(0);
}

for (const preset of PRESETS) {
  test.describe(`standalone reveal — the scene, not the form · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test.setTimeout(240_000);

    test('A · two cards: in the opening, one head naming the cell, the status under the row, assembled by its cards; L3 shows the cell; A takes', async ({page, request}) => {
      const playerId = await createCleanTcnGame(request, TWO_CARDS_CELL);
      await forceSwiftPlacement(page);
      await bootSeededGame(page, request, playerId, {query: preset.query});
      await openConvertPlants(page);
      expect(await walkBoardCursorTo(page, TWO_CARDS_CELL), `the cursor never reached cell ${TWO_CARDS_CELL}`).toBeTruthy();
      const handBefore = ((await fetchPlayerModel(request, playerId)) as unknown as {cardsInHand: Array<unknown>}).cardsInHand.length;

      await armEntrySampler(page);
      await press(page, 'Enter', 200);
      await waitForScene(page);
      const samples = await readEntrySampler(page);
      const g = await geometry(page);

      // THE COUNT IS THE BATCH and the slots are its cards.
      expect(Math.max(...samples.map((s) => s.proxies)), 'two covers for two cards').toBe(2);
      expect(g.slots).toHaveLength(2);
      // THE ENTRY IS ASSEMBLED BY THE CARDS — measured, both directions.
      const firstTouch = samples.findIndex((s) => s.landed > 0);
      expect(firstTouch, `a cover never touched its slot: ${JSON.stringify(samples.slice(-5))}`).toBeGreaterThanOrEqual(0);
      const chromeBeforeTouch = samples.slice(0, firstTouch).filter((s) => s.frame > 0.05 && !s.cards);
      expect(chromeBeforeTouch, 'the scene\'s chrome (head · status · floor) stood before any card had touched — a frame round nothing').toHaveLength(0);
      const cardsWithoutHead = samples.filter((s) => s.cards && s.frame < 0.05);
      expect(cardsWithoutHead, 'a real card painted while the head was unseen — slots without their scene').toHaveLength(0);
      expect(samples.length, 'the entry sampler never ran').toBeGreaterThan(20);

      expectInOpening(g, 'two cards');
      // THE HEAD SAYS IT ONCE and names the cell by its printed face.
      expect(g.head.match(/Получены карты/g) ?? [], `the head says it once: «${g.head}»`).toHaveLength(1);
      expect(g.head).not.toContain('Карты добавлены из источника добора');
      expect(g.cellIcons, 'the source badge shows the cell\'s two printed card bonuses').toBe(2);
      expect(g.received).toContain('2');
      // The status line stands right under the row; the cards are the scene's protagonists.
      const rowBottom = Math.max(...g.slots.map((s) => s.b));
      expect(g.namebarTop - rowBottom, 'the card\'s name hangs right under the row').toBeLessThanOrEqual(3.2 * g.rem);
      expect(g.namebarTop).toBeGreaterThan(rowBottom - 2);
      expect(Math.max(...g.slots.map((s) => s.h)), 'the cards are at least a third of the opening').toBeGreaterThanOrEqual((g.opening.b - g.opening.t) / 3);

      // L3 — WHERE FROM: the scene recedes over the board, the paying cell is ringed; L3 brings the cards back.
      expect(await pressUntil(page, 'KeyC', async () => await page.locator('.con-reveal--peek').count() > 0, {settleMs: 300})).toBeTruthy();
      await expect(page.locator('.board-log-highlight.con-peek-cell--source'), 'the paying cell is ringed').toHaveCount(1);
      // The recede is a 200 ms opacity transition from the class flip — wait it out (a loaded renderer reads it mid-way),
      // and name the reveal's own classes if it never comes (the peek rule keys on `--scene.--peek`).
      const peekRead = () => page.evaluate(() => {
        const card = document.querySelector<HTMLElement>('.con-reveal__card');
        return {opacity: card === null ? -1 : Number(getComputedStyle(card).opacity), classes: document.querySelector('.con-reveal')?.className ?? '(no .con-reveal)'};
      });
      await expect.poll(async () => (await peekRead()).opacity, {timeout: 3_000, message: `the scene recedes while the cell is shown (${JSON.stringify(await peekRead())})`})
        .toBeLessThan(0.3);
      expect(await pressUntil(page, 'KeyC', async () => await page.locator('.con-reveal--peek').count() === 0, {settleMs: 300})).toBeTruthy();
      await expect(page.locator('.board-log-highlight.con-peek-cell--source')).toHaveCount(0);

      // A — one card per press into the hand; the second take closes the scene.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal [data-zoom-slot]').count() === 1, {settleMs: 600})).toBeTruthy();
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() === 0, {settleMs: 600})).toBeTruthy();
      await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as {cardsInHand: Array<unknown>}).cardsInHand.length,
        {timeout: 10_000}).toBe(handBefore + 2);
    });

    test('B · one card + steel: the SAME scene — no viewer on its own, a hero, X opens the viewer, B returns, A takes', async ({page, request}) => {
      const playerId = await createCleanTcnGame(request, STEEL_CARD_CELL);
      await forceSwiftPlacement(page);
      await bootSeededGame(page, request, playerId, {query: preset.query});
      await openConvertPlants(page);
      expect(await walkBoardCursorTo(page, STEEL_CARD_CELL), `the cursor never reached cell ${STEEL_CARD_CELL}`).toBeTruthy();

      await armEntrySampler(page);
      await press(page, 'Enter', 200);
      await waitForScene(page);
      const samples = await readEntrySampler(page);
      const g = await geometry(page);

      expect(await page.locator('dialog.con-zoom[open]').count(), 'a lone reward card opens no fullscreen viewer').toBe(0);
      expect(g.slots, 'one slot for one card').toHaveLength(1);
      expect(samples.findIndex((s) => s.landed > 0), 'the lone cover lands in its own slot').toBeGreaterThanOrEqual(0);
      expect(samples.filter((s) => s.cards && s.frame < 0.05), 'the card never stands without its scene').toHaveLength(0);
      expectInOpening(g, 'one card');
      expect(g.head.match(/Получена карта/g) ?? []).toHaveLength(1);
      expect(g.received, 'one card: no count badge — the title is singular').toBe('');
      expect(g.cellIcons, 'the cell is named by its two printed bonuses (steel + card)').toBe(2);
      expect(g.slots[0].h, 'the hero is at least a third of the opening').toBeGreaterThanOrEqual((g.opening.b - g.opening.t) / 3);

      // X — the viewer, as for any card; B — back to the same scene.
      await openZoomViewer(page);
      await closeZoomViewer(page);
      await expect(page.locator('.con-reveal--scene [data-zoom-slot]')).toHaveCount(1);
      // A — the card into the hand, the scene leaves.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() === 0, {settleMs: 600})).toBeTruthy();
    });
  });
}
