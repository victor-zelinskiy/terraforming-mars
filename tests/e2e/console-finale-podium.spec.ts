/*
 * TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» — the finale as a PODIUM, end to end, on the SATURATED fixtures (every base score
 * category, the winner not the viewer — `finale-rich-5p` / `-2p`).
 *
 *  A · the results of FIVE players at 4K / FHD / Deck: the winner is the hero (≥ a third of the opening's height, the
 *      tallest seat, a face), five seats with five corporation faces, the content reaching the opening's foot (≥ 85 %),
 *      no empty band over a third of the height, no scroll, no text under the couch floor outside a card face;
 *  B · the DUEL: two side-by-side seats, the hero ≥ a third, both faces;
 *  C · THE COUNT FLOWS: a storyboard probe (setInterval — never rAF) sees each category's TOKENS in the air, the
 *      totals never move while the tokens fly (the count ticks on the touchdown), the medallions light, the ranking
 *      and the crowning move the seats; X skips to the canonical state atomically (no token left, the server's totals);
 *  D · the overview's «Счёт» and «Игроки» fill the opening with the same objects (faces, medallions);
 *  G · reduced motion: no token ever flies, the result is the same.
 * The hidden score opens HERE: the totals on the podium are the server's own breakdown totals.
 */
import {test, expect, Page} from './consoleTest';
import {fixtureTable, getModel, journeyToEndgame, shoot, waitWithFrames} from './consoleEndgameHarness';

const SHOT_DIR = 'screenshots/console-finale-podium';

type Shares = {
  rootH: number,
  contentBottom: number,
  heroHeight: number,
  maxVoid: number,
  scrolls: boolean,
  below: Array<string>,
  seats: number,
  faces: number,
};

/** The opening's shares: the content's foot, the hero's height, the largest empty band, the type under the floor. */
async function shares(page: Page, rootSel: string, tv: boolean): Promise<Shares> {
  return await page.evaluate(({sel, tv}) => {
    const root = document.querySelector<HTMLElement>(sel)!;
    const rr = root.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floorPx = tv ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem : 0;
    const spans: Array<[number, number]> = [];
    const below: Array<string> = [];
    let bottom = rr.top;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
        continue;
      }
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const object = own || el.tagName === 'IMG' || el.classList.contains('pcard') || cs.backgroundImage.includes('url(');
      if (object) {
        spans.push([Math.max(r.top, rr.top), Math.min(r.bottom, rr.bottom)]);
        bottom = Math.max(bottom, Math.min(r.bottom, rr.bottom));
      }
      if (tv && own && el.closest('svg') === null && el.closest('.pcard') === null && el.closest('.gp-glyph') === null) {
        const z = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
        const px = parseFloat(cs.fontSize) * z;
        if (px + 0.5 < floorPx) {
          below.push(`${el.className.toString().split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 20)}» ${Math.round(px)}px`);
        }
      }
    }
    spans.sort((a, b) => a[0] - b[0]);
    let maxVoid = 0;
    let reach = rr.top;
    for (const [top, end] of spans) {
      maxVoid = Math.max(maxVoid, top - reach);
      reach = Math.max(reach, end);
    }
    const hero = document.querySelector<HTMLElement>('.con-eg__row--hero, .con-ovpl__hero');
    return {
      rootH: rr.height,
      contentBottom: (bottom - rr.top) / rr.height,
      heroHeight: hero === null ? 0 : hero.getBoundingClientRect().height / rr.height,
      maxVoid: maxVoid / rr.height,
      scrolls: root.scrollHeight > root.clientHeight + 1,
      below,
      seats: document.querySelectorAll('.con-eg__row').length,
      faces: document.querySelectorAll('.con-eg__face .pcard').length,
    };
  }, {sel: rootSel, tv});
}

/**
 * The scene is AT REST: two consecutive equal reads of every measured object under `sel` (a seat, a face, a board
 * line, the players' hero) — a state, never a duration (a FLIP / a crowning / a fit still moving reads differently).
 */
async function layoutAtRest(page: Page, sel: string, what: string): Promise<void> {
  let last = '';
  await waitWithFrames(page, async () => {
    const now = await page.evaluate((s) => Array.from(document.querySelectorAll<HTMLElement>(
      `${s} .pcard, ${s} [data-eg-row], ${s} .con-ovs__line, ${s} .con-ovpl__hero, ${s} .con-ovpl__group`))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${getComputedStyle(el).opacity}`;
      }).join('|'), sel);
    const same = now !== '' && now === last;
    last = now;
    return same;
  }, 20_000, what);
}

async function settled(page: Page): Promise<void> {
  await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 150_000, 'the settled results');
  await layoutAtRest(page, '.con-endgame', 'the podium at rest');
}

/** Turn the overview's tabs with E until `name` is the active one — each press waits for the tab to change. */
async function overviewTab(page: Page, name: RegExp): Promise<void> {
  const active = async () => (await page.locator('.con-egov__tab--active').first().textContent()) ?? '';
  for (let i = 0; i < 7 && !name.test(await active()); i++) {
    const before = await active();
    await page.keyboard.press('KeyE');
    await waitWithFrames(page, async () => (await active()) !== before, 8_000, `the overview's tab after «${before.trim()}»`);
  }
  expect(await active()).toMatch(name);
}

async function serverTotals(request: Parameters<typeof getModel>[0], id: string): Promise<Array<number>> {
  const model = await getModel(request, id);
  return model.players.map((p) => p.victoryPointsBreakdown?.total ?? -1).sort((a, b) => b - a);
}

async function shownTotals(page: Page): Promise<Array<number>> {
  return (await page.locator('.con-eg__total-num').allTextContents()).map((t) => Number(t.trim())).sort((a, b) => b - a);
}

for (const profile of [
  {name: 'tv4k', viewport: {width: 3840, height: 2160}, tv: true},
  {name: 'fhd', viewport: {width: 1920, height: 1080}, tv: false},
  {name: 'deck', viewport: {width: 1280, height: 800}, tv: false},
] as const) {
  test.describe(`console finale podium — five players · ${profile.name}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test('A · the hero, five faces on the horizon, the opening filled, the type at the floor', async ({page, request}) => {
      test.setTimeout(600_000);
      const ids = await fixtureTable(request, 'finale-rich-5p');
      await journeyToEndgame(page, request, ids);
      await page.keyboard.press('KeyX'); // the count is C's subject — land on the canonical results
      await settled(page);
      await shoot(page, SHOT_DIR, `${profile.name}-5p-results`);
      const s = await shares(page, '.con-endgame', profile.tv);
      expect(s.seats, 'five seats').toBe(5);
      expect(s.faces, 'five corporation faces').toBe(5);
      expect(s.scrolls, 'five players stay one screen, no scroll').toBe(false);
      expect(s.heroHeight, `the hero is a third of the opening (${s.heroHeight.toFixed(2)})`).toBeGreaterThanOrEqual(1 / 3);
      expect(s.contentBottom, `the content reaches the opening's foot (${s.contentBottom.toFixed(2)})`).toBeGreaterThanOrEqual(0.85);
      expect(s.maxVoid, `no empty band over a third (${s.maxVoid.toFixed(2)})`).toBeLessThanOrEqual(1 / 3);
      expect(s.below, 'no text under the couch floor outside a card face').toEqual([]);
      // The hero is the TALLEST seat; the winner's ribbon stands on it.
      const heights = await page.locator('.con-eg__row').evaluateAll((els) => els.map((el) => ({
        hero: el.classList.contains('con-eg__row--hero'), h: el.getBoundingClientRect().height,
      })));
      const heroH = Math.max(...heights.filter((x) => x.hero).map((x) => x.h));
      expect(heights.filter((x) => !x.hero).every((x) => x.h < heroH)).toBe(true);
      await expect(page.locator('.con-eg__row--hero .con-eg__ribbon')).toHaveCount(1);
      // The hidden score opens HERE — the server's own totals.
      expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    });
  });
}

for (const profile of [
  {name: 'tv4k', viewport: {width: 3840, height: 2160}, tv: true},
  {name: 'fhd', viewport: {width: 1920, height: 1080}, tv: false},
  {name: 'deck', viewport: {width: 1280, height: 800}, tv: false},
] as const) {
  test.describe(`console finale podium — the duel · ${profile.name}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test('B · two heroes side by side; D · the overview\'s Score and Players fill the opening with faces', async ({page, request}) => {
      test.setTimeout(600_000);
      const ids = await fixtureTable(request, 'finale-rich-2p');
      await journeyToEndgame(page, request, ids);
      await page.keyboard.press('KeyX');
      await settled(page);
      await shoot(page, SHOT_DIR, `${profile.name}-2p-results`);
      await expect(page.locator('.con-eg__rows--side')).toHaveCount(1);
      const s = await shares(page, '.con-endgame', profile.tv);
      expect(s.seats).toBe(2);
      expect(s.faces).toBe(2);
      expect(s.heroHeight, `the duel's hero is a third of the opening (${s.heroHeight.toFixed(2)})`).toBeGreaterThanOrEqual(1 / 3);
      expect(s.contentBottom).toBeGreaterThanOrEqual(0.85);
      expect(s.below).toEqual([]);
      // Every seat HOLDS its reading column (the name over the seat and the medallions over the actions on a narrow box
      // were the Deck's defect) — and nothing of a seat reaches into the actions below.
      const spill = await page.evaluate(() => {
        const out: Array<string> = [];
        const actions = document.querySelector('.con-eg__actions')?.getBoundingClientRect();
        for (const row of Array.from(document.querySelectorAll<HTMLElement>('.con-eg__row'))) {
          const seat = row.getBoundingClientRect();
          const read = row.querySelector('.con-eg__read')?.getBoundingClientRect();
          if (read !== undefined && (read.top < seat.top - 1 || read.bottom > seat.bottom + 1)) {
            out.push(`${row.dataset.egRow}: read ${Math.round(read.top)}–${Math.round(read.bottom)} vs seat ${Math.round(seat.top)}–${Math.round(seat.bottom)}`);
          }
          const overlapsX = actions !== undefined && seat.right > actions.left && seat.left < actions.right;
          if (actions !== undefined && overlapsX && seat.bottom > actions.top + 1) {
            out.push(`${row.dataset.egRow}: seat foot ${Math.round(seat.bottom)} under the actions' top ${Math.round(actions.top)}`);
          }
        }
        return out;
      });
      expect(spill, 'every seat holds its reading column, clear of the actions').toEqual([]);

      // D · «Обзор партии» → «Счёт»: the board with a face per place, filling the opening.
      await page.keyboard.press('Enter');
      await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) > 0, 15_000, 'the overview');
      await overviewTab(page, /Счёт/i);
      await waitWithFrames(page, async () => (await page.locator('.con-ovs__board').count()) > 0, 8_000, 'the score board');
      await layoutAtRest(page, '.con-egov', 'the score board at rest');
      await shoot(page, SHOT_DIR, `${profile.name}-2p-ov-score`);
      expect(await page.locator('.con-ovs__seat .pcard').count(), 'a face per place').toBe(2);
      const score = await shares(page, '.con-egov', profile.tv);
      expect(score.contentBottom, `the board reaches the opening's foot (${score.contentBottom.toFixed(2)})`).toBeGreaterThanOrEqual(0.85);
      expect(score.below).toEqual([]);
      // «Игроки»: the participant's face as the hero, the milestones / awards as medallions.
      await overviewTab(page, /Игроки/i);
      await waitWithFrames(page, async () => (await page.locator('.con-ovpl__hero').count()) > 0, 8_000, 'the players sheet');
      await layoutAtRest(page, '.con-egov', 'the players sheet at rest');
      await shoot(page, SHOT_DIR, `${profile.name}-2p-ov-players`);
      expect(await page.locator('.con-ovpl__hero .pcard').count(), 'the participant\'s face').toBe(1);
      const players = await shares(page, '.con-egov', profile.tv);
      expect(players.contentBottom).toBeGreaterThanOrEqual(0.85);
      expect(players.below).toEqual([]);
    });
  });
}

test.describe('console finale podium — the count flows (4K)', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

  test('C · tokens fly from the rail into every seat, the count waits for the touchdown, X lands atomically', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    await journeyToEndgame(page, request, ids);
    await waitWithFrames(page, async () => (await page.locator('.con-endgame--entering, .con-endgame--scoring').count()) > 0, 20_000, 'the count');
    // The storyboard probe — setInterval (headless starves rAF on a quiet screen; a dead rAF probe passes).
    await page.evaluate(() => {
      type Sample = {beat: string, cat: string, tokens: Array<string>, totals: Array<string>, lit: number};
      const samples: Array<Sample> = [];
      const timer = window.setInterval(() => {
        const root = document.querySelector<HTMLElement>('.con-endgame');
        if (root === null) {
          return;
        }
        samples.push({
          beat: root.dataset.egBeat ?? '',
          cat: root.dataset.egCat ?? '',
          tokens: Array.from(document.querySelectorAll<HTMLElement>('.con-eg-token')).map((t) => t.dataset.egToken ?? ''),
          totals: Array.from(document.querySelectorAll<HTMLElement>('[data-eg-total]')).map((t) => t.textContent ?? ''),
          lit: document.querySelectorAll('.con-eg__medal--on').length,
        });
      }, 30);
      (globalThis as unknown as {__podium: {samples: Array<Sample>, stop: () => void}}).__podium = {samples, stop: () => window.clearInterval(timer)};
    });
    // Let three categories play, then skip the rest.
    await waitWithFrames(page, async () => Number(await page.locator('.con-endgame').getAttribute('data-eg-cat')) >= 3, 60_000, 'three categories');
    await shoot(page, SHOT_DIR, 'tv4k-5p-count');
    const samples = await page.evaluate(() => {
      const p = (globalThis as unknown as {__podium: {samples: Array<{beat: string, cat: string, tokens: Array<string>, totals: Array<string>, lit: number}>, stop: () => void}}).__podium;
      p.stop();
      return p.samples;
    });
    expect(samples.length, 'the probe sampled').toBeGreaterThan(30);
    const flying = samples.filter((s) => s.tokens.length > 0);
    expect(flying.length, 'tokens were seen in the air').toBeGreaterThan(0);
    expect(new Set(flying.flatMap((s) => s.tokens)).size, 'more than one category flew').toBeGreaterThan(1);
    // While a beat's tokens fly, no total moves: within every run of `fly` samples the totals are constant.
    let run: Array<string> | undefined;
    for (const s of samples) {
      if (s.beat === 'fly') {
        const key = s.totals.join('|');
        if (run === undefined) {
          run = [key];
        } else {
          run.push(key);
        }
      } else if (run !== undefined) {
        expect(new Set(run).size, `the totals moved while tokens flew: ${[...new Set(run)].join(' / ')}`).toBe(1);
        run = undefined;
      }
    }
    // The medallions light as categories land.
    expect(Math.max(...samples.map((s) => s.lit))).toBeGreaterThan(5);

    // X — the canonical state, atomically: no token left, the server's totals, every medallion lit.
    await page.keyboard.press('KeyX');
    await settled(page);
    expect(await page.locator('.con-eg-token').count()).toBe(0);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });
});

test.describe('console finale podium — reduced motion (FHD)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('G · no token ever flies; the count still lands on the server\'s totals and the podium forms', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    // The live matchMedia is what the console's reduced motion reads (the context option never reached the page
    // here — the effects-explorer / info-workspace precedent sets it on the page).
    await page.emulateMedia({reducedMotion: 'reduce'});
    await journeyToEndgame(page, request, ids);
    // The precondition, read where the product reads it: the OS preference and the console's own bridge.
    expect(await page.evaluate(() => ({
      media: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      bridge: document.documentElement.classList.contains('con-reduced-motion'),
    })), 'the page runs under reduced motion').toEqual({media: true, bridge: true});
    await page.evaluate(() => {
      const seen = {tokens: 0};
      const timer = window.setInterval(() => {
        seen.tokens = Math.max(seen.tokens, document.querySelectorAll('.con-eg-token').length);
      }, 30);
      (globalThis as unknown as {__rm: {seen: {tokens: number}, stop: () => void}}).__rm = {seen, stop: () => window.clearInterval(timer)};
    });
    await settled(page);
    const tokens = await page.evaluate(() => {
      const p = (globalThis as unknown as {__rm: {seen: {tokens: number}, stop: () => void}}).__rm;
      p.stop();
      return p.seen.tokens;
    });
    expect(tokens, 'reduced motion flies no token').toBe(0);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });
});
