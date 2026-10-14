import {expect, Page} from '@playwright/test';

/**
 * THE SEE-THROUGH's witness («ПРОСВЕТ», Turmoil Redux TR47 — the owner's
 * accent of 2026-10-14: «when hovering, the tile becomes transparent and the
 * player sees WHAT is under it»). ONE reader for every picker that lifts a
 * piece — an ocean removal (RX33 Water Export, the Reds, TR47), a move's
 * SOURCE level (TR39's ocean, TR14's city), a remove-and-replace (Kaguya
 * Tech), the water out from under a TR44 city — so the five neighbours and
 * the card's own spec read the field and the dossier through the same words,
 * and a change of the hook fails them together (invariant 14).
 *
 * What it reads, off the live DOM (never off a probe's memory):
 *   · which piece the focused cell sees through (`board-space--peek-top` /
 *     `board-space--peek-under`), and the PAINTED opacity of the piece that
 *     would leave (the top sprite, or the buried water's tier) against the
 *     piece that stays;
 *   · whether the printed bonus is painted under the translucent tile;
 *   · the reticle's pose (the pickup ring, no ghost projected over a tile);
 *   · the dossier's own section «ОТКРОЕТСЯ» — its rows' titles.
 */
export type PeekRead = {
  /** The piece seen through on the cell — `undefined` when nothing is. */
  peek: 'top' | 'under' | undefined;
  /** The computed opacity of the piece that would LEAVE (the lifted one). */
  liftedOpacity: number | undefined;
  /** The computed opacity of the piece that STAYS (the city over the lifted water). */
  stayOpacity: number | undefined;
  /** The owner cube's opacity, when the cell has one (it goes with its tile). */
  cubeOpacity: number | undefined;
  /** The printed bonus icons in the DOM — painted under the translucent tile. */
  bonusIcons: number;
  /** The reticle wears the pickup ring. */
  reticlePickup: boolean;
  /** A tile ghost is projected over the cell — never on a removal. */
  ghost: boolean;
  /** The dossier's «ОТКРОЕТСЯ» rows — the titles, in order. */
  uncovers: Array<string>;
};

export const readPeek = (page: Page, spaceId: string): Promise<PeekRead> => page.evaluate((id) => {
  const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${id}"]`);
  const opacity = (el: Element | null | undefined): number | undefined =>
    el instanceof HTMLElement ? Number(getComputedStyle(el).opacity) : undefined;
  // The see-through is the cell's `data-peek` ATTRIBUTE (never a class — the board section writes the focus ring
  // and the availability classes imperatively, and a reactive class toggle on the same element wipes them).
  const peekAttr = cell?.dataset.peek;
  const peek = peekAttr === 'under' ? 'under' : peekAttr === 'top' ? 'top' : undefined;
  const top = cell?.querySelector<HTMLElement>('[data-test="tile"]');
  const under = cell?.querySelector<HTMLElement>('.board-stack__tier[data-stack-piece="under"]');
  return {
    peek,
    liftedOpacity: peek === 'under' ? opacity(under) : opacity(top),
    stayOpacity: peek === 'under' ? opacity(top) : undefined,
    cubeOpacity: opacity(cell?.querySelector('.board-owner-cube')),
    bonusIcons: cell?.querySelectorAll('.board-space-bonus').length ?? 0,
    reticlePickup: document.querySelector('.con-bcur--pickup') !== null,
    ghost: document.querySelector('.con-bcur__ghost') !== null,
    uncovers: Array.from(document.querySelectorAll<HTMLElement>('.con-context__sec--uncovers .con-dossier-row__title'))
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
  };
}, spaceId);

/**
 * The see-through stands on `spaceId` for the `piece` that would leave: the
 * lifted piece is painted TRANSLUCENT (the 90 ms class has settled), the
 * staying piece keeps its paint, the reticle wears the pickup ring and projects
 * no ghost. Returns the settled read for the spec's own further claims (the
 * printed bonus, the dossier's words).
 */
export async function expectSeeThrough(page: Page, spaceId: string, piece: 'top' | 'under', why: string,
  opts: {reticle?: 'pickup' | 'projection'} = {}): Promise<PeekRead> {
  await expect.poll(async () => {
    const r = await readPeek(page, spaceId);
    return r.peek === piece && r.liftedOpacity !== undefined && r.liftedOpacity < 0.5 ? 'seen-through' : JSON.stringify(r);
  }, {timeout: 10_000, message: `${why}: the ${piece} piece on ${spaceId} is seen through`}).toBe('seen-through');
  const read = await readPeek(page, spaceId);
  if (piece === 'under') {
    expect(read.stayOpacity, `${why}: the city over the water keeps its paint`).toBe(1);
  } else if (read.cubeOpacity !== undefined) {
    expect(read.cubeOpacity, `${why}: the owner cube goes translucent with its tile`).toBeLessThan(0.5);
  }
  // A pick that only LIFTS (a removal, a move's source) wears the pickup ring and projects nothing over the tile; a
  // remove-and-replace (Kaguya) still PLACES, so the reticle projects the landing tile over the doomed one.
  if ((opts.reticle ?? 'pickup') === 'pickup') {
    expect(read.reticlePickup, `${why}: the reticle wears its pickup pose`).toBe(true);
    expect(read.ghost, `${why}: no ghost of a tile over a tile`).toBe(false);
  } else {
    expect(read.reticlePickup, `${why}: a placement, not a lift — no pickup pose`).toBe(false);
  }
  return read;
}

/** The dossier's «ОТКРОЕТСЯ» section stands and its rows say `expected` (each a pattern over a row's title). */
export async function expectUncovers(page: Page, expected: ReadonlyArray<RegExp>, why: string): Promise<Array<string>> {
  await expect.poll(async () => (await page.locator('.con-context__sec--uncovers .con-dossier-row__title').allTextContents()).length > 0,
    {timeout: 10_000, message: `${why}: the dossier's «ОТКРОЕТСЯ» section stands`}).toBe(true);
  const rows = (await page.locator('.con-context__sec--uncovers .con-dossier-row__title').allTextContents())
    .map((t) => t.replace(/\s+/g, ' ').trim());
  for (const pattern of expected) {
    expect(rows.some((r) => pattern.test(r)), `${why}: a row matching ${pattern} among ${JSON.stringify(rows)}`).toBe(true);
  }
  const head = await page.locator('.con-context__sec--uncovers .con-context__sec-head').first().textContent();
  expect((head ?? '').trim(), `${why}: the section's own head`).toMatch(/Откроется|Uncovers/i);
  return rows;
}
