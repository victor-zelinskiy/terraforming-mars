import {test, expect} from '@playwright/test';
import loreTexts from '../../assets/text/lore_texts.json';
import ruLore from '../../src/locales/ru/lore_texts.json';

/**
 * THE ARCHIVE ENTRY, MEASURED OVER THE WHOLE RU CORPUS.
 *
 * The entry's composition is a MEASURE problem: the column, the three tier
 * sizes, the leading and the indent together decide whether a Russian sentence
 * reads as one archival note or falls apart into two-word fragments («мировые /
 * лидеры», «первой / предлагает»). A spot check on two corporations proves
 * nothing about the other 477 entries — and the tier a card lands in is a pure
 * character count, so any two neighbouring cards in the browse order can be in
 * different tiers.
 *
 * OFFLINE by construction: no game, no server-side state, no navigation — the
 * page is a scrap of the REAL CardLoreAside markup wearing the built
 * `styles.css` and the profile's own tokens, over the REAL corpus.
 * (The `length-tier-ladder-calibration` lesson: calibrate a ladder with a
 * corpus probe, never by eye on a convenient sample.)
 *
 * What it asserts, per profile:
 *   1. NOTHING CLIPS — no line is wider than the measure it was laid into
 *      (a long Cyrillic compound in a narrow column would simply hang out,
 *      since Electron ships no hyphenation dictionary to break it).
 *   2. THE FRAME HOLDS — every entry fits inside the constant frame height
 *      `.card-zoom-lore` reserves, so the block never reaches past the card.
 *   3. IT READS AS A NOTE, NOT A POEM — for any entry that takes three lines
 *      or more, the lines BEFORE the last one fill the measure. This is the
 *      metric the raggedness complaint is actually about.
 *   4. THE TIERS DO NOT JUMP — the largest and smallest tier sizes stay within
 *      a ratio the eye cannot name between two browsed cards.
 */

/** ⚠️ Mirrors `LORE_SHORT_MAX` / `LORE_REGULAR_MAX` (src/client/cards/cardLore.ts).
 *  Re-stated rather than imported so the probe stays a plain-JSON offline
 *  harness; `guards the copy` below fails the moment the source moves. */
const SHORT_MAX = 65;
const REGULAR_MAX = 170;

type Tier = 'short' | 'regular' | 'extended';

function tierOf(text: string): Tier {
  const n = text.trim().length;
  return n <= SHORT_MAX ? 'short' : n <= REGULAR_MAX ? 'regular' : 'extended';
}

/** Every entry the block can ever print, in the locale it was reported in. */
function corpus(): Array<{key: string, text: string, tier: Tier}> {
  const en = loreTexts as Record<string, string>;
  const ru = ruLore as Record<string, string>;
  const seen = new Set<string>();
  const out: Array<{key: string, text: string, tier: Tier}> = [];
  for (const [cardNumber, english] of Object.entries(en)) {
    const text = (ru[english] ?? english).trim();
    if (text === '' || seen.has(text)) {
      continue;
    }
    seen.add(text);
    out.push({key: cardNumber, text, tier: tierOf(text)});
  }
  return out;
}

/**
 * The profiles the entry has to survive. `tv` mirrors ConsoleShell's TV
 * profile (its rem base is 20px × --con-ui-scale); the base profile keeps a
 * fixed rem and lets the column's `vw` clamp do the viewport work.
 *
 * `fit` is what `CardZoomModal.fitCardToViewport` solves for a 320×460 face at
 * that viewport — the block's constant frame is expressed in the CARD's own
 * pixels, so the probe has to wear the real one (a hardcoded 4K fit would
 * report a 1192 px frame on a 1280×800 handheld).
 *
 * `frameContainsCorpus` is false exactly where the card is floor-clamped to
 * MIN_ZOOM (1280×800: a 320 px card between a 360 px entry and a 420 px rules
 * panel — the viewer is already cramped there). The frame is a BASELINE, not a
 * budget: past it a long entry simply flows on down the empty band, and the
 * heading — the thing the frame exists for — still does not move.
 */
const LINES_TV = {short: 4, regular: 7, extended: 11} as const;
const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, tv: true, scale: 2, fit: 3.275, frameContainsCorpus: true, lineBudget: LINES_TV, minLineFill: 0.3},
  {tag: 'tv-fhd', width: 1920, height: 1080, tv: true, scale: 1, fit: 1.6375, frameContainsCorpus: true, lineBudget: LINES_TV, minLineFill: 0.3},
  {tag: 'fhd', width: 1920, height: 1080, tv: false, scale: 1, fit: 1.835, frameContainsCorpus: true, lineBudget: LINES_TV, minLineFill: 0.3},
  // A 360 px column at 1280×800 measures ~19 characters, so one long compound
  // («здравоохранение», «Генно-модифицированные») can legitimately end a line
  // early. The per-line floor is relaxed accordingly — the TIER FILL and the
  // LINE BUDGET are what guard this profile.
  {tag: 'handheld', width: 1280, height: 800, tv: false, scale: 1, fit: 1, frameContainsCorpus: false,
    lineBudget: {short: 6, regular: 9, extended: 15}, minLineFill: 0.15},
] as const;

/**
 * ── THE BARS, AND WHERE THEY COME FROM ───────────────────────────────────
 * Every number below was read off a BEFORE/AFTER sweep of this same probe over
 * the whole corpus at 4K, hyphenation off on both sides:
 *
 *                       BEFORE (shipped)         AFTER (this iteration)
 *   italic entries       455 / 479                0 / 479
 *   lines  s/r/e mean    3.66 / 4.70 / 9.75       2.26 / 3.66 / 7.38
 *          s/r/e max       6  /   9  /  13          4  /   7  /  10
 *   mean fill s/r/e      0.745 / 0.807 / 0.822    0.815 / 0.847 / 0.863
 *   worst single line    0.12  / 0.26  / 0.28     0.34  / 0.45  / 0.44
 *   lines out of column  15                       0
 *   tallest block        1325 px (past the frame) 1022 px (inside it)
 *
 * THE LINE BUDGET IS THE LOAD-BEARING GUARD — it is what «a note, not a poem»
 * measures, and the shipped composition fails it on all three tiers (6/9/13
 * against 4/7/11). The fill bars are a SANITY FLOOR under it, set just below
 * the worst value the narrowest profile measures: they would not on their own
 * have caught the shipped look, and they are not asked to.
 */

/** Mean fill of the lines BEFORE the last one (a paragraph's last line is
 *  short by right). 1.0 = every line runs the full measure. Aggregated per
 *  tier: one pathological string («…самовоспроизведение…» — three unbreakable
 *  20-letter words) must not be able to fail an otherwise sound ladder. */
const MIN_MEAN_FILL: Readonly<Record<Tier, number>> = {short: 0.74, regular: 0.78, extended: 0.78};
// (the per-line floor is per-profile — see PROFILES.minLineFill)
/** Loudest ÷ quietest tier size. Above this the step is nameable while browsing. */
const MAX_TIER_SPREAD = 1.2;
/**
 * Nothing may reach the viewer's own chrome (the counter row above, the
 * command bar below, the container's padding). Deliberately generous — this is
 * the «no scroll, no clipping, ever» floor, not a composition target.
 */
const CHROME_REM = 11;

test.describe('archive entry · the measure fits the corpus', () => {
  test('guards the copy of the tier thresholds', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/client/cards/cardLore.ts', 'utf8');
    expect(src, 'LORE_SHORT_MAX moved — update SHORT_MAX above')
      .toContain(`export const LORE_SHORT_MAX = ${SHORT_MAX};`);
    expect(src, 'LORE_REGULAR_MAX moved — update REGULAR_MAX above')
      .toContain(`export const LORE_REGULAR_MAX = ${REGULAR_MAX};`);
  });

  for (const profile of PROFILES) {
    test(`every entry composes at ${profile.tag}`, async ({page}) => {
      test.setTimeout(180_000);
      await page.setViewportSize({width: profile.width, height: profile.height});

      const entries = corpus();
      expect(entries.length, 'the corpus is non-empty').toBeGreaterThan(400);

      // The built stylesheet + the app's fonts, nothing else.
      await page.goto('/');
      await page.addStyleTag({url: '/styles.css'});
      // ⚠️ MEASURE THE WORST CASE, WHICH IS THE SHIPPED ONE. `hyphens: auto`
      // needs a hyphenation dictionary; Chromium pulls the `.hyb` files through
      // the component updater, which ELECTRON does not carry — so in the app
      // the property is a silent no-op (visible in the reported screenshots:
      // «жизнеспособные» never breaks) while this Playwright Chromium happily
      // hyphenates and would report a measure that is 5–10 % more even than
      // the product's. The rule stays in the stylesheet (where a dictionary
      // exists it can only help), but every bar below is calibrated WITHOUT it.
      await page.addStyleTag({content: '.card-zoom-lore__quote{hyphens:manual !important;}'});
      await page.evaluate(({tv, scale}) => {
        document.documentElement.classList.add('console-native');
        document.documentElement.lang = 'ru';
        if (tv) {
          document.documentElement.classList.add('con-profile-tv');
          document.documentElement.style.setProperty('--con-ui-scale', String(scale));
        }
      }, {tv: profile.tv, scale: profile.scale});
      // The literary face is fetched on first paint of a glyph it owns — a
      // silent fallback to Ubuntu would re-flow every measurement below.
      const fontsReady = await page.evaluate(async () => {
        // ⚠️ `fonts.load`/`check` parse a CSS `font` SHORTHAND — a variable-font
        // weight like `470` is rejected there, and the whole call then reports
        // «not loaded» for a face that is perfectly available. Ask for the
        // family, with real Cyrillic + Latin sample text so BOTH unicode-range
        // subsets are fetched.
        await document.fonts.load('30px Literata', 'Записьabc');
        await document.fonts.ready;
        return document.fonts.check('30px Literata', 'Записьabc');
      });
      expect(fontsReady, 'Literata upright loaded — a fallback face invalidates the whole probe').toBe(true);

      const measured = await page.evaluate(({items, fit}) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden';
        document.body.appendChild(host);

        // The REAL markup of CardLoreAside, in its settled (`--in`) state.
        const aside = document.createElement('aside');
        const body = document.createElement('div');
        body.className = 'card-zoom-lore__body';
        const label = document.createElement('h2');
        label.className = 'card-zoom-lore__label';
        label.innerHTML = '<span class="card-zoom-lore__spark"></span>' +
          '<span class="card-zoom-lore__label-text">ЗАПИСЬ ИЗ АРХИВА</span>' +
          '<span class="card-zoom-lore__rule"></span>' +
          '<span class="card-zoom-lore__tip"></span>';
        const quote = document.createElement('blockquote');
        quote.className = 'card-zoom-lore__quote';
        quote.lang = 'ru';
        const text = document.createElement('span');
        text.className = 'card-zoom-lore__text';
        quote.appendChild(text);
        body.append(label, quote);
        aside.appendChild(body);
        host.appendChild(aside);
        // The zoom this viewport really solves, so the frame is the real one.
        aside.style.setProperty('--card-zoom-fit', String(fit));

        const out = items.map((item) => {
          aside.className = `card-zoom-lore card-zoom-lore--cyrillic card-zoom-lore--in card-zoom-lore--${item.tier}`;
          text.textContent = item.text;
          // Line boxes of the real text node — the only honest source of
          // «how many lines» and «how full is each of them».
          // ⚠️ ONE LINE IS NOT ONE RECT: Chromium splits a line's range rects
          // at internal run boundaries, so the raw list reports phantom 20 px
          // «lines». Group by the rect's TOP and take each line's real extent.
          const range = document.createRange();
          range.selectNodeContents(text);
          const byLine = new Map<number, {l: number, r: number}>();
          for (const r of range.getClientRects()) {
            if (r.width <= 0.5) {
              continue;
            }
            const key = Math.round(r.top);
            const cur = byLine.get(key) ?? {l: Infinity, r: -Infinity};
            byLine.set(key, {l: Math.min(cur.l, r.left), r: Math.max(cur.r, r.right)});
          }
          const lineWidths = [...byLine.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v.r - v.l);
          const qs = getComputedStyle(quote);
          const padLeft = parseFloat(qs.paddingLeft);
          const quoteW = quote.getBoundingClientRect().width;
          // `width: fit-content` collapses to the text for a one-liner and
          // saturates at the tier's cap once it wraps — so a WRAPPED quote's
          // own width IS the measure the browser laid the lines into.
          const measure = lineWidths.length > 1 ? quoteW - padLeft : undefined;
          const head = lineWidths.slice(0, -1);
          return {
            key: item.key,
            chars: item.text.length,
            tier: item.tier,
            fontSize: parseFloat(qs.fontSize),
            lines: lineWidths.length,
            measure,
            widest: lineWidths.length === 0 ? 0 : Math.max(...lineWidths),
            meanFill: measure === undefined || head.length === 0 ?
              undefined : head.reduce((a, b) => a + b, 0) / head.length / measure,
            minFill: measure === undefined || head.length === 0 ?
              undefined : Math.min(...head) / measure,
            bodyH: body.getBoundingClientRect().height,
            text: item.text,
          };
        });

        const frameH = aside.getBoundingClientRect().height;
        const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const columnW = aside.getBoundingClientRect().width;
        host.remove();
        return {rows: out, frameH, remPx, columnW};
      }, {items: entries, fit: profile.fit});

      const {rows, frameH, remPx, columnW} = measured;
      const wrapped = rows.filter((r) => r.measure !== undefined);
      // RUNNING PROSE only — see MIN_MEAN_FILL.
      const multi = rows.filter((r) => r.lines >= 3 && r.meanFill !== undefined && r.tier !== 'short');
      const byTier = (t: Tier) => rows.filter((r) => r.tier === t);
      const stat = (v: ReadonlyArray<number>) => v.length === 0 ? 'n/a' :
        `min ${Math.min(...v).toFixed(2)} · mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} · max ${Math.max(...v).toFixed(2)}`;

      const sizes = (['short', 'regular', 'extended'] as const)
        .map((t) => byTier(t)[0]?.fontSize ?? 0);
      console.log(`[lore-measure] ${profile.tag}  rem=${remPx}px  column=${Math.round(columnW)}px  frame=${Math.round(frameH)}px`);
      console.log(`  tier sizes  short ${sizes[0]}px · regular ${sizes[1]}px · extended ${sizes[2]}px  (spread ${(sizes[0] / sizes[2]).toFixed(3)})`);
      for (const t of ['short', 'regular', 'extended'] as const) {
        const g = byTier(t);
        const gw = g.filter((r) => r.measure !== undefined);
        console.log(`  ${t.padEnd(8)} n=${String(g.length).padStart(3)}  lines ${stat(g.map((r) => r.lines))}` +
          `  fill ${stat(gw.map((r) => r.meanFill!).filter((v) => v !== undefined))}` +
          `  chars/line ${stat(gw.map((r) => r.chars / r.lines))}`);
      }
      const worstRagged = multi.slice().sort((a, b) => a.meanFill! - b.meanFill!).slice(0, 8);
      console.log('  raggedest entries:\n    ' + worstRagged
        .map((r) => `fill ${r.meanFill!.toFixed(2)} (min ${r.minFill!.toFixed(2)}) ${r.lines}L ${r.chars}ch ${r.tier} — ${r.text.slice(0, 64)}…`)
        .join('\n    '));
      const tallest = rows.slice().sort((a, b) => b.bodyH - a.bodyH).slice(0, 3);
      console.log('  tallest entries:\n    ' + tallest
        .map((r) => `${Math.round(r.bodyH)}px / frame ${Math.round(frameH)}px  ${r.lines}L ${r.chars}ch — ${r.text.slice(0, 56)}…`)
        .join('\n    '));

      // 1 · nothing clips.
      const clipped = wrapped.filter((r) => r.widest > r.measure! + 1);
      expect(clipped.map((r) => `${r.key} (${Math.round(r.widest)}px > ${Math.round(r.measure!)}px) ${r.text.slice(0, 40)}`),
        'a line wider than the measure it was laid into').toEqual([]);

      // 2 · nothing scrolls, nothing clips vertically: no entry can reach the
      //     viewer's own chrome, at any profile.
      const bandBudget = profile.height - CHROME_REM * remPx;
      const spilling = rows.filter((r) => r.bodyH > bandBudget);
      expect(spilling.map((r) => `${r.key} (${Math.round(r.bodyH)}px > ${Math.round(bandBudget)}px, ${r.lines} lines) ${r.text.slice(0, 40)}`),
        'an entry tall enough to reach the viewer chrome').toEqual([]);

      // 2b · …and where the card is not floor-clamped, the constant frame is a
      //      real baseline: the whole corpus composes inside it.
      if (profile.frameContainsCorpus) {
        const overflowing = rows.filter((r) => r.bodyH > frameH + 1);
        expect(overflowing.map((r) => `${r.key} (${Math.round(r.bodyH)}px > ${Math.round(frameH)}px, ${r.lines} lines) ${r.text.slice(0, 40)}`),
          'an entry taller than the frame the block reserves').toEqual([]);
      }

      // 3 · IT READS AS A NOTE, NOT A POEM. Two independent halves: the block
      //     stays SHORT (a line ceiling per tier) and its lines stay FULL (the
      //     tier's aggregate fill). The shipped composition fails both.
      for (const tier of ['short', 'regular', 'extended'] as const) {
        const group = byTier(tier);
        const budget = profile.lineBudget[tier];
        const tooTall = group.filter((r) => r.lines > budget);
        expect(tooTall.map((r) => `${r.key} ${r.lines}L > ${budget} — ${r.text.slice(0, 48)}`),
          `${tier} entries broken into more than ${budget} lines`).toEqual([]);

        const fills = group.map((r) => r.meanFill).filter((v): v is number => v !== undefined);
        const mean = fills.reduce((a, b) => a + b, 0) / Math.max(1, fills.length);
        expect(mean, `${tier} tier: mean fill of the lines before the last`)
          .toBeGreaterThanOrEqual(MIN_MEAN_FILL[tier]);
      }
      const collapsed = multi.filter((r) => r.minFill! < profile.minLineFill);
      expect(collapsed.map((r) => `${r.key} minFill=${r.minFill!.toFixed(2)} ${r.lines}L — ${r.text.slice(0, 48)}`),
        `prose entries with a line below ${profile.minLineFill} of the measure`).toEqual([]);

      // 4 · the ladder is optical compensation, never a nameable step.
      expect(sizes[0] / sizes[2], 'the tier ladder spread').toBeLessThanOrEqual(MAX_TIER_SPREAD);
      // A reading floor is a LOGICAL size, never a device one — the TV profile
      // owes the couch its 26-logical-px reading floor (console_tv.less), the
      // other profiles owe their own clamp's floor. Comparing device px would
      // fail a perfectly-sized 1280×800 panel and pass a starved 4K one.
      const floorRem = profile.tv ? 1.3 : 0.98;
      expect(sizes[2] / remPx, `the densest tier stays a real reading size (≥ ${floorRem}rem)`)
        .toBeGreaterThanOrEqual(floorRem - 0.001);
    });
  }
});
