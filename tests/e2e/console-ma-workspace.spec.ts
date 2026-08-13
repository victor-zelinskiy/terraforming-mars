import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, soloGameConfig} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console MILESTONES/AWARDS WORKSPACE — the North-Star flow guard
 * (docs/claude/console/ma-workspace.md):
 *
 *   Overview → Hero Detail → Commit → Ceremony INSIDE the workspace →
 *   Settle → auto-Close.
 *
 * What this proves at the real surface, driven the way a player drives it:
 *  1. the overview carries NO per-item CTA (A only SELECTS);
 *  2. A descends into the detail stage; the pressed card's emblem goes dark
 *     the moment the hero pedestal carries it (ONE physical object, never a
 *     double image); the crumb grows the «› <name> › <stage>» tail;
 *  3. B before the commit folds back and the focus lands on the SAME item;
 *  4. A on the stage commits; the EXISTING ceremony plays INSIDE the
 *     workspace (`.con-mafocus__cere`) — the global centre-stage shell
 *     (`.con-macere__scene`) must NOT also present it;
 *  5. the workspace closes only after the ceremony's own completion — and
 *     leaves no ceremony layers, with the funded state already on the books.
 */

const OUT = path.resolve('screenshots', 'ma-workspace');

/** Human + MarsBot (awards/milestones are DISABLED in true solo — the rules'
 *  own «for 1 player games» carve-out), deterministic base+corpEra board.
 *  `testMode` gives 500 M€, so the first award is fundable on action one. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'MATester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  automa: {difficulty: 'normal'},
});

async function key(page: Page, code: string, settle = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The bottom command bar's visible labels (the semantic footer; the bar
 *  renders uppercase — compare in one case). */
async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').innerText().catch(() => '')).replace(/\s+/g, ' ').toUpperCase();
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console MA workspace · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('overview → detail → commit → in-workspace ceremony → auto-close', async ({page, request}) => {
      test.setTimeout(480_000);

      await bootIntoGame(page, request, {config: GAME_CONFIG, buy: 2, query: profile.query});
      await page.waitForSelector('.con-board', {timeout: 45_000});

      // ── 1 · The AWARDS overview (LB opens milestones; RB switches over) ────
      await key(page, 'KeyQ', 1400);
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      await key(page, 'KeyE', 1400); // → НАГРАДЫ (the category toggle survives)
      expect(await page.locator('.con-ma').count(), 'the MA workspace must survive the category switch').toBe(1);

      // No per-item CTA (criterion 1) and A = «Выбрать» in the footer (2).
      expect(await page.locator('.con-ma__btn').count(), 'the per-item CTA must be gone').toBe(0);
      expect(await page.locator('.con-ma__cta').count(), 'the CTA zone must be gone').toBe(0);
      const listBar = await barText(page);
      expect(listBar, 'the overview footer advertises SELECT').toContain('ВЫБРАТЬ');
      // The last trace of the modal era: `X Осмотреть` is GONE — one primary
      // verb, and A opens every item (including the ones it cannot buy).
      expect(listBar, 'the inspect verb must be gone from the bar').not.toContain('ОСМОТРЕТЬ');

      // THE HEADER states the SYSTEM: the live price, never a wallet delta.
      const head = (await page.locator('.con-ma__wshead').innerText()).replace(/\s+/g, ' ');
      expect(head, 'the header carries the live price chip').toContain('ЦЕНА');
      expect(head, 'the header must not project a balance').not.toContain('→');
      expect(await page.locator('.con-ma__wallet').count(), 'the header wallet is gone').toBe(0);

      // THE STATUS RAIL carries the WHOLE projection of the focused item, in
      // the shared chips (M€ + the category counter), and nothing else does.
      await page.waitForSelector('.con-marail', {timeout: 4_000});
      const railChips = await page.locator('.con-marail .action-effect-chip').count();
      expect(railChips, 'the focused award projects M€ + the slot counter').toBe(2);
      const railText = (await page.locator('.con-marail').innerText()).replace(/\s+/g, ' ');
      expect(railText, 'the rail states the resulting balance').toContain('→');
      expect(railText, 'no bespoke «будет потрачено» dialect').not.toContain('потрачено');
      await shoot(page, profile.tag + '-01-overview');

      // The focused item (the first fundable award — openSheet homes on it).
      const focusedName = (await page.locator('.con-ma__card--focused .con-ma__name').innerText()).trim();
      expect(focusedName.length, 'an award must be focused').toBeGreaterThan(0);

      // ── 2 · A = SELECT → the hero detail descend ───────────────────────────
      await page.keyboard.press('Enter');
      // Mid-transition: the pressed card's own emblem must already be DARK
      // while the hero pedestal carries it — one physical object, never two.
      await page.waitForTimeout(140);
      const midOpacity = await page.locator('.con-ma__card--focused .con-ma__stage').evaluate(
        (el) => getComputedStyle(el).opacity);
      await page.waitForSelector('.con-mafocus', {timeout: 6_000});
      expect(Number(midOpacity), 'the browse emblem must go dark the instant the carry starts').toBeLessThan(0.05);
      await page.waitForTimeout(1100); // the reveal waves settle
      await shoot(page, profile.tag + '-02-detail');

      // The stage restates the item; the crumb grew the tail; the bar shows the
      // REAL verb.
      const crumbSubject = (await page.locator('.con-wshead__subject').innerText().catch(() => '')).trim();
      expect(crumbSubject.toUpperCase(), 'the crumb subject names the descended item')
        .toBe(focusedName.toUpperCase());
      expect((await page.locator('.con-wshead__step').innerText()).trim().toUpperCase(),
        'the pre-commit stage word').toBe('СПОНСОРСТВО');
      expect(await barText(page), 'the detail footer advertises the commit verb').toContain('СПОНСИРОВАТЬ');

      // The detail state speaks the SAME rail — one projection, one language,
      // and the old «БУДЕТ ПОТРАЧЕНО −8 462 → 454» band is gone with it.
      expect(await page.locator('.con-mafocus .con-marail .action-effect-chip').count(),
        'the stage projects through the shared rail').toBe(2);
      expect(await page.locator('.con-mafocus__spend, .con-mafocus__slots-after').count(),
        'the bespoke spend/slots band must be gone').toBe(0);

      // THE BADGE stays inside its hero column (the clipped «ПОРОГ ДОСТИГНУТ —
      // МОЖНО ВЗЯТЬ СЕЙЧАС» is what this measures against).
      const badgeFits = await page.evaluate(() => {
        const chip = document.querySelector('.con-mafocus__state-chip') as HTMLElement | null;
        const col = document.querySelector('.con-mafocus__side') as HTMLElement | null;
        if (chip === null || col === null) {
          return {ok: false, overflow: 999};
        }
        const c = chip.getBoundingClientRect();
        const s = col.getBoundingClientRect();
        return {ok: true, overflow: Math.max(s.left - c.left, c.right - s.right)};
      });
      expect(badgeFits.ok, 'the state badge must exist').toBeTruthy();
      expect(badgeFits.overflow, 'the state badge must stay inside the hero column').toBeLessThan(1);

      // ── 3 · B folds back; the focus survives on the SAME item ──────────────
      await key(page, 'Escape', 1200);
      expect(await page.locator('.con-mafocus').count(), 'B must fold the stage').toBe(0);
      const refocused = (await page.locator('.con-ma__card--focused .con-ma__name').innerText()).trim();
      expect(refocused, 'the fold returns the focus to the entered item').toBe(focusedName);
      const restoredOpacity = await page.locator('.con-ma__card--focused .con-ma__stage').evaluate(
        (el) => getComputedStyle(el).opacity);
      expect(Number(restoredOpacity), 'the browse emblem is whole again after the fold').toBeGreaterThan(0.9);
      await shoot(page, profile.tag + '-03-folded-back');

      // ── 4 · Descend again → COMMIT → the ceremony INSIDE the workspace ─────
      await key(page, 'Enter', 1300);
      await page.waitForSelector('.con-mafocus', {timeout: 6_000});
      await page.keyboard.press('Enter'); // the commit — the stage does NOT close

      // The ceremony arrives ON the stage; the global own-beat scene must not.
      await page.waitForSelector('.con-mafocus__cere', {timeout: 12_000});
      expect(await page.locator('.con-ma').count(), 'the workspace stays up for its ceremony').toBe(1);
      expect(await page.locator('.con-macere__scene').count(),
        'the global centre-stage ceremony must not double-present a claimed beat').toBe(0);
      await page.waitForTimeout(900);
      expect(await barText(page), 'no commit verb may survive the commit').not.toContain('СПОНСИРОВАТЬ');
      await shoot(page, profile.tag + '-04-ceremony');

      // ── 5 · The workspace closes ONLY after the ceremony settles ───────────
      await page.waitForSelector('.con-ma', {state: 'detached', timeout: 20_000});
      expect(await page.locator('.con-mafocus, .con-mafocus__cere, .con-ceremony-fx').count(),
        'no ceremony layer may outlive the workspace').toBe(0);
      expect(await page.locator('.con-macere__scene').count(),
        'the beat was consumed by the stage — never replayed globally').toBe(0);
      await page.waitForTimeout(600);
      await shoot(page, profile.tag + '-05-closed');

      // The final state is already on the books: re-open the awards and the
      // funded slot names the viewer (no second flight, no stale counts).
      await key(page, 'KeyQ', 1400);
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      await key(page, 'KeyE', 1400);
      const panel = (await page.locator('.con-ma').innerText()).replace(/\s+/g, ' ');
      expect(panel, 'the funded tally is live after the close').toContain('1/3');
      // …and the PRICE followed the game: the second funding costs 14, from the
      // engine's own ladder (the UI never re-derives it from a constant).
      expect((await page.locator('.con-ma__price').innerText()).replace(/\s+/g, ' '),
        'the header price is the LIVE next-award cost').toContain('14');
      await shoot(page, profile.tag + '-06-reopened');

      // ── 7 · A blocked item still OPENS, and tells the truth ────────────────
      // (There is no `X` any more: A is the one way in, for every item.)
      await key(page, 'KeyQ', 1400); // → ДОСТИЖЕНИЯ, where a threshold blocks
      await page.waitForSelector('.con-ma', {timeout: 8_000});
      const blockedIdx = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.con-ma__card'));
        return cards.findIndex((c) => c.classList.contains('con-ma__card--go') === false &&
          c.classList.contains('con-ma__card--taken') === false);
      });
      if (blockedIdx >= 0) {
        for (let i = 0; i < blockedIdx; i++) {
          await key(page, i % 2 === 0 ? 'ArrowRight' : 'ArrowDown', 260);
        }
        await key(page, 'Enter', 1400);
        if (await page.locator('.con-mafocus').count() > 0) {
          const stage = (await page.locator('.con-mafocus').innerText()).replace(/\s+/g, ' ');
          expect(stage, 'a blocked item opens and explains itself')
            .not.toContain('ПОТРАЧЕНО');
          // …and it NEVER draws a success preview of a payment it cannot make.
          const railTone = await page.locator('.con-mafocus .con-marail').getAttribute('class');
          expect(railTone ?? '', 'a blocked stage rail is blocked, never projected')
            .not.toContain('con-marail--projected');
          await shoot(page, profile.tag + '-07-blocked-detail');
          await key(page, 'Escape', 1000);
        }
      }
    });
  });
}
