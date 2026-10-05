import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, settle} from './consoleStart';
import {ColonyName} from '../../src/common/colonies/ColonyName';

/**
 * THE COLONY TILE'S TWO CELLS READ WHOLE — every colony × every marker position × three profiles (PL-006).
 *
 * A tile's trade cell is «ТОРГОВАТЬ [value]» and its bonus cell «БОНУС [value]», each one line in a fixed box. The
 * value never yields (a cut glyph is a lie about the reward); the label may only yield by an ellipsis in its OWN box —
 * and on the TV it always did: the profile's type floor (0.8rem) makes the label 39 % larger against a tile that is the
 * same relative size, so «ТОРГОВАТЬ» read «ТОРГОВ…» on EVERY tile at 4K (and on Luna / Io beside «17 +4» at 1080).
 *
 * A CORPUS, not a sample: the label's room is what the VALUE leaves, and the value changes with the marker (one digit
 * or two, a levy, a composite «[Venus] + 2 [floaters]»), so every colony the game knows is laid out at every one of
 * the seven positions, seven tiles at a time (the densest table) with the «ПРИЧАЛЫ» column standing (the narrowest
 * grid). Claims: every label WHOLE (its text fits its own box), every value INSIDE its cell. Failures name the colony,
 * the position, the cell and the shortfall in px.
 *
 * Fixture `aurora-station` (it carries a dock: the column stands). Heavy on 4K: `--workers=1`.
 */

const PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

// Every tile the server can deal (`ColonyManifest`) — Leavitt II is named but not registered there (its row is
// commented out), so a save cannot hold it.
const UNREGISTERED: ReadonlyArray<string> = [ColonyName.LEAVITT_II];
const ALL = (Object.values(ColonyName) as Array<string>).filter((name) => !UNREGISTERED.includes(name));
const GROUP = 7;
const GROUPS: Array<Array<string>> = [];
for (let i = 0; i < ALL.length; i += GROUP) {
  const group = ALL.slice(i, i + GROUP);
  // The last group is filled to the densest table with colonies already measured (the layout is the claim's subject).
  for (let k = 0; group.length < GROUP; k++) {
    group.push(ALL[k]);
  }
  GROUPS.push(group);
}
const POSITIONS = [0, 1, 2, 3, 4, 5, 6];
const OUT = path.resolve('screenshots', 'colony-tile-labels');

type Cell = {colony: string, cell: string, label: string, short: number, slack: number, valueInside: boolean};

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect(colonies, 'the colonies workspace opened').toHaveCount(1, {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
}

/** Every cell of every tile: the label's shortfall (scroll − client, px) and whether the value stands inside its cell. */
const readCells = (page: Page): Promise<Array<Cell>> => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-colonies .con-coltile')).flatMap((tile) => {
  const colony = (tile.getAttribute('data-test') ?? tile.querySelector('[data-test^="con-colony-"]')?.getAttribute('data-test') ?? '').replace('con-colony-', '');
  return Array.from(tile.querySelectorAll<HTMLElement>('.con-coltile__cell')).map((cell, i) => {
    const label = cell.querySelector<HTMLElement>('.con-coltile__cell-label');
    const value = cell.querySelector<HTMLElement>('.con-coltile__cell-value')?.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    // The text's own laid-out width (a Range ignores the ellipsis clip) against the label's box — the log's margin.
    const range = document.createRange();
    if (label !== null) {
      range.selectNodeContents(label);
    }
    const ink = label === null ? 0 : range.getBoundingClientRect().width;
    return {
      colony,
      cell: i === 0 ? 'trade' : 'bonus',
      label: (label?.textContent ?? '').trim(),
      short: label === null ? 0 : Math.max(0, label.scrollWidth - label.clientWidth),
      slack: label === null ? 0 : Math.round((label.clientWidth - ink) * 10) / 10,
      valueInside: value === undefined || value.width === 0 || (value.left >= box.left - 0.5 && value.right <= box.right + 0.5),
    };
  });
}));

for (const profile of PROFILES) {
  test.describe(`colony tile cells read whole · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});
    for (let g = 0; g < GROUPS.length; g++) {
      test(`group ${g + 1}: ${GROUPS[g].join(', ')}`, async ({page, request}) => {
        test.setTimeout(600_000);
        const failures: Array<string> = [];
        let measured = 0;
        let tightest = Infinity;
        for (const position of POSITIONS) {
          await bootFixtureSeats(page, request, 'aurora-station', {
            query: profile.query,
            arrange: (serialized) => {
              (serialized as unknown as {colonies: Array<unknown>}).colonies = GROUPS[g].map((name) => ({name, colonies: [], isActive: true, trackPosition: position}));
            },
          });
          await settle(page, {timeoutMs: 30_000});
          await openColonies(page);
          console.log(`[${profile.id}] group ${g + 1} @${position}: the table stands`);
          const cells = await readCells(page);
          expect(cells.length, `the table laid out ${GROUP} tiles (two cells each) at position ${position}`).toBe(GROUP * 2);
          for (const c of cells) {
            measured++;
            if (c.short > 0) {
              failures.push(`${c.colony} @${position} ${c.cell}: «${c.label}» short by ${c.short} px`);
            }
            if (!c.valueInside) {
              failures.push(`${c.colony} @${position} ${c.cell}: the value sticks out of its cell`);
            }
          }
          tightest = Math.min(tightest, ...cells.map((c) => c.slack));
          if (position === 0 || position === 6) {
            fs.mkdirSync(OUT, {recursive: true});
            await page.screenshot({path: path.join(OUT, `${profile.id}-g${g + 1}-p${position}.png`)});
          }
        }
        console.log(`[${profile.id}] group ${g + 1}: ${measured} cells measured, ${failures.length} failures, tightest label slack ${tightest} px`);
        expect(measured, 'anti-vacuous: every cell of every position was measured').toBe(GROUP * 2 * POSITIONS.length);
        expect(failures, `every label whole and every value inside its cell:\n${failures.join('\n')}`).toEqual([]);
      });
    }
  });
}
