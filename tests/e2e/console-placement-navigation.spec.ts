import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, createGameWithCards, soloGameConfig} from './consoleStart';

/**
 * FAST NAVIGATION — the panel must not be the moving object on screen.
 *
 * The dossier is a HUD of the cell the player is pointing at, and the player
 * points with the d-pad. Iteration 1 animated section enter/leave/reflow, so
 * every cursor step re-composed the panel and pulled the eye off the hex being
 * chosen. This probe walks the board FAST and asserts the two things that
 * make the panel calm:
 *   ① the geometry of the standing sections does not move between cells;
 *   ② nothing is mid-flight when the walk stops (no motion queue to drain).
 * It also records a video of the walk (`--video=on`), which is the artefact a
 * human actually judges «does the board stay the subject?» by.
 */

const OUT = path.resolve('screenshots', 'placement-navigation');

async function key(page: Page, code: string, settle = 130): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
  // Headless Chromium drives rAF off the compositor: a screenshot is what
  // forces a frame, so the walk really renders rather than idling.
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
}

/** The y of every section head + the panel's own height. */
async function anchors(page: Page): Promise<{heads: Array<{key: string, y: number}>, h: number, cell: string, rows: number}> {
  return page.evaluate(() => {
    const panel = document.querySelector('.con-inspector') as HTMLElement | null;
    const heads = Array.from(document.querySelectorAll('.con-context__sec')).map((s) => ({
      key: (s.className.match(/con-context__sec--(\w+)/) ?? [])[1] ?? '?',
      y: Math.round(s.getBoundingClientRect().top),
    }));
    return {
      heads,
      h: panel === null ? 0 : Math.round(panel.getBoundingClientRect().height),
      cell: document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '',
      rows: document.querySelectorAll('.con-dossier-row').length,
    };
  });
}

// `video` forces a new worker, so Playwright only accepts it at FILE level
// (not inside a describe) — the 4K viewport rides along with it.
test.use({
  viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1,
  screen: {width: 3840, height: 2160},
  video: {mode: 'on', size: {width: 1920, height: 1080}},
});

test.describe('placement dossier · fast navigation', () => {
  test('walking the board does not move the panel', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({seed: 0.42})});
    await bootSeededGame(page, request, playerId, {query: '&consoleProfile=tv'});
    await page.waitForTimeout(1200);

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» (the left slot) opens the placement.
    await key(page, 'Comma', 1400);
    await key(page, 'ArrowLeft', 2600);
    expect((await page.locator('.con-context').innerText()).toUpperCase())
      .toContain('РАЗМЕЩЕНИЕ');

    // ── THE WALK. Fast steps, no settle time — the player holding a direction
    //    is exactly the case a motion queue would show up in.
    const seen: Array<Awaited<ReturnType<typeof anchors>>> = [];
    const walk = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp',
      'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    for (const step of walk) {
      await key(page, step, 120);
      seen.push(await anchors(page));
    }
    fs.mkdirSync(OUT, {recursive: true});
    await page.screenshot({path: path.join(OUT, 'after-fast-walk.png')});

    // ① THE FRAME HOLDS. The claim is about the four blocks a player tracks
    //    while choosing a cell — the toll, the result, the standing and the
    //    forecast: each must sit at the SAME y on every cell.
    //    «ПРАВИЛА ПОЛЯ» is deliberately not among them: it is an optional
    //    block riding the flow of the top-anchored zone, below everything
    //    that is tracked, and pinning it too would mean reserving a permanent
    //    hole for a block most cells do not have.
    console.log('[nav] ' + seen.map((s) =>
      `${s.cell || '--'} rows=${s.rows} ${s.heads.map((h) => `${h.key}@${h.y}`).join(' ')}`).join('\n      '));
    const ANCHORED = ['effect', 'gain', 'progress', 'endgame'];
    let worst = 0;
    let worstKey = '';
    for (let i = 1; i < seen.length; i++) {
      for (const head of seen[i].heads.filter((h) => ANCHORED.includes(h.key))) {
        const before = seen[i - 1].heads.find((h) => h.key === head.key);
        if (before !== undefined && Math.abs(head.y - before.y) > worst) {
          worst = Math.abs(head.y - before.y);
          worstKey = head.key;
        }
      }
    }
    // A couple of px absorbs sub-pixel rounding, nothing more. Before the
    // frame was split into a top-anchored and a bottom-anchored zone, these
    // blocks travelled 277 px the moment a neighbour carried one more fact.
    expect(worst, `«${worstKey}» drifted ${worst}px between neighbouring cells`).toBeLessThanOrEqual(4);

    // ② NOTHING IS STILL MOVING once the walk stops — no queue to drain.
    await page.waitForTimeout(400);
    const running = await page.evaluate(() => {
      const panel = document.querySelector('.con-inspector');
      if (panel === null || typeof panel.getAnimations !== 'function') {
        return -1;
      }
      return panel.getAnimations({subtree: true})
        .filter((a) => a.playState === 'running').length;
    });
    expect(running, 'an animation was still running after the walk settled').toBeLessThanOrEqual(0);
  });
});
