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
 * «Магнитные генераторы поля».
 *
 * OFFLINE by construction: no game, no server, no navigation — the page is a
 * scrap of DOM wearing the built `styles.css` and the TV profile's own tokens.
 * (The `length-tier-ladder-calibration` lesson: calibrate a tier ladder with a
 * corpus probe, never by eye on a convenient sample.)
 */

/**
 * The TV panel's title column, IN REM (the LESS geometry: `.con-inspector`
 * max-width minus its padding, minus the identity swatch + gap). It is
 * resolved against the page's REAL rem — the console maps rem onto the
 * viewport through `--con-ui-scale`, so assuming «1rem = 20px» would measure
 * a column half the true width at 4K and fail names that fit perfectly.
 */
const TITLE_W_REM = 21.5 - (0.85 + 0.95) - (2.45 + 0.6);

/**
 * The identity line must not WRAP at all on the couch: the ladder exists
 * precisely so the loudest voice on the panel stays one clean line. (The
 * measured table backs it — the worst name, «Генераторы магнитного поля»,
 * lands on one line in the dense tier.)
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

  test('every tile name lands in at most two lines at 4K TV', async ({page}) => {
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
    await page.waitForTimeout(600); // let the webfonts land

    const {measured, titleW} = await page.evaluate(({names, titleWRem}) => {
      // The page's OWN rem — never an assumed constant (see TITLE_W_REM).
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const titleW = titleWRem * remPx;
      const host = document.createElement('div');
      host.style.cssText = `position:fixed;left:0;top:0;width:${titleW}px;visibility:hidden`;
      document.body.appendChild(host);
      /** Lines this name takes in the tier the LIVE ladder would pick for it. */
      const measure = (text: string, tier: '' | 'long' | 'dense') => {
        const h2 = document.createElement('h2');
        h2.className = 'con-context__title' + (tier === '' ? '' : ` con-context__title--${tier}`);
        h2.textContent = text;
        host.appendChild(h2);
        const cs = getComputedStyle(h2);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.1;
        const out = {
          lines: Math.max(1, Math.round(h2.getBoundingClientRect().height / lh)),
          width: h2.scrollWidth,
        };
        host.removeChild(h2);
        return out;
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
      host.remove();
      return {measured: out, titleW};
    }, {names, titleWRem: TITLE_W_REM});

    const overflowing = measured.filter((m) => m.lines > MAX_LINES);
    const clipped = measured.filter((m) => m.width > titleW + 1);
    console.log('[title-measure] column =', Math.round(titleW), 'px\n  ' + measured
      .slice().sort((a, b) => b.chars - a.chars)
      .map((m) => `${String(m.chars).padStart(2)}ch  live=${m.tier.padEnd(5)} ${m.lines}L  1-line@${m.fitsOneLineAt.padEnd(5)}  ${m.text}`)
      .join('\n  '));

    expect(titleW, 'the probe resolved a real column, not a 16px-rem default').toBeGreaterThan(300);
    expect(overflowing.map((m) => `${m.text} (${m.lines} lines)`), 'a name needing more than two lines').toEqual([]);
    // A word that cannot break inside the column would clip, whatever the
    // line count says — `overflow-wrap: anywhere` must have caught them all.
    expect(clipped.map((m) => `${m.text} (${Math.round(m.width)}px > ${Math.round(titleW)}px)`),
      'a name wider than its column').toEqual([]);
  });
});
