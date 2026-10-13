import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, openActionFocus, openCardActions, press, settle} from './consoleStart';

/**
 * THE OUTCOME TILES — a card action's variant choice on the console composer (the owner's 4K photo of 2026-10-13,
 * «Сбор атмосферы»: three bezel plates each printing the WHOLE «аэростат → 2 титан / 3 энергия / 4 тепло» row, a
 * column taller than the band, the third tile cut under the commit button).
 *
 * The fixture (`variant-tiles`): blue holds Atmo Collectors with two floaters — ONE printed row the server splits
 * into THREE branches — and Asteroid Rights with one asteroid — a row with an INTERIOR OR, two branches. The spec
 * drives the real surface on both profiles and proves:
 *
 *  1. the slice — every tile prints ITS outcome and nothing else (one sprite, the same resource its own reading
 *     chip names); the price the variants share is printed once above them, never on a tile (PL-074);
 *  2. the fit — the three tiles stand in ONE row (`data-variant-axis="row"`), the group never overflows the column's
 *     viewport, the commit row stands clear under it, and no `[console-overflow]` is reported;
 *  3. the grammar — ←→ switch the tiles (wrapping), ↓ cannot leave an unanswered group, the bar names the switch
 *     («◄► Вариант»), A seals ONE tile and lets the others recede, ↑ from the commit row re-enters on the tile the
 *     cursor left; the commit lands the chosen reading on the rail (heat 6 → 10 — server truth);
 *  4. the interior OR — Asteroid Rights' second row: the production branch prints the production plate, the titanium
 *     branch its titanium, and nothing prints both.
 */
const OUT = path.resolve('screenshots', 'variant-tiles');
const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const GROUP = `${COMPOSER} .con-composer__branches`;
const TILES = `${GROUP} .con-vchoice__opt`;
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** «Действия карт» → the `nth` printed row of `card` → its composer. The action centre is a GRID: a 2D walk. */
async function openAction(page: Page, card: string, nth: number): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[data-action-card]'));
    const at = tiles.findIndex((e) => e.classList.contains('con-cardactions__tile--focused'));
    if (at < 0) {
      return '';
    }
    const name = tiles[at].getAttribute('data-action-card') ?? '';
    const nthOfCard = tiles.slice(0, at).filter((e) => e.getAttribute('data-action-card') === name).length;
    return `${name}#${nthOfCard}`;
  });
  const hit = async () => (await focused()) === `${card}#${nth}`;
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 24 && !(await hit()); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await hit(), `never focused «${card}» row ${nth + 1} (at «${await focused()}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
}

type Tile = {
  pos: number,
  focused: boolean,
  selected: boolean,
  recede: boolean,
  top: number,
  /** The sprites the tile PRINTS (its headline), by file name. */
  prints: Array<string>,
  /** The sprites its reading chips show. */
  chips: Array<string>,
  costChips: number,
  production: boolean,
};

/** The sprite an icon box paints, by file name — a face icon paints inline, a chip icon through its class. */
const spriteOf = (el: Element): string => {
  const inline = (el as HTMLElement).style.backgroundImage;
  const painted = inline !== '' ? inline : getComputedStyle(el).backgroundImage;
  return painted.match(/\/([^/]+)\.(?:png|svg|webp)/)?.[1] ?? '?';
};

async function tiles(page: Page): Promise<Array<Tile>> {
  return await page.evaluate(([sel, sprite]) => {
    const spriteFn = new Function('el', `return (${sprite})(el)`) as (el: Element) => string;
    return Array.from(document.querySelectorAll<HTMLElement>(sel)).map((t) => ({
      pos: Number(t.getAttribute('data-branch-pos')),
      focused: t.classList.contains('con-vchoice__opt--focused'),
      selected: t.classList.contains('con-vchoice__opt--selected'),
      recede: t.classList.contains('con-vchoice__opt--recede'),
      // The LAYOUT top (the cursor's cold lift is a transform — the focused tile's painted box rides a hair higher).
      top: t.offsetTop,
      prints: Array.from(t.querySelectorAll('[data-vchoice-print] .pcard-ic')).map(spriteFn),
      chips: Array.from(t.querySelectorAll('.action-effect-chip__icon')).map(spriteFn),
      costChips: t.querySelectorAll('.action-effect-chip--cost').length,
      production: t.querySelector('[data-vchoice-print] .pcard-prod') !== null,
    }));
  }, [TILES, spriteOf.toString()] as const);
}

const focusedPos = async (page: Page) => (await tiles(page)).find((t) => t.focused)?.pos ?? -1;

async function fit(page: Page) {
  return await page.evaluate(([group, composer]) => {
    const g = document.querySelector<HTMLElement>(group);
    const scroll = document.querySelector<HTMLElement>(`${composer} .con-composer__scroll`);
    const cta = document.querySelector<HTMLElement>(`${composer} .con-composer__cta`);
    const r = (el: HTMLElement | null) => el === null ? null : {top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom)};
    return {
      axis: g?.getAttribute('data-variant-axis') ?? null,
      group: r(g),
      viewport: r(scroll),
      overflow: scroll === null ? null : scroll.scrollHeight - scroll.clientHeight,
      cta: r(cta),
      bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      hero: (document.querySelector(`${composer} .con-composer__hero`)?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  }, [GROUP, COMPOSER] as const);
}

for (const preset of PRESETS) {
  test.describe(`variant tiles · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`Atmo Collectors: three outcome tiles in ONE row — each prints its own resource, ←→ switch them, the choice lands (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const overflow: Array<string> = [];
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'variant-tiles', {query: preset.query});
      await settle(page);
      await openAction(page, 'Atmo Collectors', 1);
      await shoot(page, preset.id, 'atmo-01-open');

      // ① THE SLICE — one sprite per tile, the one its own reading names; the shared price above, never on a tile.
      let ts = await tiles(page);
      expect(ts.map((t) => t.pos), 'three variants').toEqual([0, 1, 2]);
      for (const t of ts) {
        expect(t.prints, `tile ${t.pos} prints exactly ONE sprite`).toHaveLength(1);
        expect(t.chips, `tile ${t.pos} reads exactly one chip`).toHaveLength(1);
        expect(t.prints[0], `tile ${t.pos}: the print IS the chip's resource`).toBe(t.chips[0]);
        expect(t.costChips, `tile ${t.pos} repeats no price (PL-074)`).toBe(0);
      }
      expect(new Set(ts.map((t) => t.prints[0])).size, 'three different outcomes').toBe(3);
      expect(ts.map((t) => t.prints[0]).sort(), 'titanium · energy · heat').toEqual(['heat', 'power', 'titanium']);
      let f = await fit(page);
      expect(f.hero, 'the common price is stated once, above').toMatch(/Будет списано/);

      // ② THE FIT — one row, inside the column's viewport, the commit row clear under it.
      expect(f.axis, 'the tiles stand side by side').toBe('row');
      expect(new Set(ts.map((t) => t.top)).size, 'one row').toBe(1);
      expect(f.overflow, 'the decision column does not scroll').toBe(0);
      expect(f.group!.bottom, 'the group ends inside the viewport').toBeLessThanOrEqual(f.viewport!.bottom + 1);
      expect(f.cta!.top, 'the commit row stands under the group').toBeGreaterThanOrEqual(f.group!.bottom);

      // ③ THE GRAMMAR — ←→ switch (wrapping), ↓ cannot leave an unanswered group, the bar says so.
      expect(await focusedPos(page), 'the cursor opens on the first tile').toBe(0);
      expect(f.bar, 'the bar names the switch').toMatch(/Вариант/);
      await press(page, 'ArrowDown', 300);
      expect(await focusedPos(page), '↓ cannot leave an unanswered choice').toBe(0);
      await press(page, 'ArrowRight', 300);
      expect(await focusedPos(page)).toBe(1);
      await press(page, 'ArrowRight', 300);
      expect(await focusedPos(page)).toBe(2);
      await press(page, 'ArrowRight', 300);
      expect(await focusedPos(page), '→ wraps').toBe(0);
      await press(page, 'ArrowLeft', 300);
      expect(await focusedPos(page), '← wraps back').toBe(2);
      await shoot(page, preset.id, 'atmo-02-cursor-heat');
      expect(await page.locator(`${TILES}.con-vchoice__opt--selected`).count(), 'moving the cursor selects nothing').toBe(0);

      // A seals the heat tile; the cursor advances to the commit row; the other tiles recede.
      await press(page, 'Enter', 500);
      ts = await tiles(page);
      expect(ts.filter((t) => t.selected).map((t) => t.pos), 'ONE seal, on the heat tile').toEqual([2]);
      expect(ts.filter((t) => t.recede).map((t) => t.pos), 'the others recede').toEqual([0, 1]);
      f = await fit(page);
      expect(f.hero, 'the formula reads the chosen outcome').toMatch(/Вы получите[\s\S]*6\s*→\s*10/);
      expect(f.cta!.top, 'the commit row still stands clear').toBeGreaterThanOrEqual(f.group!.bottom);
      await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`), 'A on a tile advances to the commit row').toHaveCount(1);
      await shoot(page, preset.id, 'atmo-03-chosen-heat');
      await press(page, 'ArrowUp', 300);
      expect(await focusedPos(page), '↑ re-enters the group on the tile the cursor left').toBe(2);
      await press(page, 'ArrowDown', 300);
      await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`), '↓ leaves an answered group to the commit row').toHaveCount(1);

      // The commit: the chosen reading lands on the rail (server truth).
      const before = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {heat: number}};
      expect(before.thisPlayer.heat).toBe(6);
      await press(page, 'Enter', 800);
      await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as {thisPlayer: {heat: number}}).thisPlayer.heat, {timeout: 20_000, message: 'heat 6 → 10'}).toBe(10);
      await settle(page, {timeoutMs: 30_000});
      expect(overflow, 'no [console-overflow]').toEqual([]);
    });

    test(`Asteroid Rights: an interior OR — the production branch prints the plate, the titanium branch its titanium (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'variant-tiles', {query: preset.query});
      await settle(page);
      await openAction(page, 'Asteroid Rights', 1);
      await shoot(page, preset.id, 'rights-01-open');
      const ts = await tiles(page);
      expect(ts.map((t) => t.pos), 'two variants').toEqual([0, 1]);
      const production = ts.find((t) => t.production);
      const titanium = ts.find((t) => !t.production);
      expect(production, 'one tile prints the production plate').toBeDefined();
      expect(titanium, 'the other prints the titanium').toBeDefined();
      expect(titanium!.prints.every((s) => s === 'titanium'), `titanium only, got ${titanium!.prints.join(',')}`).toBe(true);
      expect(titanium!.prints.length, 'the printed «2 titanium»').toBeGreaterThan(0);
      expect(production!.prints.filter((s) => s === 'titanium'), 'the production tile prints no titanium').toHaveLength(0);
      for (const t of ts) {
        expect(t.costChips, `tile ${t.pos} repeats no price (PL-074)`).toBe(0);
      }
      const f = await fit(page);
      expect(f.axis).toBe('row');
      expect(f.overflow, 'no scroll').toBe(0);
    });
  });
}
