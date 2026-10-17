import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, bootIntoGame, closeZoomViewer, press, settle, soloGameConfig} from './consoleStart';

/**
 * «РАЗЫГРАНО» — THE TABLE IS A TABLE (TR65, 2026-10-17): the played-cards screen stands in the central opening like
 * every workspace, its faces are readable from the couch (the hand album's density — never a strip of names), its
 * zones are SHELVES on strict pages, the corporation is the HERO of the identity column, the events lie face down
 * beneath it. The physics the old drawer had is kept on the new geometry: a category LIFTS off the shelf (its
 * slots hold their place, one physical copy) and returns; X inspects out of the real slot and the table stays on
 * stage under the viewer; LB/RB show the rival's table on the same chassis; the bot's table is its flipped pile.
 *
 *  A. the 20-card table — one screen, the opening; every face at the album's scale; no text under the TV floor
 *  B. the 50-card table — strict pages: LT/RT turn them, the focus walk turns them, neighbours stay mounted
 *  C. a category lifts off the shelf and returns (slots held — one copy); X inspects out of the real slot
 *  E. LB/RB — the rival on the same chassis without an empty frame; the bot — its flipped pile and its corporation
 *  F. an early table — the corporation alone, the shelves' room honest; reduced motion — the same screen
 *
 * The scene itself (the landing of a played card onto the shelf) is the hero probes' subject
 * (`console-play-landing-probe` / `-geometry`): they measure the receiving stage AND assert the standalone table never
 * stands during a workspace play.
 */
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto', faceFloor: 250, bottomFloor: 0.85},
  // The hand album's standard face at 4K measures ≈ 520 px (TR58's diagnosis); the table's shelf face may not fall under it.
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', faceFloor: 520, bottomFloor: 0.85},
  // The handheld's ALBUM is one row (the hand's own density); its TABLE stands on two (the owner, 2026-10-17 — PL-622:
  // ≈ 191 px faces, 20 cards in 4 pages), so the content reaches the bottom like on the other profiles.
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', faceFloor: 150, bottomFloor: 0.85},
] as const;

const TABLE = '.con-played:not(.con-played--embedded)';

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await press(page, code, settleMs);
}

/** X from the board home → the table, settled. */
async function openTable(page: Page): Promise<void> {
  for (let i = 0; i < 3 && await page.locator(TABLE).count() === 0; i++) {
    await key(page, 'KeyX', 1200);
  }
  await expect(page.locator(TABLE), 'the table stands').toHaveCount(1);
  await settle(page).catch(() => undefined);
}

type Shape = {
  root: {x: number, y: number, w: number, h: number},
  stage: {t: number, b: number, l: number},
  shelfFaceW: number, shelfFaces: number, heroW: number, identityW: number,
  pages: number, page: number,
  belowFloor: Array<string>,
  rightShare: number, bottomShare: number,
};

/** The table's numbers, read in one pass: the box against the opening, the faces, the pages, the type floor. */
async function shapeOf(page: Page): Promise<Shape> {
  return await page.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(sel)!;
    const rr = root.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const rem = parseFloat(cs.fontSize);
    const px = (v: string) => parseFloat(v) || 0;
    const stage = {t: px(cs.getPropertyValue('--con-stage-t')), b: px(cs.getPropertyValue('--con-stage-b')), l: px(cs.getPropertyValue('--con-stage-l'))};
    const widths = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s)).map((el) => el.getBoundingClientRect().width).filter((w) => w > 0);
    const shelf = widths('.con-played__album .con-played__slot');
    const hero = widths('.con-played__identity .con-played__family--corporation .con-played__slot');
    const identity = widths('.con-played__identity');
    const floorPx = px(cs.getPropertyValue('--con-t-floor')) * rem;
    const active = `[data-played-page-index="${root.dataset.playedPage}"]`;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const below: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      if (el.closest('.con-played__page') !== null && el.closest(active) === null) {
        continue;
      }
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (own || el.classList.contains('pcard')) {
        maxX = Math.max(maxX, Math.min(r.right, rr.right));
        maxY = Math.max(maxY, Math.min(r.bottom, rr.bottom));
      }
      // The premium face has its own type scale (the album's) — the floor is the CHROME's law.
      if (!own || el.closest('svg') !== null || el.closest('.pcard') !== null) {
        continue;
      }
      const z = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
      const eff = parseFloat(getComputedStyle(el).fontSize) * z;
      if (floorPx > 0 && eff + 0.5 < floorPx) {
        below.push(`${(el.className || el.tagName).toString().split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 24)}» ${Math.round(eff)}px`);
      }
    }
    return {
      root: {x: rr.left, y: rr.top, w: rr.width, h: rr.height},
      stage,
      shelfFaceW: shelf[0] ?? 0, shelfFaces: shelf.length, heroW: hero[0] ?? 0, identityW: identity[0] ?? 0,
      pages: Number(root.dataset.playedPages ?? '0'), page: Number(root.dataset.playedPage ?? '0'),
      belowFloor: below,
      rightShare: (maxX - rr.left) / rr.width, bottomShare: (maxY - rr.top) / rr.height,
    };
  }, TABLE);
}

const bar = (page: Page) => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const crumb = (page: Page) => page.evaluate(() => (document.querySelector('.con-played .con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const focusedZone = (page: Page) => page.evaluate(() => {
  const el = document.querySelector<HTMLElement>('.con-played__family--focused');
  return el?.dataset.playedCat ?? el?.dataset.playedRun ?? '';
});

for (const preset of PRESETS) {
  test.describe(`the played table · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the 20-card table is ONE screen in the opening — the album's faces, shelves with counts, nothing under the floor (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'info-dossier', {query: preset.query});
      await settle(page);
      await openTable(page);
      const s = await shapeOf(page);
      // THE OPENING: the table's box is the central opening (the strategy rail yields — the policy class), never a
      // drawer over a dimmed board.
      expect(s.root.y, 'the top of the opening').toBeCloseTo(s.stage.t, -1);
      expect(s.root.x, 'the player rail\'s seam').toBeCloseTo(s.stage.l, -1);
      expect(s.root.y + s.root.h, 'the bar\'s edge').toBeCloseTo(preset.viewport.height - s.stage.b, -1);
      expect(s.root.x + s.root.w, 'welded to the physical right edge').toBeCloseTo(preset.viewport.width, -1);
      await expect(page.locator('.con-root'), 'the strategy rail\'s zone is taken').toHaveClass(/con-root--rail-replaced/);
      // THE FACES: the shelf face at the album's scale — never a 13 px name strip.
      expect(s.shelfFaces, 'faces on the active page').toBeGreaterThan(0);
      expect(s.shelfFaceW, `a shelf face ≥ ${preset.faceFloor} px (measured ${Math.round(s.shelfFaceW)})`).toBeGreaterThanOrEqual(preset.faceFloor);
      expect(s.heroW, 'the corporation is the hero — larger than a shelf face').toBeGreaterThan(s.shelfFaceW);
      expect(s.identityW, 'the identity column stands').toBeGreaterThan(0);
      // THE ROOM: the content reaches the box (the old drawer left its right third empty).
      expect(s.rightShare, 'the content reaches the right').toBeGreaterThan(0.85);
      expect(s.bottomShare, 'the content reaches the bottom').toBeGreaterThan(preset.bottomFloor);
      if (preset.id === 'tv4k') {
        expect(s.belowFloor, `no chrome text under the TV floor:\n${s.belowFloor.join('\n')}`).toEqual([]);
      }
      // THE SHELVES: every zone wears its caption with its count; the crumb names the screen and the seat.
      expect(await page.locator('.con-played__family--corporation .con-played__caption').textContent(), 'the corporation shelf').toMatch(/Корпорация/i);
      await expect(page.locator('.con-played__family--event .con-played__caption-count')).toHaveText('2');
      await expect(page.locator('[data-played-run="active"] .con-played__caption-count').first()).toHaveText('14');
      expect(await crumb(page)).toMatch(/Разыграно/i);
      expect(await crumb(page)).toMatch(/player1/i);
      const b = await bar(page);
      expect(b, 'A opens, B closes').toMatch(/Открыть/);
      expect(b).toMatch(/Закрыть/);
      expect(b, 'the pages ride the triggers').toMatch(/Листать/);
      // The command bar stays ON TOP of the screen (a workspace, not a drawer under the footer).
      expect(await page.locator('.con-footer').evaluate((el) => el.classList.contains('con-footer--under-scene'))).toBe(false);
      await key(page, 'Escape', 1000);
      await expect(page.locator(TABLE)).toHaveCount(0, {timeout: 8_000});
    });
  });
}

for (const preset of PRESETS.filter((p) => p.id !== 'deck')) {
  test.describe(`the played table · pages and physics · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`B · the 50-card table turns strict pages — LT/RT, the focus walk; neighbours stay mounted (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'played-table-50', {query: preset.query});
      await settle(page);
      await openTable(page);
      const s0 = await shapeOf(page);
      expect(s0.pages, 'fifty cards are several pages').toBeGreaterThanOrEqual(4);
      expect(s0.page).toBe(0);
      // Every page carries the identity column; the active page and its neighbour are mounted (a slide lands on real
      // slots, never on an empty frame).
      expect(await page.locator('.con-played__page').count()).toBe(2);
      await key(page, 'Period', 700); // RT — the next page
      const s1 = await shapeOf(page);
      expect(s1.page).toBe(1);
      expect(await page.locator('.con-played__page').count(), 'the active page and both neighbours').toBe(3);
      expect(s1.shelfFaceW, 'the face does not change with the page').toBeCloseTo(s0.shelfFaceW, 0);
      await expect(page.locator('[data-played-page-index="1"] .con-played__slot').first()).toBeVisible();
      await key(page, 'Comma', 700); // LT — back
      expect((await shapeOf(page)).page).toBe(0);
      await key(page, 'Comma', 500);
      expect((await shapeOf(page)).page, 'the first page is the edge').toBe(0);
      // THE FOCUS WALK: right past the page's last zone continues onto the next page (the album's own law).
      let turned = false;
      for (let i = 0; i < 8 && !turned; i++) {
        await key(page, 'ArrowRight', 400);
        turned = (await shapeOf(page)).page > 0;
      }
      expect(turned, 'the walk turned the page').toBe(true);
      expect(await focusedZone(page), 'the cursor stands on a zone of the new page').not.toBe('');
      // A continuation names its range; the zone's first run its total.
      const counts = await page.locator('[data-played-page-index="1"] [data-played-run="active"] .con-played__caption-count').allTextContents();
      expect(counts.some((c) => /–/.test(c)), `a continuation reads a range: ${counts.join(' · ')}`).toBe(true);
      await key(page, 'Escape', 1000);
    });

    test(`C · a category LIFTS off the shelf and returns — slots held, one copy; X inspects out of the real slot (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'info-dossier', {query: preset.query});
      await settle(page);
      await openTable(page);
      // The cursor onto the ACTIVE shelf (the first run right of the corporation).
      for (let i = 0; i < 6 && await focusedZone(page) !== 'active'; i++) {
        await key(page, 'ArrowRight', 400);
      }
      expect(await focusedZone(page)).toBe('active');
      const slotBefore = await page.locator('[data-played-run="active"] .con-played__slot').first().boundingBox();
      expect(slotBefore?.width ?? 0).toBeGreaterThan(4);
      await key(page, 'Enter', 400);
      await expect(page.locator('.con-played-cat'), 'the category view mounts').toHaveCount(1, {timeout: 8_000});
      await expect(page.locator('.con-played-cat--framed'), 'the cards landed, the frame assembled').toHaveCount(1, {timeout: 15_000});
      await settle(page).catch(() => undefined);
      // ONE PHYSICAL COPY: the table's slots of the lifted cards hold their place (invisible, laid out).
      const held = page.locator('[data-played-run="active"] .con-played__slot--held-out');
      expect(await held.count(), 'the active cards of the page are away').toBeGreaterThan(0);
      const slotDuring = await page.locator('[data-played-run="active"] .con-played__slot').first().boundingBox();
      expect(slotDuring?.width ?? 0, 'the slot keeps its geometry').toBeCloseTo(slotBefore?.width ?? 0, 0);
      expect(await page.locator('.con-played-cat__slot').count(), 'every card of the zone in the grid').toBe(14);
      // A LIFT NEVER SHRINKS A FACE (PL-619) — unless that is what keeps the whole zone on ONE screen (the project's
      // first goal): either the grid's face is the shelf's at least, or every card of the zone stands in view, no scroll.
      const catW = (await page.locator('.con-played-cat__slot').first().boundingBox())?.width ?? 0;
      const grid = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.con-played-cat__grid');
        if (el === null) {
          return {scrolls: false, inView: 0};
        }
        const box = el.getBoundingClientRect();
        const inView = Array.from(document.querySelectorAll<HTMLElement>('.con-played-cat__slot')).filter((slot) => {
          const r = slot.getBoundingClientRect();
          return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
        }).length;
        return {scrolls: el.scrollHeight > el.clientHeight + 2, inView};
      });
      const shelfW = slotBefore?.width ?? 0;
      if (catW < shelfW - 1) {
        expect(grid.scrolls, `a face under the shelf's (${Math.round(catW)} < ${Math.round(shelfW)} px) only to keep the zone on one screen`).toBe(false);
        expect(grid.inView, 'the whole zone stands in view').toBe(14);
      }
      // THE VIEW STANDS OVER THE TABLE'S BODY (PL-626): the crumb is painted — nothing of the view over it — and the
      // view's box is the body's (the ДОП. РЕСУРСЫ lane and the head stay clear).
      const room = await page.evaluate(() => {
        const head = document.querySelector<HTMLElement>('.con-played__head');
        const body = document.querySelector<HTMLElement>('.con-played__body');
        const view = document.querySelector<HTMLElement>('.con-played-cat');
        if (head === null || body === null || view === null) {
          return undefined;
        }
        const h = head.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        const v = view.getBoundingClientRect();
        const atHead = document.elementFromPoint(h.left + 24, h.top + h.height / 2);
        return {
          headCovered: atHead !== null && view.contains(atHead),
          dTop: v.top - b.top, dLeft: v.left - b.left, dRight: b.right - v.right, dBottom: b.bottom - v.bottom,
          viewTop: v.top, headBottom: h.bottom,
        };
      });
      expect(room, 'the head, the body and the view are on the page').toBeDefined();
      expect(room?.headCovered, 'the crumb is not under the category view').toBe(false);
      expect(room?.viewTop ?? 0, 'the view starts below the head').toBeGreaterThanOrEqual((room?.headBottom ?? 0) - 1);
      for (const [edge, d] of Object.entries({top: room?.dTop, left: room?.dLeft, right: room?.dRight, bottom: room?.dBottom})) {
        expect(Math.abs(d ?? 99), `the view's ${edge} edge is the body's`).toBeLessThanOrEqual(2);
      }
      // THE CRUMB names the stage — the view never titles itself.
      expect(await crumb(page)).toMatch(/Активные/i);
      await expect(page.locator('.con-played .con-wshead'), 'ONE head (the table’s) — the category view draws none').toHaveCount(1);
      // X — the fullscreen out of the grid's real slot; the table stays on stage under the viewer.
      await key(page, 'KeyX', 1200);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 8_000});
      await expect(page.locator('.con-zoom__prov-cat')).toHaveText('Активные');
      expect(await page.locator(TABLE).evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
      await closeZoomViewer(page);
      // B — the cards fly home; every hold releases.
      await key(page, 'Escape', 400);
      await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 15_000});
      await expect(held).toHaveCount(0);
      expect(await focusedZone(page), 'the cursor stays on the zone it came from').toBe('active');
      await key(page, 'Escape', 1000);
    });

    test(`E · LB/RB — the rival's table on the same chassis, never an empty frame; the bot — its flipped pile (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'info-dossier', {query: preset.query});
      await settle(page);
      await openTable(page);
      const own = await crumb(page);
      // A table-count witness armed BEFORE the press: the chassis never leaves the DOM across the switch.
      await page.evaluate(() => {
        const w = window as unknown as {__tableGaps: number, __tableObs?: MutationObserver};
        w.__tableGaps = 0;
        w.__tableObs = new MutationObserver(() => {
          if (document.querySelector('.con-played__table') === null) {
            w.__tableGaps++;
          }
        });
        w.__tableObs.observe(document.body, {childList: true, subtree: true});
      });
      await key(page, 'KeyE', 1000); // RB — the rival
      const rival = await crumb(page);
      expect(rival).not.toBe(own);
      expect(rival).toMatch(/player2/i);
      await expect(page.locator('.con-played__family--corporation .con-played__slot').first()).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as {__tableGaps: number}).__tableGaps), 'no frame without the table').toBe(0);
      const s = await shapeOf(page);
      expect(s.shelfFaceW, 'the rival\'s faces at the same scale').toBeGreaterThanOrEqual(preset.faceFloor);
      // NO EVENT YET (PL-620): the stack's place is an outline that names what is missing — never a card-sized plate.
      const place = page.locator('.con-played__family--event .con-played__seat-place--events');
      await expect(place).toHaveCount(1);
      await expect(place.locator('.con-played__seat-note')).toHaveText('Событий пока нет');
      const paint = await place.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {image: cs.backgroundImage, color: cs.backgroundColor, border: cs.borderTopStyle};
      });
      expect(paint.image, 'no fill').toBe('none');
      expect(paint.color, 'no fill').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(paint.border, 'the place is drawn by its outline').toBe('dashed');
      await key(page, 'KeyQ', 1000); // LB — back to the own seat
      expect(await crumb(page)).toBe(own);
      await key(page, 'Escape', 1000);
    });
  });
}

test.describe('the played table · the bot, the early table, reduced motion', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('F · an early table — the corporation alone as the hero, the shelves\' room honest; the bot\'s pile + corporation', async ({page, request}) => {
    test.setTimeout(480_000);
    await bootIntoGame(page, request, {
      config: soloGameConfig({players: [{name: 'TableTester', color: 'red', beginner: false, handicap: 0, first: true}], automa: {difficulty: 'normal'}}),
      query: '&consoleProfile=auto',
    });
    await openTable(page);
    await expect(page.locator('.con-played__family--corporation .con-played__slot')).toHaveCount(1);
    await expect(page.locator('.con-played__none'), 'the shelves\' room says so in words').toBeVisible();
    await expect(page.locator('.con-played__seat-place--events'), 'the events\' prepared place').toHaveCount(1);
    expect(await bar(page), 'one page — no page verb').not.toMatch(/Листать/);
    // RB — the bot: its flipped pile on the same chassis, the provenance line, its corporation as the hero.
    await key(page, 'KeyE', 1200);
    await expect(page.locator('.con-played__provenance')).toBeVisible();
    await expect(page.locator('.con-played__botcorp')).toHaveCount(1);
    expect(await crumb(page)).toMatch(/Бот/);
    await key(page, 'Enter', 1400);
    await expect(page.locator('dialog.con-zoom[open]'), 'A on the bot\'s corporation — the fullscreen out of its slot').toHaveCount(1, {timeout: 8_000});
    await closeZoomViewer(page);
    await key(page, 'Escape', 1000);
    await expect(page.locator(TABLE)).toHaveCount(0, {timeout: 8_000});
  });

  test('G · reduced motion — the same screen, the category opens without a flight', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await bootFixtureSeats(page, request, 'info-dossier', {query: '&consoleProfile=auto'});
    await settle(page);
    await openTable(page);
    const s = await shapeOf(page);
    expect(s.shelfFaceW).toBeGreaterThanOrEqual(250);
    for (let i = 0; i < 6 && await focusedZone(page) !== 'active'; i++) {
      await key(page, 'ArrowRight', 300);
    }
    await key(page, 'Enter', 600);
    await expect(page.locator('.con-played-cat--framed')).toHaveCount(1, {timeout: 8_000});
    expect(await page.locator('.con-played-cat__proxy').count(), 'no flight proxies under reduced motion').toBe(0);
    await key(page, 'Escape', 600);
    await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 8_000});
    await key(page, 'Escape', 800);
  });
});
