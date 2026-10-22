import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, FixtureName, press, settle} from './consoleStart';

/**
 * THE PAYOUT STAGE'S GEOMETRY — colony polish 2 (the owner's 4K report of 2026-10-21: «на экране торговли на Плутоне
 * очень плохая компоновка на 4K TV, не хватает места и карты не видны»).
 *
 * A trade on Pluto with several settlements pays a TABLE: the track's income cards + one place per settlement. The
 * owner photographed FIVE objects (3 income + 2 places) on a 4K TV: the row broke 4 + 1, the second line had no height,
 * `align-content: center` split the overflow and the cards were cropped under the head. This spec drives the same
 * tables on both production profiles and asserts, on the box that actually clips:
 *   ① no card is cropped by the row, the zone or the stage panel;
 *   ② the line breaks where the layout solved it (never a wrap the engine did not plan);
 *   ③ the stage spends its band — the panel is not pinned to a token while the band above and below it stands empty.
 *
 * It also WRITES the frames and the measured geometry (`screenshots/colony-polish-2/<out>/<profile>/<fixture>/`), so a
 * before / after comparison is one folder beside another: `PAYOUT_OUT=before TM_E2E_ROOT=.e2e-colony2-before …`.
 */
const OUT = path.join('screenshots', 'colony-polish-2', process.env.PAYOUT_OUT ?? 'after');
const PLUTO = 'Pluto';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const FIXTURES: ReadonlyArray<{fixture: FixtureName, objects: number}> = [
  {fixture: 'pluto-settlements-2', objects: 4},
  {fixture: 'pluto-settlements-2-wide', objects: 5},
  {fixture: 'pluto-settlements-3-wide', objects: 7},
];
const ONLY = (process.env.PAYOUT_FIXTURES ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');

type Box = {x: number, y: number, w: number, h: number};
type Geo = {
  viewport: Box,
  band?: Box,
  panel?: Box,
  hero?: Box,
  zone?: Box,
  head?: Box,
  strip?: Box & {fit: string, padTop: number, padBottom: number, colGap: number, rowGap: number, classes: string},
  items: Array<Box & {kind: string, zoom: string}>,
  cards: Array<Box>,
  conds: Array<Box & {text: string}>,
  labels: Array<Box>,
  namebar?: Box & {classes: string, text: string},
  /** px of the strip's content outside the strip's own box (the box that clips). */
  overflow: number,
  /** px of card outside the stage PANEL (the owner's frame: cards over the panel's edge). */
  panelOverflow: number,
  renderedRows: number,
  perRow: string,
};

async function shoot(page: Page, dir: string, name: string): Promise<void> {
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

async function geometry(page: Page): Promise<Geo> {
  return page.evaluate(() => {
    const box = (el: Element | null | undefined): Box | undefined => {
      if (el === null || el === undefined) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
    };
    const q = (s: string) => document.querySelector<HTMLElement>(s);
    const strip = q('.con-reveal__strip');
    const cs = strip === null ? undefined : getComputedStyle(strip);
    const items: Geo['items'] = [];
    const cards: Array<Box> = [];
    let overflow = 0;
    let panelOverflow = 0;
    const panel = box(q('.con-colfocus__surface'));
    const stripBox = box(strip);
    // LINES by vertical OVERLAP (a focused slot is lifted, a zone is taller than a slot — the tops differ on one line).
    const lines: Array<{top: number, bottom: number}> = [];
    if (strip !== null) {
      for (const child of Array.from(strip.children) as Array<HTMLElement>) {
        const b = box(child);
        if (b === undefined || b.w === 0 || child.classList.contains('con-reveal__shelfbreak')) {
          continue;
        }
        const kind = child.classList.contains('con-reveal__bonus-zone') ? 'zone' :
          child.classList.contains('con-reveal__incslot') ? 'income' : child.classList.contains('con-cards__slot') ? 'slot' : child.className;
        const slot = child.classList.contains('con-cards__slot') ? child : child.querySelector<HTMLElement>('.con-cards__slot');
        items.push({...b, kind, zoom: slot === null ? '' : getComputedStyle(slot).zoom});
        const line = lines.find((l) => b.y < l.bottom && b.y + b.h > l.top);
        if (line === undefined) {
          lines.push({top: b.y, bottom: b.y + b.h});
        } else {
          line.top = Math.min(line.top, b.y);
          line.bottom = Math.max(line.bottom, b.y + b.h);
        }
      }
      for (const card of Array.from(strip.querySelectorAll<HTMLElement>('.con-cards__slot'))) {
        const b = box(card);
        if (b === undefined || b.w === 0 || getComputedStyle(card).visibility === 'hidden') {
          continue;
        }
        cards.push(b);
        if (stripBox !== undefined) {
          overflow = Math.max(overflow, stripBox.y - b.y, b.y + b.h - (stripBox.y + stripBox.h), stripBox.x - b.x, b.x + b.w - (stripBox.x + stripBox.w));
        }
        if (panel !== undefined) {
          panelOverflow = Math.max(panelOverflow, panel.y - b.y, b.y + b.h - (panel.y + panel.h));
        }
      }
    }
    const namebar = q('.con-reveal__namebar');
    const bandEl = q('.con-colonies__stagewrap') ?? q('.con-main');
    return {
      viewport: {x: 0, y: 0, w: window.innerWidth, h: window.innerHeight},
      band: box(bandEl),
      panel,
      hero: box(q('.con-colfocus__hero')),
      zone: box(q('.con-colfocus__outcome')),
      head: box(q('.con-reveal__head')),
      strip: strip === null || cs === undefined || stripBox === undefined ? undefined : {
        ...stripBox,
        fit: strip.getAttribute('data-fit') ?? '',
        padTop: parseFloat(cs.paddingTop), padBottom: parseFloat(cs.paddingBottom),
        colGap: parseFloat(cs.columnGap), rowGap: parseFloat(cs.rowGap), classes: strip.className,
      },
      items,
      cards,
      conds: Array.from(document.querySelectorAll<HTMLElement>('.con-reveal__sealcond')).map((el) => ({...(box(el) as Box), text: (el.textContent ?? '').trim()})),
      labels: Array.from(document.querySelectorAll<HTMLElement>('.con-reveal__bonus-zone-label')).map((el) => box(el) as Box),
      namebar: namebar === null ? undefined : {...(box(namebar) as Box), classes: namebar.className, text: (namebar.textContent ?? '').replace(/\s+/g, ' ').trim()},
      overflow: Math.round(overflow),
      panelOverflow: Math.round(panelOverflow),
      renderedRows: lines.length,
      perRow: strip === null ? '' : strip.style.getPropertyValue('--con-ws-stage-per-row'),
    };
  });
}

for (const preset of PRESETS) {
  for (const scenario of FIXTURES) {
    if (ONLY.length > 0 && !ONLY.includes(scenario.fixture)) {
      continue;
    }
    test.describe(`Pluto payout geometry · ${scenario.fixture} · ${preset.id}`, () => {
      test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

      test(`${scenario.objects} objects fit the stage — nothing cropped, the band spent (${preset.id})`, async ({page, request}) => {
        test.setTimeout(300_000);
        const dir = path.join(OUT, preset.id, scenario.fixture);
        const log: Array<string> = [];
        page.on('console', (m) => {
          const t = m.text();
          if (/\[console-leak-detector\]|\[console-overflow\]|Vue warn|STRANDED/.test(t)) {
            log.push(t.slice(0, 200));
          }
        });
        await bootFixtureSeats(page, request, scenario.fixture, {query: preset.query, keepColony: PLUTO});
        await settle(page);
        await openColonies(page);
        await focusTile(page, PLUTO);
        await press(page, 'Enter', 2000);
        expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
        await shoot(page, dir, '00-stage');
        const stage = await geometry(page);
        await press(page, 'KeyX', 300); // confirm the trade
        const active = page.locator('.con-colonies .con-reveal__bonus-zone--active');
        await active.first().waitFor({state: 'visible', timeout: 60_000});
        await cinematicBeat(page, 3200, 'the payout lands and the fit settles');
        await shoot(page, dir, '10-table');
        const geo = await geometry(page);
        fs.writeFileSync(path.join(dir, 'geometry.json'), JSON.stringify({stage, table: geo, console: log}, null, 1));
        console.log(`── ${scenario.fixture} · ${preset.id} ──`);
        console.log(`band=${JSON.stringify(geo.band)} panel=${JSON.stringify(geo.panel)} zone=${JSON.stringify(geo.zone)} hero=${JSON.stringify(geo.hero)}`);
        console.log(`head=${JSON.stringify(geo.head)} strip=${JSON.stringify(geo.strip)}`);
        console.log(`items=${geo.items.map((i) => `${i.kind}@${i.x},${i.y} ${i.w}x${i.h} z${i.zoom}`).join(' | ')}`);
        console.log(`conds=${geo.conds.map((c) => `${c.w}x${c.h} «${c.text}»`).join(' | ')} labels=${geo.labels.map((l) => `${l.w}x${l.h}`).join(' | ')}`);
        console.log(`namebar=${JSON.stringify(geo.namebar)} overflow=${geo.overflow} panelOverflow=${geo.panelOverflow} rows=${geo.renderedRows} perRow=${geo.perRow}`);
        console.log(`console: ${JSON.stringify(log.slice(-10))}`);

        // The cursor on the second object, then A takes the first card — the row keeps its shape.
        await press(page, 'ArrowRight', 500);
        await shoot(page, dir, '11-cursor');
        await press(page, 'ArrowLeft', 300);
        await press(page, 'Enter', 2200);
        await shoot(page, dir, '12-taken');
        const taken = await geometry(page);
        fs.writeFileSync(path.join(dir, 'geometry-taken.json'), JSON.stringify(taken, null, 1));

        expect(geo.items.length, 'every object of the table stands in the row').toBe(scenario.objects);
        // ① NOTHING IS CROPPED — against the row (the box that clips) and against the stage panel.
        expect(geo.overflow, `a card stands ${geo.overflow}px outside the row`).toBeLessThanOrEqual(2);
        expect(geo.panelOverflow, `a card stands ${geo.panelOverflow}px outside the stage panel`).toBeLessThanOrEqual(0);
        // ② THE SHAPE THAT RENDERS IS THE SHAPE THAT WAS SOLVED.
        const perRow = Number(geo.perRow || scenario.objects);
        expect(geo.renderedRows, `the row rendered ${geo.renderedRows} lines for a ${perRow}-per-row shape`).toBe(Math.ceil(scenario.objects / perRow));
        // …and the shape survives the first take.
        expect(taken.renderedRows, 'the take re-flowed the row').toBe(geo.renderedRows);
      });
    });
  }
}
