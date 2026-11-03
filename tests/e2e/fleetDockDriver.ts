import {expect, Page} from './consoleTest';
import {press} from './consoleStart';

/*
 * THE DOCK-CELL DRIVER — the fleet docks as CELLS of the colony grid (ledger EZ, the owner 2026-11-03: «логично по
 * 3 в 2 ряда — во втором ряду 2 колонии и 1 причал»): the colonies and the docks are ONE grid, the docks LAST in
 * reading order, ONE tile size, and the d-pad walks ONE slot index over them. ▶ walks the reading order (the grid's
 * own step carries on into the next row), so «into the docks» is ▶ until the cursor stands on a dock and «back» is
 * ◀ off the first dock onto the last colony — every spec asks the driver, never a literal arrow count.
 */

/** The keys of the one walk: ▶ the next cell in reading order (the docks come after every colony), ◀ the previous. */
export const DOCK_WALK = {next: 'ArrowRight', prev: 'ArrowLeft'} as const;

/** The dock the cursor stands on ('' while it is on a colony). */
export const focusedDock = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector('.con-colonies__dockslot--focused [data-fleet-dock]')?.getAttribute('data-fleet-dock') ?? '');

/** Walk onto the first dock cell — ▶ in reading order, one press at a time, each verified by the cursor itself. */
export async function enterDocks(page: Page): Promise<void> {
  for (let i = 0; i < 12 && await focusedDock(page) === ''; i++) {
    await press(page, DOCK_WALK.next, 350);
  }
  expect(await focusedDock(page), 'the cursor stands on a dock cell').not.toBe('');
}

/** Stand on `card` (walking onto the docks first). */
export async function focusDockCard(page: Page, card: string): Promise<void> {
  await enterDocks(page);
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, DOCK_WALK.next, 350);
  }
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, DOCK_WALK.prev, 350);
  }
  expect(await focusedDock(page), `the cursor stands on «${card}»`).toBe(card);
}

/**
 * The docks' status strips as PAINTED: each strip against its own TILE (the strip stands in the track's place — the
 * line is the tile's, and nothing outside the tile may cut it), the word against its own box (PL-016).
 */
export const dockStatusLines = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__grid .con-fleetdock-tile')).map((tile) => {
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

/** The colony tiles' and the dock tiles' painted sizes — ONE size for the whole grid (one fit, one scale). */
export const tileSizes = (page: Page) => page.evaluate(() => {
  const size = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
  return {colonies: size('.con-colonies__grid .con-colonies__slot .con-coltile'), docks: size('.con-colonies__grid .con-coltile--dock')};
});

/**
 * THE DOCKS ARE CELLS OF THE GRID: every dock tile lies inside the colonies' browse layer, inside the grid's own box,
 * and AFTER every colony in reading order (a later row, or the same row further right) — and `rows` is the grid's
 * row composition as painted (cells per row, top to bottom: 5 colonies + 1 dock = [3, 3]).
 */
export const docksInGrid = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('.con-colonies__grid')?.getBoundingClientRect();
  const layer = document.querySelector('.con-colonies__browse')?.getBoundingClientRect();
  const rectsOf = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => el.getBoundingClientRect());
  const colonies = rectsOf('.con-colonies__grid > .con-colonies__slot');
  const docks = rectsOf('.con-colonies__grid > .con-colonies__dockslot');
  if (grid === undefined || layer === undefined || docks.length === 0) {
    return {measured: false, inside: false, last: false, rows: [] as Array<number>};
  }
  const within = (r: DOMRect, box: DOMRect) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
  const inside = docks.every((r) => within(r, layer) && within(r, grid));
  // Reading order: a row is a band of cells sharing a top (± 2 px).
  const after = (a: DOMRect, b: DOMRect) => a.top > b.top + 2 || (Math.abs(a.top - b.top) <= 2 && a.left >= b.right - 0.5);
  const last = docks.every((d) => colonies.every((c) => after(d, c)));
  const tops: Array<number> = [];
  for (const r of [...colonies, ...docks]) {
    if (!tops.some((t) => Math.abs(t - r.top) <= 2)) {
      tops.push(r.top);
    }
  }
  tops.sort((a, b) => a - b);
  const rows = tops.map((t) => [...colonies, ...docks].filter((r) => Math.abs(r.top - t) <= 2).length);
  return {measured: true, inside, last, rows};
});
