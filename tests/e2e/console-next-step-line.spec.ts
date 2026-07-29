import {test, expect} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * CONSOLE «ДАЛЕЕ» LINE — the geometry contract.
 *
 * The row now says WHICH tile is placed, which means its text length varies a
 * lot between cards («разместите тайл» ↔ «разместите особый тайл «Генераторы
 * магнитного поля» — рядом с океаном»). Two things must NOT vary with it:
 *
 *  1. the row's HEIGHT — otherwise the preview modal resizes as the player
 *     moves between cards, and the CTA below it walks up and down;
 *  2. the row's WIDTH — it must never push a horizontal scrollbar, which on the
 *     Steam Deck (1280×800, the tightest supported profile) is where a long
 *     localized tile name would first break out.
 *
 * These are pixel facts, so they are measured in a real browser against the
 * REAL compiled `build/styles.css` — a unit test cannot make either claim
 * (jsdom performs no layout). The harness renders the row markup directly
 * rather than driving a whole game to each card: the variants below are
 * exhaustive over what `consolePlacementNextStep` can emit, which a live walk
 * could never be. `markup drift` is guarded separately, at the bottom.
 */

const CSS = path.resolve('build', 'styles.css');

/** The component template's row, once per shape the presenter can produce. */
const ROWS: ReadonlyArray<{id: string, html: string}> = [
  {id: 'prose-note', html: row({glyph: true, text: 'выберите клетку для резервирования'})},
  {id: 'generic-tile', html: row({tile: true, text: 'разместите тайл'})},
  {id: 'city-tile', html: row({tile: true, text: 'разместите тайл города'})},
  {id: 'ocean-tile', html: row({tile: true, text: 'разместите тайл океана'})},
  {id: 'greenery-tile', html: row({tile: true, text: 'разместите тайл озеленения'})},
  {id: 'special-unnamed', html: row({tile: true, text: 'разместите особый тайл'})},
  {id: 'special-named', html: row({tile: true, text: 'разместите особый тайл «Солнечная электростанция»'})},
  {id: 'special-named-constraint', html: row({tile: true, text: 'разместите особый тайл «Промышленный центр»', tail: 'рядом с городом'})},
  {id: 'plural-ocean', html: row({tile: true, text: 'разместите 2 тайла океана'})},
  {id: 'longest-real-name', html: row({tile: true, text: 'разместите особый тайл «Генераторы магнитного поля»', tail: 'на клетке с бонусом стали или титана'})},
  // Deliberately absurd — the row must clip, never widen.
  {id: 'pathological', html: row({tile: true, text: 'разместите особый тайл «' + 'Очень'.repeat(40) + '»', tail: 'Ж'.repeat(200)})},
];

function row(o: {tile?: boolean, glyph?: boolean, text: string, tail?: string}): string {
  const lead = o.tile === true ?
    '<span class="con-composer__next-tile"></span>' :
    '<span class="con-composer__next-glyph">›</span>';
  const tail = o.tail !== undefined ? `<span class="con-composer__next-tail">${o.tail}</span>` : '';
  return `<div class="con-composer__next">${lead}` +
    '<span class="con-composer__next-label">Далее</span>' +
    `<span class="con-composer__next-text">${o.text}</span>${tail}</div>`;
}

/**
 * The composer column the row lives in, at its narrowest realistic width.
 *
 * `console*.less` is authored in rem against a 1920×1080 LOGICAL layout where
 * 1rem = 20px, and `--con-ui-scale` maps that onto the real viewport. The
 * harness reproduces that mapping on `html` so a Steam Deck measurement is the
 * REAL one (1rem ≈ 13.3px there), not a default-16px approximation.
 */
function harness(remPx: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fs.readFileSync(CSS, 'utf8')}</style>
    <style>
      html { font-size: ${remPx}px; }
      html, body { margin: 0; padding: 0; background: #05080d; }
      /* The composer's own content column — the row's real bound. */
      #probe { width: 34rem; overflow: hidden; }
    </style></head>
    <body><div class="con-root con-profile-tv"><div class="con-composer"><div id="probe">
      ${ROWS.map((r) => r.html).join('')}
    </div></div></div></body></html>`;
}

const LOGICAL_WIDTH = 1920;
const LOGICAL_REM = 20;

const PROFILES: ReadonlyArray<{id: string, width: number, height: number}> = [
  {id: 'deck-handheld', width: 1280, height: 800},
  {id: 'standard-1080', width: 1920, height: 1080},
];
const remFor = (width: number) => (width / LOGICAL_WIDTH) * LOGICAL_REM;

test.describe('console «ДАЛЕЕ» line — fixed height, no overflow', () => {
  test.beforeAll(() => {
    expect(fs.existsSync(CSS), 'build/styles.css missing — run `npm run make:css` first').toBeTruthy();
  });

  for (const profile of PROFILES) {
    test(`every variant is ONE line of the SAME height · ${profile.id}`, async ({page}) => {
      await page.setViewportSize({width: profile.width, height: profile.height});
      await page.setContent(harness(remFor(profile.width)));
      await page.waitForTimeout(150);

      const measured = await page.$$eval('.con-composer__next', (els) => els.map((el) => {
        const e = el as HTMLElement;
        const text = e.querySelector('.con-composer__next-text') as HTMLElement;
        return {
          height: e.getBoundingClientRect().height,
          // A wrapped row is taller than its own line box — the direct signal
          // that the "one line" contract broke.
          lineHeight: text.getBoundingClientRect().height,
          scrollWidth: e.scrollWidth,
          clientWidth: e.clientWidth,
        };
      }));
      expect(measured.length).toBe(ROWS.length);

      // 1. ONE height for every variant. Not "close" — identical.
      const heights = [...new Set(measured.map((m) => Math.round(m.height * 100) / 100))];
      const detail = measured.map((m, i) => `${ROWS[i].id}=${m.height}`).join(', ');
      expect(heights, `rows differ in height: ${detail}`).toHaveLength(1);
      expect(heights[0], 'the row collapsed').toBeGreaterThan(10);

      // 2. Still a SINGLE line — the text never wrapped to a second row.
      for (const [i, m] of measured.entries()) {
        expect(m.lineHeight, `${ROWS[i].id} wrapped to a second line`).toBeLessThanOrEqual(m.height);
      }

      // 3. No horizontal overflow: the row clips its tail instead of growing.
      for (const [i, m] of measured.entries()) {
        expect(m.scrollWidth, `${ROWS[i].id} overflows its row horizontally`).toBeLessThanOrEqual(m.clientWidth + 1);
      }
    });

    test(`the column never scrolls sideways · ${profile.id}`, async ({page}) => {
      await page.setViewportSize({width: profile.width, height: profile.height});
      await page.setContent(harness(remFor(profile.width)));
      await page.waitForTimeout(150);
      const doc = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(doc.scrollWidth, 'the page gained a horizontal scrollbar').toBeLessThanOrEqual(doc.clientWidth + 1);
    });
  }

  test('a real tile name is shown IN FULL — only the constraint tail may clip', async ({page}) => {
    // The TIGHTEST supported profile — if a real name fits here it fits everywhere.
    await page.setViewportSize({width: 1280, height: 800});
    await page.setContent(harness(remFor(1280)));
    await page.waitForTimeout(150);
    const truncated = await page.$$eval('.con-composer__next-text', (els) => els
      .map((el, i) => ({i, clipped: (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1})));
    // Index 10 is the deliberately pathological row; every REAL name fits.
    const realClipped = truncated.filter((t) => t.clipped && t.i !== ROWS.length - 1).map((t) => ROWS[t.i].id);
    expect(realClipped, `real tile names were truncated: ${realClipped.join(', ')}`).toHaveLength(0);
  });

  test('the markup the harness measures matches the component templates', () => {
    // The harness renders the row by hand; if a template stops emitting one of
    // these parts the geometry above would be testing a fiction.
    const PARTS = [
      'con-composer__next-tile',
      'con-composer__next-glyph',
      'con-composer__next-label',
      'con-composer__next-text',
      'con-composer__next-tail',
    ];
    const TEMPLATES = [
      'src/client/components/console/ConsolePlayCardConfirm.vue',
      'src/client/components/console/ConsoleCorpFirstActionConfirm.vue',
      'src/client/components/console/ConsoleActionComposer.vue',
    ];
    for (const file of TEMPLATES) {
      const src = fs.readFileSync(path.resolve(file), 'utf8');
      for (const part of PARTS) {
        expect(src.includes(part), `${file} no longer renders .${part}`).toBeTruthy();
      }
    }
  });
});
