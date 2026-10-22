import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR61 — CARGO MECHS («Грузовые мехи»): the FIFTH consumer of the repeat mechanism, not a fifth interface.
 *
 * What this pins down on the console:
 *  · «Действия карт» lists the card's TWO printed rows as TWO tiles (the TR51 grammar — the tile IS the printed row,
 *    «Вариант 1 / 2»), and descending into a tile FIXES that variant: A «1 energy → a mech onto ANY card» opens on its
 *    «КУДА» target step (this card included), B «1 mech from here → a used action again» on the REPEAT SLOT;
 *  · A on the slot hands the pick to «ДЕЙСТВИЯ КАРТ» in repeat mode — the SAME surface Viron's road uses: the crumb
 *    stays continuous («ГРУЗОВЫЕ МЕХИ › ПОВТОР ДЕЙСТВИЯ»), the bar's A is «Выбрать», the candidate's own composer
 *    captures the copy, and the source composer comes back PAINTED with the chosen action in its slot;
 *  · the commit runs the copy: the mech leaves this card, the copied action's own effects follow (Restricted Area's
 *    2 M€ and a card), the journal names the copier;
 *  · without a mech here B's tile is refused with its COUNT («0 из 1 меха на этой карте») and A alone is the action;
 *  · Viron and Cargo Mechs stand on one table — both listed, the loop guard's own case.
 */
const OUT = path.resolve('screenshots', 'cargo-mechs', process.env.TM_E2E_SHOTS_TAG ?? '');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const composer = '.con-cardactions .con-composer';
const CARD = 'Cargo Mechs';
const tiles = (page: Page) => page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);

type Wire = {
  thisPlayer: {megacredits: number, energy: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (w: Wire, card: string) => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/** The focused «Действия карт» tile: its card and its printed variant (0 when the card prints one) — the Mining Mechs idiom. */
const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  const variant = (tile?.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\D+/g, '');
  return {card: tile?.getAttribute('data-action-card') ?? '', variant: variant === '' ? 0 : Number(variant)};
});

/**
 * Walk the browse grid to «Cargo Mechs · Вариант N» (1 = the energy row, 2 = the repeat row). The grid is a COLUMN of
 * cards whose printed rows stand SIDE BY SIDE inside the card's row, so the walk has two axes: → inside the row first,
 * ↓ to the next card when → moved nothing. Two consecutive no-moves end it (the Mining Mechs idiom, one axis more).
 */
async function focusVariant(page: Page, variant: number): Promise<void> {
  const where = async () => JSON.stringify(await focusedTile(page));
  const at = async () => {
    const f = await focusedTile(page);
    return f.card === CARD && f.variant === variant;
  };
  const trail: Array<string> = [];
  let stuck = 0;
  for (let i = 0; i < 24 && stuck < 2; i++) {
    if (await at()) {
      return;
    }
    const before = await where();
    trail.push(before);
    await press(page, 'ArrowRight', 260);
    if (await where() !== before) {
      stuck = 0;
      continue;
    }
    await press(page, 'ArrowDown', 260);
    stuck = await where() === before ? stuck + 1 : 0;
  }
  expect(await at(), `never focused «${CARD}» · variant ${variant} (at ${await where()}; trail ${trail.join(' → ')})`).toBe(true);
}

const text = async (page: Page, selector: string) => (await page.locator(selector).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
const focusedRow = (page: Page) => text(page, `${composer} .con-composer__row--focused`);

/** Walk the composer's cursor until `ok` holds (the spaceship-recycling spec's idiom: ↑ / ↓ over the rows, → inside a row group). */
async function walkComposer(page: Page, ok: () => Promise<boolean>, label: string): Promise<void> {
  const inRowGroup = () => page.evaluate(() => document.querySelector('.con-composer__branches[data-variant-axis="row"] .con-vchoice__opt--focused') !== null);
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8; i++) {
      if (await ok()) {
        return;
      }
      if (await inRowGroup()) {
        for (let j = 0; j < 4 && !(await ok()); j++) {
          await press(page, 'ArrowRight', 220);
        }
        if (await ok()) {
          return;
        }
      }
      await press(page, key, 220);
    }
  }
  expect(await ok(), `the composer's cursor never reached ${label} (at «${await focusedRow(page)}»)`).toBe(true);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 10 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

for (const preset of PRESETS) {
  test.describe(`Cargo Mechs · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('B — the repeat: the slot hands the pick to the ONE repeat surface, the source comes back painted, the commit runs the copy', async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId} = await bootFixtureSeats(page, request, 'cargo-mechs', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      // Both copiers stand on the table (the loop guard's own case) and both are listed; the card's two printed rows
      // are two tiles.
      await expect(page.locator('.con-cardactions__tile[data-action-card="Viron"]'), 'Viron listed').toHaveCount(1);
      await expect(tiles(page), 'two tiles — one per printed row').toHaveCount(2);
      await focusVariant(page, 2);
      await shoot(page, preset.id, 'b-01-tiles');
      await openActionFocus(page);
      await settle(page).catch(() => undefined);
      // The variant is FIXED by the tile — the composer asks no outcome tiles, it opens on B's own rows.
      await expect(page.locator(`${composer} .con-composer__branches`), 'no second variant question').toHaveCount(0);
      await shoot(page, preset.id, 'b-02-composer');
      // The REPEAT SLOT of variant B — Viron's own row, empty until chosen.
      await walkComposer(page, async () => /повтора/i.test(await focusedRow(page)), 'the repeat slot');
      await press(page, 'Enter', 2500);
      await expect(page.locator('.con-cardactions'), 'the repeat surface stands up over the source (v-show, never a second instance of it)').toHaveCount(2, {timeout: 10_000});
      const crumb = await crumbText(page);
      expect(crumb, 'the crumb stays continuous: the card, then the stage').toMatch(/ГРУЗОВЫЕ МЕХИ/i);
      expect(crumb).toMatch(/ПОВТОР/i);
      await expect(page.locator('.con-cmdbar'), 'A = «Выбрать», never «Выполнить»').toContainText(/выбрать/i);
      await shoot(page, preset.id, 'b-03-repeat-pick');
      await press(page, 'Enter', 2000); // A = «Выбрать» the (only) candidate — Restricted Area
      await press(page, 'Enter', 2500); // A = «Выбрать это действие» (the candidate composer's CTA)
      await expect(page.locator('.con-cardactions'), 'the pick resolved back to the source').toHaveCount(1, {timeout: 10_000});
      await settle(page).catch(() => undefined);
      await expect(page.locator(`${composer} .con-composer__repeatpick-name`), 'the slot names the chosen action').toContainText(/закрытая зона/i);
      await shoot(page, preset.id, 'b-04-slot-filled');

      const before = await wireOf(request, playerId);
      await armTransferWitness(page);
      await toCommitRow(page);
      await press(page, 'Enter', 400);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Cargo Mechs'), {timeout: 30_000, message: 'the mech paid'}).toBe(0);
      await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'Restricted Area\'s own price was paid by the copy').toBe(before.thisPlayer.megacredits - 2);
      expect((after.cardsInHand ?? []).length, 'Restricted Area\'s own card arrived').toBe((before.cardsInHand ?? []).length + 1);
      const witness = await transferWitness(page);
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, preset.id, 'trail-b-commit.txt'), transferTrail(witness) + '\n');
      expect(endsOverGlass(witness), 'no end of a flight over glass').toEqual([]);
      await shoot(page, preset.id, 'b-05-after');
    });

    test('A — without a mech: B refused with its count, A alone — the mech onto ANY holder, this card included (КУДА)', async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId} = await bootFixtureSeats(page, request, 'cargo-mechs-empty', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      await expect(tiles(page), 'two tiles — one per printed row').toHaveCount(2);
      // B's tile is refused with its COUNT (PL-197) — the browse grid asks the same availability the composer does.
      await expect(tiles(page).nth(1).locator('.con-cardactions__tile-reason'), 'B refused with its count').toContainText(/0 из 1/);
      await expect(tiles(page).nth(0).locator('.con-cardactions__tile-reason'), 'A is live').toHaveCount(0);
      await focusVariant(page, 1);
      await shoot(page, preset.id, 'a-01-tiles-empty');
      await openActionFocus(page);
      await settle(page).catch(() => undefined);
      await expect(page.locator(`${composer} .con-composer__branches`), 'the variant is the tile\'s').toHaveCount(0);
      await shoot(page, preset.id, 'a-02-composer');
      // A's target step — «КУДА»: every own mech holder, this card included.
      await walkComposer(page, async () => /куда/i.test(await focusedRow(page)), 'the target row');
      await press(page, 'Enter', 600);
      await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
      expect(await page.locator('.con-ptsel__cell').count(), 'two holders: this card and Forestry Mechs').toBe(2);
      for (const key of ['ArrowRight', 'ArrowLeft']) {
        for (let i = 0; i < 6 && (await focusedCandidate(page)) !== 'self'; i++) {
          await press(page, key, 220);
        }
      }
      expect(await focusedCandidate(page), 'this card is a legal target of its own mech').toBe('self');
      await shoot(page, preset.id, 'a-03-target');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel')).toHaveCount(0);
      await toCommitRow(page);
      await press(page, 'Enter', 400);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Cargo Mechs'), {timeout: 30_000, message: 'the mech landed here'}).toBe(1);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.energy, 'the energy paid').toBe(0);
      await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
      await shoot(page, preset.id, 'a-04-after');
    });
  });
}
