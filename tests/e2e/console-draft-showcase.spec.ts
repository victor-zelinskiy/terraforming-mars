import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, bootFixtureSeats, cinematicBeat, fetchPlayerModel, press, pressUntil, pressUntilVisible, sendPlayerInput, settle} from './consoleStart';

/**
 * T10 · CE — THE PACKET SHOWCASE (the draft + the research buy on the 4K TV). The stand of the iteration «ДРАФТ И
 * ПОКУПКА ИССЛЕДОВАНИЯ — ВИТРИНА ПАКЕТА НА 4K»: the most frequent screen between generations, walked on every profile
 * from fixtures that stand its stages up directly (`draft-showcase-pick` — red's first packet of a two-seat draft,
 * blue never answers, so a pick leads to the WAIT — and, walked with blue answering over the API, to red's research buy of
 * the four drafted cards; `draft-showcase-solo-buy` — the no-draft buy). (A fixture standing IN the buy after a draft
 * loads a degenerate scene — the reload-into-buy defect, ledger CE — so the buy is reached the way a player reaches it.)
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
      // A card FACE is a graphic printed at its own scale (the premium face's type is the card's) — the floor is the UI's.
      if (own && el.closest('svg') === null && el.closest('.pcard') === null) {
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

type Wire = {game: {phase: string}, waitingFor?: {type: string, buyMode?: boolean, draftPrompt?: unknown, cards?: Array<{name: string}>}};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function stageVisible(page: Page, stage: string): Promise<boolean> {
  return page.locator(`.con-draftws__stage--${stage}`).isVisible();
}

async function openDraft(page: Page, request: Parameters<typeof bootFixture>[1], fixture: 'draft-showcase-pick' | 'draft-showcase-solo-buy', profile: Profile): Promise<string> {
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
  // A SETTLED read — two consecutive equal samples of what is asserted (the fit, the cards' size): the console's quiet
  // says nothing about a ResizeObserver refit still catching up on a software-rastered 4K (measured on CI: the first
  // read 0.775 of the body with 1070 px cards, the fitted one 0.99 with 1119 px).
  let s = await measure(page, stage);
  await expect.poll(async () => {
    const next = await measure(page, stage);
    const same = Math.abs(next.foot - s.foot) < 0.005 && Math.abs(next.cardH - s.cardH) < 1;
    s = next;
    return same;
  }, {timeout: 6_000, intervals: [250], message: `${name}: the showcase's fit settles`}).toBe(true);
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

    test('D — the research buy of the drafted cards (the draft walked: the viewer on the pad, the rival over the API): nothing picked, then two', async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'draft-showcase-pick', {query: profile.query, landing: 'prompt'});
      if (!await page.locator('.con-draftws').isVisible()) {
        await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
      }
      for (let round = 0; round < 24; round++) {
        const mine = await wireOf(request, playerId);
        if (mine.game.phase === 'research' && mine.waitingFor?.buyMode === true) {
          break;
        }
        const theirs = await wireOf(request, seats[1]);
        if (theirs.waitingFor?.type === 'card' && theirs.waitingFor.draftPrompt !== undefined && (theirs.waitingFor.cards?.length ?? 0) > 0) {
          await sendPlayerInput(request, seats[1], {type: 'card', cards: [theirs.waitingFor.cards![0].name]} as never);
        }
        if (mine.waitingFor?.type === 'card' && mine.waitingFor.draftPrompt !== undefined && await stageVisible(page, 'pick')) {
          await pressUntil(page, 'Enter', async () => await stageVisible(page, 'wait') || await stageVisible(page, 'buy') ||
            await page.locator('.con-draftws__stage--pick .con-cards__slot--picked').count() > 0, {settleMs: 900});
        }
        await cinematicBeat(page, 700, 'the rival answers and the packet passes');
      }
      await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 60_000});
      // The buy is measured once its DEAL is over — its reading row (the wallet plate) is painted then. Four slots stand
      // from the deal's first frame, so on a slow renderer (CI) a read right after them caught the cards mid-flight
      // (1070 px, no text at all) and called it the composition (foot 0.775).
      await expect.poll(() => page.evaluate(() => {
        let el: Element | null = document.querySelector('[data-draft-wallet]');
        let o = el === null ? 0 : 1;
        for (; el !== null; el = el.parentElement) {
          const cs = getComputedStyle(el);
          o *= cs.visibility === 'hidden' || cs.display === 'none' ? 0 : Number(cs.opacity);
        }
        return o;
      }), {timeout: 30_000, message: 'the buy\'s wallet plate is painted (its deal is over)'}).toBeGreaterThan(0.9);
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
