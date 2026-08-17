import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, createGameWithCards, soloGameConfig} from './consoleStart';

/**
 * THE ONE SANCTIONED EXCEPTION to «a modal never covers a bar»: the RIGHT-EDGE
 * DRAWERS.
 *
 * Every decision surface and the shared dim are bounded by the central opening
 * — the four hull members stay lit (`console-workspace-band.spec.ts` proves
 * that side). «Журнал» and the placement/inspection dossier are the deliberate
 * opposite: they are not modals over the stage but the right rail's
 * REPLACEMENT — same edge, same band, wider — so the rail must stop being drawn
 * entirely while either stands.
 *
 * WHAT THIS PROVES, per drawer:
 *  1. the drawer's box COVERS the rail's box (same edge, at least as wide);
 *  2. the rail is not merely underneath it — it is NOT DRAWN (`visibility`),
 *     because the dossier's glass is translucent and the trophy gallery used to
 *     ghost through the panel that was supposed to replace it;
 *  3. …and its BOX SURVIVES (`visibility`, never `display`), which is the whole
 *     reason both drawers are overlays: the board's fit and the planet-focus
 *     scene must never reflow for a mode change.
 * (3) is the one a screenshot cannot show and a `display: none` "fix" would
 * silently break.
 */

const OUT = path.resolve('screenshots', 'right-drawer');

async function key(page: Page, code: string, settle = 600): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Probe = {
  drawer: {l: number, r: number, t: number, b: number} | null,
  rail: {l: number, r: number, w: number, visibility: string, display: string} | null,
};

async function probe(page: Page, drawerSel: string): Promise<Probe> {
  return page.evaluate((sel) => {
    const drawerEl = document.querySelector<HTMLElement>(sel);
    const railEl = document.querySelector<HTMLElement>('.con-strat');
    const box = (el: HTMLElement | null) => {
      if (el === null) {
        return null;
      }
      const b = el.getBoundingClientRect();
      return {l: b.left, r: b.right, t: b.top, b: b.bottom};
    };
    return {
      drawer: box(drawerEl),
      rail: railEl === null ? null : {
        ...(() => {
          const b = railEl.getBoundingClientRect();
          return {l: b.left, r: b.right, w: b.width};
        })(),
        visibility: getComputedStyle(railEl).visibility,
        display: getComputedStyle(railEl).display,
      },
    };
  }, drawerSel);
}

async function assertReplacesRail(page: Page, sel: string, label: string): Promise<void> {
  const p = await probe(page, sel);
  expect(p.drawer, `${label}: the drawer is not on screen`).not.toBeNull();
  expect(p.rail, `${label}: the strategy rail is not in the DOM`).not.toBeNull();

  // 1 · SAME EDGE, AT LEAST AS WIDE — the drawer is the rail's replacement, so
  //     the rail's whole box must fall inside it.
  expect(p.drawer!.l, `${label}: the drawer starts right of the rail (${p.drawer!.l} > ${p.rail!.l})`)
    .toBeLessThanOrEqual(p.rail!.l + 2);
  expect(p.drawer!.r, `${label}: the drawer ends left of the rail's edge`)
    .toBeGreaterThanOrEqual(p.rail!.r - 2);

  // 2 · NOT DRAWN. Covering was not enough: translucent glass let the gallery
  //     ghost through the panel replacing it.
  expect(p.rail!.visibility, `${label}: the rail must not be drawn under the drawer`).toBe('hidden');

  // 3 · …but its BOX SURVIVES, so the board never reflows for a mode change.
  expect(p.rail!.display, `${label}: the rail's box must survive (visibility, never display)`)
    .not.toBe('none');
  expect(p.rail!.w, `${label}: the rail's box collapsed (${p.rail!.w}px)`).toBeGreaterThan(0);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console right-edge drawers · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the journal and the board dossier REPLACE the right rail', async ({page, request}) => {
      test.setTimeout(300_000);
      const playerId = await createGameWithCards(request, [], {config: soloGameConfig()});
      await bootSeededGame(page, request, playerId, {query: profile.query});

      // The rail is the board home's right edge to begin with.
      const idle = await probe(page, '.con-strat');
      expect(idle.rail!.visibility, 'the rail is drawn on the calm board home').toBe('visible');

      // ── «ЖУРНАЛ» (View / R) ────────────────────────────────────────────
      await key(page, 'KeyR', 1200);
      await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
      await assertReplacesRail(page, '.con-journal', 'journal');
      await shoot(page, `${profile.tag}-1-journal`);
      await key(page, 'KeyR', 1000);
      await expect(page.locator('.con-journal')).toHaveCount(0);
      // …and it comes BACK: the exception is a state, never a one-way door.
      const back = await probe(page, '.con-strat');
      expect(back.rail!.visibility, 'the rail returns when the drawer closes').toBe('visible');

      // ── THE BOARD DOSSIER (board inspection — L3 / KeyC) ───────────────
      await key(page, 'KeyC', 1400);
      const dossier = page.locator('.con-context');
      if (await dossier.count() === 0) {
        // Inspection refuses on a board that is mid-task; say so rather than
        // passing quietly on half the subject.
        expect(false, 'board inspection never opened the dossier').toBeTruthy();
      }
      await assertReplacesRail(page, '.con-context', 'board dossier');
      await shoot(page, `${profile.tag}-2-dossier`);
    });
  });
}
