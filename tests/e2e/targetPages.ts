import {expect, Page} from './consoleTest';
import {press} from './consoleStart';

/**
 * EVERY PAGE OF THE TARGET SELECTOR (ledger ET — the owner, 2026-11-02: a set the readable floor cannot hold whole is
 * PAGED, never shrunk, never scrolled). `read` runs on each page in turn — RB (`KeyE`) between pages, the page
 * position (`[data-ptsel-pages]`) the witness of each turn — and the selector is left on its FIRST page again (LB,
 * `KeyQ`). A set that stands whole is one page: `read` runs once and nothing is pressed.
 *
 * For a band the bumpers turn (one band, or the split); a board of several bands walks its owners with LB/RB instead.
 */
export async function acrossTargetPages<T>(page: Page, read: () => Promise<ReadonlyArray<T>>, root = '.con-ptsel'): Promise<Array<T>> {
  const pages = page.locator(`${root} [data-ptsel-pages]`).first();
  const count = (await pages.count()) === 0 ? 1 : Number(await pages.getAttribute('data-ptsel-page-count') ?? '1');
  const out: Array<T> = [];
  for (let p = 1; p <= count; p++) {
    if (p > 1) {
      await press(page, 'KeyE', 400);
      await expect(pages, `RB turned to page ${p} of ${count}`).toHaveAttribute('data-ptsel-page', String(p));
    }
    out.push(...await read());
  }
  for (let p = count; p > 1; p--) {
    await press(page, 'KeyQ', 400);
  }
  if (count > 1) {
    await expect(pages, 'back on the first page').toHaveAttribute('data-ptsel-page', '1');
  }
  return out;
}
