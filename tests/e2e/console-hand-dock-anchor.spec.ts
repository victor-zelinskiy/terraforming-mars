import {test, expect, Page} from './consoleTest';
import {bootIntoGame, openActionFocus, openCardActions, playCardFromHand, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {armWitness, pageNow, Witness} from './witness';
import type {ObservedSample} from './observeCore';

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
 * probe is a WITNESS (FLAKE ZERO — `armWitness`): the product's own writes are
 * observed in the task that makes them (a MutationObserver over the document +
 * a frame tick), every change kept with the page's time — never a sampler of
 * its own that sleeps through a frame. What it records is an OBSERVATION (the
 * dock's chassis, the surfaces standing, every docked body OUT of the tray);
 * the «a real escape STANDS» judgement is folded on the Node side.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'AnchorTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.31,
});

/** The tray's own generous envelope: the raised pose lifts ~.45rem, the
 *  receiving breath spreads ~5%. A violation of the shipped bug was 443px. */
const TOP_SLACK = 60;
const SIDE_SLACK = 90;
/** A body out of the tray that STANDS this long at one spot (±8 px) is an escape — a glide home is moving. */
const STAND_MS = 420;
const STAND_PX = 8;

type Violation = {
  label: string,
  card: number[],
  dock: number[],
  surfaces: string,
};

/** One docked body painted OUT of the tray (rounded box). */
type OutBody = {name: string, x: number, y: number, w: number, h: number};
/** What the anchor witness observes in one state of the page. */
type DockState = {
  /** The dock chassis's rounded box (`l,t,w,h`), or null while there is none to anchor to (pre-game / hidden). */
  dock: string | null,
  /** The card-actions workspace stands. */
  ws: boolean,
  /** The surfaces standing (named on a violation). */
  surfaces: string,
  /** Every VISIBLE docked body outside the tray's envelope. */
  out: Array<OutBody>,
};

/** The reader of {@link DockState} — in the page, self-contained (the slack comes through `args`). */
function readDock(slack: {top: number, side: number}): DockState {
  const dock = document.querySelector('.con-handdock');
  const d = dock?.getBoundingClientRect();
  const surfaces = ['.con-cardactions', '.con-hand', '.con-stdp', '.con-task-host']
    .filter((s) => document.querySelector(s) !== null).join(',') || 'board';
  if (d === undefined || d.width === 0) {
    return {dock: null, ws: false, surfaces, out: []}; // pre-game / hidden — nothing to anchor to
  }
  const out: Array<OutBody> = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-handbody[data-hand-body-mode="docked"]'))) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.03) {
      continue; // held mid-delivery / unseated — not on screen
    }
    const b = el.getBoundingClientRect();
    if (b.top < d.top - slack.top || b.top > d.bottom || b.left < d.left - slack.side || b.right > d.right + slack.side) {
      out.push({name: el.getAttribute('data-hand-dock-card') ?? '', x: Math.round(b.left), y: Math.round(b.top),
        w: Math.round(b.width), h: Math.round(b.height)});
    }
  }
  return {
    dock: [Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height)].join(','),
    ws: document.querySelector('.con-cardactions') !== null,
    surfaces,
    out,
  };
}

async function installAnchorWatch(page: Page): Promise<Witness<DockState>> {
  return armWitness<DockState, {top: number, side: number}>(page, 'hand-dock-anchor', readDock,
    {args: {top: TOP_SLACK, side: SIDE_SLACK}, max: 20_000});
}

/** The tour's chapters on the PAGE's clock — a violation is named by the chapter it was first sighted in. */
type Mark = {label: string, t: number};

async function mark(page: Page, marks: Array<Mark>, label: string): Promise<void> {
  marks.push({label, t: await pageNow(page)});
}

/**
 * THE STATIONARY CONFIRMATION, folded over the record (single-owner rework): a body released mid-screen legitimately
 * GLIDES home on the layer's own 340 ms reconcile tween (the physical gather when a flow swallows the hand) — mode
 * already 'docked', rect still travelling. A REAL escape STANDS: same spot (±8 px), out of the tray, ≥ 420 ms later —
 * read at a LATER recorded state that still shows it there, or at the end of the record (`endT`, the page at rest).
 * A record keeps a state only when it changes, so a body that MOVED at the next state was travelling, never standing.
 */
function anchorViolations(samples: ReadonlyArray<ObservedSample<DockState>>, marks: ReadonlyArray<Mark>, endT: number): Array<Violation> {
  type Seen = {x: number, y: number, t: number, body: OutBody, dock: string, surfaces: string};
  const pending = new Map<string, Seen>();
  const violations: Array<Violation> = [];
  const labelAt = (t: number) => [...marks].reverse().find((m) => m.t <= t)?.label ?? 'boot';
  const confirm = (seen: Seen) => {
    if (violations.length < 20) {
      violations.push({
        label: labelAt(seen.t),
        card: [seen.body.x, seen.body.y, seen.body.w, seen.body.h],
        dock: seen.dock.split(',').map(Number),
        surfaces: seen.surfaces,
      });
    }
  };
  for (const {t, v} of samples) {
    if (v.dock === null) {
      continue;
    }
    const outNow = new Set<string>();
    for (const body of v.out) {
      outNow.add(body.name);
      const seen = pending.get(body.name);
      if (seen === undefined || Math.abs(seen.x - body.x) > STAND_PX || Math.abs(seen.y - body.y) > STAND_PX) {
        pending.set(body.name, {x: body.x, y: body.y, t, body, dock: v.dock, surfaces: v.surfaces});
        continue; // first sighting / still moving — the tween is alive
      }
      if (t - seen.t >= STAND_MS) {
        pending.delete(body.name);
        confirm(seen);
      }
    }
    for (const name of [...pending.keys()]) {
      if (!outNow.has(name)) {
        pending.delete(name); // back in the tray / hidden / gone
      }
    }
  }
  for (const seen of pending.values()) {
    if (endT - seen.t >= STAND_MS) {
      confirm(seen); // the record ends with it still standing out of the tray
    }
  }
  return violations;
}

const PROFILES = [
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
      await settle(page);
      const marks: Array<Mark> = [];
      const anchor = await installAnchorWatch(page);

      // ── The play itself closes the «КАРТЫ В РУКЕ» workspace WHILE the hand
      //    loses a card — the flush that first shipped the defect. ──────────
      await mark(page, marks, 'play-card-from-hand');
      await playCardFromHand(page, 'Business Network');
      await settle(page);

      // ── The blue-action workspace: browse open/close, twice. ─────────────
      for (let i = 0; i < 2; i++) {
        await mark(page, marks, `actions-open-${i}`);
        await openCardActions(page).catch(() => {});
        await settle(page);
        await mark(page, marks, `actions-close-${i}`);
        await press(page, 'Escape', 1600);
      }

      // ── …its SETUP stage, then B twice (stage → browse → board). ─────────
      await mark(page, marks, 'focus-open');
      await openCardActions(page).catch(() => {});
      await settle(page);
      await openActionFocus(page).catch(() => {});
      await settle(page);
      await mark(page, marks, 'focus-back');
      await press(page, 'Escape', 1300);
      await mark(page, marks, 'focus-close');
      await press(page, 'Escape', 1800);

      // ── The one LEGAL journey: the hand album out of the dock and back. ──
      await mark(page, marks, 'hand-open');
      await press(page, 'Period', 800);
      await press(page, 'Enter', 2200);
      await mark(page, marks, 'hand-close');
      await press(page, 'Escape', 2400);

      // ── A workspace opened straight after that episode. ──────────────────
      await mark(page, marks, 'actions-after-hand-open');
      await openCardActions(page).catch(() => {});
      await settle(page);
      await mark(page, marks, 'actions-after-hand-close');
      await press(page, 'Escape', 1800);

      // ── A different workspace on the same shell (Standard Projects). ─────
      await mark(page, marks, 'stdp-open');
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1500);
      await mark(page, marks, 'stdp-close');
      await press(page, 'Escape', 1800);
      await press(page, 'Escape', 1200);

      // ── Rapid repeats: open/close cycles with no time to settle (the
      //    tour's subject — each press is a step of it, never a retry). ─────
      await mark(page, marks, 'rapid-cycles');
      for (let i = 0; i < 4; i++) {
        await press(page, 'Period', 400);
        await press(page, 'ArrowUp', 600);
        await press(page, 'Escape', 500);
      }
      await settle(page);
      const endT = await pageNow(page);
      const samples = await anchor.stop();
      const values = samples.map((s) => s.v);
      const violations = anchorViolations(samples, marks, endT);

      // A silently dead probe must never pass: the witness recorded at least the state it was armed in.
      expect(samples.length, 'the anchor probe must have sampled the whole tour')
        .toBeGreaterThan(0);
      expect(values.some((v) => v.dock !== null && v.ws), 'the tour must actually have opened the card-actions workspace')
        .toBe(true);

      const story = violations
        .map((v) => `[${v.label}] card=${JSON.stringify(v.card)} dock=${JSON.stringify(v.dock)} on=${v.surfaces}`)
        .join('\n  ');
      expect(violations.length,
        `a hand card left the tray:\n  ${story}`).toBe(0);

      // …and the CHASSIS itself never travels: the dock is welded into the
      // footer, so a workspace teardown that deforms the root column would
      // show up here even if nothing measured it.
      const dockRects = [...new Set(values.map((v) => v.dock).filter((d): d is string => d !== null))];
      expect(dockRects.length,
        `the dock chassis moved during the tour: ${dockRects.join(' | ')}`).toBe(1);
    });
  });
}
