import {test, expect} from '@playwright/test';
import {TileType, isSpecialTile, tileTypeToString} from '../../src/common/TileType';
import translations from '../../src/genfiles/translations.json';

/**
 * THE PLACEMENT TITLE, MEASURED OVER THE WHOLE CORPUS.
 *
 * The dossier's identity line is the panel's loudest voice, and its size tier
 * is chosen by LENGTH — so the tier ladder is only honest if it is calibrated
 * against every name that can actually land there, in the real font, at the
 * real column width. A spot check on «ОЗЕЛЕНЕНИЕ» proves nothing about
 * «Генераторы магнитного поля».
 *
 * OFFLINE by construction: no game, no server, no navigation — the page is a
 * scrap of DOM wearing the built `styles.css` and the TV profile's own tokens.
 * (The `length-tier-ladder-calibration` lesson: calibrate a tier ladder with a
 * corpus probe, never by eye on a convenient sample.)
 *
 * ⭐ THE PROBE BUILDS THE REAL SUB-DOM AND MEASURES ITS REAL EDGES — it does
 * NOT re-derive the column with arithmetic. Two things went wrong when it did:
 *
 *   · the arithmetic MIRRORED the LESS (panel max-width, both paddings, the
 *     swatch, the gap), and the mirror rotted the moment the panel's width
 *     moved — a hand-maintained copy of geometry is a copy that drifts;
 *   · the measured node hung off `document.body`, OUTSIDE any `.con-root`, so
 *     it never inherited `@con-font` at all. The probe measured the index
 *     page's `Ubuntu, Sans` while claiming «the real font» — and since Ubuntu
 *     is a SYSTEM font (this app self-hosts Prototype and Golos Text only),
 *     the answer changed with the OS: ~4 % of headroom on a dev box, where it
 *     fell back to Arial, and none on the Linux CI runner, where the corpus
 *     tipped into two lines and failed a guard about a face the panel never
 *     uses.
 *
 * So: a real `.con-root` (the font), a real `.con-inspector.con-context`
 * (`position: fixed; inset: 0` on the root reproduces the box `.con-main`
 * gives the panel — both span the whole viewport, measured live), a real head
 * with the real swatch. Every padding, cap and gap comes from the stylesheet,
 * and the face is asserted before a single width is read.
 */

/**
 * The identity line must not WRAP at all on the couch: the ladder exists
 * precisely so the loudest voice on the panel stays one clean line. (The
 * measured table backs it — the worst name, «Падение Деймоса», lands on one
 * line at ~96 % of the column in the base tier.)
 */
const MAX_LINES = 1;

/** `translations.json` is keyed ENGLISH-FIRST: `{<key>: {ru: …, de: …}}`. */
function ru(key: string): string {
  return (translations as Record<string, Record<string, string> | undefined>)[key]?.ru ?? key;
}

/** Every name the identity line can print: the ordinary nouns + every named tile. */
function corpus(): Array<{key: string, text: string}> {
  const out = [{key: 'Greenery', text: ru('Greenery')},
    {key: 'City', text: ru('City')},
    {key: 'Ocean', text: ru('Ocean')},
    {key: 'Tile', text: ru('Tile')},
    {key: 'Marker', text: ru('Marker')}];
  for (const raw of Object.keys(tileTypeToString)) {
    const tt = Number(raw) as TileType;
    if (!isSpecialTile(tt)) {
      continue;
    }
    const name = tileTypeToString[tt];
    if (typeof name === 'string' && name.trim() !== '') {
      out.push({key: name, text: ru(name)});
    }
  }
  return out;
}

test.describe('placement dossier · the identity line fits the corpus', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

  test('every tile name lands on ONE line at 4K TV', async ({page}) => {
    test.setTimeout(120_000);
    const names = corpus();
    expect(names.length, 'the corpus is non-empty').toBeGreaterThan(20);

    // The built stylesheet + the app's fonts, nothing else. `?console=1` is
    // not needed: the probe applies the profile classes itself.
    await page.goto('/');
    await page.addStyleTag({url: '/styles.css'});
    await page.evaluate(() => {
      document.documentElement.classList.add('console-native', 'con-profile-tv');
      document.documentElement.style.setProperty('--con-ui-scale', '2');
    });

    // THE FONT IS AWAITED, NEVER SLEPT ON. `font-display: swap` means a face
    // that has not landed yet lays out in the FALLBACK's metrics, so a blind
    // `waitForTimeout` turns the whole spec into a race whose loser measures
    // a different typeface. `fonts.load()` also forces the CYRILLIC face,
    // which is a separate `unicode-range` @font-face and is otherwise never
    // requested by a page that shows no Cyrillic.
    const fontsReady = await page.evaluate(async (texts) => {
      const sample = texts.join(' ');
      await Promise.all(['1.5rem Prototype', '400 1.5rem Prototype']
        .map((f) => document.fonts.load(f, sample)));
      await document.fonts.ready;
      return document.fonts.check('400 1.5rem Prototype', sample);
    }, names.map((n) => n.text));
    expect(fontsReady, 'the Prototype faces (latin + cyrillic) actually loaded').toBe(true);

    const {measured, titleW, panelW, fontFamily} = await page.evaluate((names) => {
      // THE REAL SUB-DOM. `.con-root` is `position: fixed; inset: 0` — the
      // same box `.con-main` gives the panel in the app — so the panel's own
      // `width: 23%` / `max-width` / padding resolve exactly as on the board,
      // and the flex head hands the title its real column.
      const root = document.createElement('div');
      root.className = 'con-root';
      root.style.visibility = 'hidden';
      const panel = document.createElement('aside');
      panel.className = 'con-inspector con-context';
      const header = document.createElement('header');
      header.className = 'con-context__id';
      const head = document.createElement('div');
      head.className = 'con-context__head';
      const swatch = document.createElement('span');
      swatch.className = 'con-context__tile';
      const art = document.createElement('span');
      art.className = 'con-context__tile-art';
      const h2 = document.createElement('h2');
      swatch.appendChild(art);
      head.append(swatch, h2);
      header.appendChild(head);
      panel.appendChild(header);
      root.appendChild(panel);
      document.body.appendChild(root);

      /** Lines this name takes in `tier`, and the widest line's INK width. */
      const measure = (text: string, tier: '' | 'long' | 'dense') => {
        h2.className = 'con-context__title' + (tier === '' ? '' : ` con-context__title--${tier}`);
        h2.textContent = text;
        const cs = getComputedStyle(h2);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.1;
        // The INK, not the box: an `h2` is a block and fills its column, so
        // `scrollWidth` can never report an overflow the wrapping prevented.
        const range = document.createRange();
        range.selectNodeContents(h2);
        const rects = [...range.getClientRects()];
        return {
          lines: Math.max(1, Math.round(h2.getBoundingClientRect().height / lh)),
          width: rects.length === 0 ? 0 : Math.max(...rects.map((r) => r.width)),
          column: h2.getBoundingClientRect().width,
          family: cs.fontFamily,
        };
      };

      const out = names.map((n) => {
        // The LIVE ladder (mirrors `placementTitleTier`).
        const tier: '' | 'long' | 'dense' =
          n.text.length > 22 ? 'dense' : n.text.length > 15 ? 'long' : '';
        const live = measure(n.text, tier);
        // …and the CALIBRATION data: the loudest tier that still lands the
        // name on ONE line, which is what the thresholds should be read off.
        const oneLine = (['', 'long', 'dense'] as const).find((t) => measure(n.text, t).lines === 1);
        return {
          key: n.key, text: n.text, chars: n.text.length, tier: tier === '' ? 'base' : tier,
          lines: live.lines, width: live.width,
          fitsOneLineAt: oneLine === undefined ? 'none' : oneLine === '' ? 'base' : oneLine,
        };
      });
      // THE COLUMN, not one name's box. The title is a flex item with the
      // default `flex: 0 1 auto`, so a short name reports its own INK width
      // and would understate the space it actually has. A string that cannot
      // fit shrinks the item to exactly the room the head leaves beside the
      // swatch — that is the column every name is judged against.
      const probe = measure('Ш'.repeat(240), '');
      const panelW = panel.getBoundingClientRect().width;
      root.remove();
      return {measured: out, titleW: probe.column, panelW, fontFamily: probe.family};
    }, names);

    // THE GUARD THAT KEEPS THE PROBE HONEST: measuring the wrong typeface is
    // exactly how this spec failed on CI while passing everywhere else.
    expect(fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      'the identity line was measured in the panel own face').toBe('Prototype');

    const overflowing = measured.filter((m) => m.lines > MAX_LINES);
    const clipped = measured.filter((m) => m.width > titleW + 1);
    console.log('[title-measure] panel =', Math.round(panelW), 'px · title column =',
      Math.round(titleW), 'px\n  ' + measured
        .slice().sort((a, b) => b.chars - a.chars)
        .map((m) => `${String(m.chars).padStart(2)}ch  live=${m.tier.padEnd(5)} ${m.lines}L ` +
          `${String(Math.round(m.width)).padStart(4)}px (${((m.width / titleW) * 100).toFixed(0)}%)  ` +
          `1-line@${m.fitsOneLineAt.padEnd(5)}  ${m.text}`)
        .join('\n  '));

    expect(titleW, 'the probe resolved a real column, not a collapsed box').toBeGreaterThan(300);
    expect(overflowing.map((m) => `${m.text} (${m.lines} lines)`), 'a name that wraps').toEqual([]);
    // A word that cannot break inside the column would clip, whatever the
    // line count says — `overflow-wrap: anywhere` must have caught them all.
    expect(clipped.map((m) => `${m.text} (${Math.round(m.width)}px > ${Math.round(titleW)}px)`),
      'a name wider than its column').toEqual([]);
  });
});
