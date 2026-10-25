import {expect, Page} from './consoleTest';
import {press} from './consoleStart';

/*
 * THE «ПРИЧАЛЫ» DRIVER — the fleet docks as TILES of the colony family
 * (the owner's 2026-10-25 iteration): the group stands a step apart from the
 * colony grid, as a COLUMN right of it or a ROW under it — whichever the
 * section's fit solved (`[data-docks-placement]`). The d-pad walks the group
 * along that axis, so every spec asks the driver, never a literal arrow.
 */

export type DockPlacement = 'side' | 'below';

/** Where the group stands right now. */
export const docksPlacement = async (page: Page): Promise<DockPlacement> =>
  await page.evaluate(() => document.querySelector('.con-colonies__docks')?.getAttribute('data-docks-placement')) === 'below' ? 'below' : 'side';

/** The keys of the group's geometry: INTO it from the grid, BACK to the grid, and ALONG it (next / previous). */
export async function dockKeys(page: Page): Promise<{into: string, back: string, next: string, prev: string}> {
  return await docksPlacement(page) === 'below' ?
    {into: 'ArrowDown', back: 'ArrowUp', next: 'ArrowRight', prev: 'ArrowLeft'} :
    {into: 'ArrowRight', back: 'ArrowLeft', next: 'ArrowDown', prev: 'ArrowUp'};
}

/** The dock the cursor stands on ('' while it is in the grid). */
export const focusedDock = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector('.con-colonies__dockslot--focused [data-fleet-dock]')?.getAttribute('data-fleet-dock') ?? '');

/** Walk INTO the group — one press at a time, each verified by the cursor itself. */
export async function enterDocks(page: Page): Promise<void> {
  const {into} = await dockKeys(page);
  for (let i = 0; i < 6 && await focusedDock(page) === ''; i++) {
    await press(page, into, 350);
  }
  expect(await focusedDock(page), 'the cursor stands in the docks group').not.toBe('');
}

/** Stand on `card` in the group (entering it first). */
export async function focusDockCard(page: Page, card: string): Promise<void> {
  await enterDocks(page);
  const {next, prev} = await dockKeys(page);
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, next, 350);
  }
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, prev, 350);
  }
  expect(await focusedDock(page), `the cursor stands on «${card}»`).toBe(card);
}

/**
 * The docks' status lines as PAINTED: each line against its own TILE (a dock is a tile now — the line is the tile's,
 * and nothing outside the tile may cut it), the text against its own box (PL-016).
 */
export const dockStatusLines = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__docks .con-fleetdock-tile')).map((tile) => {
    const box = tile.getBoundingClientRect();
    const pill = tile.querySelector<HTMLElement>('.con-fleetdock-tile__status');
    const r = pill?.getBoundingClientRect();
    const text = pill?.querySelector<HTMLElement>('.con-fleetdock-tile__status-text') ?? null;
    return {
      text: (text?.textContent ?? '').trim(),
      insideTile: r !== undefined && r.width > 0 && r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.bottom <= box.bottom + 0.5,
      whole: text !== null && text.scrollWidth <= text.clientWidth + 1,
    };
  }));

/** The colony tiles' and the dock tiles' painted sizes — ONE size for the whole surface (`planDockFit`). */
export const tileSizes = (page: Page) => page.evaluate(() => {
  const size = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
  return {colonies: size('.con-colonies__grid .con-coltile'), docks: size('.con-colonies__docks .con-coltile')};
});

/** Every tile of the group lies inside the colonies' browse layer and clear of the colony grid (a step apart). */
export const docksApart = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('.con-colonies__grid')?.getBoundingClientRect();
  const layer = document.querySelector('.con-colonies__browse')?.getBoundingClientRect();
  const tiles = Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__docks .con-coltile')).map((el) => el.getBoundingClientRect());
  if (grid === undefined || layer === undefined || tiles.length === 0) {
    return {measured: false, inside: false, clear: false};
  }
  const inside = tiles.every((r) => r.left >= layer.left - 0.5 && r.right <= layer.right + 0.5 && r.top >= layer.top - 0.5 && r.bottom <= layer.bottom + 0.5);
  const clear = tiles.every((r) => r.left >= grid.right - 0.5 || r.top >= grid.bottom - 0.5);
  return {measured: true, inside, clear};
});
