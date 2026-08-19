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

/**
 * One sample of the walk: the panel's OUTER box (the geometry that must not
 * move), which cell is focused, and what is IN MOTION right now. The value
 * flick (`con-dossier-val-in`, a 100 ms opacity keyframe on a changed value)
 * is the ONE sanctioned animation of a cell change — anything else running
 * mid-walk (a transition, a height animation, a section reflow tween) is the
 * regression this probe exists to catch.
 */
async function sample(page: Page): Promise<{
  rect: string, cell: string, rows: number,
  transitions: number, foreign: Array<string>,
}> {
  return page.evaluate(() => {
    const panel = document.querySelector('.con-inspector') as HTMLElement | null;
    const r = panel?.getBoundingClientRect();
    const running = panel === null || typeof panel.getAnimations !== 'function' ? [] :
      panel.getAnimations({subtree: true}).filter((a) => a.playState === 'running');
    const isValFlick = (a: Animation): boolean =>
      a instanceof CSSAnimation && a.animationName === 'con-dossier-val-in';
    // PAINT is sanctioned (the cell bar's legal↔illegal recolour, the scroll
    // fade); GEOMETRY is the regression. The split is the transition's own
    // property.
    const PAINT = ['opacity', 'background-color', 'box-shadow', 'color', 'border-color'];
    const isPaint = (a: Animation): boolean =>
      a instanceof CSSTransition && PAINT.includes(a.transitionProperty);
    return {
      rect: r === undefined ? '' : `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`,
      cell: document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '',
      rows: document.querySelectorAll('.con-dossier-row').length,
      transitions: running.filter((a) => a instanceof CSSTransition && !isPaint(a)).length,
      foreign: running.filter((a) => !(a instanceof CSSTransition) && !isValFlick(a))
        .map((a) => (a instanceof CSSAnimation ? a.animationName : a.constructor.name)),
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
    const seen: Array<Awaited<ReturnType<typeof sample>>> = [];
    const walk = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp',
      'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    for (const step of walk) {
      await key(page, step, 120);
      seen.push(await sample(page));
    }
    fs.mkdirSync(OUT, {recursive: true});
    await page.screenshot({path: path.join(OUT, 'after-fast-walk.png')});
    console.log('[nav] ' + seen.map((s) =>
      `${s.cell || '--'} rows=${s.rows} rect=${s.rect} tr=${s.transitions} foreign=[${s.foreign.join(',')}]`).join('\n      '));

    // ① THE PANEL'S OUTER GEOMETRY NEVER MOVES — the shell is the frame; only
    //    the content inside it re-reads per cell.
    const rects = new Set(seen.map((s) => s.rect));
    expect([...rects], 'the panel box changed during the walk').toHaveLength(1);

    // ② NOTHING ANIMATES ON A CELL CHANGE except the sanctioned 100 ms value
    //    flick: no CSS transitions (that is what an animated grow/collapse
    //    would run on), and no foreign keyframe animation inside the panel.
    //    Sampled DURING the fast walk — a queue of tweens would be running
    //    exactly here.
    const withTransitions = seen.filter((s) => s.transitions > 0);
    expect(withTransitions, `transitions ran mid-walk: ${JSON.stringify(withTransitions)}`).toHaveLength(0);
    const withForeign = seen.flatMap((s) => s.foreign);
    expect(withForeign, `foreign animations ran mid-walk: ${withForeign.join(', ')}`).toHaveLength(0);

    // ③ NOTHING IS STILL MOVING once the walk stops — no queue to drain.
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
