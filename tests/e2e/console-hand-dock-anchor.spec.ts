import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, openActionFocus, openCardActions, playCardFromHand, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE HAND DOCK IS ANCHORED — closing a foreign workspace may not move it.
 *
 * The dock's pack has exactly three poses (default · «наготове» · compact) plus
 * the one deliberate physical journey (dock ↔ «Карты в руке», flown by
 * `handRevealDirector` on its own proxy layer). Nothing else may put a hand
 * card anywhere but in the tray — not for one frame.
 *
 * WHAT THIS CATCHES, and why only an e2e can. Vue's `<transition-group>` FLIP
 * records each child's position with `getBoundingClientRect()` INSIDE its
 * render function, i.e. in the middle of the parent's patch. The console
 * legitimately passes through transient layouts there: a teleported `--embed`
 * surface stands at its `<Teleport>` fallback — a direct child of `.con-root` —
 * for the flush between its host unmounting and the re-home, and its in-zone
 * geometry (`position: relative; flex: 1`) then makes it a member of the root's
 * flex COLUMN. `.con-main` (`flex: 1 1 0%`) yields, and the footer the dock is
 * welded into travels ~493px. That frame is never painted — but it was
 * measured, and the pack inherited the delta as a real 340ms slide back into
 * the dock from the CENTRE OF THE SCREEN.
 *
 * So the claim is about the INTERMEDIATE frames, not the end state, and the
 * probe is `MutationObserver` + `setInterval` — never `requestAnimationFrame`,
 * which headless Chromium stops delivering exactly when the screen goes quiet.
 * Its own sample count is asserted, or a dead probe passes.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'AnchorTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.31,
});

/** The tray's own generous envelope: the raised pose lifts ~.45rem, the
 *  receiving breath spreads ~5%. A violation of the shipped bug was 443px. */
const TOP_SLACK = 60;
const SIDE_SLACK = 90;

type Violation = {
  label: string,
  card: number[],
  dock: number[],
  surfaces: string,
};

async function installAnchorWatch(page: Page): Promise<void> {
  await page.evaluate(([topSlack, sideSlack]) => {
    const w = window as any;
    if (w.__dockAnchor !== undefined) {
      clearInterval(w.__dockAnchor.timer);
    }
    const state = {
      timer: 0 as any,
      samples: 0,
      label: 'boot',
      violations: [] as Array<Violation>,
      dockRects: new Set<string>(),
      sawWorkspace: false,
      /** name → first out-of-tray sighting (rect + time) awaiting its
       *  stationary confirmation. */
      pendingOut: {} as Record<string, {x: number, y: number, t: number}>,
    };
    const scan = () => {
      state.samples++;
      const dock = document.querySelector('.con-handdock');
      if (dock === null) {
        return;
      }
      const d = dock.getBoundingClientRect();
      if (d.width === 0) {
        return; // pre-game / hidden — nothing to anchor to
      }
      state.dockRects.add([Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height)].join(','));
      if (document.querySelector('.con-cardactions') !== null) {
        state.sawWorkspace = true;
      }
      const now = performance.now();
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-handbody[data-hand-body-mode="docked"]'))) {
        const cs = getComputedStyle(el);
        const name = el.getAttribute('data-hand-dock-card') ?? '';
        if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.03) {
          delete state.pendingOut[name];
          continue; // held mid-delivery / unseated — not on screen
        }
        const b = el.getBoundingClientRect();
        const out = b.top < d.top - topSlack || b.top > d.bottom ||
          b.left < d.left - sideSlack || b.right > d.right + sideSlack;
        // TWO-SAMPLE STATIONARY CONFIRMATION (single-owner rework): a body
        // released mid-screen legitimately GLIDES home on the layer's own
        // 340 ms reconcile tween (the physical gather when a flow swallows
        // the hand) — mode already 'docked', rect still travelling. A REAL
        // escape STANDS: same spot, out of the tray, ≥ 420 ms later.
        if (!out) {
          delete state.pendingOut[name];
          continue;
        }
        const seen = state.pendingOut[name];
        if (seen === undefined || Math.abs(seen.x - b.left) > 8 || Math.abs(seen.y - b.top) > 8) {
          state.pendingOut[name] = {x: b.left, y: b.top, t: now};
          continue; // first sighting / still moving — the tween is alive
        }
        if (now - seen.t >= 420 && state.violations.length < 20) {
          delete state.pendingOut[name];
          state.violations.push({
            label: state.label,
            card: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
            dock: [Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height)],
            surfaces: ['.con-cardactions', '.con-hand', '.con-stdp', '.con-task-host']
              .filter((s) => document.querySelector(s) !== null).join(',') || 'board',
          });
        }
      }
    };
    state.timer = setInterval(scan, 16);
    new MutationObserver(scan).observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true,
    });
    w.__dockAnchor = state;
    scan();
  }, [TOP_SLACK, SIDE_SLACK] as const);
}

async function mark(page: Page, label: string): Promise<void> {
  await page.evaluate((l) => {
    (window as any).__dockAnchor.label = l;
  }, label);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`hand dock anchor · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('no workspace close ever moves a hand card out of the tray', async ({page, request}) => {
      test.setTimeout(600_000);

      await bootIntoGame(page, request, {
        cards: ['Business Network'],
        buy: 6,
        config: GAME_CONFIG,
        query: profile.query,
      });
      await waitForTurn(page);
      await page.waitForTimeout(3000);
      await installAnchorWatch(page);

      // ── The play itself closes the «КАРТЫ В РУКЕ» workspace WHILE the hand
      //    loses a card — the flush that first shipped the defect. ──────────
      await mark(page, 'play-card-from-hand');
      await playCardFromHand(page, 'Business Network');
      await page.waitForTimeout(2500);

      // ── The blue-action workspace: browse open/close, twice. ─────────────
      for (let i = 0; i < 2; i++) {
        await mark(page, `actions-open-${i}`);
        await openCardActions(page).catch(() => {});
        await page.waitForTimeout(900);
        await mark(page, `actions-close-${i}`);
        await press(page, 'Escape', 1600);
      }

      // ── …its SETUP stage, then B twice (stage → browse → board). ─────────
      await mark(page, 'focus-open');
      await openCardActions(page).catch(() => {});
      await page.waitForTimeout(800);
      await openActionFocus(page).catch(() => {});
      await page.waitForTimeout(1200);
      await mark(page, 'focus-back');
      await press(page, 'Escape', 1300);
      await mark(page, 'focus-close');
      await press(page, 'Escape', 1800);

      // ── The one LEGAL journey: the hand album out of the dock and back. ──
      await mark(page, 'hand-open');
      await press(page, 'Period', 800);
      await press(page, 'Enter', 2200);
      await mark(page, 'hand-close');
      await press(page, 'Escape', 2400);

      // ── A workspace opened straight after that episode. ──────────────────
      await mark(page, 'actions-after-hand-open');
      await openCardActions(page).catch(() => {});
      await page.waitForTimeout(900);
      await mark(page, 'actions-after-hand-close');
      await press(page, 'Escape', 1800);

      // ── A different workspace on the same shell (Standard Projects). ─────
      await mark(page, 'stdp-open');
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1500);
      await mark(page, 'stdp-close');
      await press(page, 'Escape', 1800);
      await press(page, 'Escape', 1200);

      // ── Rapid repeats: open/close cycles with no time to settle. ─────────
      await mark(page, 'rapid-cycles');
      for (let i = 0; i < 4; i++) {
        await press(page, 'Period', 400);
        await press(page, 'ArrowUp', 600);
        await press(page, 'Escape', 500);
      }
      await page.waitForTimeout(1500);

      const probe = await page.evaluate(() => {
        const s = (window as any).__dockAnchor;
        return {
          samples: s.samples as number,
          violations: s.violations as Array<Violation>,
          dockRects: Array.from(s.dockRects) as Array<string>,
          sawWorkspace: s.sawWorkspace as boolean,
        };
      });

      // A silently dead probe must never pass (memory: rAF probes go quiet).
      expect(probe.samples, 'the anchor probe must have sampled the whole tour')
        .toBeGreaterThan(1500);
      expect(probe.sawWorkspace, 'the tour must actually have opened the card-actions workspace')
        .toBe(true);

      const story = probe.violations
        .map((v) => `[${v.label}] card=${JSON.stringify(v.card)} dock=${JSON.stringify(v.dock)} on=${v.surfaces}`)
        .join('\n  ');
      expect(probe.violations.length,
        `a hand card left the tray:\n  ${story}`).toBe(0);

      // …and the CHASSIS itself never travels: the dock is welded into the
      // footer, so a workspace teardown that deforms the root column would
      // show up here even if nothing measured it.
      expect(probe.dockRects.length,
        `the dock chassis moved during the tour: ${probe.dockRects.join(' | ')}`).toBe(1);
    });
  });
}
