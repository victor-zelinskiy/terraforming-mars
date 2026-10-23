/*
 * T03 · CF — THE PLAYER BOARD: MATERIAL, NOT FORM (the stand of «ИГРОВОЙ ПЛАНШЕТ — ЛЕВАЯ ПАНЕЛЬ НА 4K»).
 *
 * The left rail (score cap · six resource rows · the tag matrix) may change its PAINT and never its BOXES: every
 * flight aims at the same selectors on every material (`consoleResourceTransfer.targetPointFor`,
 * `generationScene`, the conversion overlay). This stand reads every ANCHOR's rect on three profiles and:
 *   A · writes them (`screenshots/t03/rail/<tag>/<profile>/anchors.json`) with the rail's frames — «before» is the
 *       base client (`TM_E2E_SHOTS_TAG=before`);
 *   B · with `TM_E2E_RAIL_MOCK=M1|M2|M3` injects a MOCKUP's paint (`railMaterialMocks.ts`) over the live scene,
 *       re-reads every anchor and fails on a move of more than 1 px — a mockup may not move a box either;
 *   C · against a checked-in BASELINE (`tests/e2e/railAnchorsBaseline.json` — the base client of fcd6fb7374's rail, written by A) fails on any
 *       anchor that moved more than 1 px from the base client — the parity guard of the shipped material.
 *
 * FUNCTIONAL class (no motion is measured). Fixture `cultural-metropolis` (blue's board home, a live rail).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, settle} from './consoleStart';
import {RAIL_MOCKS, RailMock} from './railMaterialMocks';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const MOCK = process.env.TM_E2E_RAIL_MOCK as RailMock | undefined;
const OUT = path.resolve('screenshots', 't03', 'rail', MOCK ?? TAG);
const BASELINE = path.resolve('tests', 'e2e', 'railAnchorsBaseline.json');

type Rect = {x: number, y: number, w: number, h: number};
type Anchors = Record<string, Rect>;

/** Every anchor a flight, a probe or a seam reads off the rail — the selectors are the contract, never renamed. */
async function readAnchors(page: Page): Promise<Anchors> {
  return page.evaluate(() => {
    const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
    const put = (key: string, el: Element | null) => {
      if (el === null) {
        return;
      }
      const r = el.getBoundingClientRect();
      out[key] = {x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10};
    };
    put('rail', document.querySelector('.con-res'));
    put('score', document.querySelector('.con-score'));
    put('score.tr', document.querySelector('.con-score__value--tr'));
    put('score.vp', document.querySelector('.con-score__cell--vp .con-score__valwrap'));
    for (const key of ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']) {
      const row = document.querySelector(`.con-res__row--${key}`);
      put(`${key}.row`, row);
      put(`${key}.icon`, row?.querySelector('.con-res__icon') ?? null);
      put(`${key}.digits`, row?.querySelector('.con-res__digits') ?? null);
      put(`${key}.stockwrap`, row?.querySelector('.con-res__stockwrap') ?? null);
      put(`${key}.prod`, row?.querySelector('.con-res__prod') ?? null);
    }
    document.querySelectorAll('.con-tagmx__cell').forEach((cell) => put(`tag.${cell.getAttribute('data-tag-cell')}`, cell));
    put('tagmx', document.querySelector('.con-tagmx'));
    const seam = getComputedStyle(document.querySelector('.con-root') ?? document.documentElement).getPropertyValue('--con-rail-w').trim();
    out['seam'] = {x: 0, y: 0, w: Number.parseFloat(seam) || 0, h: 0};
    return out;
  });
}

function drift(a: Anchors, b: Anchors): Array<string> {
  const out: Array<string> = [];
  for (const key of Object.keys(a)) {
    const p = a[key];
    const q = b[key];
    if (q === undefined) {
      out.push(`${key}: gone`);
      continue;
    }
    const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.w - q.w), Math.abs(p.h - q.h));
    if (d > 1) {
      out.push(`${key}: ${JSON.stringify(p)} → ${JSON.stringify(q)} (Δ ${d.toFixed(1)})`);
    }
  }
  return out;
}

async function railShot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `${name}.png`)});
  const box = await page.locator('.con-res-host').boundingBox();
  if (box !== null) {
    const vp = page.viewportSize()!;
    await page.screenshot({path: path.join(OUT, profile, `${name}-rail.png`),
      clip: {x: 0, y: Math.max(0, box.y - 8), width: Math.min(vp.width, box.x + box.width * 2.2), height: Math.min(vp.height - Math.max(0, box.y - 8), box.height + 16)}});
  }
}

for (const preset of PROFILES) {
  test.describe(`T03 · the rail's material · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`anchors, frames${MOCK !== undefined ? ` and mockup ${MOCK}` : ''} (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'cultural-metropolis', {query: preset.query});
      await settle(page, {timeoutMs: 30_000});
      const base = await readAnchors(page);
      expect(Object.keys(base).filter((k) => k.endsWith('.digits')), 'six rows read').toHaveLength(6);
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, preset.id, 'anchors.json'), JSON.stringify(base, null, 1));
      if (MOCK === undefined) {
        await railShot(page, preset.id, 'board');
        if (fs.existsSync(BASELINE)) {
          const baseline = (JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, Anchors>)[preset.id];
          if (baseline !== undefined) {
            const moved = drift(baseline, base);
            expect(moved, `anchors moved against the base client:\n${moved.join('\n')}`).toEqual([]);
          }
        }
        return;
      }
      await page.addStyleTag({content: RAIL_MOCKS[MOCK]});
      await settle(page, {timeoutMs: 10_000});
      const mocked = await readAnchors(page);
      await railShot(page, preset.id, `mock-${MOCK}`);
      const moved = drift(base, mocked);
      expect(moved, `mockup ${MOCK} moved an anchor:\n${moved.join('\n')}`).toEqual([]);
    });
  });
}
