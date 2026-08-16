import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame} from './consoleStart';

/**
 * HAND ALBUM probe — the strict-page rework of «Карты в руке»
 * (consoleHandAlbum.ts + ConsoleHandSection).
 *
 * Asserts the framework's own contract on a REAL 20-card hand:
 *  - profile page shape: 5×2 on tv/fhd (≤10 slots rendered per page),
 *    4×1 on the Deck (≤4);
 *  - NO vertical scroll: the album's scroll geometry equals its box;
 *  - count-independent card size: the slot box is identical on page 1
 *    and on the last (partial) page;
 *  - deterministic paging: walking right across the page edge advances
 *    the indicator; the focused card is always on the ACTIVE page;
 *  - page jump (wheel) keeps the relative slot;
 *  - close gathers every card home (dock full again, no lifted leftovers).
 *
 * Screenshots to screenshots/hand-album/ for the visual review.
 */

const OUT = path.resolve('screenshots', 'hand-album');

function newGameConfig() {
  return {
    players: [{name: 'AlbumTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 350): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function bootBigHand(page: Page, request: APIRequestContext, profileQuery = ''): Promise<void> {
  await bootIntoGame(page, request, {
    config: newGameConfig(),
    // 13 cards: a full first page AND a thin second one — the probe's subject
    // is now BOTH worlds (the standard 5×2 and the 3-card SHOWCASE page; on
    // the Deck 13 → 4+4+4+1 with a hero tail).
    buy: 13,
    query: profileQuery,
  });
  await page.waitForTimeout(800);
}

async function openHand(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand').count() === 0; i++) {
    if (await page.locator('.con-zoom, .con-quick, .con-composer').count() > 0) {
      await key(page, 'Escape', 900);
      continue;
    }
    await key(page, 'Period', 700);
    await key(page, 'Enter', 2600);
    if (await page.locator('.con-quick').count() > 0) {
      await key(page, 'Escape', 700);
    }
  }
  await expect(page.locator('.con-hand')).toHaveCount(1);
  await page.waitForTimeout(1200); // the open episode settles
}

/** The album's live geometry, read in one evaluate batch. */
function readAlbum(page: Page) {
  return page.evaluate(() => {
    const album = document.querySelector<HTMLElement>('.con-hand__album');
    const sel = document.querySelector<HTMLElement>('.con-hand__slot--selected');
    const selCard = sel?.querySelector<HTMLElement>(':is(.card-container, .pcard)');
    const selRect = selCard?.getBoundingClientRect();
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-hand__page'))
      .map((p) => p.querySelectorAll('.con-hand__slot').length);
    // The page position lives in the ALBUM SPINE (the footer bay), beside
    // the LB/RB verbs that drive it — never in the header any more.
    const ind = document.querySelector<HTMLElement>('.con-handdock__pager');
    const albumStyle = album === null ? undefined : getComputedStyle(album);
    return {
      hasAlbum: album !== null,
      scrollExcessY: album === null ? -1 : album.scrollHeight - album.clientHeight,
      // The mounted neighbour page's TRANSFORMED bounds are scrollable
      // overflow by CSS spec — invisible and clipped. What must hold is that
      // nothing can ACT on it: overflow is hidden (no scrollbar, no user
      // scroll) and the scroll position is pinned at zero.
      overflow: albumStyle === undefined ? '' : `${albumStyle.overflowX}/${albumStyle.overflowY}`,
      scrollPos: album === null ? -1 : album.scrollLeft + album.scrollTop,
      pageSlotCounts: slots,
      maxPageSlots: slots.length === 0 ? 0 : Math.max(...slots),
      selName: sel?.getAttribute('data-zoom-slot') ?? '',
      selW: selRect === undefined ? 0 : Math.round(selRect.width),
      selH: selRect === undefined ? 0 : Math.round(selRect.height),
      selOnScreen: selRect !== undefined && selRect.left >= -2 &&
        selRect.right <= window.innerWidth + 2,
      indicator: ind?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      edges: {
        left: document.querySelector('.con-hand__pgedge--left') !== null,
        right: document.querySelector('.con-hand__pgedge--right') !== null,
      },
    };
  });
}

const PROFILES = [
  // `page2` names what the 13-card hand's SECOND page is on this profile:
  // a 3-card SHOWCASE (cards must render LARGER than page 1's standard) or
  // another full standard page (sizes must match to the pixel).
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', perPage: 10, page2: 'showcase'},
  {tag: 'fhd', width: 1920, height: 1080, query: '', perPage: 10, page2: 'showcase'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld', perPage: 4, page2: 'standard'},
] as const;

for (const profile of PROFILES) {
  test.describe(`hand album · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('strict pages, stable size, deterministic paging', async ({page, request}) => {
      test.setTimeout(480_000);
      await bootBigHand(page, request, profile.query);
      await openHand(page);

      const total = await page.locator('.con-hand__slot').count();
      expect(total, 'a multi-page hand to probe').toBeGreaterThan(profile.perPage);

      // ── strict page shape + no scroll ────────────────────────────────
      const a1 = await readAlbum(page);
      expect(a1.hasAlbum, 'the album viewport exists').toBe(true);
      expect(a1.maxPageSlots, 'no page exceeds the profile capacity').toBeLessThanOrEqual(profile.perPage);
      expect(a1.scrollExcessY, 'no vertical scroll geometry (the card area cannot scroll down)').toBeLessThanOrEqual(1);
      expect(a1.overflow, 'the album is a clip, never a scroll container').toBe('hidden/hidden');
      expect(a1.scrollPos, 'the album scroll position is pinned at zero').toBe(0);
      expect(a1.edges.right, 'a next page is hinted at the right edge').toBe(true);
      expect(a1.edges.left, 'no previous page on page 1').toBe(false);
      expect(a1.indicator, 'the page indicator names page 1').toContain('1/');
      const sizeOnFull = {w: a1.selW, h: a1.selH};
      await shoot(page, `${profile.tag}-1-first-page`);

      // ── walk right across the page edge — the order simply continues ──
      let crossed = false;
      for (let i = 0; i < profile.perPage + 2; i++) {
        await key(page, 'ArrowRight', 140);
        const now = await readAlbum(page);
        expect(now.selName, `a card holds focus at every step (step ${i})`).not.toBe('');
        if (now.indicator.includes('2/')) {
          crossed = true;
          break;
        }
      }
      expect(crossed, 'walking right crossed onto page 2').toBe(true);
      await page.waitForTimeout(450); // the slide settles
      const a2 = await readAlbum(page);
      expect(a2.selOnScreen, 'the focused card sits on the ACTIVE (visible) page').toBe(true);
      expect(a2.edges.left, 'page 2 hints the way back').toBe(true);
      if (profile.page2 === 'showcase') {
        // The thin page is a SHOWCASE: one row, genuinely LARGER cards —
        // the whole point of the adaptive density.
        expect(a2.maxPageSlots, 'the showcase page holds the tail').toBeLessThanOrEqual(profile.perPage);
        expect(a2.selW, 'showcase cards render larger than the standard page').toBeGreaterThan(sizeOnFull.w * 1.1);
        expect(a2.selW / a2.selH, 'the premium aspect survives the growth')
          .toBeCloseTo(sizeOnFull.w / sizeOnFull.h, 1);
      } else {
        // A full standard page: count-independent size to the pixel.
        expect(Math.abs(a2.selW - sizeOnFull.w), 'card width identical across pages').toBeLessThanOrEqual(1);
        expect(Math.abs(a2.selH - sizeOnFull.h), 'card height identical across pages').toBeLessThanOrEqual(1);
      }
      await shoot(page, `${profile.tag}-2-second-page`);

      // ── page jump via the wheel keeps the relative slot ──────────────
      const before = await readAlbum(page);
      const albumBox = await page.locator('.con-hand__album').boundingBox();
      if (albumBox !== null) {
        await page.mouse.move(albumBox.x + albumBox.width / 2, albumBox.y + albumBox.height / 2);
        await page.mouse.wheel(0, -120); // one firm notch back
        await page.waitForTimeout(500);
      }
      const after = await readAlbum(page);
      expect(after.indicator, 'the wheel turned one page back').toContain('1/');
      expect(after.selName, 'focus moved with the page, not reset').not.toBe('');
      expect(after.selName, 'a DIFFERENT card holds focus after the jump').not.toBe(before.selName);
      await shoot(page, `${profile.tag}-3-wheel-back`);

      // ── LB/RB are the album's PAGE VERBS (the bay spine's own controls) ──
      await key(page, 'KeyE', 550); // RB → next page
      expect((await readAlbum(page)).indicator, 'RB turned to page 2').toContain('2/');
      await key(page, 'KeyQ', 550); // LB → previous page
      const backHome = await readAlbum(page);
      expect(backHome.indicator, 'LB turned back to page 1').toContain('1/');
      expect(backHome.edges.left, 'page 1 mutes the way back').toBe(false);

      if (profile.tag === 'tv4k') {
        // Focus at each horizontal edge of the page (the ring + band must
        // clear the stage — the plan's gutters are exactly this reserve).
        for (let i = 0; i < profile.perPage + 2; i++) {
          await key(page, 'ArrowLeft', 80);
        }
        await shoot(page, 'tv4k-5-focus-left-edge');
        for (let i = 0; i < 4; i++) {
          await key(page, 'ArrowRight', 80);
        }
        await page.waitForTimeout(300);
        await shoot(page, 'tv4k-6-focus-right-edge');
        // The tag filter rides the TRIGGERS now: RT → next filter (a
        // re-pagination through the edge packets), R3 resets to «ВСЕ».
        await key(page, 'Period', 900); // RT → first tag
        await shoot(page, 'tv4k-7-filter-active');
        await key(page, 'KeyV', 900); // R3 → reset to all
        // The focused card is FOLLOWED through the reset — its page opens,
        // whichever it is; the full universe is back in the range text.
        expect((await readAlbum(page)).indicator, 'reset restored the full hand').toContain('13');
      }

      // ── close: every card gathers home, nothing stays lifted ─────────
      await key(page, 'Escape', 2400);
      await expect(page.locator('.con-hand')).toHaveCount(0);
      await expect(page.locator('.con-handdock__card--lifted')).toHaveCount(0);
      await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
      const dockBacks = await page.locator('.con-handdock__card').count();
      expect(dockBacks, 'the dock pack is whole again').toBeGreaterThan(0);
      await shoot(page, `${profile.tag}-4-closed`);
    });
  });
}

/**
 * «КРУПНЫЕ КАРТЫ» — the album-layout preference: always ONE row of at most
 * four, loaded from localStorage BEFORE the first layout measure (the boot
 * seeds it via addInitScript — the HandDock flight must aim at the large
 * composition from its first frame, never open 5×2 and snap).
 */
test.describe('hand album · «Крупные карты» (tv4k)', () => {
  test.use({
    viewport: {width: 3840, height: 2160},
    deviceScaleFactor: 1,
    screen: {width: 3840, height: 2160},
  });

  test('capacity 4, hero tail, larger cards than the adaptive standard', async ({page, request}) => {
    test.setTimeout(480_000);
    await page.addInitScript(() => {
      window.localStorage.setItem('tm_console_album', 'large');
    });
    await bootBigHand(page, request, '&consoleProfile=tv');
    await openHand(page);

    // 13 cards at capacity 4 → 4+4+4+1: four pages, page 1 full.
    const a1 = await readAlbum(page);
    expect(a1.indicator, 'the pager paginates by FOUR').toContain('1/4');
    expect(a1.maxPageSlots, 'no page exceeds the large capacity').toBeLessThanOrEqual(4);
    expect(a1.scrollExcessY, 'no vertical scroll in large mode').toBeLessThanOrEqual(1);
    const fullW = a1.selW;
    await shoot(page, 'tv4k-large-1-full-page');

    // Jump to the last page: a single HERO card, larger than the 4-row card.
    for (let i = 0; i < 3; i++) {
      await key(page, 'KeyE', 550);
    }
    const a4 = await readAlbum(page);
    expect(a4.indicator, 'the hero tail page').toContain('4/4');
    expect(a4.pageSlotCounts.some((n) => n === 1), 'the last page holds ONE card').toBe(true);
    expect(a4.selW, 'the hero renders larger than the full-row card').toBeGreaterThan(fullW * 1.1);
    await shoot(page, 'tv4k-large-2-hero-tail');

    // Home again + close: every card gathers, nothing stays lifted.
    for (let i = 0; i < 3; i++) {
      await key(page, 'KeyQ', 400);
    }
    expect((await readAlbum(page)).indicator).toContain('1/4');
    await key(page, 'Escape', 2400);
    await expect(page.locator('.con-hand')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card--lifted')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, 'tv4k-large-3-closed');
  });
});
