import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, press, pressUntil, pressUntilVisible, settle} from './consoleStart';

/**
 * T10 · CE — THE PACKET SHOWCASE (the draft + the research buy on the 4K TV). The stand of the iteration «ДРАФТ И
 * ПОКУПКА ИССЛЕДОВАНИЯ — ВИТРИНА ПАКЕТА НА 4K»: the most frequent screen between generations, walked on every profile
 * from fixtures that stand its stages up directly (`draft-showcase-pick` — red's first packet of a two-seat draft,
 * blue never answers, so a pick leads to the WAIT; `draft-showcase-buy` — red's research buy of the four drafted cards,
 * 40 M€; `draft-showcase-solo-buy` — the no-draft buy).
 *
 * THE SHOWCASE PROBE (the TR68 / TR69 class) measures each stage against the workspace's BODY (the opening the stages
 * live in): the content's FOOT (the lowest visible content as a share of the body's height), the INK (the share of a
 * 48 × 27 grid over the body whose cell centres fall on visible content), the largest EMPTY BAND (rows of that grid
 * with nothing on them, as a share of the height), the protagonist card's height share, the shelf's thumbnail
 * height, the texts under the couch floor (zoom-aware) and whatever sticks out of the workspace.
 *
 * Every cell writes its table (`screenshots/t10/<tag>/<profile>/<cell>.json`) and its frame BEFORE any assertion, so
 * the BEFORE run against the HEAD client (`TM_E2E_SHOTS_TAG=before` on `.e2e-t10-before`) records the same table and
 * asserts nothing.
 *
 * PROFILES: the TV row, plus fhd and the Deck — the iteration's own claim is per profile (the TV grows, the Deck's
 * base contract is «fits without a scroll» and does not grow), so the exception to the one-row law names its numbers
 * (`.claude/rules/tests.md` § ONE ROW).
 */

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const AFTER = TAG !== 'before';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;
type Profile = typeof PROFILES[number];

type Showcase = {
  stage: string,
  body: {w: number, h: number},
  foot: number,
  ink: number,
  emptyBand: number,
  cards: number,
  cardH: number,
  cardShare: number,
  shelfThumbs: number,
  shelfThumbH: number,
  readingLines: number,
  floorPx: number,
  below: Array<string>,
  texts: number,
  clipped: Array<string>,
  scrollers: number,
};

function outDir(profile: Profile): string {
  const dir = path.resolve('screenshots', 't10', TAG, profile.id);
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(profile: Profile, cell: string, table: unknown): void {
  fs.writeFileSync(path.join(outDir(profile), `${cell}.json`), JSON.stringify(table, null, 2));
}

async function shoot(page: Page, profile: Profile, cell: string): Promise<void> {
  await page.screenshot({path: path.join(outDir(profile), `${cell}.png`)});
}

/** THE SHOWCASE PROBE — see the header. `stage` names the visible stage layer (`pick` · `wait` · `buy` · `inspect`). */
async function measure(page: Page, stage: string): Promise<Showcase> {
  return await page.evaluate((stageName) => {
    const root = document.querySelector<HTMLElement>('.con-draftws');
    const bodyEl = document.querySelector<HTMLElement>('.con-draftws__body');
    if (root === null || bodyEl === null) {
      throw new Error('no draft workspace on screen');
    }
    const body = bodyEl.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const token = getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor').trim();
    const floorPx = (token.endsWith('rem') ? parseFloat(token) : 0.8) * rem;
    const opacityChain = (el: Element): number => {
      let o = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        o *= parseFloat(cs.opacity);
      }
      return o;
    };
    const visible = (el: Element): boolean => {
      const box = el.getBoundingClientRect();
      return box.width > 1 && box.height > 1 && opacityChain(el) > 0.15;
    };
    const label = (el: Element) => `${String((el as HTMLElement).className).split(' ')[0] || el.tagName} «${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)}»`;

    // THE CONTENT: every visible leaf-ish object of the body — a card face, an image, an own-text element, a token.
    const content: Array<DOMRect> = [];
    const below: Array<string> = [];
    let texts = 0;
    for (const el of Array.from(bodyEl.querySelectorAll<HTMLElement>('*'))) {
      if (!visible(el)) {
        continue;
      }
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const object = el.classList.contains('pcard') || el.tagName === 'IMG' || /__await-node|__shelf-slot|con-card-back/.test(String(el.className));
      if (own && el.closest('svg') === null) {
        texts++;
        const z = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
        const px = parseFloat(getComputedStyle(el).fontSize) * z;
        if (px + 0.5 < floorPx) {
          below.push(`${label(el)} ${px.toFixed(1)}px`);
        }
      }
      if (own || object) {
        content.push(el.getBoundingClientRect());
      }
    }
    // THE GRID: 48 × 27 cells over the body; a cell is inked when its centre falls on a content box.
    const COLS = 48;
    const ROWS = 27;
    let inked = 0;
    const rowInked: Array<boolean> = [];
    for (let r = 0; r < ROWS; r++) {
      const cy = body.top + (r + 0.5) * body.height / ROWS;
      let any = false;
      for (let c = 0; c < COLS; c++) {
        const cx = body.left + (c + 0.5) * body.width / COLS;
        if (content.some((b) => cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom)) {
          inked++;
          any = true;
        }
      }
      rowInked.push(any);
    }
    let run = 0;
    let longest = 0;
    for (const any of rowInked) {
      run = any ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    const foot = content.length === 0 ? 0 : (Math.max(...content.map((b) => Math.min(b.bottom, body.bottom))) - body.top) / body.height;

    // THE PROTAGONISTS: the visible stage's card slots; the shelf's thumbnails.
    const stageEl = document.querySelector(`.con-draftws__stage--${stageName}`);
    const slots = stageEl === null ? [] : Array.from(stageEl.querySelectorAll('.con-cards__slot')).filter(visible);
    const cardH = slots.length === 0 ? 0 : Math.max(...slots.map((s) => (s.querySelector('.pcard') ?? s).getBoundingClientRect().height));
    const shelf = document.querySelector('.con-draftws__shelf');
    const thumbs = shelf === null ? [] : Array.from(shelf.querySelectorAll('.con-draftws__shelf-slot')).filter(visible);
    const shelfThumbH = thumbs.length === 0 ? 0 : Math.max(...thumbs.map((t) => t.getBoundingClientRect().height));
    const reading = document.querySelector('.con-draftws__statusbar');

    // WHAT STICKS OUT of the workspace (a clipped card, a strip running off the opening) and any scroll container.
    const ws = root.getBoundingClientRect();
    const clipped: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('.con-cards__slot, .con-draftws__shelf, .con-draftws__statusbar'))) {
      if (!visible(el)) {
        continue;
      }
      const b = el.getBoundingClientRect();
      if (b.left < ws.left - 1 || b.right > ws.right + 1 || b.top < ws.top - 1 || b.bottom > ws.bottom + 1) {
        clipped.push(label(el));
      }
    }
    const scrollers = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && visible(el);
    }).length;

    return {
      stage: stageName,
      body: {w: Math.round(body.width), h: Math.round(body.height)},
      foot: +foot.toFixed(3),
      ink: +(inked / (COLS * ROWS)).toFixed(3),
      emptyBand: +(longest / ROWS).toFixed(3),
      cards: slots.length,
      cardH: Math.round(cardH),
      cardShare: +(cardH / body.height).toFixed(3),
      shelfThumbs: thumbs.length,
      shelfThumbH: Math.round(shelfThumbH),
      readingLines: reading === null ? 0 : reading.getClientRects().length,
      floorPx,
      below,
      texts,
      clipped,
      scrollers,
    };
  }, stage);
}

async function stageVisible(page: Page, stage: string): Promise<boolean> {
  return page.locator(`.con-draftws__stage--${stage}`).isVisible();
}

async function openDraft(page: Page, request: Parameters<typeof bootFixture>[1], fixture: 'draft-showcase-pick' | 'draft-showcase-buy' | 'draft-showcase-solo-buy', profile: Profile): Promise<string> {
  const playerId = await bootFixture(page, request, fixture, {query: profile.query, landing: 'prompt'});
  if (!await page.locator('.con-draftws').isVisible()) {
    await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
  }
  await settle(page, {timeoutMs: 30_000});
  return playerId;
}

/** The record of one cell: the table first, the frame beside it, the assertions only after (an AFTER run). */
async function cell(page: Page, profile: Profile, name: string, stage: string): Promise<Showcase> {
  await settle(page, {timeoutMs: 30_000});
  const s = await measure(page, stage);
  write(profile, name, s);
  await shoot(page, profile, name);
  console.log(`[showcase ${TAG} ${profile.id} ${name}]`, JSON.stringify({...s, below: s.below.length, clipped: s.clipped}));
  return s;
}

/** The contract every stage keeps (AFTER only): nothing sticks out, no scroll, the TV's type on its floor. */
function expectHonest(profile: Profile, s: Showcase): void {
  expect(s.clipped, `${s.stage}: nothing sticks out of the workspace`).toEqual([]);
  expect(s.scrollers, `${s.stage}: no scroll container`).toBe(0);
  if (profile.id === 'tv4k') {
    expect(s.below, `${s.stage}: nothing under the couch floor (${s.floorPx}px)`).toEqual([]);
  }
}

/**
 * THE MOCKUPS (`TM_DRAFT_MOCKUPS=1`, the TV only) — three compositions for the owner's batch, drawn as CSS over the
 * LIVE scene (the real fit engine solves the cards in the box each mockup leaves them): M1 the packet in the whole
 * opening over a shelf of large faces at the foot; M2 the shelf as a column at the right; M3 the shelf as a ribbon
 * above the packet. Each is shot on the first packet and on the wait (where M1–M3 also stand the shelf big).
 */
const MOCKUPS: Record<string, string> = {
  M1: `
    .con-draftws__stagewrap--shelved .con-draftws__stage { bottom: 12.4rem !important; }
    .con-draftws__shelf { padding: .5rem 1.2rem .6rem !important; background: rgba(9,15,24,.55) !important; }
    .con-draftws__shelf-row { justify-content: center; min-height: 0 !important; gap: 1rem !important; }
    .con-draftws__shelf-slot, .con-draftws__shelf-seat { width: 6.6rem !important; height: 9.3rem !important; }
    .con-draftws__shelf-slot :is(.card-container, .pcard) { zoom: calc(0.415 * var(--con-ui-scale, 1)) !important; }
    .con-draftws:has(.con-draftws__stage--wait:not([style*="none"])) .con-draftws__shelf { bottom: 38% !important; background: none !important; box-shadow: none !important; }
    .con-draftws:has(.con-draftws__stage--wait:not([style*="none"])) .con-draftws__shelf-slot,
    .con-draftws:has(.con-draftws__stage--wait:not([style*="none"])) .con-draftws__shelf-seat { width: 12rem !important; height: 16.9rem !important; }
    .con-draftws:has(.con-draftws__stage--wait:not([style*="none"])) .con-draftws__shelf-slot :is(.card-container, .pcard) { zoom: calc(0.755 * var(--con-ui-scale, 1)) !important; }
    .con-draftws:has(.con-draftws__stage--wait:not([style*="none"])) .con-draftws__stage--wait { justify-content: flex-end; padding-bottom: 2rem; }
  `,
  M2: `
    .con-draftws__stagewrap--shelved .con-draftws__stage { bottom: 0 !important; right: 17.5rem !important; }
    .con-draftws__shelf { left: auto !important; right: 0 !important; top: 0 !important; width: 16.5rem !important; justify-content: center; }
    .con-draftws__shelf-row { flex-wrap: wrap; justify-content: center; align-content: center; min-height: 0 !important; gap: .8rem !important; }
    .con-draftws__shelf-slot, .con-draftws__shelf-seat { width: 7rem !important; height: 9.9rem !important; }
    .con-draftws__shelf-slot :is(.card-container, .pcard) { zoom: calc(0.44 * var(--con-ui-scale, 1)) !important; }
  `,
  M3: `
    .con-draftws__stagewrap--shelved .con-draftws__stage { top: 11.4rem !important; bottom: 0 !important; }
    .con-draftws__shelf { top: 0 !important; bottom: auto !important; }
    .con-draftws__shelf-row { justify-content: center; min-height: 0 !important; gap: 1rem !important; }
    .con-draftws__shelf-slot, .con-draftws__shelf-seat { width: 6.4rem !important; height: 9rem !important; }
    .con-draftws__shelf-slot :is(.card-container, .pcard) { zoom: calc(0.4 * var(--con-ui-scale, 1)) !important; }
  `,
};

if (process.env.TM_DRAFT_MOCKUPS === '1') {
  const tv = PROFILES[0];
  for (const [mock, css] of Object.entries(MOCKUPS)) {
    test.describe(`the packet showcase · mockup ${mock}`, () => {
      test.use({viewport: tv.viewport});
      test(`${mock} — the first packet and the wait`, async ({page, request}) => {
        test.setTimeout(240_000);
        await bootFixture(page, request, 'draft-showcase-pick', {query: tv.query, landing: 'prompt'});
        await page.addStyleTag({content: css});
        if (!await page.locator('.con-draftws').isVisible()) {
          await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
        }
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await expect(page.locator('.con-draftws__stage--pick .con-cards__slot').first()).toBeVisible({timeout: 45_000});
        await cell(page, tv, `mock-${mock}-a-packet`, 'pick');
        expect(await pressUntil(page, 'Enter', async () => await stageVisible(page, 'wait'), {settleMs: 1200}), 'A picks into the wait').toBe(true);
        await cell(page, tv, `mock-${mock}-b-wait`, 'wait');
      });
    });
  }
}

for (const profile of PROFILES) {
  test.describe(`the packet showcase · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    test('A–C — the first packet, the wait after the pick, the drafted cards inspected', async ({page, request}) => {
      test.setTimeout(300_000);
      await openDraft(page, request, 'draft-showcase-pick', profile);
      await expect(page.locator('.con-draftws__stage--pick .con-cards__slot').first()).toBeVisible({timeout: 45_000});
      const a = await cell(page, profile, 'a-first-packet', 'pick');

      expect(await pressUntil(page, 'Enter', async () => await stageVisible(page, 'wait'), {settleMs: 1200}), 'A picks into the wait').toBe(true);
      const b = await cell(page, profile, 'b-wait', 'wait');

      expect(await pressUntil(page, 'Comma', async () => await stageVisible(page, 'inspect'), {settleMs: 1200}), 'LT opens the drafted cards').toBe(true);
      const c = await cell(page, profile, 'c-inspect', 'inspect');
      await press(page, 'Escape', 1500);

      if (!AFTER) {
        return;
      }
      for (const s of [a, b, c]) {
        expectHonest(profile, s);
      }
      expect(a.cards, 'the packet is four cards').toBe(4);
      if (profile.id === 'tv4k') {
        expect(a.cardShare, 'the packet\'s cards are the protagonists (≥ 45 % of the opening\'s height)').toBeGreaterThanOrEqual(0.45);
        expect(a.foot, 'the content reaches the opening\'s foot').toBeGreaterThanOrEqual(0.85);
        expect(a.emptyBand, 'no empty band over a third of the opening').toBeLessThan(0.33);
        expect(b.shelfThumbH, 'the wait shows the drafted card as a face on the shelf (≥ 180 px)').toBeGreaterThanOrEqual(180);
        expect(b.emptyBand, 'the wait is not an empty field').toBeLessThan(0.33);
        expect(c.shelfThumbs + c.cards, 'the inspect shows the drafted row').toBeGreaterThanOrEqual(1);
      }
    });

    test('D — the research buy of the drafted cards: nothing picked, then two', async ({page, request}) => {
      test.setTimeout(300_000);
      await openDraft(page, request, 'draft-showcase-buy', profile);
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 45_000});
      const zero = await cell(page, profile, 'd-buy-0', 'buy');
      const picked = async () => page.locator('.con-draftws__stage--buy .con-cards__slot--picked').count();
      await pressUntil(page, 'Enter', async () => await picked() >= 1, {settleMs: 900});
      await press(page, 'ArrowRight', 700);
      await pressUntil(page, 'Enter', async () => await picked() >= 2, {settleMs: 900});
      const two = await cell(page, profile, 'd-buy-2', 'buy');

      if (!AFTER) {
        return;
      }
      for (const s of [zero, two]) {
        expectHonest(profile, s);
      }
      if (profile.id === 'tv4k') {
        expect(zero.cardShare, 'the buy\'s cards are the protagonists').toBeGreaterThanOrEqual(0.45);
        expect(zero.foot).toBeGreaterThanOrEqual(0.85);
      }
    });

    test('E — the buy without a draft (solo) stands on the same showcase', async ({page, request}) => {
      test.setTimeout(300_000);
      await openDraft(page, request, 'draft-showcase-solo-buy', profile);
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 45_000});
      const e = await cell(page, profile, 'e-solo-buy', 'buy');
      if (!AFTER) {
        return;
      }
      expectHonest(profile, e);
      if (profile.id === 'tv4k') {
        expect(e.cardShare).toBeGreaterThanOrEqual(0.45);
      }
    });
  });
}
