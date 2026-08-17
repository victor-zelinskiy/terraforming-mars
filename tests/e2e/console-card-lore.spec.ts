import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console fullscreen card inspect · the ARCHIVE ENTRY (the card's lore).
 *
 * Drives a real solo game into the start wizard's project-buy step, opens the
 * shared fullscreen viewer with X, and asserts the three-zone composition:
 *
 *   [ ЗАПИСЬ ИЗ АРХИВА ]   [ CARD — dead centre ]   [ ПРАВИЛА ]
 *
 *  1. the entry renders on the LEFT with its localized heading and a real
 *     (non-fallback) text;
 *  2. the CARD stays on the viewport centre line — the entry on one side and
 *     the rules panel on the other must NOT shift it (the regression the
 *     `--flank` grid exists to prevent);
 *  3. the entry is inert — no focusable node, `pointer-events: none`;
 *  4. LB / RB browsing swaps the entry in lockstep with the card.
 */

const OUT_DIR = path.resolve('screenshots', 'console-card-lore');

function newGameConfig() {
  return {
    players: [{name: 'LoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

type Box = {left: number, right: number, top: number, bottom: number, width: number};

async function boxOf(page: Page, selector: string): Promise<Box | undefined> {
  const el = page.locator(selector).first();
  if (await el.count() === 0) {
    return undefined;
  }
  return el.evaluate((node) => {
    const r = (node as HTMLElement).getBoundingClientRect();
    return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width};
  });
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080},
  {tag: 'tv4k', width: 3840, height: 2160},
] as const;

// The two profiles drive a REAL game through the start wizard against one
// shared dev server; running them concurrently (the repo's `fullyParallel`
// default) makes both walks race for it and drop keypresses. They are cheap —
// serialise them rather than leave a flaky spec behind.
test.describe.configure({mode: 'serial'});

for (const profile of PROFILES) {
  test.describe(`console archive entry · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the fullscreen viewer shows the archive entry left of a centred card', async ({page, request}) => {
      test.setTimeout(300_000);

      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok()).toBeTruthy();
      const {players} = await created.json();
      await page.goto(`/player?id=${players[0].id}&console=1`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── Reach the project-buy step (many card slots — a project card has
      //    structured rules, so all three zones are on screen at once). ─────
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      await key(page, 'Enter', 1400); // pick the focused corporation
      const slots = page.locator('.con-start__frame .con-cards__slot');
      for (let hop = 0; hop < 6 && await slots.count() < 4; hop++) {
        await key(page, 'Period', 1400);
      }
      expect(await slots.count(), 'the project-buy step is on screen').toBeGreaterThanOrEqual(4);

      // ── X → the shared fullscreen viewer. Retried: an X landing before the
      //    freshly-mounted step accepts input is silently dropped. ─────────
      const loreBlock = page.locator('.con-zoom .card-zoom-lore');
      for (let tries = 0; tries < 5 && await loreBlock.count() === 0; tries++) {
        await key(page, 'KeyX', 1800);
      }
      await expect(loreBlock).toHaveCount(1, {timeout: 10_000});
      await page.waitForTimeout(900); // the staged reveal settles

      // 1. Heading + a REAL entry (never the fallback notice).
      await expect(page.locator('.card-zoom-lore__label-text')).toHaveText('ЗАПИСЬ ИЗ АРХИВА');
      const firstText = (await page.locator('.card-zoom-lore__text').innerText()).trim();
      expect(firstText.length, 'the archive entry has text').toBeGreaterThan(0);
      expect(firstText).not.toContain('Архивная запись отсутствует');
      expect(await page.locator('.card-zoom-lore--fallback').count(), 'no fallback for an in-scope card').toBe(0);
      // Both decorative marks, and they contribute no text of their own.
      expect(await page.locator('.card-zoom-lore__mark').count()).toBe(2);
      await shoot(page, `${profile.tag}-01-archive-entry`);

      // 2. STRICT CENTRING: the card sits on the viewport centre line, with the
      //    entry entirely to its left and the rules panel entirely to its right.
      const card = await boxOf(page, '.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container');
      const lore = await boxOf(page, '.con-zoom .card-zoom-lore');
      const side = await boxOf(page, '.con-zoom .card-zoom-side');
      expect(card, 'the fullscreen card').toBeTruthy();
      expect(lore, 'the archive entry').toBeTruthy();
      const cardCentre = (card!.left + card!.right) / 2;
      const viewportCentre = profile.width / 2;
      expect(Math.abs(cardCentre - viewportCentre),
        `card centre ${cardCentre} vs viewport centre ${viewportCentre}`).toBeLessThanOrEqual(2);
      expect(lore!.right, 'the entry stays clear of the card').toBeLessThanOrEqual(card!.left);
      if (side !== undefined) {
        expect(side.left, 'the rules panel stays clear of the card').toBeGreaterThanOrEqual(card!.right);
      }

      // 3. Inert: nothing focusable, no pointer target — and NO quote RULE.
      //    Spectre.css gives every blockquote a light `border-left`; leaking it
      //    made the entry read as a Markdown quote / a text caret / the edge of
      //    another panel. This is the real-CSS guard that it stays killed.
      const inert = await page.locator('.card-zoom-lore').evaluate((el) => {
        const quote = el.querySelector('.card-zoom-lore__quote') as HTMLElement;
        const qs = getComputedStyle(quote);
        return {
          focusable: el.querySelectorAll('button, a, input, select, textarea, [tabindex]').length,
          pointerEvents: getComputedStyle(el).pointerEvents,
          fontFamily: qs.fontFamily,
          fontStyle: qs.fontStyle,
          fontWeight: qs.fontWeight,
          fontSize: parseFloat(qs.fontSize),
          lineHeight: parseFloat(qs.lineHeight),
          fontSynthesis: qs.fontSynthesis,
          borders: [qs.borderLeftWidth, qs.borderRightWidth, qs.borderTopWidth, qs.borderBottomWidth],
          marks: el.querySelectorAll('.card-zoom-lore__mark').length,
          markTags: [...el.querySelectorAll('.card-zoom-lore__mark')].map((m) => m.tagName.toLowerCase()),
          extended: el.classList.contains('card-zoom-lore--extended'),
          regular: el.classList.contains('card-zoom-lore--regular'),
        };
      });
      expect(inert.focusable, 'the entry holds nothing focusable').toBe(0);
      expect(inert.pointerEvents).toBe('none');
      expect(inert.fontFamily, 'the Cyrillic literary face').toContain('Literata');
      // ONE VOICE, WHATEVER THE TIER. The length tier is a pure character
      // count, so letting it pick the LETTERFORM (the shipped state: italic,
      // with `extended` opting out into upright) made two neighbouring cards
      // render in two different faces for no reason the player could see.
      // Upright / 470 / one leading, for every tier — the tier compensates
      // size and measure only. Real faces, never synthesized.
      expect(inert.fontStyle, `every tier reads upright (tier: ${inert.extended ? 'extended' : inert.regular ? 'regular' : 'short'})`).toBe('normal');
      expect(inert.fontWeight, 'the one editorial weight').toBe('470');
      expect(inert.lineHeight / inert.fontSize, 'one leading for every tier')
        .toBeCloseTo(1.5, 2);
      expect(inert.fontSynthesis, 'no faux italic / faux bold').toBe('none');
      expect(inert.borders, 'NO vertical rule — the Spectre blockquote border stays killed')
        .toEqual(['0px', '0px', '0px', '0px']);
      expect(inert.markTags, 'both marks are local SVG, not font glyphs').toEqual(['svg', 'svg']);

      // 3b. The marks frame the text: the opening one above-left of the first
      //     line, the closing one below-right of the LAST line (so it tracks the
      //     real height of the entry, whatever its length).
      const frame = await page.locator('.card-zoom-lore').evaluate((el) => {
        const r = (n: Element) => n.getBoundingClientRect();
        const quote = r(el.querySelector('.card-zoom-lore__quote')!);
        const text = r(el.querySelector('.card-zoom-lore__text')!);
        const open = r(el.querySelector('.card-zoom-lore__mark--open')!);
        const close = r(el.querySelector('.card-zoom-lore__mark--close')!);
        return {quote, text, open, close};
      });
      expect(frame.open.right, 'the opening mark clears the text column').toBeLessThanOrEqual(frame.text.left + 1);
      expect(frame.open.top, 'the opening mark sits above the first line').toBeLessThan(frame.text.top);
      expect(frame.close.top, 'the closing mark sits below the last line').toBeGreaterThanOrEqual(frame.quote.bottom - 1);
      expect(frame.close.top - frame.quote.bottom, 'and keeps real air under it').toBeGreaterThan(2);
      expect(frame.close.left, 'the closing mark stays on the text side, never adrift')
        .toBeGreaterThan(frame.open.right);

      // 3c. The entry never reaches the card, and never rides the screen edge.
      //     (The widened measure spends the gutter the hidden touch chevrons
      //     used to reserve — it must not spend the safe inset as well.)
      expect(card!.left - lore!.right, 'air between the entry and the card frame')
        .toBeGreaterThanOrEqual(2 * profile.width / 1920);
      // …and the words stay well clear of the panel edge. The bar is a
      // «nowhere near it» check (the TV safe inset is 28 px at 4K and the real
      // measured value is ~204), not a re-statement of the design value.
      const textLeft = (await boxOf(page, '.card-zoom-lore__text'))!.left;
      expect(textLeft, 'the words keep a real inset from the panel edge')
        .toBeGreaterThanOrEqual(64 * profile.width / 1920);

      // 4. LB / RB browsing swaps the entry with the card — and moves NOTHING
      //    else. The heading is the tell: the block used to hug its text and
      //    centre on the card, so a 145-character entry and a 224-character
      //    one put «ЗАПИСЬ ИЗ АРХИВА» ~100 px apart at 4K and every browse step
      //    visibly re-laid the left gutter out. The constant frame pins it.
      // ⚠️ The reveal choreography slides the heading in from `translateX(7px)`,
      // so its LEFT is only meaningful once the transition has run. The block's
      // own box carries no transform — so the horizontal half of «the base
      // position is stable» is asserted on the ASIDE, and the heading is judged
      // on its TOP, which the slide cannot touch. (Racing the transition on the
      // heading's left is a measured flake, not a theoretical one.)
      const settled = page.locator('.card-zoom-lore--in');
      await expect(settled, 'the entry finished its reveal').toHaveCount(1, {timeout: 5_000});
      const headingBefore = await boxOf(page, '.card-zoom-lore__label');
      const asideBefore = await boxOf(page, '.con-zoom .card-zoom-lore');
      await key(page, 'KeyE', 1500); // RB → next card
      await page.waitForTimeout(700);
      await expect(settled, 'the next entry finished its reveal').toHaveCount(1, {timeout: 5_000});
      const secondText = (await page.locator('.card-zoom-lore__text').innerText()).trim();
      expect(secondText.length).toBeGreaterThan(0);
      expect(secondText, 'the entry follows the browsed card').not.toBe(firstText);
      const cardAfter = await boxOf(page, '.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container');
      expect(Math.abs((cardAfter!.left + cardAfter!.right) / 2 - viewportCentre),
        'the card stays centred while browsing').toBeLessThanOrEqual(2);
      const headingAfter = await boxOf(page, '.card-zoom-lore__label');
      const asideAfter = await boxOf(page, '.con-zoom .card-zoom-lore');
      expect(Math.abs(headingAfter!.top - headingBefore!.top),
        `the heading holds its line across a browse step (${firstText.length} → ${secondText.length} chars)`)
        .toBeLessThanOrEqual(1);
      expect([
        Math.abs(asideAfter!.left - asideBefore!.left),
        Math.abs(asideAfter!.top - asideBefore!.top),
        Math.abs(asideAfter!.right - asideBefore!.right),
      ].every((d) => d <= 1), `the block keeps its base box (${JSON.stringify(asideBefore)} → ${JSON.stringify(asideAfter)})`)
        .toBe(true);
      await shoot(page, `${profile.tag}-02-browsed`);

      await key(page, 'KeyQ', 1500); // LB → back
      await page.waitForTimeout(700);
      expect((await page.locator('.card-zoom-lore__text').innerText()).trim()).toBe(firstText);

      // 5. prefers-reduced-motion: the entry still reads, it just stops
      //    travelling — no offset, no blur, and never a lost entrance.
      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.waitForTimeout(500);
      const reduced = await page.locator('.card-zoom-lore').evaluate((el) => {
        const q = getComputedStyle(el.querySelector('.card-zoom-lore__quote')!);
        const m = getComputedStyle(el.querySelector('.card-zoom-lore__mark--close')!);
        return {
          transform: q.transform,
          filter: q.filter,
          opacity: q.opacity,
          // the closing mark keeps its 180° rotation — that is its GLYPH, not motion
          markTransform: m.transform,
          markOpacity: m.opacity,
        };
      });
      expect(reduced.transform, 'no travel under reduced motion').toBe('none');
      expect(reduced.filter, 'no blur under reduced motion').toBe('none');
      expect(Number(reduced.opacity), 'the entry is still fully shown').toBe(1);
      expect(Number(reduced.markOpacity), 'the closing mark is still shown').toBeGreaterThan(0);
      expect(reduced.markTransform, 'the closing mark stays rotated (glyph, not motion)')
        .toContain('matrix');
      await page.emulateMedia({reducedMotion: null});
    });
  });
}
