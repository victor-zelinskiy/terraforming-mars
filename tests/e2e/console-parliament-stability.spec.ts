import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, settle} from './consoleStart';
import {focusParliamentZone, openParliament, parliament, PARLIAMENT_PRESETS, parliamentZone} from './parliamentDrive';

/*
 * THE BROWSE LAYER IS STILL WHILE THE PLAYER POINTS (ПОЛИРОВКА — the registry's
 * «скачки раскладки» class). A d-pad walk over the three zones and the six
 * party tiles is a HUD read: the cursor moves, nothing else may. Two laws,
 * measured on every profile:
 *   · every layout-bearing block of the overview (head, seats, government,
 *     voting slots, party tiles, agenda) keeps its transform-free box
 *     (`offset*` geometry) through the whole walk — a focused tile may glow
 *     and scale, it may not push its neighbours;
 *   · the six tiles are the SAME chassis: equal tile heights and an EQUAL
 *     state-row height whether the tile carries «ПРАВИТ», «2/2 ВАШ ЭФФЕКТ»,
 *     «ВЫДАН КАРТОЙ» or nothing at all — a caption that exists on three tiles
 *     and not on the other three is exactly the jump this guards.
 * The DENSE table (five seats, every tile state at once) is the worst case.
 */
type Box = {x: number, y: number, w: number, h: number};
type Snapshot = Record<string, Box>;

const BLOCKS = ['.con-parl__head', '.con-parl__seats', '.con-parl__gov', '.con-parl__voting', '.con-parl__parties', '.con-parl__agenda'];

/** Transform-free boxes of every layout-bearing block of the overview, keyed by a stable id. */
async function layoutSnapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((blocks) => {
    const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
    const box = (el: HTMLElement) => ({x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight});
    const root = document.querySelector<HTMLElement>('.con-parl');
    if (root === null) {
      return out;
    }
    for (const sel of blocks) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el !== null) {
        out[sel] = box(el);
      }
    }
    root.querySelectorAll<HTMLElement>('.con-parl__party').forEach((el, i) => {
      const id = el.getAttribute('data-party') ?? String(i);
      out[`party:${id}`] = box(el);
      const plaque = el.querySelector<HTMLElement>('.con-pseal');
      if (plaque !== null) {
        out[`party:${id}:plaque`] = box(plaque);
      }
      const state = el.querySelector<HTMLElement>('.con-pseal__state');
      out[`party:${id}:state`] = state === null ? {x: 0, y: 0, w: 0, h: 0} : box(state);
    });
    root.querySelectorAll<HTMLElement>('.con-parl__slot').forEach((el, i) => {
      out[`slot:${el.getAttribute('data-instance') ?? i}`] = box(el);
    });
    return out;
  }, BLOCKS);
}

function diff(before: Snapshot, after: Snapshot, slackPx = 1): Array<string> {
  const out: Array<string> = [];
  for (const key of Object.keys(before)) {
    const a = before[key];
    const b = after[key];
    if (b === undefined) {
      out.push(`${key}: gone`);
      continue;
    }
    const moved = (['x', 'y', 'w', 'h'] as const).filter((k) => Math.abs(a[k] - b[k]) > slackPx);
    if (moved.length > 0) {
      out.push(`${key}: ${moved.map((k) => `${k} ${a[k]}→${b[k]}`).join(', ')}`);
    }
  }
  for (const key of Object.keys(after)) {
    if (before[key] === undefined) {
      out.push(`${key}: appeared`);
    }
  }
  return out;
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`parliament stability (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('the d-pad walk over the overview moves the cursor and nothing else', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-dense', {query: preset.query, landing: 'board'});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      const parties = await parliament(page).locator('.con-parl__party').count();
      expect(parties, 'six party tiles').toBe(6);

      // The chassis law first: every tile and every state row the same height, before anything moves.
      const base = await layoutSnapshot(page);
      const tileHeights = new Set(Object.keys(base).filter((k) => /^party:[^:]+$/.test(k)).map((k) => base[k].h));
      const stateHeights = new Set(Object.keys(base).filter((k) => /:state$/.test(k)).map((k) => base[k].h));
      expect(Array.from(tileHeights), `${preset.id}: the six tiles share one height`).toHaveLength(1);
      expect(Array.from(stateHeights), `${preset.id}: the six state rows share one height (a caption is reserved on every tile)`).toHaveLength(1);
      expect(Math.min(...Array.from(stateHeights)), `${preset.id}: the state row is reserved, not collapsed`).toBeGreaterThan(0);

      // Then the walk: parties → across all six and back → voting → across the slots → government.
      const trail: Array<string> = [];
      const check = async (step: string) => {
        const now = await layoutSnapshot(page);
        const moved = diff(base, now);
        trail.push(`${step}: zone=${await parliamentZone(page)} moved=${moved.length}`);
        expect(moved, `${preset.id} · after ${step} — nothing but the cursor moved\n${trail.join('\n')}`).toEqual([]);
      };
      await focusParliamentZone(page, 'parties');
      await check('focus parties');
      for (let i = 0; i < 7; i++) {
        await press(page, 'ArrowRight', 350);
        await check(`parties → ${i + 1}`);
      }
      for (let i = 0; i < 2; i++) {
        await press(page, 'ArrowLeft', 350);
        await check(`parties ← ${i + 1}`);
      }
      await focusParliamentZone(page, 'voting');
      await check('focus voting');
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowRight', 350);
        await check(`voting → ${i + 1}`);
      }
      await focusParliamentZone(page, 'government');
      await check('focus government');
      await focusParliamentZone(page, 'parties');
      await check('back to parties');
    });
  });
}
