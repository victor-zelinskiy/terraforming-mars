/*
 * CONSOLE SURFACE MOTION — the GSAP runtime (the director).
 *
 * The DOM half of the surface-motion system: a pair of Vue `<transition
 * :css="false">` hooks the shell binds to every MIGRATED band surface. The
 * hooks read `data-motion-surface` off the element, resolve the transition
 * kind through the PURE model (+ the store's departure / wheel-origin
 * captures) and play a short compositor-only choreography. Contracts
 * (playedCategoryDirector / consoleZoomMotion idioms):
 *
 *  - transform/opacity ONLY, on the surface's `[data-motion-panel]` (falling
 *    back to the root); the fixed band root itself is never animated, so the
 *    full-viewport geometry the fit engines measure stays put;
 *  - every hook is EPISODE-GUARDED (a per-element kill + a safety timer) —
 *    `done()` always fires, a stalled rAF can never wedge Vue's transition
 *    bookkeeping, a rapid re-open kills the previous tween mid-flight and
 *    continues from the live values;
 *  - durations resolve through `motionMs` (speed presets scale in lockstep);
 *    reduced motion snaps to the end state (a short opacity beat at most);
 *  - the shade owner registry is driven HERE (enter registers, leave
 *    releases) so the one `.con-shade` dim can never double or blink across
 *    a swap — the CSS transition on the shade does the rest;
 *  - a surface hidden by the hand/tableau PICK bridge (v-show) triggers the
 *    same hooks — those are recognized (isPickBridgeHidden) and resolved
 *    instantly: the pick's own hand choreography owns that beat.
 *
 * PHASE entries (composer → reveal result) additionally FLIP every anchor
 * (`data-motion-anchor` id matched against the captured departure) from its
 * old viewport rect into its new one — the source card physically travels
 * between the stages of one operation instead of blinking.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  CapturedRect,
  SurfaceMotionId,
  SurfaceDeparture,
} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {
  addShadeOwner,
  removeShadeOwner,
  isAnchorHandoffLive,
  takeSurfaceDeparture,
  takeWheelOrigin,
  takeWheelChosenSlot,
  takeWheelEcho,
  surfaceMotionState,
} from '@/client/console/surfaceMotion/surfaceMotionState';
import {colonyEntryCascade} from '@/client/console/consoleColonyFocusMotion';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** First appearance of a band surface. */
const OPEN_MS = 210;
/** Final exit of a band surface. */
const DISMISS_MS = 140;
/** The continuation entry of a phase handoff (faster than an open — the
 *  scene is already established; only the stage recomposes). */
const PHASE_MS = 190;
/** The anchor FLIP rides slightly longer than the panel so the travelling
 *  card is the last thing to settle — the eye follows it. */
const PHASE_ANCHOR_MS = 300;
/** The outgoing side of an ordinary handoff. */
const HANDOFF_OUT_MS = 110;
/** A departing WORKSPACE section dissolves over the re-appearing board —
 *  slightly longer than a modal dismiss (a full screen letting go). */
const SECTION_OUT_MS = 170;
/** The wheel family — mechanical, immediate. */
const WHEEL_IN_MS = 120;
const WHEEL_OUT_MS = 95;
const WHEEL_SLOT_STAGGER_S = 0.011;
/** Safety slack added to every hook's guarantee timer. */
const SAFETY_SLACK_MS = 450;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/**
 * A CLIENT PICK BRIDGE is out — the asking surface is hidden via `v-show`, so
 * the enter/leave pair Vue fires for that flip is the BRIDGE's beat, never a
 * real entrance or dismissal.
 *
 * ⚠ It reads the ONE fact the shell publishes (`pickBridgeActive` →
 * `setPickSuppressed`, the same computed its `v-show` is bound to) — never a
 * re-derivation from one bridge's module. It used to name only the HAND pick,
 * while the shell hid on `!handPickActive && !repeatPickActive`: opening the
 * Viron REPEAT pick therefore ran a genuine leave (which poses EVERY panel
 * under the root, the open composer's included) and closing it ran a genuine
 * enter (which restores only the outermost one). The action centre came back
 * with its breadcrumb and its command bar — and an empty frame.
 */
function isPickBridgeHidden(): boolean {
  return surfaceMotionState.pickSuppressed;
}

/**
 * Surfaces that NEVER own the shade:
 *  - the action composer is a CHILD layer of the action center (whose
 *    ownership already dims the stage) — and a child's leave hook never
 *    fires when its parent unmounts wholesale, so a child ownership would
 *    leak past the parent's teardown; the center's `--behind` recession
 *    carries its extra depth instead;
 *  - the MA screen + the generic bottom sheet keep their OWN dims by design
 *    (the MA workspace's depth-graded backdrop / bottom-sheet 0.6), so the
 *    full shade must not stack on top;
 *  - Info Mode is a Y-layer that opens OVER arbitrary surfaces (z 11560,
 *    above the shade) and carries its own full dim;
 *  - a SECTION (colonies / hydro) is a workspace, not a modal — no dim.
 */
const NON_SHADE_OWNERS: ReadonlySet<SurfaceMotionId> = new Set([
  'action-composer', 'ma-screen', 'sheet', 'info-mode', 'section',
]);

function surfaceIdOf(el: Element): SurfaceMotionId | undefined {
  const id = (el as HTMLElement).dataset?.motionSurface;
  return id === undefined || id === '' ? undefined : (id as SurfaceMotionId);
}

function panelOf(el: Element): HTMLElement | undefined {
  const panel = el.querySelector<HTMLElement>('[data-motion-panel]');
  return panel ?? (el instanceof HTMLElement ? el : undefined);
}

/**
 * The WORKSPACE FAMILY marker (`con-ws`, docs/claude/console/workspace-band.md):
 * a decision surface docked right of the player rail, sharing ONE frame box
 * with every other workspace. Their entrances must not travel — see the
 * materialize branch in `enterSurface`.
 */
function isWorkspaceSurface(el: Element): boolean {
  return el.classList.contains('con-ws');
}

/** EVERY panel under the root — a departing action center carries its open
 *  composer with it (the composer's own transition never fires when the
 *  parent unmounts), so the leave must move BOTH panels as one. */
function panelsOf(el: Element): Array<HTMLElement> {
  const panels = [...el.querySelectorAll<HTMLElement>('[data-motion-panel]')];
  if (panels.length > 0) {
    return panels;
  }
  return el instanceof HTMLElement ? [el] : [];
}

/** The per-element live tween registry — a new hook on the same element
 *  kills the previous episode and continues from the live values. */
const liveTweens = new WeakMap<Element, gsap.core.Timeline | gsap.core.Tween>();

function killLive(el: Element): void {
  liveTweens.get(el)?.kill();
  liveTweens.delete(el);
}

/**
 * Run `body` with a guaranteed completion: `finish` is once-gated, wired to
 * the returned timeline's onComplete AND a safety timer. The hook's `done`
 * can therefore never be dropped (Vue would otherwise strand the element).
 */
function guarded(
  el: Element,
  totalMs: number,
  done: () => void,
  body: (finish: () => void) => gsap.core.Timeline | gsap.core.Tween | undefined,
): void {
  killLive(el);
  let finished = false;
  let safety = 0;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    liveTweens.delete(el);
    done();
  };
  const tween = body(finish);
  if (tween === undefined) {
    finish();
    return;
  }
  liveTweens.set(el, tween);
  safety = window.setTimeout(finish, motionMs(totalMs) + SAFETY_SLACK_MS);
}

// ── the enter hook ──────────────────────────────────────────────────────────

/**
 * Vue `@enter` for a migrated band surface. Resolves the entry kind:
 *  - a fresh departure capture linking to this surface → PHASE continuation
 *    (+ anchor FLIPs);
 *  - a fresh wheel origin → directional entry from the chosen slot;
 *  - the quick wheel itself → the mechanical wheel-open;
 *  - otherwise → the standard open rise.
 */
export function surfaceEnterHook(el: Element, done: () => void): void {
  const id = surfaceIdOf(el);
  if (id === undefined || typeof window === 'undefined') {
    done();
    return;
  }
  // The reveal's headless variant renders nothing (the fullscreen dialog owns
  // the presentation) and the drawn variant is choreographed by its own draw
  // cinematic (deal-in slots, bonus veils) — the band motion must not touch
  // their opacity. They still own the shade (drawn) or not (headless).
  const variant = (el as HTMLElement).dataset?.motionVariant;
  if (variant !== 'headless' && !NON_SHADE_OWNERS.has(id)) {
    addShadeOwner(id);
  }
  // A pick-bridge re-show (v-show flip back) is NOT an entrance — the
  // re-shown surface must cover the section switch in the same frame.
  const pickReturn = (el as HTMLElement).dataset?.motionPickHidden === '1';
  if (pickReturn) {
    delete (el as HTMLElement).dataset.motionPickHidden;
  }
  if (isPickBridgeHidden() || pickReturn || variant === 'headless' || variant === 'drawn') {
    killLive(el);
    done();
    return;
  }
  const panel = panelOf(el);
  if (panel === undefined) {
    done();
    return;
  }
  // THE ENTRANCE MUST HEAL EVERYTHING THE DEPARTURE POSED. The leave moves
  // EVERY panel under the root as one (`panelsOf` — a departing centre carries
  // its open composer with it, whose own transition never fires); the entrance
  // animates only the OUTERMOST one, so a nested panel would keep the leave's
  // `opacity: 0` for the rest of the surface's life — frame back, content gone.
  // A leave and an enter must clear the same set, or the pair is not reversible.
  const nested = panelsOf(el).slice(1);
  if (nested.length > 0) {
    gsap.set(nested, {clearProps: 'transform,opacity,visibility'});
  }
  // …AND THE SAME RULE FOR ANCHORS. A leave that hands its card to an
  // incoming FLIP BLANKS its own copy (`opacity: 0`) so the travelling card is
  // never double — which is free for a surface that then unmounts, and a
  // permanent hole in one hidden by `v-show`. The action workspace is exactly
  // that: it waits, mounted, under a card's Hydronetwork step, so on the walk
  // back its hero slot came up EMPTY and stayed empty for the rest of the
  // game. Heal here, before the FLIP re-poses whatever it claims.
  const anchors = el.querySelectorAll<HTMLElement>('[data-motion-anchor]');
  if (anchors.length > 0) {
    gsap.set(anchors, {clearProps: 'opacity'});
  }
  const reduced = consoleReducedMotionActive();
  const departure = takeSurfaceDeparture(id);
  const wheelOrigin = id === 'quick' ? undefined : takeWheelOrigin();
  const kind = departure !== undefined ? 'phase' :
    id === 'quick' ? 'wheel-open' :
      wheelOrigin !== undefined ? 'wheel-handoff' : 'open';

  if (reduced) {
    // Reduced motion: no travel — a short functional fade only.
    guarded(el, 160, done, (finish) => {
      gsap.set(panel, {clearProps: 'transform,opacity,visibility'});
      return gsap.fromTo(panel, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.12, ease: 'power1.out', onComplete: finish});
    });
    return;
  }

  // ── THE WORKSPACE FAMILY MATERIALIZES IN PLACE ───────────────────────────
  // A workspace surface (the `con-ws` marker: everything docked right of the
  // player rail between the two bars) is a FRAME the player learns the
  // position of — every one of them shares the same box. So its entrance may
  // never TRAVEL: a directional push (the wheel handoff's impulse, the
  // default rise) made the frame land a few px off its final geometry and
  // snap, which reads as a layout jump rather than motion. The whole family
  // therefore composes with opacity + a hair of scale ONLY, from its own
  // centre — the position is right on the first painted frame.
  // Two deliberate exemptions: a PHASE swap (one surface becoming the next —
  // its FLIP is the whole point) and the command WHEEL, whose cross assembles
  // from its own hub without the frame ever moving.
  if (isWorkspaceSurface(el) && kind !== 'phase' && id !== 'quick') {
    // The colonies' content phrase (islands → planets → rail) outlives the
    // panel materialize — give its guard timer the room.
    guarded(el, OPEN_MS + (id === 'section' ? 1200 : 320), done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      tl.fromTo(panel,
        {autoAlpha: 0, scale: 0.988, transformOrigin: '50% 50%'},
        {autoAlpha: 1, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      // The surface's own dim (the info workspace opens over arbitrary band
      // surfaces and carries one) fades with the frame, never after it.
      const backdrop = el.querySelector<HTMLElement>('.con-info__backdrop, .con-sheet__backdrop');
      if (backdrop !== null) {
        tl.fromTo(backdrop, {opacity: 0}, {opacity: 1, duration: s(200), ease: 'power1.out', clearProps: 'opacity'}, 0);
      }
      contentCascade(id, el, tl, s(40));
      // The wheel's pressed symbol ECHOES on the destination (a local
      // materialize — nothing travels), the one handoff cue kept here.
      // ⚠ The echo target is the surface's PERMANENT identity emblem, and the
      // surface lives a whole flow after this one-shot — so the echo must be
      // UNSTRANDABLE. The old fromTo(autoAlpha: 0) applied its from-state at
      // BUILD (immediateRender), and a timeline killed before the tween's cue
      // never fires onInterrupt on the unstarted child: the emblem stayed at
      // inline opacity 0 for the workspace's whole life («the lightning is
      // just gone»). Now: (1) every enter first HEALS any stale inline state;
      // (2) the echo is scale-only (opacity is never touched — NORTH STAR:
      // the identity symbol never blinks) with immediateRender: false, so an
      // early kill leaves NOTHING behind.
      const echo = kind === 'wheel-handoff' ? takeWheelEcho() : undefined;
      const echoEl = echo !== undefined ?
        el.querySelector<HTMLElement>(`[data-wheel-anchor="${echo}"]`) : null;
      if (echoEl !== null) {
        gsap.set(echoEl, {clearProps: 'transform,opacity,visibility'});
        tl.fromTo(echoEl,
          {scale: 0.8, transformOrigin: '50% 50%'},
          {
            scale: 1, duration: s(160), ease: 'power2.out', immediateRender: false, clearProps: 'transform',
            onInterrupt: () => gsap.set(echoEl, {clearProps: 'transform'}),
          }, s(90));
      }
      return tl;
    });
    return;
  }

  // (The generic bottom sheet's authored rise-from-the-bar is retired: the
  // sheet is a WORKSPACE surface now and shares the family's materialize —
  // one entrance language for every screen docked beside the rail.)

  // THE INFORMATION WORKSPACE (Y): the frame UNFOLDS from the left rail's
  // seam — the workspace reads as the rail's own detail surface extending
  // rightward, never a modal landing on top of the game. The OWN dim (the
  // workspace opens over arbitrary band surfaces) fades in with it instead
  // of popping, and the content composes left→right (contentCascade).
  if (id === 'info-mode') {
    const backdrop = el.querySelector<HTMLElement>('.con-info__backdrop');
    guarded(el, OPEN_MS + 360, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      if (backdrop !== null) {
        tl.fromTo(backdrop, {opacity: 0}, {opacity: 1, duration: s(200), ease: 'power1.out', clearProps: 'opacity'}, 0);
      }
      tl.fromTo(panel,
        {autoAlpha: 0, x: -20 * conUiScale(), scale: 0.992, transformOrigin: '0% 38%'},
        {autoAlpha: 1, x: 0, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(20));
      contentCascade(id, el, tl, s(60));
      return tl;
    });
    return;
  }

  switch (kind) {
  case 'phase':
    enterPhase(el, panel, departure as SurfaceDeparture, done);
    return;
  case 'wheel-open':
    guarded(el, WHEEL_IN_MS + 160, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      tl.fromTo(panel,
        {autoAlpha: 0, scale: 0.96, transformOrigin: '50% 58%'},
        {autoAlpha: 1, scale: 1, duration: s(WHEEL_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      // The cross ASSEMBLES from its hub: the centre slot pops first, the
      // four arms slide out into their places (each from the centre's
      // direction), the key caps print on last. Transform/opacity only,
      // fully input-transparent — a press mid-assembly lands normally.
      const u = conUiScale();
      const centre = el.querySelector<HTMLElement>('.con-quick__slot--center');
      if (centre !== null) {
        tl.fromTo(centre,
          {scale: 0.9, opacity: 0},
          {scale: 1, opacity: 1, duration: s(120), ease: 'back.out(1.5)', clearProps: 'transform,opacity'}, 0);
      }
      const arms: ReadonlyArray<readonly [string, number, number]> = [
        ['up', 0, 12], ['down', 0, -12], ['left', 12, 0], ['right', -12, 0],
      ];
      arms.forEach(([slot, dx, dy], i) => {
        const armEl = el.querySelector<HTMLElement>(`.con-quick__slot--${slot}`);
        if (armEl !== null) {
          tl.fromTo(armEl,
            {x: dx * u, y: dy * u, opacity: 0},
            {x: 0, y: 0, opacity: 1, duration: s(130), ease: 'expo.out', clearProps: 'transform,opacity'},
            s(25) + i * WHEEL_SLOT_STAGGER_S);
        }
      });
      const keys = el.querySelectorAll<HTMLElement>('.con-quick__slot-key');
      if (keys.length > 0) {
        tl.fromTo(keys,
          {opacity: 0},
          {opacity: 1, duration: s(90), ease: 'power1.out', clearProps: 'opacity'}, s(70));
      }
      return tl;
    });
    return;
  case 'wheel-handoff': {
    // CONTEXT REVEAL: the surface forms IN PARALLEL with the wheel's depth
    // collapse, rising from the chosen slot's direction — the commit's
    // impulse carries into the next screen (a small directional bias, never
    // a slide). The destination's own emblem ECHOES the pressed symbol a
    // beat into the reveal (a local materialize — nothing travels), and the
    // surface's CONTENT composes in its own short cascade (contentCascade).
    const origin = wheelOrigin as {x: number, y: number};
    const echo = takeWheelEcho();
    const echoEl = echo !== undefined ?
      el.querySelector<HTMLElement>(`[data-wheel-anchor="${echo}"]`) : null;
    guarded(el, OPEN_MS + 320, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      if (id === 'std-projects') {
        // The Standard-Projects screen is the wheel's own centre unfolding —
        // a firmer geometric expansion from the hub (lighter than the
        // full-screen workspace reveals by design).
        tl.fromTo(panel,
          {autoAlpha: 0, scale: 0.955, transformOrigin: '50% 46%'},
          {autoAlpha: 1, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      } else {
        const rect = panel.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = origin.x - cx;
        const dy = origin.y - cy;
        const len = Math.max(1, Math.hypot(dx, dy));
        const push = Math.min(18 * conUiScale(), len * 0.08);
        tl.fromTo(panel,
          {autoAlpha: 0, x: (dx / len) * push, y: (dy / len) * push, scale: 0.985, transformOrigin: '50% 50%'},
          {autoAlpha: 1, x: 0, y: 0, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      }
      contentCascade(id, el, tl, s(40));
      if (echoEl !== null) {
        // Same unstrandable echo as the workspace branch above: heal first,
        // then a scale-only pop that never touches the emblem's opacity.
        gsap.set(echoEl, {clearProps: 'transform,opacity,visibility'});
        tl.fromTo(echoEl,
          {scale: 0.8, transformOrigin: '50% 50%'},
          {
            scale: 1, duration: s(160), ease: 'power2.out', immediateRender: false, clearProps: 'transform',
            onInterrupt: () => gsap.set(echoEl, {clearProps: 'transform'}),
          }, s(90));
      }
      return tl;
    });
    return;
  }
  default:
    guarded(el, OPEN_MS + 320, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      tl.fromTo(panel,
        {autoAlpha: 0, y: 14 * conUiScale(), scale: 0.986, transformOrigin: '50% 62%'},
        {autoAlpha: 1, y: 0, scale: 1, duration: s(OPEN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, 0);
      contentCascade(id, el, tl, s(40));
      return tl;
    });
  }
}

/**
 * The per-surface CONTENT CASCADE of a fresh reveal: the shell/chrome leads
 * (the base panel tween), then the surface's own large content composes in a
 * short stagger — the premium "the context forms" beat. Selector-driven and
 * capped (a miss is a silent no-op; a long list animates only its first
 * rows), transform/opacity only. `fromTo` immediateRender hides the
 * cascading elements from the first frame — no flash before their cue.
 */
function contentCascade(id: SurfaceMotionId, el: Element, tl: gsap.core.Timeline, at: number): void {
  const u = conUiScale();
  if (id === 'info-mode') {
    // The dossier composes FROM the rail seam: identity header first, then
    // the detail columns spread left→right (the bot dashboard's grid blocks
    // ride the same cue). Selector misses are silent no-ops (detail screens
    // re-open with their own layout).
    const head = el.querySelector<HTMLElement>('.con-info__head');
    const cols = [...el.querySelectorAll<HTMLElement>('.con-info__col, .con-info__grid > .con-info__block')].slice(0, 8);
    if (head !== null) {
      tl.fromTo(head,
        {y: -6 * u, opacity: 0},
        {y: 0, opacity: 1, duration: s(150), ease: 'power2.out', clearProps: 'transform,opacity'}, at);
    }
    if (cols.length > 0) {
      tl.fromTo(cols,
        {x: -12 * u, opacity: 0},
        {x: 0, opacity: 1, duration: s(180), ease: 'power2.out', stagger: 0.035, clearProps: 'transform,opacity'}, at + s(30));
    }
    return;
  }
  if (id === 'std-projects') {
    const rows = [...el.querySelectorAll<HTMLElement>('.con-stdp__card')].slice(0, 10);
    if (rows.length > 0) {
      tl.fromTo(rows,
        {y: 8 * u, opacity: 0},
        {y: 0, opacity: 1, duration: s(150), ease: 'power2.out', stagger: 0.014, clearProps: 'transform,opacity'}, at);
    }
    return;
  }
  if (id === 'card-actions') {
    // Filters settle from above, the dossier column slides in from its
    // flank, the action groups compose upward — three planes, one rhythm.
    const filters = el.querySelector<HTMLElement>('.con-cardactions__filters');
    const detail = el.querySelector<HTMLElement>('.con-cardactions__detail');
    const groups = [...el.querySelectorAll<HTMLElement>('.con-cardactions__group')].slice(0, 8);
    if (filters !== null) {
      tl.fromTo(filters,
        {y: -6 * u, opacity: 0},
        {y: 0, opacity: 1, duration: s(140), ease: 'power2.out', clearProps: 'transform,opacity'}, at);
    }
    if (detail !== null) {
      tl.fromTo(detail,
        {x: -10 * u, opacity: 0},
        {x: 0, opacity: 1, duration: s(170), ease: 'power2.out', clearProps: 'transform,opacity'}, at + s(30));
    }
    if (groups.length > 0) {
      tl.fromTo(groups,
        {y: 10 * u, opacity: 0},
        {y: 0, opacity: 1, duration: s(160), ease: 'power2.out', stagger: 0.016, clearProps: 'transform,opacity'}, at + s(50));
    }
    return;
  }
  if (id === 'section') {
    // The COLONY WORKSPACE speaks its OWN entry phrase, shared verbatim with
    // its embedded-step door (consoleColonyFocusMotion.colonyEntryCascade):
    // the fleet dock settles from above, the colony ISLANDS surface in
    // reading order with their planets arriving a beat later, the compact
    // status rail seats last. The strategic context assembles, never pops.
    // ⚠ `el` IS `.con-colonies` here (the section root carries the motion
    // marker) — the old `el.querySelector('.con-colonies')` guard matched
    // descendants only, so this whole branch was silently dead and the
    // workspace arrived as a bare panel fade («колонии просто появляются»).
    const colonies = el instanceof HTMLElement && el.classList.contains('con-colonies') ?
      el : el.querySelector<HTMLElement>('.con-colonies');
    if (colonies === null) {
      return; // the hydro section — panel materialize only
    }
    const fleet = el.querySelector<HTMLElement>('.con-colonies__fleetbar');
    if (fleet !== null) {
      tl.fromTo(fleet,
        {y: -6 * u, opacity: 0},
        {y: 0, opacity: 1, duration: s(150), ease: 'power2.out', clearProps: 'transform,opacity'}, at);
    }
    colonyEntryCascade(tl, colonies, at + s(40));
  }
}

/**
 * PHASE continuation: the panel enters as the next stage of the SAME scene —
 * a soft directional recompose from the outgoing panel's centre — while every
 * shared anchor FLIPs from its captured rect into its new home (the source
 * card travels; the eye keeps its object).
 */
function enterPhase(el: Element, panel: HTMLElement, dep: SurfaceDeparture, done: () => void): void {
  // THE CARRIED OBJECTS, decided BEFORE anything is posed — the panel's own
  // entrance depends on whether one exists.
  const carried = Array.from(el.querySelectorAll<HTMLElement>('[data-motion-anchor]'))
    .map((node) => ({node, from: dep.anchors.get(node.dataset.motionAnchor ?? '')}))
    .filter((c): c is {node: HTMLElement, from: CapturedRect} => c.from !== undefined);

  guarded(el, PHASE_ANCHOR_MS + 240, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    const rect = panel.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (dep.panel !== undefined) {
      dx = (dep.panel.left + dep.panel.width / 2) - (rect.left + rect.width / 2);
      dy = (dep.panel.top + dep.panel.height / 2) - (rect.top + rect.height / 2);
    }
    const cap = 26 * conUiScale();
    const clamp = (v: number) => Math.max(-cap, Math.min(cap, v * 0.16));
    // ⚠️ A SCENE THAT CARRIES AN OBJECT MAY NOT MOVE UNDER IT. The panel's
    // directional recompose is a `scale` + `translate` on the very ancestor the
    // anchor is measured inside, so its rect during the entrance is not the
    // rect it will rest at — the FLIP then aims at a moving, shrunken target
    // and the card reads as «something growing over on the left» instead of
    // the object the player was just holding. When something is carried the
    // scene MATERIALISES in place instead; the travel the eye follows is the
    // card's, and there is only one of it.
    tl.fromTo(panel,
      carried.length > 0 ?
        {autoAlpha: 0} :
        {autoAlpha: 0, x: clamp(dx), y: clamp(dy), scale: 0.99, transformOrigin: '50% 50%'},
      {autoAlpha: 1, x: 0, y: 0, scale: 1, duration: s(PHASE_MS), ease: 'power3.out', clearProps: 'transform,opacity,visibility'}, 0);

    if (carried.length === 0) {
      return tl;
    }
    // HOLD the carried objects while their destination settles. `@enter` fires
    // with the surface in the DOM but not yet laid out by its own machinery (a
    // screen that seats a scene layer, publishes a zone and re-fits a rail
    // settles over several frames), so a rect read now is a PRE-LAYOUT one —
    // measured on the Hydronetwork's source dock: 216px out. They are invisible
    // for that gap rather than painted at a home they are about to leave.
    gsap.set(carried.map((c) => c.node), {autoAlpha: 0});
    settledRects(carried.map((c) => c.node), (rects) => {
      if (!el.isConnected) {
        gsap.set(carried.map((c) => c.node), {clearProps: 'transform,opacity,visibility'});
        return;
      }
      carried.forEach(({node, from}, i) => {
        const to = rects[i];
        const scale = to === undefined || to.width < 10 ? NaN : from.width / to.width;
        if (to === undefined || !isFinite(scale) || scale <= 0) {
          gsap.set(node, {clearProps: 'transform,opacity,visibility'});
          return;
        }
        // ZOOM COMPENSATION: card slots live inside CSS `zoom:` contexts, which
        // rescale a child's transform pixels — viewport-px deltas must be
        // divided by the effective zoom (visual width / layout width) or the
        // card undershoots.
        const effZoom = node.offsetWidth > 0 ? to.width / node.offsetWidth : 1;
        // `overwrite` — the arriving surface may run its OWN entry cascade over
        // the same element. Two un-owned tweens on one transform leave whichever
        // finishes first in charge of the final frame, which is how a travelling
        // card ended up wearing a stale translate for the rest of its life.
        gsap.fromTo(node,
          {x: (from.left - to.left) / effZoom, y: (from.top - to.top) / effZoom, scale,
            transformOrigin: 'top left', autoAlpha: 1},
          {x: 0, y: 0, scale: 1, duration: s(PHASE_ANCHOR_MS), ease: 'power3.inOut',
            overwrite: 'auto', clearProps: 'transform,opacity,visibility'});
      });
    });
    return tl;
  });
}

/**
 * THE RECTS OF `nodes`, ONCE THEY HAVE STOPPED MOVING.
 *
 * Two agreeing frames, bounded — the project's own settle rule, and the only
 * honest way to aim a FLIP at a surface that lays ITSELF out after mounting.
 * Falls through with whatever it has on the bound, so a target that never
 * settles degrades to a slightly-off travel rather than to nothing at all.
 */
function settledRects(
  nodes: ReadonlyArray<HTMLElement>,
  done: (rects: ReadonlyArray<DOMRect | undefined>) => void,
): void {
  const MAX_FRAMES = 12;
  let frames = 0;
  let last = '';
  const read = (): Array<DOMRect> => nodes.map((n) => n.getBoundingClientRect());
  const sample = () => {
    frames++;
    const rects = read();
    const sig = rects.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`).join('|');
    if ((sig === last && rects.every((r) => r.width >= 10)) || frames >= MAX_FRAMES) {
      done(rects);
      return;
    }
    last = sig;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

// ── the wheel's COMMIT PIN ──────────────────────────────────────────────────

/**
 * PIN THE QUICK WHEEL TO THE BOX IT WAS CHOSEN IN.
 *
 * Called at the COMMIT, in the same pre-flush breath as `markWheelHandoff`
 * captures the slot's centre — and for exactly the same reason: everything
 * this reads is about to stop being true.
 *
 * The wheel is a BAND surface, so its four insets ARE the central opening's
 * live geometry (`--con-stage-*`, plus the shell's `.con-root--rail-replaced`
 * policy). And the very press that dismisses it is what opens the workspace
 * that takes the strategy rail's zone — a SHEET screen raises the policy class
 * (`--con-stage-r-eff: 0`), a SECTION workspace `v-show`s the rail away so the
 * geometry mirror measures 0×0 and publishes the collapsed inset. Both land in
 * the SAME Vue flush as the wheel's leave, so the departing cross re-solves in
 * the now-wider opening and slides half a rail sideways on the first painted
 * frame of its own recession: a one-frame twitch precisely where the grammar
 * promises «the assembly hands its depth to the incoming context».
 *
 * The fix is the box, not the timing: the four inset properties the band mixin
 * owns are re-declared inline at their used pixel values, so the leaving wheel
 * cannot follow the tokens any more. Nothing else is touched — same z, same
 * flex centring, same exit timeline; the wheel simply plays it where the player
 * pressed it. `surfaceLeaveCancelledHook` clears the pin, so a re-opened wheel
 * is centred by the live opening again.
 *
 * ⚠️ WHY NOT IN THE LEAVE HOOK. That hook runs mid-patch, and both
 * `getBoundingClientRect` and `getComputedStyle` flush style there — by then
 * the policy class is already on `.con-root`, so the "live" box it would read
 * is the moved one. The honest capture point is BEFORE the state change, which
 * is why this is a commit-time call and not another branch of the leave.
 *
 * ⚠️ AND NOT A CONSTANT RIGHT EDGE ON `.con-quick` EITHER (the `right: 0` trick
 * `.con-ws-stage-sides()` uses for screens): the wheel legitimately centres in
 * whatever opening it was OPENED in — including the wider one it gets during a
 * placement, where the context dossier already holds the rail's zone. Welding
 * its resting edge would move the cross in that state to fix a transition.
 */
export function pinQuickWheelBox(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.querySelector<HTMLElement>('.con-quick');
  if (el === null) {
    return;
  }
  const cs = getComputedStyle(el);
  // A positioned box resolves its insets to used pixels — re-declaring them is
  // a byte-for-byte freeze of the SAME box (no border/box-sizing arithmetic,
  // which a width/height freeze would have to get right).
  if (cs.left === 'auto' || cs.right === 'auto') {
    return; // not the band geometry we know how to pin — leave it alone
  }
  gsap.set(el, {left: cs.left, right: cs.right, top: cs.top, bottom: cs.bottom});
}

// ── the leave hook ──────────────────────────────────────────────────────────

/**
 * Vue `@leave` for a migrated band surface. The wheel's leave distinguishes
 * a plain dismiss from a slot handoff (the chosen slot flashes its impulse);
 * every other surface departs with a short, confident drop. The shade owner
 * releases IMMEDIATELY (the shade's own CSS fade runs in parallel — or holds,
 * when the next owner registered in the same flush).
 */
export function surfaceLeaveHook(el: Element, done: () => void): void {
  const id = surfaceIdOf(el);
  if (id === undefined || typeof window === 'undefined') {
    done();
    return;
  }
  removeShadeOwner(id);
  const variant = (el as HTMLElement).dataset?.motionVariant;
  if (isPickBridgeHidden()) {
    // The pick bridge hides the surface via v-show — mark it so the flip
    // BACK is recognized as a re-show (instant), not a fresh entrance.
    (el as HTMLElement).dataset.motionPickHidden = '1';
    killLive(el);
    done();
    return;
  }
  if (variant === 'headless') {
    killLive(el);
    done();
    return;
  }
  const panels = panelsOf(el);
  const panel = panels[0];
  if (panel === undefined) {
    done();
    return;
  }
  // A departing WORKSPACE SECTION (colonies / hydro) must leave the flex
  // flow BEFORE its exit plays: it shares `.con-main` with the re-appearing
  // board, and squeezing the board for the exit's lifetime made the planet
  // mount at half width (a tiny --board-scale), then JUMP to full size on
  // the unmount reflow — while the leaver itself flashed squeezed on the
  // right. FROZEN at its live rect (fixed, pointer-inert, above the board's
  // stacking level) the workspace dissolves OVER the planet, which owns its
  // full home from the FIRST frame — fitBoard keeps its stored scale and
  // never recomputes mid-exit. Applied synchronously in the leave hook (the
  // same pre-paint task as the board's v-show flip), so no squeezed frame
  // can ever paint.
  if (id === 'section' && el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    gsap.set(el, {
      position: 'fixed',
      left: r.left, top: r.top, width: r.width, height: r.height,
      margin: 0, zIndex: 5, pointerEvents: 'none',
    });
  }
  // An anchored FLIP is claiming this surface's card (composer → reveal):
  // blank the departing anchors instantly so the travelling card exists on
  // the INCOMING side only — never a double image.
  if (isAnchorHandoffLive()) {
    const anchors = el.querySelectorAll<HTMLElement>('[data-motion-anchor]');
    if (anchors.length > 0) {
      gsap.set(anchors, {opacity: 0});
    }
  }
  if (consoleReducedMotionActive()) {
    guarded(el, 140, done, (finish) => gsap.to(panels, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', onComplete: finish}));
    return;
  }
  if (id === 'quick') {
    const chosen = takeWheelChosenSlot();
    guarded(el, WHEEL_OUT_MS + 150, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      const u = conUiScale();
      if (chosen !== undefined) {
        // PRESS → MECHANICAL COMMIT → DEPTH COLLAPSE. The commit is the
        // moment of отдача that replaced the arcade icon flight: small,
        // dense, layered — never a bounce, never a show.
        const chosenEl = el.querySelector<HTMLElement>(`.con-quick__slot--${chosen}`);
        const body = chosenEl === null ? null : chosenEl.querySelector<HTMLElement>('.con-quick__slot-body');
        const icon = chosenEl === null ? null : chosenEl.querySelector<HTMLElement>('.con-quick__slot-icon');
        const rest = [...el.querySelectorAll<HTMLElement>('.con-quick__slot')].filter((n) => n !== chosenEl);
        // 1 · MECHANICAL COMMIT: the armed body (held toward the player by
        // its CSS state) drives IN — fast start, dense contact, immediate
        // fixation. The icon lags a hair behind its shell: two masses, one
        // mechanism.
        if (body !== null) {
          tl.to(body, {y: 3 * u, scale: 0.982, duration: s(60), ease: 'power3.in'}, 0);
        }
        if (icon !== null) {
          tl.to(icon, {scale: 0.94, duration: s(70), ease: 'power2.in'}, s(15));
        }
        // 2 · DEPTH COLLAPSE: the neighbours lose their interactive layer
        // first (a slight settle back, no drift)…
        if (rest.length > 0) {
          tl.to(rest, {scale: 0.985, y: 2 * u, autoAlpha: 0, duration: s(85), ease: 'power2.in'}, s(50));
        }
        // …the chosen tile stays readable a few beats longer, then follows…
        if (chosenEl !== null) {
          tl.to(chosenEl, {autoAlpha: 0, scale: 0.99, duration: s(80), ease: 'power2.in'}, s(95));
        }
        // …and the whole assembly recedes ONE layer back — never a zoom,
        // never a point-collapse: it hands its depth to the incoming
        // context, which is already forming in parallel.
        tl.to(panel, {autoAlpha: 0, scale: 0.972, y: 6 * u, transformOrigin: '50% 58%', duration: s(110), ease: 'power2.in'}, s(70));
      } else {
        // DISMISS (B): the cross lets go inward — the assembly in reverse,
        // faster and softer (no celebratory beat, just a clean release).
        const slots = el.querySelectorAll<HTMLElement>('.con-quick__slot');
        if (slots.length > 0) {
          for (const n of slots) {
            const cls = n.className;
            const dx = cls.includes('--left') ? 5 : cls.includes('--right') ? -5 : 0;
            const dy = cls.includes('--up') ? 5 : cls.includes('--down') ? -5 : 0;
            tl.to(n, {x: dx * u, y: dy * u, opacity: 0, duration: s(75), ease: 'power2.in'}, 0);
          }
        }
        tl.to(panel, {autoAlpha: 0, scale: 0.975, transformOrigin: '50% 58%', duration: s(WHEEL_OUT_MS), ease: 'power2.in'}, s(15));
      }
      return tl;
    });
    return;
  }
  // THE INFORMATION WORKSPACE dismiss: the frame returns INTO the rail seam
  // (the reverse of its unfold) and its OWN dim fades with it — the board
  // underneath re-emerges gradually, never in a backdrop pop.
  if (id === 'info-mode') {
    const backdrop = el.querySelector<HTMLElement>('.con-info__backdrop');
    guarded(el, DISMISS_MS + 100, done, (finish) => {
      const tl = gsap.timeline({onComplete: finish});
      tl.to(panels, {
        autoAlpha: 0,
        x: -14 * conUiScale(),
        scale: 0.994,
        transformOrigin: '0% 40%',
        duration: s(DISMISS_MS + 20),
        ease: 'power2.in',
      }, 0);
      if (backdrop !== null) {
        tl.to(backdrop, {opacity: 0, duration: s(DISMISS_MS + 60), ease: 'power1.in'}, 0);
      }
      return tl;
    });
    return;
  }
  guarded(el, id === 'section' ? SECTION_OUT_MS : DISMISS_MS, done, (finish) => gsap.to(panels, {
    autoAlpha: 0,
    y: 8 * conUiScale(),
    scale: id === 'section' ? 0.988 : 0.992,
    transformOrigin: '50% 60%',
    duration: s(id === 'section' ? SECTION_OUT_MS :
      id === 'action-composer' || id === 'card-actions' ? HANDOFF_OUT_MS : DISMISS_MS),
    ease: 'power2.in',
    onComplete: finish,
  }));
}

/** Vue `@enter-cancelled` / `@leave-cancelled` — re-align the shade owner
 *  with the element's ACTUAL direction and drop the dead tween. */
export function surfaceEnterCancelledHook(el: Element): void {
  const id = surfaceIdOf(el);
  killLive(el);
  if (id !== undefined) {
    removeShadeOwner(id);
  }
}

export function surfaceLeaveCancelledHook(el: Element): void {
  const id = surfaceIdOf(el);
  killLive(el);
  // A cancelled section leave returns to the flow — drop the freeze; a
  // cancelled wheel leave (the player re-opened a selector mid-recession, so
  // Vue re-uses the very same element) drops its commit PIN and is centred by
  // the live opening again. Harmless for every other surface: none carries
  // these inline props.
  gsap.set(el, {clearProps: 'position,left,right,top,bottom,width,height,margin,zIndex,pointerEvents'});
  if (id !== undefined && (el as HTMLElement).dataset?.motionVariant !== 'headless' && !NON_SHADE_OWNERS.has(id)) {
    addShadeOwner(id);
  }
}
