import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, bootIntoGame, closeZoomViewer, press, pressUntil, settle, soloGameConfig} from './consoleStart';

/**
 * «РАЗЫГРАНО» — ONE PAGE OF TABLE STACKS (the owner, 2026-10-19; TR65's chassis stays: the screen stands in the central
 * opening like every workspace). Every zone lies as the printed game lays it — the corporation, the preludes, the CEO,
 * the active and the automated cards as CASCADES (each covered card shows its title band, the newest lies whole in
 * front, a long zone continues in a second lane), the events as ONE face-down pile — and the whole table is ONE screen:
 * its compactness (the face, the band, the lanes) is solved from the body and the counts. A zone is READ in its
 * category view (A), and only there are pages allowed — an album of at least two rows, LB / RB turn it, the page count
 * stated on screen, the seat NOT switched inside.
 *
 *  A. the 20-card table — one page in the opening; every card on it; the stacks inside the body; no text under the
 *     TV floor; no page verb at the table
 *  B. the 50-card table — still ONE page (every card in the body); a big zone opens as an ALBUM: the spine «1 / N»,
 *     LB / RB turn its pages (the seat stays), B closes; LB / RB at the table walk the seats
 *  C. a category LIFTS off its stack and returns (slots held — one copy); X inspects out of the real slot
 *  E. LB/RB — the rival on the same chassis without an empty frame; the rival's empty events place
 *  F. an early table — the corporation alone, the projects' room honest; the bot — its flipped pile + corporation
 *  G. reduced motion — the same screen, the category opens without a flight
 *
 * The scene itself (the landing of a played card onto its stack) is the hero probes' subject
 * (`console-play-landing-probe` / `-geometry`).
 */
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', faceFloor: 380},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', faceFloor: 120},
] as const;

const TABLE = '.con-played:not(.con-played--embedded)';
const OUT = path.resolve('screenshots', 'played-stacks');

/** The acceptance frames (`screenshots/played-stacks/<profile>/`). */
async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

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
  frontW: number, stacks: Array<string>, faces: number,
  /** Cards (or stacks) whose box leaves the measured body — a one-page table has none. */
  outside: Array<string>,
  density: string,
  belowFloor: Array<string>,
  rightShare: number,
};

/** The table's numbers, read in one pass: the box against the opening, the stacks, the type floor. */
async function shapeOf(page: Page): Promise<Shape> {
  return await page.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(sel)!;
    const rr = root.getBoundingClientRect();
    const body = root.querySelector<HTMLElement>('.con-played__body')!.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const rem = parseFloat(cs.fontSize);
    const px = (v: string) => parseFloat(v) || 0;
    const stage = {t: px(cs.getPropertyValue('--con-stage-t')), b: px(cs.getPropertyValue('--con-stage-b')), l: px(cs.getPropertyValue('--con-stage-l'))};
    const front = Array.from(root.querySelectorAll<HTMLElement>('.con-played__slot--front')).map((el) => el.getBoundingClientRect().width).filter((w) => w > 0);
    const outside: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-played-stack], .con-played__slot'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) {
        continue;
      }
      if (r.left < body.left - 1 || r.right > body.right + 1 || r.top < body.top - 1 || r.bottom > body.bottom + 1) {
        outside.push(`${el.dataset.playedStack ?? el.dataset.playedKey ?? el.className} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)} vs body ${Math.round(body.right)},${Math.round(body.bottom)}`);
      }
    }
    const floorPx = px(cs.getPropertyValue('--con-t-floor')) * rem;
    let maxX = -Infinity;
    const below: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (own || el.classList.contains('pcard')) {
        maxX = Math.max(maxX, Math.min(r.right, rr.right));
      }
      // The premium face has its own type scale — the floor is the CHROME's law.
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
      frontW: front.length > 0 ? Math.min(...front) : 0,
      stacks: Array.from(root.querySelectorAll<HTMLElement>('[data-played-stack]')).map((el) => el.dataset.playedStack ?? ''),
      faces: root.querySelectorAll('[data-played-key]').length,
      outside,
      density: root.dataset.playedDensity ?? '',
      belowFloor: below,
      rightShare: (maxX - rr.left) / rr.width,
    };
  }, TABLE);
}

const bar = (page: Page) => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const crumb = (page: Page) => page.evaluate(() => (document.querySelector('.con-played .con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const focusedZone = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.con-played__family--focused')?.dataset.playedCat ?? '');
/** The table's stack counts as its captions read them. */
const stackCounts = (page: Page) => page.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll<HTMLElement>('.con-played [data-played-stack]'))
  .map((el) => [el.dataset.playedStack ?? '', Number(el.querySelector('.con-played__caption-count')?.textContent ?? '1')])));

/** Walk the cursor to a stack (spatial: ▶ along the row, ◀ when it ran past). */
async function focusStack(page: Page, stack: string): Promise<void> {
  for (let i = 0; i < 8 && await focusedZone(page) !== stack; i++) {
    await key(page, 'ArrowRight', 350);
  }
  for (let i = 0; i < 8 && await focusedZone(page) !== stack; i++) {
    await key(page, 'ArrowLeft', 350);
  }
  expect(await focusedZone(page), `the cursor on the ${stack} stack`).toBe(stack);
}

for (const preset of PRESETS) {
  test.describe(`the played table · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the 20-card table is ONE page in the opening — stacks inside the body, every card on it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'info-dossier', {query: preset.query});
      await settle(page);
      await openTable(page);
      const s = await shapeOf(page);
      // THE OPENING: the table's box is the central opening (the strategy rail yields — the policy class).
      expect(s.root.y, 'the top of the opening').toBeCloseTo(s.stage.t, -1);
      expect(s.root.x, 'the player rail\'s seam').toBeCloseTo(s.stage.l, -1);
      expect(s.root.y + s.root.h, 'the bar\'s edge').toBeCloseTo(preset.viewport.height - s.stage.b, -1);
      expect(s.root.x + s.root.w, 'welded to the physical right edge').toBeCloseTo(preset.viewport.width, -1);
      await expect(page.locator('.con-root'), 'the strategy rail\'s zone is taken').toHaveClass(/con-root--rail-replaced/);
      // ONE PAGE: every stack and every card inside the body — nothing paged, nothing cut.
      expect(s.outside, `nothing leaves the body:\n${s.outside.join('\n')}`).toEqual([]);
      expect(s.stacks[0], 'the corporation leads').toBe('corporation');
      expect(s.stacks[s.stacks.length - 1], 'the events close the table').toBe('events');
      expect(['comfort', 'tight', 'pile']).toContain(s.density);
      // The front faces read from the couch.
      expect(s.frontW, `a stack's front face ≥ ${preset.faceFloor} px (measured ${Math.round(s.frontW)})`).toBeGreaterThanOrEqual(preset.faceFloor);
      expect(s.rightShare, 'the stacks spread over the width').toBeGreaterThan(0.85);
      if (preset.id === 'tv4k') {
        expect(s.belowFloor, `no chrome text under the TV floor:\n${s.belowFloor.join('\n')}`).toEqual([]);
      }
      // THE STACKS: every zone wears its caption with its count; the events one face-down pile.
      await expect(page.locator('.con-played__family--event .con-played__caption-count')).toHaveText('2');
      await expect(page.locator('[data-played-stack="active"] .con-played__caption-count')).toHaveText('14');
      await expect(page.locator('[data-played-stack="active"] [data-played-key]')).toHaveCount(14);
      expect(await crumb(page)).toMatch(/Разыграно/i);
      expect(await crumb(page)).toMatch(/player1/i);
      const b = await bar(page);
      expect(b, 'A opens, B closes').toMatch(/Открыть/);
      expect(b).toMatch(/Закрыть/);
      expect(b, 'one page — no page verb at the table').not.toMatch(/Листать/);
      await shoot(page, preset.id, '01-table-20');
      // The command bar stays ON TOP of the screen (a workspace, not a drawer under the footer).
      expect(await page.locator('.con-footer').evaluate((el) => el.classList.contains('con-footer--under-scene'))).toBe(false);
      await key(page, 'Escape', 1000);
      await expect(page.locator(TABLE)).toHaveCount(0, {timeout: 8_000});
    });
  });
}

for (const preset of PRESETS.filter((p) => p.id !== 'deck')) {
  test.describe(`the played table · the album and the physics · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`B · the 50-card table stays ONE page; a big zone opens as an ALBUM — LB/RB turn its pages, the seat stays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'played-table-50', {query: preset.query});
      await settle(page);
      await openTable(page);
      const s = await shapeOf(page);
      // Every card of the table lies on the one page: the face-up ones as keyed slots, the events in their pile.
      const total = Number(await page.locator('.con-played__total b').textContent());
      const events = Number(await page.locator('.con-played__family--event .con-played__caption-count').textContent());
      expect(total, 'the fifty-card table (+ the corporation)').toBeGreaterThanOrEqual(50);
      expect(s.faces + events, 'every card on the one page').toBe(total);
      expect(s.outside, `nothing leaves the body:\n${s.outside.join('\n')}`).toEqual([]);
      const lanes = await page.locator('[data-played-stack][data-played-lanes]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-played-lanes'))));
      expect(Math.max(...lanes), 'a long zone continues in a second lane').toBeGreaterThan(1);
      await shoot(page, preset.id, '02-table-50');
      // The biggest zone opens as an album.
      const counts = await stackCounts(page);
      const big = Object.entries(counts).filter(([k]) => k !== 'events' && k !== 'corporation').sort((a, b) => b[1] - a[1])[0][0];
      await focusStack(page, big);
      const own = await crumb(page);
      await key(page, 'Enter', 400);
      await expect(page.locator('.con-played-cat--framed'), 'the cards landed, the frame assembled').toHaveCount(1, {timeout: 15_000});
      await settle(page).catch(() => undefined);
      const album = page.locator('.con-played-cat__albumbox');
      await expect(album, 'a big zone is an ALBUM').toHaveCount(1);
      const pages = Number(await album.getAttribute('data-cat-pages'));
      expect(pages, 'several pages — and the player sees it').toBeGreaterThan(1);
      await expect(page.locator('[data-cat-spine] .con-played-cat__spine-page')).toHaveText(`1 / ${pages}`);
      await expect(page.locator('[data-cat-spine] .con-played-cat__spine-dot')).toHaveCount(pages);
      expect(await page.locator('.con-played-cat__grid').count(), 'never a scrolling grid').toBe(0);
      // Two rows a page at least.
      const rows = await page.evaluate(() => {
        const page0 = document.querySelector('[data-cat-page-index="0"]');
        return new Set(Array.from(page0?.querySelectorAll<HTMLElement>('.con-played-cat__slot') ?? []).map((el) => Math.round(el.getBoundingClientRect().top))).size;
      });
      expect(rows, 'the album page has at least two rows').toBeGreaterThanOrEqual(2);
      expect(await bar(page), 'LB/RB «Листать» inside the album').toMatch(/Листать/);
      await shoot(page, preset.id, '03-album-page1');
      // RB — the next page; the seat is NOT switched (the crumb's subject stays).
      await key(page, 'KeyE', 700);
      await expect(album).toHaveAttribute('data-cat-page', '1');
      await expect(page.locator('[data-cat-spine] .con-played-cat__spine-page')).toHaveText(`2 / ${pages}`);
      expect(own, 'the own seat before the album').toMatch(/player1/i);
      expect(await crumb(page), 'the seat stays inside a category').toMatch(/player1/i);
      expect(await crumb(page)).not.toMatch(/player2/i);
      const firstOnScreen = await page.evaluate(() => {
        const box = document.querySelector('.con-played-cat__album')!.getBoundingClientRect();
        return Array.from(document.querySelectorAll<HTMLElement>('.con-played-cat__slot')).some((el) => {
          const r = el.getBoundingClientRect();
          return el.closest('[data-cat-page-index="1"]') !== null && r.left >= box.left - 1 && r.right <= box.right + 1;
        });
      });
      expect(firstOnScreen, 'page 2 stands in the album box').toBe(true);
      await shoot(page, preset.id, '04-album-page2');
      // LB — back.
      await key(page, 'KeyQ', 700);
      await expect(album).toHaveAttribute('data-cat-page', '0');
      // B — the cards fly home; the table again; RB now walks the seats.
      await key(page, 'Escape', 400);
      await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 15_000});
      await key(page, 'KeyE', 1000);
      expect(await crumb(page), 'at the table RB is the seat').toMatch(/player2/i);
      await key(page, 'Escape', 1000);
    });

    test(`C · a category LIFTS off its stack and returns — slots held, one copy; X inspects out of the real slot (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'info-dossier', {query: preset.query});
      await settle(page);
      await openTable(page);
      await focusStack(page, 'active');
      const slotBefore = await page.locator('[data-played-stack="active"] .con-played__slot').first().boundingBox();
      expect(slotBefore?.width ?? 0).toBeGreaterThan(4);
      await key(page, 'Enter', 400);
      await expect(page.locator('.con-played-cat'), 'the category view mounts').toHaveCount(1, {timeout: 8_000});
      await expect(page.locator('.con-played-cat--framed'), 'the cards landed, the frame assembled').toHaveCount(1, {timeout: 15_000});
      await settle(page).catch(() => undefined);
      // ONE PHYSICAL COPY: the stack's slots of the lifted cards hold their place (invisible, laid out).
      const held = page.locator('[data-played-stack="active"] .con-played__slot--held-out');
      expect(await held.count(), 'the active cards are away').toBe(14);
      const slotDuring = await page.locator('[data-played-stack="active"] .con-played__slot').first().boundingBox();
      expect(slotDuring?.width ?? 0, 'the slot keeps its geometry').toBeCloseTo(slotBefore?.width ?? 0, 0);
      expect(await page.locator('.con-played-cat__slot').count(), 'every card of the zone in the view').toBe(14);
      // Fourteen cards stand on ONE screen at this size — no scroll, no pages.
      const grid = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.con-played-cat__grid');
        if (el === null) {
          return {grid: false, scrolls: false, inView: 0};
        }
        const box = el.getBoundingClientRect();
        const inView = Array.from(document.querySelectorAll<HTMLElement>('.con-played-cat__slot')).filter((slot) => {
          const r = slot.getBoundingClientRect();
          return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
        }).length;
        return {grid: true, scrolls: el.scrollHeight > el.clientHeight + 2, inView};
      });
      expect(grid.grid, 'one screen holds the zone — the grid').toBe(true);
      expect(grid.scrolls).toBe(false);
      expect(grid.inView, 'the whole zone stands in view').toBe(14);
      await shoot(page, preset.id, '05-category-grid');
      // THE VIEW STANDS OVER THE TABLE'S BODY (PL-626): the crumb is painted, the view's box is the body's.
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
        };
      });
      expect(room, 'the head, the body and the view are on the page').toBeDefined();
      expect(room?.headCovered, 'the crumb is not under the category view').toBe(false);
      for (const [edge, d] of Object.entries({top: room?.dTop, left: room?.dLeft, right: room?.dRight, bottom: room?.dBottom})) {
        expect(Math.abs(d ?? 99), `the view's ${edge} edge is the body's`).toBeLessThanOrEqual(2);
      }
      expect(await crumb(page)).toMatch(/Активные/i);
      await expect(page.locator('.con-played .con-wshead'), 'ONE head (the table’s) — the category view draws none').toHaveCount(1);
      // X — the fullscreen out of the grid's real slot; the table stays on stage under the viewer.
      await key(page, 'KeyX', 1200);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 8_000});
      await expect(page.locator('.con-zoom__prov-cat')).toHaveText('Активные');
      expect(await page.locator(TABLE).evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
      await closeZoomViewer(page);
      // B — the cards fly home; every hold releases. (Act → verify → retry: the viewer's own return can absorb the
      // first B on a loaded runner — a second B mid-flight only snaps the cards home.)
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-played-cat').count() === 0, {tries: 3, settleMs: 2_500}),
        'B closes the category').toBe(true);
      await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 15_000});
      await expect(held).toHaveCount(0);
      expect(await focusedZone(page), 'the cursor stays on the zone it came from').toBe('active');
      await key(page, 'Escape', 1000);
    });

    test(`E · LB/RB — the rival's table on the same chassis, never an empty frame (${preset.id})`, async ({page, request}) => {
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
      expect(s.frontW, 'the rival\'s faces at the couch scale').toBeGreaterThanOrEqual(preset.faceFloor);
      expect(s.outside).toEqual([]);
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

  test('F · an early table — the corporation alone, the projects\' room honest; the bot\'s pile + corporation', async ({page, request}) => {
    test.setTimeout(480_000);
    await bootIntoGame(page, request, {
      config: soloGameConfig({players: [{name: 'TableTester', color: 'red', beginner: false, handicap: 0, first: true}], automa: {difficulty: 'normal'}}),
      query: '&consoleProfile=auto',
    });
    await openTable(page);
    await expect(page.locator('.con-played__family--corporation .con-played__slot')).toHaveCount(1);
    await expect(page.locator('.con-played__none'), 'the projects\' room says so in words').toBeVisible();
    await expect(page.locator('.con-played__seat-place--events'), 'the events\' prepared place').toHaveCount(1);
    expect(await bar(page), 'one page — no page verb').not.toMatch(/Листать/);
    // RB — the bot: its flipped pile on the same chassis, its corporation on the first stack (a player's table — D16).
    await key(page, 'KeyE', 1200);
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
    expect(s.frontW).toBeGreaterThanOrEqual(190);
    await focusStack(page, 'active');
    await key(page, 'Enter', 600);
    await expect(page.locator('.con-played-cat--framed')).toHaveCount(1, {timeout: 8_000});
    expect(await page.locator('.con-played-cat__proxy').count(), 'no flight proxies under reduced motion').toBe(0);
    await key(page, 'Escape', 600);
    await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 8_000});
    await key(page, 'Escape', 800);
  });
});
