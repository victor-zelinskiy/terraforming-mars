import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openActionFocus, openCardActions, playCardFromHand, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console REPEAT-ACTION PICK · the source composer survives the bridge.
 *
 * Viron's action («repeat a blue action already used this generation») hands
 * the choice to the ДЕЙСТВИЯ КАРТ workspace in REPEAT mode. That handoff is a
 * CLIENT PICK BRIDGE: the source workspace is hidden with `v-show` and keeps
 * every capture, and coming back is a re-show — never a fresh entrance.
 *
 * THE BUG THIS GUARDS. `v-show` DOES fire the `<transition>` enter/leave pair,
 * and surface-motion's «that was a bridge, not a dismissal» verdict named only
 * the HAND pick. So opening the repeat pick ran a genuine LEAVE — which poses
 * EVERY `[data-motion-panel]` under the root, the open composer's panel
 * included — and closing it ran a genuine ENTER, which restores only the
 * outermost one. The action centre came back with its breadcrumb, its command
 * bar and an EMPTY FRAME: «ДЕЙСТВИЯ КАРТ › VIRON › НАСТРОЙКА» over nothing.
 *
 * So the claim is deliberately about the composer's CONTENT, not its presence:
 * the stage root stayed mounted and measurable the whole time — it was the
 * panel inside it that never came back. Both ways out of the pick are covered:
 * B (cancel) and a real choice (resolve), because the leave/enter pair is the
 * same for both.
 *
 * Setup (SETUP, never the subject — see consoleStart.ts): Viron + Physics
 * Complex, whose action is a single branch with no decisions, so «use it once»
 * is two presses and Viron then has exactly one candidate to copy.
 */

const OUT_DIR = path.resolve('screenshots', 'console-repeat-pick');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'VironTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {venus: true},
  customCorporationsList: ['Viron'],
  seed: 0.11,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The inspector names the FOCUSED tile's source card in English. */
async function focusedSource(page: Page): Promise<string> {
  return page.locator('.con-cardactions .con-cardactions__detail-cardwrap').first()
    .getAttribute('data-zoom-slot').then((v) => v ?? '').catch(() => '');
}

async function walkToSource(page: Page, card: string, steps = 12): Promise<boolean> {
  for (let i = 0; i < steps; i++) {
    if (await focusedSource(page) === card) {
      return true;
    }
    await press(page, 'ArrowDown', 350);
  }
  return await focusedSource(page) === card;
}

/**
 * Is the stage's own content PAINTED? Not «is the stage in the DOM» — that
 * never stopped being true. `visibility` is inherited, so a hidden ancestor
 * anywhere between the root and the hero card shows up here.
 */
async function stageContentPainted(page: Page): Promise<{panel: string, hero: string, surface: string}> {
  return page.evaluate(() => {
    const read = (sel: string): string => {
      const el = document.querySelector<HTMLElement>(`.con-cardactions ${sel}`);
      if (el === null) {
        return 'MISSING';
      }
      const cs = getComputedStyle(el);
      return `${cs.opacity}/${cs.visibility}`;
    };
    return {
      panel: read('.con-composer__panel--stage'),
      hero: read('[data-action-focus-card]'),
      surface: read('[data-unfold-surface]'),
    };
  });
}

test.describe('console repeat-action pick', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the source composer comes back PAINTED — from B and from a real pick', async ({page, request}) => {
    test.setTimeout(600_000);

    await bootWithCards(page, request, {
      cards: ['Physics Complex'],
      corporation: 'Viron',
      config: GAME_CONFIG,
      step: 0.013,
    });
    await waitForTurn(page);
    await page.waitForTimeout(3000);

    expect(await playCardFromHand(page, 'Physics Complex'), 'Physics Complex played').toBe(true);

    // ── Use the Physics Complex action, so Viron has a candidate to copy. ──
    await openCardActions(page);
    expect(await walkToSource(page, 'Physics Complex'), 'focus Physics Complex').toBe(true);
    await openActionFocus(page);
    await press(page, 'Enter', 4000); // confirm — a single branch, no decisions
    await page.waitForTimeout(4000);

    // ── Viron's own action → the repeat pick. ────────────────────────────
    await waitForTurn(page);
    await openCardActions(page);
    expect(await walkToSource(page, 'Viron'), 'focus Viron').toBe(true);
    await openActionFocus(page);
    const opened = await stageContentPainted(page);
    expect(opened.panel, 'the stage paints when it opens').toBe('1/visible');

    // A on the repeat row hands the choice to the ДЕЙСТВИЯ КАРТ surface in
    // repeat mode — TWO roots: the hidden source + the pick standing over it.
    await press(page, 'Enter', 2500);
    await expect(page.locator('.con-cardactions'), 'the repeat surface stands up').toHaveCount(2);
    await shoot(page, '01-repeat-pick');

    // ── B: back to the source. ───────────────────────────────────────────
    await press(page, 'Escape', 2500);
    await page.waitForTimeout(1500);
    await expect(page.locator('.con-cardactions')).toHaveCount(1);
    await shoot(page, '02-after-cancel');
    const afterCancel = await stageContentPainted(page);
    expect(afterCancel, 'B returns to a PAINTED composer, never an empty frame').toEqual({
      panel: '1/visible', hero: '1/visible', surface: '1/visible',
    });

    // ── …and the same for a real choice. ─────────────────────────────────
    await press(page, 'Enter', 2500); // re-open the pick
    await expect(page.locator('.con-cardactions')).toHaveCount(2);
    await press(page, 'Enter', 2000); // A = «Выбрать» the focused candidate
    await press(page, 'Enter', 2500); // A = «Выбрать это действие» (its CTA)
    await expect(page.locator('.con-cardactions'), 'the pick resolved back to the source')
      .toHaveCount(1, {timeout: 10_000});
    await page.waitForTimeout(1500);
    await shoot(page, '03-after-resolve');
    const afterResolve = await stageContentPainted(page);
    expect(afterResolve, 'a resolved pick returns to a PAINTED composer').toEqual({
      panel: '1/visible', hero: '1/visible', surface: '1/visible',
    });
  });
});
