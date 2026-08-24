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

async function bootBigHand(page: Page, request: APIRequestContext, profileQuery = '', buy = 13): Promise<void> {
  await bootIntoGame(page, request, {
    config: newGameConfig(),
    // 13 cards: a full first page AND a thin second one — the probe's subject
    // is now BOTH worlds (the standard 5×2 and the 3-card SHOWCASE page; on
    // the Deck 13 → 4+4+4+1 with a hero tail).
    buy,
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
      // POSITION too — a page slide finishes its size long before it finishes
      // its transform, so «the box stopped changing» is only true of a card
      // that has stopped MOVING as well (see `readSettledAlbum`).
      selX: selRect === undefined ? 0 : Math.round(selRect.left),
      selY: selRect === undefined ? 0 : Math.round(selRect.top),
      selOnScreen: selRect !== undefined && selRect.left >= -2 &&
        selRect.right <= window.innerWidth + 2,
      indicator: ind?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      // BOTH edges always render (the composition must not shift when a
      // side goes away) — availability is the `--off` modifier.
      edges: {
        left: document.querySelector('.con-hand__pgedge--left:not(.con-hand__pgedge--off)') !== null,
        right: document.querySelector('.con-hand__pgedge--right:not(.con-hand__pgedge--off)') !== null,
      },
      edgesRendered: document.querySelectorAll('.con-hand__pgedge').length,
      // The old full-height hairlines are gone: the affordance is a short
      // centred stack, never a rail.
      edgeHeightFrac: (() => {
        const el = document.querySelector<HTMLElement>('.con-hand__pgedge');
        const box = document.querySelector<HTMLElement>('.con-hand__album');
        return el === null || box === null ? -1 :
          el.getBoundingClientRect().height / box.getBoundingClientRect().height;
      })(),
    };
  });
}

/**
 * `readAlbum`, with the FOCUSED CARD'S BOX SETTLED.
 *
 * ⚠️ A SIZE REFERENCE HAS TO SETTLE TOO — a comparison is only as settled as
 * its LEAST settled side. The page-2 read below already polls for this; the
 * REFERENCE it is compared against did not, and was taken straight after
 * `openHand`'s fixed 1200 ms, which is a DURATION standing in for a state.
 * On a loaded 4K runner the open episode is still growing the focused card
 * at that moment, so «card width identical across pages» failed by 25 px
 * against a properly settled tail page — the reference was the wrong number,
 * and the product was right both times.
 */
async function readSettledAlbum(page: Page): Promise<Awaited<ReturnType<typeof readAlbum>>> {
  const same = (a: Awaited<ReturnType<typeof readAlbum>>, b: Awaited<ReturnType<typeof readAlbum>>) =>
    a.selName === b.selName && a.selW === b.selW && a.selH === b.selH &&
    a.selX === b.selX && a.selY === b.selY;
  let prev = await readAlbum(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(120);
    const now = await readAlbum(page);
    // «Settled» is the WHOLE box at rest AND on screen: a page slide reaches
    // its final size several frames before its final transform, so settling
    // on the size alone hands back a card that is still travelling (it read
    // as «the focused card is not on the active page»).
    if (now.selW > 0 && now.selOnScreen && same(now, prev)) {
      return now;
    }
    prev = now;
  }
  return prev;
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
      const a1 = await readSettledAlbum(page);
      expect(a1.hasAlbum, 'the album viewport exists').toBe(true);
      expect(a1.maxPageSlots, 'no page exceeds the profile capacity').toBeLessThanOrEqual(profile.perPage);
      expect(a1.scrollExcessY, 'no vertical scroll geometry (the card area cannot scroll down)').toBeLessThanOrEqual(1);
      expect(a1.overflow, 'the album is a clip, never a scroll container').toBe('hidden/hidden');
      expect(a1.scrollPos, 'the album scroll position is pinned at zero').toBe(0);
      expect(a1.edges.right, 'a next page is hinted at the right edge').toBe(true);
      expect(a1.edges.left, 'no previous page on page 1').toBe(false);
      expect(a1.edgesRendered, 'both edges keep their reserved gutter').toBe(2);
      expect(a1.edgeHeightFrac, 'the edge is a SHORT centred stack, not a rail')
        .toBeLessThan(0.55);
      expect(a1.indicator.replace(/\s/g, ''), 'the spine shows a clean position').toContain('1/');
      const sizeOnFull = {w: a1.selW, h: a1.selH};
      await shoot(page, `${profile.tag}-1-first-page`);

      // ── walk right across the page edge — the order simply continues ──
      let crossed = false;
      for (let i = 0; i < profile.perPage + 2; i++) {
        await key(page, 'ArrowRight', 140);
        const now = await readAlbum(page);
        expect(now.selName, `a card holds focus at every step (step ${i})`).not.toBe('');
        if (now.indicator.replace(/\s/g, '').includes('2/')) {
          crossed = true;
          break;
        }
      }
      expect(crossed, 'walking right crossed onto page 2').toBe(true);
      // POLL for the settled page instead of sampling once: the slide is
      // 180ms but a 4K profile needs a few more frames to paint the new
      // page's cards, and a single post-timeout read can land inside that
      // window (the measured card is then not yet in its final box). The
      // CONTRACT is «it settles», not «it settles within one timeout».
      const a2 = await readSettledAlbum(page);
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
      expect(after.indicator.replace(/\s/g, ''), 'the wheel turned one page back').toContain('1/');
      expect(after.selName, 'focus moved with the page, not reset').not.toBe('');
      expect(after.selName, 'a DIFFERENT card holds focus after the jump').not.toBe(before.selName);
      await shoot(page, `${profile.tag}-3-wheel-back`);

      // ── LB/RB are the album's PAGE VERBS (the bay spine's own controls) ──
      await key(page, 'KeyE', 550); // RB → next page
      expect((await readAlbum(page)).indicator.replace(/\s/g, ''), 'RB turned to page 2').toContain('2/');
      await key(page, 'KeyQ', 550); // LB → previous page
      const backHome = await readAlbum(page);
      expect(backHome.indicator.replace(/\s/g, ''), 'LB turned back to page 1').toContain('1/');
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
        expect((await readAlbum(page)).indicator.replace(/\s/g, ''), 'reset restored the full hand (2 pages again)').toContain('/2');
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
 * The ACTIVE page's own solved geometry, read where the browser actually
 * lays it out from: the plan's INLINE outputs (`--con-hand-zoom`, the page
 * width, the row height + column gap) plus the page's on-screen berth.
 *
 * Deliberately NOT the cards' rects for composition: the focused slot
 * carries `transform: scale(1.035)`, so an edge card's rect is ~1.7 % of a
 * card wide of its layout box and a strict centring assertion would fail on
 * the focus pop rather than on the layout. The page's own border box is
 * immune to its children's transforms — it IS `padX` / `pageW`.
 */
function readActivePage(page: Page) {
  return page.evaluate(() => {
    const album = document.querySelector<HTMLElement>('.con-hand__album');
    const sel = document.querySelector<HTMLElement>('.con-hand__slot--selected');
    const pageEl = sel?.closest<HTMLElement>('.con-hand__page') ?? null;
    const row = pageEl?.querySelector<HTMLElement>('.con-hand__row') ?? null;
    const box = album?.getBoundingClientRect();
    const rect = pageEl?.getBoundingClientRect();
    // IS THE SLIDE OVER? The strip's INLINE transform is the target berth
    // (the plan's own output); its COMPUTED one is where the transition has
    // got to. Equal ⇒ settled — the honest signal, where «the last two reads
    // agreed» is only a guess that gets it wrong exactly when the machine is
    // loaded and the transition has not started yet.
    const strip = document.querySelector<HTMLElement>('.con-hand__pagestrip');
    const targetX = strip === null ? 0 : Number((/-?[\d.]+/.exec(strip.style.transform) ?? ['0'])[0]);
    const liveX = strip === null ? 0 : new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41;
    return {
      stripSettled: Math.abs(liveX - targetX) < 0.5,
      slots: pageEl?.querySelectorAll('.con-hand__slot').length ?? 0,
      rows: pageEl?.querySelectorAll('.con-hand__row').length ?? 0,
      // The plan's outputs, verbatim from the DOM the browser lays out.
      zoom: pageEl === null ? '' : getComputedStyle(pageEl).getPropertyValue('--con-hand-zoom').trim(),
      pageW: pageEl === null ? 0 : Math.round(pageEl.getBoundingClientRect().width * 100) / 100,
      rowH: row === null ? '' : row.style.height,
      gapX: row === null ? '' : row.style.columnGap,
      // The berth inside the album box: the two side airs and the top.
      leftAir: box === undefined || rect === undefined ? -1 : Math.round((rect.left - box.left) * 100) / 100,
      rightAir: box === undefined || rect === undefined ? -1 : Math.round((box.right - rect.right) * 100) / 100,
      topAir: box === undefined || rect === undefined ? -1 : Math.round((rect.top - box.top) * 100) / 100,
    };
  });
}

/**
 * …READ ONCE THE SLIDE HAS SETTLED. The page strip is ONE retargetable
 * transform transition, so a berth read on the frame the last turn was
 * accepted is a berth one stride away from the final one — the index (and
 * therefore the pager and the slot count) is already there while the strip
 * is not. Same law the profile walk above already polls for: the contract
 * is «it settles», not «it settles within one timeout».
 *
 * Settled = the strip's live transform HAS REACHED its target (`stripSettled`)
 * and the berth then reads the same twice. «Two equal reads» alone is not
 * enough and fails exactly where it matters: with three 4K browsers on one
 * box the slide starts late, and a strip that has not begun moving reads
 * perfectly stable — one whole stride away from where the index already is.
 */
async function readSettledPage(page: Page): Promise<Awaited<ReturnType<typeof readActivePage>>> {
  let prev = await readActivePage(page);
  for (let i = 0; i < 40; i++) {
    if (prev.stripSettled) {
      const now = await readActivePage(page);
      if (now.stripSettled && now.leftAir === prev.leftAir && now.pageW === prev.pageW && now.slots === prev.slots) {
        return now;
      }
      prev = now;
    }
    await page.waitForTimeout(120);
    prev = await readActivePage(page);
  }
  return prev;
}

/**
 * Sample the album's SOLVED CARD SIZE on every frame of `act` — «not even
 * one intermediate frame at another scale».
 *
 * `setInterval` + `MutationObserver`, never rAF: headless Chromium drives
 * rAF off the compositor and stops it exactly when the screen goes quiet.
 * Samples EVERY mounted page (the neighbours are pre-mounted for the slide),
 * so a page that would arrive at another size is caught before it is even
 * the active one. The probe asserts its own sample count — a dead sampler
 * must not pass as «nothing changed».
 */
async function sampleSizeDuring(page: Page, act: () => Promise<void>): Promise<{shapes: Array<string>, samples: number}> {
  await page.evaluate(() => {
    const w = window as unknown as {__albumShapes?: Set<string>, __albumN?: number, __albumT?: number, __albumO?: MutationObserver};
    w.__albumShapes = new Set<string>();
    w.__albumN = 0;
    const take = () => {
      document.querySelectorAll<HTMLElement>('.con-hand__page').forEach((p) => {
        const row = p.querySelector<HTMLElement>('.con-hand__row');
        if (row === null) {
          return;
        }
        w.__albumN = (w.__albumN ?? 0) + 1;
        w.__albumShapes?.add(`${getComputedStyle(p).getPropertyValue('--con-hand-zoom').trim()}|${row.style.height}|${row.style.columnGap}`);
      });
    };
    w.__albumT = window.setInterval(take, 16);
    w.__albumO = new MutationObserver(take);
    // Scoped to the STRIP, never `document.body`: an observer over the whole
    // tree fires on every HUD tick and `take()` forces a style flush each
    // time — the sampler then becomes the slowest thing on the page and the
    // very slide it is watching finishes late.
    const strip = document.querySelector('.con-hand__pagestrip');
    if (strip !== null) {
      w.__albumO.observe(strip, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class']});
    }
    take();
  });
  await act();
  return page.evaluate(() => {
    const w = window as unknown as {__albumShapes?: Set<string>, __albumN?: number, __albumT?: number, __albumO?: MutationObserver};
    window.clearInterval(w.__albumT ?? 0);
    w.__albumO?.disconnect();
    return {shapes: [...(w.__albumShapes ?? [])], samples: w.__albumN ?? 0};
  });
}

/**
 * «КРУПНЫЕ КАРТЫ» — the album-layout preference: always ONE row of at most
 * four, loaded from localStorage BEFORE the first layout measure (the boot
 * seeds it via addInitScript — the HandDock flight must aim at the large
 * composition from its first frame, never open 5×2 and snap).
 *
 * ONE STANDARD CARD, EVERY PAGE. The mode's size is the size a FULL page of
 * four renders, and a last page of 1..3 keeps it — centred over honest air.
 * Sizing the thin page by its own count made a single-card tail nearly twice
 * the standard card: every turn re-scaled the whole stage and read as an
 * accidental inspect view. Parameterised over the three partial tails,
 * because «the last page» is three different compositions.
 */
for (const tail of [1, 2, 3] as const) {
  test.describe(`hand album · «Крупные карты» · tail ${tail} (tv4k)`, () => {
    test.use({
      viewport: {width: 3840, height: 2160},
      deviceScaleFactor: 1,
      screen: {width: 3840, height: 2160},
    });

    test('the standard card size holds on the partial page', async ({page, request}) => {
      test.setTimeout(480_000);
      await page.addInitScript(() => {
        window.localStorage.setItem('tm_console_album', 'large');
      });
      // 12 + tail at capacity 4 → four pages, page 1 full, the last partial.
      await bootBigHand(page, request, '&consoleProfile=tv', 12 + tail);
      await openHand(page);

      const a1 = await readSettledAlbum(page);
      expect(a1.indicator.replace(/\s/g, ''), 'the pager paginates by FOUR').toContain('1/4');
      expect(a1.maxPageSlots, 'no page exceeds the large capacity').toBeLessThanOrEqual(4);
      expect(a1.scrollExcessY, 'no vertical scroll in large mode').toBeLessThanOrEqual(1);
      const full = await readSettledPage(page);
      expect(full.slots, 'the reference page is FULL').toBe(4);
      expect(full.rows, 'one row').toBe(1);
      await shoot(page, `tv4k-large-${tail}-1-full-page`);

      // ── 4 → tail. Nothing about the CARD may move on the way. ────────
      const turn = await sampleSizeDuring(page, async () => {
        for (let i = 0; i < 3; i++) {
          await key(page, 'KeyE', 550);
        }
      });
      expect(turn.samples, 'the sampler actually sampled').toBeGreaterThan(20);
      expect(turn.shapes, 'ONE card shape across every frame of the turn').toHaveLength(1);

      const last = await readSettledPage(page);
      const a4 = await readSettledAlbum(page);
      expect(a4.indicator.replace(/\s/g, ''), 'the partial tail page').toContain('4/4');
      expect(last.slots, `the last page holds ${tail}`).toBe(tail);
      // THE STANDARD CARD: same zoom, same row height, same gap, same seat.
      expect(last.zoom, 'the card scale is the full page\'s').toBe(full.zoom);
      expect(last.rowH, 'the row height is the full page\'s').toBe(full.rowH);
      expect(last.gapX, 'the gap between cards is the full page\'s').toBe(full.gapX);
      expect(Math.abs(last.topAir - full.topAir), 'the row keeps its vertical seat').toBeLessThanOrEqual(1);
      // …and the group is a CENTRED composition, not a stretched one.
      expect(Math.abs(last.leftAir - last.rightAir), 'the partial group is centred').toBeLessThanOrEqual(2);
      expect(last.pageW, 'exactly N standard slots wide — no filler, no growth')
        .toBeLessThan(full.pageW * (tail / 4) + 60);
      // The PAINTED card (the focused one, apples to apples with page 1).
      expect(Math.abs(a4.selW - a1.selW), 'card width identical across pages').toBeLessThanOrEqual(1);
      expect(Math.abs(a4.selH - a1.selH), 'card height identical across pages').toBeLessThanOrEqual(1);
      await shoot(page, `tv4k-large-${tail}-2-tail-page`);

      // ── and back: the reverse turn is just as quiet ──────────────────
      const back = await sampleSizeDuring(page, async () => {
        for (let i = 0; i < 3; i++) {
          await key(page, 'KeyQ', 400);
        }
      });
      expect(back.samples, 'the sampler actually sampled').toBeGreaterThan(20);
      expect(back.shapes, 'ONE card shape on the way back too').toHaveLength(1);
      const home = await readSettledPage(page);
      expect((await readAlbum(page)).indicator.replace(/\s/g, '')).toContain('1/4');
      expect(home.zoom, 'page 1 came back unchanged').toBe(full.zoom);
      expect(home.pageW, 'page 1 came back unchanged').toBe(full.pageW);
      expect(await page.locator('.con-hand__slot--selected').count(), 'focus is still on a real card').toBe(1);

      // ── a FILTER whose whole result is thin is the same page ─────────
      // (RT cycles the tag filter; a tag with 1..4 hits leaves a single
      // partial page — the size must not answer differently there either.)
      let filtered = 0;
      for (let i = 0; i < 8 && filtered === 0; i++) {
        await key(page, 'Period', 900);
        const now = await readSettledPage(page);
        if (now.slots > 0 && now.slots < 4 && (await readAlbum(page)).indicator.replace(/\s/g, '').includes('/1')) {
          filtered = now.slots;
          expect(now.zoom, 'a filtered thin result keeps the standard card').toBe(full.zoom);
          expect(now.rowH, 'a filtered thin result keeps the row').toBe(full.rowH);
          expect(Math.abs(now.leftAir - now.rightAir), 'and centres it').toBeLessThanOrEqual(2);
          await shoot(page, `tv4k-large-${tail}-3-filtered-${filtered}`);
        }
      }
      expect(filtered, 'the hand offered a tag with a thin result').toBeGreaterThan(0);
      await key(page, 'KeyV', 900); // R3 → reset to «ВСЕ»

      // ── close: every card gathers, nothing stays lifted ──────────────
      await key(page, 'Escape', 2400);
      await expect(page.locator('.con-hand')).toHaveCount(0);
      await expect(page.locator('.con-handdock__card--lifted')).toHaveCount(0);
      await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    });
  });
}
