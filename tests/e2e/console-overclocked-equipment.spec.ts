/*
 * TR54 OVERCLOCKED EQUIPMENT («Разогнанное оборудование») + THE ITERATION «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»
 * (`docs/TURMOIL_REDUX_OVERCLOCKED_EQUIPMENT.md`) — fhd + tv4k:
 *
 *   A · `overclocked-equipment` — the play composer asks «which resource» as ONE palette: six tiles in ONE row (one
 *       `offsetTop`, nothing cut, the group inside its column), each led by its resource's own sprite (the hero ≥ the
 *       reading chip's icon by a step) and the number; titanium and M€ QUIET (production 0 / −1 — never refused, never
 *       hidden: six radios); ←→ walk the row (`data-variant-axis="row"`), A SEALS the tile the cursor stands on (the
 *       cursor is not the answer), the decision column does not move. The commit: «−3 [energy]» is born on the rail's
 *       energy row and absorbed by the face's printed «−3 [energy]» before the lift (PL-107); the chosen resource's
 *       «+N» is born on the face's printed «?» (`wild`) and lands on its rail row (PL-094); `endsOverGlass` empty. The
 *       server: energy 5 → 2, plants +3.
 *   A′ — the same hand, energy chosen: ONE row, two tokens in the order of their causes (−3 before +1), 5 → 2 → 3.
 *   B · `overclocked-equipment-locked` — the Reds rule: «✕», the party named.
 *   B′ · `overclocked-equipment-energy` — 2 energy: «✕», ONE blocker — the energy.
 *
 * Frames: `screenshots/tr54/{fhd,tv4k}/`. 4K timing claims: `TM_E2E_GPU=1`, `--workers=1`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness, TransferWitness} from './transferWitness';
import {storyboard} from './consoleEndgameHarness';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const TR54 = 'Overclocked Equipment';
const OUT = path.resolve('screenshots', 'tr54');
const PALETTE = '.con-composer--play .con-vchoice--palette';

type Wire = {
  thisPlayer: {energy: number, plants: number, steel: number, tableau: Array<{name: string}>},
};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await serverModel(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached «${what}» — energy ${last?.thisPlayer.energy}, plants ${last?.thisPlayer.plants}`);
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `${name}.png`)});
}

/** Open the hand (RT wheel → centre), focus TR54, A → the play composer. */
async function openComposer(page: Page): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, TR54, Math.max(14, slots * 3)), 'the cursor stands on TR54').toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  // THE HAND PLATE reads the choice's CEILING on the printed «?» (decision 7 — PL-456): heat's production 4.
  const plate = page.locator('.con-hand [data-hand-count="4"]');
  await expect(plate, 'the plate «[?] до +4»').toHaveCount(1);
  await expect(plate).toContainText(/до\s*\+4/);
  await expect(plate.locator('.resource_icon--wild'), 'on the printed «?»').toHaveCount(1);
  await pressUntil(page, 'Enter', async () => await page.locator(PALETTE).count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

type PaletteRead = {
  tiles: Array<{resource: string, offsetTop: number, top: number, left: number, right: number, bottom: number, quiet: boolean, off: boolean, focused: boolean, selected: boolean, figure: string, hero: number}>,
  group: {left: number, right: number, top: number, bottom: number},
  column: {left: number, right: number, top: number, bottom: number},
  chipIcon: number,
  /** Every tile's reading chip stands inside its tile (nothing cut, nothing over a neighbour). */
  chipsInside: boolean,
  axis: string,
  kicker: string,
  emblem: boolean,
  medals: number,
  radios: number,
};

async function readPalette(page: Page): Promise<PaletteRead> {
  return page.evaluate((sel) => {
    const group = document.querySelector<HTMLElement>(sel)!;
    const box = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return {left: r?.left ?? 0, right: r?.right ?? 0, top: r?.top ?? 0, bottom: r?.bottom ?? 0};
    };
    const tiles = Array.from(group.querySelectorAll<HTMLElement>('.con-vchoice__opt')).map((el) => ({
      resource: el.getAttribute('data-palette-resource') ?? '',
      ...box(el),
      offsetTop: el.offsetTop,
      quiet: el.classList.contains('con-vchoice__opt--quiet'),
      off: el.classList.contains('con-vchoice__opt--off'),
      focused: el.classList.contains('con-vchoice__opt--focused'),
      selected: el.classList.contains('con-vchoice__opt--selected'),
      figure: el.querySelector('[data-vchoice-figure]')?.textContent?.trim() ?? '',
      hero: el.querySelector('.con-vchoice__heroicon')?.getBoundingClientRect().width ?? 0,
    }));
    // The reading is the pool alone (the chip's icon is hidden — the hero is the resource): its BOX is the step below.
    const chip = group.querySelector('.action-effect-chip')?.getBoundingClientRect().height ?? 0;
    const chipsInside = Array.from(group.querySelectorAll<HTMLElement>('.con-vchoice__opt')).every((tile) => {
      const t = tile.getBoundingClientRect();
      return Array.from(tile.querySelectorAll('.action-effect-chip')).every((c) => {
        const r = c.getBoundingClientRect();
        return r.left >= t.left - 1 && r.right <= t.right + 1;
      });
    });
    const column = group.closest('.con-composer__resulthero') ?? group.parentElement;
    return {
      tiles,
      group: box(group),
      column: box(column),
      chipIcon: chip,
      chipsInside,
      axis: group.getAttribute('data-variant-axis') ?? '',
      kicker: group.querySelector('[data-vchoice-kicker]')?.textContent?.trim() ?? '',
      emblem: group.querySelector('[data-vchoice-emblem="wild"]') !== null,
      medals: group.querySelectorAll('.con-vchoice__or').length,
      radios: group.querySelectorAll('[role="radio"]').length,
    };
  }, PALETTE);
}

/** The resource the palette's cursor stands on. */
async function focusedResource(page: Page): Promise<string> {
  return page.evaluate((sel) => document.querySelector(`${sel} .con-vchoice__opt--focused`)?.getAttribute('data-palette-resource') ?? '', PALETTE);
}

/** Walk the palette's row with → until the cursor stands on `resource` (the row wraps; never a counted guess). */
async function walkTo(page: Page, resource: string): Promise<void> {
  for (let i = 0; i < 8 && (await focusedResource(page)) !== resource; i++) {
    await press(page, 'ArrowRight', 250);
  }
  expect(await focusedResource(page), `the cursor stands on ${resource}`).toBe(resource);
}

/** A seals the focused tile; then ↓ to the commit row and A — the play's one POST. */
async function sealAndCommit(page: Page, resource: string): Promise<{groupTopBefore: number, groupTopAfter: number}> {
  const groupTop = () => page.evaluate((sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1, PALETTE);
  const groupTopBefore = await groupTop();
  await press(page, 'Enter', 500);
  const sealed = await page.evaluate((sel) => document.querySelector(`${sel} .con-vchoice__opt--selected`)?.getAttribute('data-palette-resource') ?? '', PALETTE);
  expect(sealed, 'A seals the tile the cursor stands on').toBe(resource);
  const groupTopAfter = await groupTop();
  const cta = page.locator('.con-composer--play .con-composer__cta--focused');
  for (let i = 0; i < 8 && await cta.count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  await expect(cta, 'the cursor reached the commit row').toHaveCount(1);
  return {groupTopBefore, groupTopAfter};
}

const value = (v: string) => v.replace(/\s+/g, '');
const birthOf = (w: TransferWitness, signed: string) => w.births.find((b) => value(b.value).startsWith(signed));
const landingOf = (w: TransferWitness, id: number) => w.landings.find((l) => l.id === id);

for (const preset of PROFILES) {
  test.describe(`TR54 · the standard-resource palette · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the play's palette: one row of six, the quiet zeros, ←→, the seal; the commit's two tokens (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'overclocked-equipment', {query: preset.query});
      const before = await serverModel(request, playerId);
      await openComposer(page);
      await shot(page, preset.id, 'A-1-palette');

      const p = await readPalette(page);
      console.log(`[tr54 ${preset.id}] kicker «${p.kicker}»`);
      expect(p.radios, 'six radios — the zeros stand').toBe(6);
      expect(p.tiles.map((t) => t.resource)).toEqual(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
      expect(new Set(p.tiles.map((t) => t.offsetTop)).size, `one row — ${JSON.stringify(p.tiles.map((t) => t.offsetTop))}`).toBe(1);
      expect(p.axis, 'the group walks as a row').toBe('row');
      expect(p.medals, 'no «ИЛИ» medallion in a palette').toBe(0);
      expect(p.emblem, 'the printed «?» on the kicker').toBe(true);
      expect(p.kicker.length).toBeGreaterThan(0);
      expect(p.tiles.map((t) => t.figure)).toEqual(['0', '+2', '0', '+3', '+1', '+4']);
      expect(p.tiles.map((t) => t.quiet)).toEqual([true, false, true, false, false, false]);
      expect(p.tiles.some((t) => t.off), 'a zero is never refused').toBe(false);
      for (const t of p.tiles) {
        expect(t.left, `${t.resource} inside its group`).toBeGreaterThanOrEqual(p.group.left - 1);
        expect(t.right, `${t.resource} inside its group`).toBeLessThanOrEqual(p.group.right + 1);
      }
      expect(Math.min(...p.tiles.map((t) => t.hero)), `the hero (${p.tiles.map((t) => t.hero)}) ≥ the reading chip (${p.chipIcon}) by a step`)
        .toBeGreaterThanOrEqual(p.chipIcon * 1.25);
      expect(p.chipsInside, 'every reading stands inside its tile').toBe(true);
      console.log(`[tr54 ${preset.id}] group ${Math.round(p.group.right - p.group.left)} × ${Math.round(p.group.bottom - p.group.top)} · column ${Math.round(p.column.right - p.column.left)} · hero ${p.tiles[1].hero} · chip ${p.chipIcon}`);

      // ── ←→ walk the row (it wraps), the cursor is not the answer, A seals, the column does not move. ──
      expect(await focusedResource(page), 'the cursor opens on the first tile').toBe('megacredits');
      expect(p.tiles.some((t) => t.selected), 'nothing is chosen before a press').toBe(false);
      await press(page, 'ArrowLeft', 250);
      expect(await focusedResource(page), '← from the first tile wraps to the last').toBe('heat');
      await walkTo(page, 'plants');
      expect(await page.locator(`${PALETTE} .con-vchoice__opt--selected`).count(), 'walking selects nothing').toBe(0);
      const {groupTopBefore, groupTopAfter} = await sealAndCommit(page, 'plants');
      expect(Math.abs(groupTopAfter - groupTopBefore), `the decision column settles — the row did not move (${groupTopBefore} → ${groupTopAfter})`).toBeLessThanOrEqual(2);
      await shot(page, preset.id, 'A-2-sealed');

      // ── THE COMMIT: «−3 [energy]» off the rail before the lift (PL-107), «+3 [plants]» born on the printed «?». ──
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'commit-plants');
      await press(page, 'Enter', 400);
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === TR54), 'TR54 on the table');
      expect(after.thisPlayer.energy, 'the server: 5 energy − 3').toBe(before.thisPlayer.energy - 3);
      expect(after.thisPlayer.plants - before.thisPlayer.plants, 'the server: +3 plants (the production)').toBe(3);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      await shot(page, preset.id, 'A-3-after');
      const w = await transferWitness(page);
      const price = birthOf(w, '−3') ?? birthOf(w, '-3');
      expect(price, `the price token was born — ${transferTrail(w)}`).toBeDefined();
      expect(price!.under, `the price is born on the rail's energy row — ${transferTrail(w)}`).toBe('rail:energy');
      const gain = birthOf(w, '+3');
      expect(gain, `the plants token was born — ${transferTrail(w)}`).toBeDefined();
      expect(gain!.under, `the chosen resource is born on the printed «?» — ${transferTrail(w)}`).toBe('wild');
      expect(gain!.t, 'the price leaves before the gain is born').toBeGreaterThan(price!.t);
      expect(landingOf(w, gain!.id)?.under, `the plants token lands on its rail row — ${transferTrail(w)}`).toBe('rail:plants');
      expect(endsOverGlass(w), transferTrail(w)).toEqual([]);
    });

    test(`A′ · energy chosen: ONE row, two tokens in the order of their causes — −3 before the lift, +1 after the landing (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'overclocked-equipment', {query: preset.query});
      const before = await serverModel(request, playerId);
      await openComposer(page);
      await walkTo(page, 'energy');
      await sealAndCommit(page, 'energy');
      // The energy row's own number on the page's clock: 5 → 2 on the price's departure, → 3 on the gain's touchdown.
      await page.evaluate(() => {
        const out: Array<string> = [];
        const read = () => (document.querySelector('.con-res .con-res__row--energy .con-res__digits')?.textContent?.match(/^-?\d+/) ?? [''])[0];
        const sample = () => {
          const v = read();
          if (v !== '' && v !== out[out.length - 1]) {
            out.push(v);
          }
        };
        const timer = window.setInterval(sample, 16);
        const mo = new MutationObserver(sample);
        mo.observe(document.body, {subtree: true, childList: true, characterData: true});
        sample();
        (window as unknown as {__energy: {out: Array<string>, stop: () => void}}).__energy = {out, stop: () => {
          window.clearInterval(timer);
          mo.disconnect();
        }};
      });
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'commit-energy');
      await press(page, 'Enter', 400);
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === TR54), 'TR54 on the table');
      expect(after.thisPlayer.energy, 'the server: 5 − 3 + 1').toBe(before.thisPlayer.energy - 3 + 1);
      await settle(page, {timeoutMs: 30_000});
      await stop();
      await shot(page, preset.id, 'Aprime-after');
      const energy = await page.evaluate(() => {
        const e = (window as unknown as {__energy: {out: Array<string>, stop: () => void}}).__energy;
        e.stop();
        return e.out;
      });
      expect(energy, `the energy row reads 5 → 2 → 3, never a netted 5 → 3: ${JSON.stringify(energy)}`).toEqual(['5', '2', '3']);
      const w = await transferWitness(page);
      const price = birthOf(w, '−3') ?? birthOf(w, '-3');
      const gain = birthOf(w, '+1');
      expect(price?.under, `the price is born on the energy row — ${transferTrail(w)}`).toBe('rail:energy');
      expect(gain?.under, `the +1 is born on the printed «?» — ${transferTrail(w)}`).toBe('wild');
      expect(gain!.t, 'the gain is born after the price').toBeGreaterThan(price!.t);
      expect(landingOf(w, gain!.id)?.under, `the +1 lands on the energy row — ${transferTrail(w)}`).toBe('rail:energy');
      expect(endsOverGlass(w), transferTrail(w)).toEqual([]);
    });

    for (const [fixture, why] of [['overclocked-equipment-locked', 'the party'], ['overclocked-equipment-energy', 'the energy']] as const) {
      test(`B · ${fixture}: «✕», ONE blocker — ${why} (${preset.id})`, async ({page, request}) => {
        test.setTimeout(180_000);
        await bootFixtureSeats(page, request, fixture, {query: preset.query});
        await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
        await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
        expect(await focusCard(page, TR54, 12), 'TR54 focused in the hand').toBe(true);
        const verdict = page.locator('.con-hand__verdictbar');
        await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
        await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
        // A refusal speaks first: an unplayable card wears no forecast plate.
        await expect(page.locator('.con-hand [data-hand-count]'), 'no plate over a refusal').toHaveCount(0);
        if (fixture === 'overclocked-equipment-locked') {
          await expect(verdict, 'the count of your delegates on the party').toContainText('0/2');
        } else {
          await expect(verdict, 'the one blocker is the energy').toContainText(/энерги/i);
        }
        await shot(page, preset.id, fixture === 'overclocked-equipment-locked' ? 'B-locked' : 'Bprime-energy');
      });
    }
  });
}

// ── THE DECK (regression — PL-105's profile): the same palette on the handheld's 800-tall band — nothing cut, the tiles
//    either one row or the 3 + 3 fold (never 5 + 1), a folded palette walks as a GRID (←→ in its row, ↓ to the row below). ──
test.describe('TR54 · the standard-resource palette · deck', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the palette on the Deck: whole, one row or 3 + 3, the grid walk', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'overclocked-equipment', {query: '&consoleProfile=handheld'});
    await openComposer(page);
    await shot(page, 'deck', 'A-1-palette');
    const p = await readPalette(page);
    expect(p.radios).toBe(6);
    const perRow = [...p.tiles.reduce((m, t) => m.set(t.offsetTop, (m.get(t.offsetTop) ?? 0) + 1), new Map<number, number>()).values()];
    expect([[6], [3, 3]], `one row or 3 + 3: ${JSON.stringify(perRow)}`).toContainEqual(perRow);
    expect(p.chipsInside, 'every reading stands inside its tile').toBe(true);
    for (const t of p.tiles) {
      expect(t.bottom, `${t.resource} inside the viewport`).toBeLessThanOrEqual(800);
    }
    if (perRow.length === 2) {
      expect(p.axis, 'a folded palette walks as a grid').toBe('grid');
      expect(await focusedResource(page)).toBe('megacredits');
      await press(page, 'ArrowDown', 250);
      expect(await focusedResource(page), '↓ to the same column of the row below').toBe('plants');
      await press(page, 'ArrowRight', 250);
      expect(await focusedResource(page), '→ along that row').toBe('energy');
    } else {
      expect(p.axis).toBe('row');
    }
  });
});
