import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame, createGameWithCards, soloGameConfig} from './consoleStart';

/**
 * THE TWO-PHASE PLACEMENT CONFIRM (placementFlow.ts) — the console default.
 *
 * The contract under test, end to end against the REAL server:
 *  ① navigation never submits — walking cells leaves the prompt standing
 *    and the server's word untouched;
 *  ② the first A LOCKS the cell: pure presentation (locked reticle pose,
 *    relabelled command bar, amber panel status) — the server still waits,
 *    no tile exists, no plants are spent;
 *  ③ B from the locked phase returns to navigation (no gameplay effect);
 *  ④ the second, separate A commits EXACTLY ONE placement: the tile lands,
 *    the plant price is paid once;
 *  ⑤ the reticle is ONE persistent element that travels between cells (a
 *    transform change, never a remount).
 */

const OUT_TIMEOUT = 300_000;

async function key(page: Page, code: string, settle = 300): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
  // Headless Chromium drives rAF off the compositor — force a frame.
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
}

type ServerTruth = {plants: number, greeneries: number, waiting: string};

async function serverTruth(request: APIRequestContext, playerId: string): Promise<ServerTruth> {
  const v = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    thisPlayer: {plants: number},
    waitingFor?: {type?: string},
    game: {spaces: Array<{tileType?: number}>},
  };
  return {
    plants: v.thisPlayer.plants,
    greeneries: v.game.spaces.filter((s) => s.tileType === 0 /* TileType.GREENERY */).length,
    waiting: v.waitingFor?.type ?? '',
  };
}

test.describe('placement · two-phase confirm', () => {
  test('lock → change → lock → confirm commits exactly one greenery', async ({page, request}) => {
    test.setTimeout(OUT_TIMEOUT);
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({seed: 0.42})});
    await bootSeededGame(page, request, playerId, {query: '&consoleProfile=tv'});
    await page.waitForTimeout(1200);

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» (the left slot) opens the placement.
    await key(page, 'Comma', 1400);
    await key(page, 'ArrowLeft', 2600);
    expect((await page.locator('.con-context').innerText()).toUpperCase())
      .toContain('РАЗМЕЩЕНИЕ');
    // Convert plants is a CLIENT-side picker: the server keeps whatever
    // prompt it had (the action menu) until the one commit submits. That is
    // exactly what makes «nothing reaches the server before the confirm»
    // assertable — the whole truth triple must stay frozen.
    const before = await serverTruth(request, playerId);

    // ① NAVIGATION NEVER SUBMITS — and the reticle is ONE travelling element.
    // The deal is not reproducible (config `seed` is ignored), so the legal
    // set differs per run and a FIXED direction can legitimately have no
    // same-row neighbour under the strict hex traversal — SWEEP directions
    // until one moves the reticle instead of remembering a step that worked.
    const cursor = page.locator('.con-bcur');
    await expect(cursor).toHaveCount(1);
    const posOf = () => cursor.evaluate((el) => (el as HTMLElement).style.transform);
    const stepSomewhere = async (): Promise<boolean> => {
      const start = await posOf();
      for (const dir of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        await key(page, dir, 450);
        if (await posOf() !== start) {
          return true;
        }
      }
      return false;
    };
    expect(await stepSomewhere(), 'the reticle must TRAVEL on a d-pad step').toBe(true);
    await expect(cursor).toHaveCount(1);
    const afterWalk = await serverTruth(request, playerId);
    expect(afterWalk, 'walking cells must not answer the prompt').toEqual(before);

    // The navigate-phase bar advertises the LOCK, not the commit.
    const bar = () => page.locator('.con-cmdbar').first().innerText().catch(() => '');
    expect((await bar()).toUpperCase()).toContain('ВЫБРАТЬ КЛЕТКУ');

    // ② THE FIRST A LOCKS — presentation only, the server still waits.
    await key(page, 'Enter', 600);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
    const lockedText = (await bar()).toUpperCase();
    expect(lockedText).toContain('ПОДТВЕРДИТЬ РАЗМЕЩЕНИЕ');
    expect(lockedText).toContain('ИЗМЕНИТЬ КЛЕТКУ');
    const whileLocked = await serverTruth(request, playerId);
    expect(whileLocked, 'the LOCK must not touch the server').toEqual(before);

    // ③ B RETURNS TO NAVIGATION — zero gameplay consequence.
    await key(page, 'Escape', 500);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(0);
    await expect(page.locator('.con-bcur')).toHaveCount(1);
    expect(await serverTruth(request, playerId), 'B must cost nothing').toEqual(before);

    // Move to a different cell when the geometry allows one (same-cell
    // re-lock still exercises the flow), lock it, and CONFIRM.
    await stepSomewhere();
    await key(page, 'Enter', 700); // lock (the dwell passes during the settle)
    await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
    await key(page, 'Enter', 1200); // ④ the separate confirm press

    // The commit lands exactly once: one new greenery, one plant price.
    await expect.poll(async () => (await serverTruth(request, playerId)).greeneries,
      {timeout: 30_000, message: 'the confirmed placement must reach the server'})
      .toBe(before.greeneries + 1);
    // Settle past the hero scene, then re-read: STILL exactly one new
    // greenery (a double submit would land a second), and the plant price
    // was paid exactly once — the cell's own printed bonus may hand up to
    // 2 plants back, so the honest claim is a bounded net decrease.
    await page.waitForTimeout(4000);
    const done = await serverTruth(request, playerId);
    expect(done.greeneries, 'a second commit must not exist').toBe(before.greeneries + 1);
    const spent = before.plants - done.plants;
    expect(spent, `net plants spent ${spent} — expected 8 minus a printed bonus of ≤2`).toBeGreaterThanOrEqual(6);
    expect(spent).toBeLessThanOrEqual(8);
    // …and the flow left the placement (no lingering locked pose).
    await expect(page.locator('.con-bcur--locked')).toHaveCount(0, {timeout: 20_000});
  });
});
