/**
 * THE TIMING / STORYBOARD CLASS (the e2e speed iteration, `docs/claude/e2e-speed-iteration.md`).
 *
 * Every spec runs in the FUNCTIONAL configuration by default — `?fastboot=1` (no GPU warm-up phases, no
 * curtain minima), the adaptive press, the product's motion at ×0.5 — because what those specs assert is
 * LOGIC, and the first instrumented samples put the product at 9 % of a run. The specs listed here assert
 * MOTION itself: a storyboard, a flight's ends, a cursor that must not jump, a tick riding a touchdown, a
 * frame budget. For them the driver passes none of the fast flags (real boot, the fixed press settle, motion
 * ×1), and they are run `--exclusive` (`npm run e2e:remote -- <task> <spec> --exclusive --workers=1`): a
 * neighbour's run beside a timing is no timing.
 *
 * HOW THE LIST GROWS — empirically, never by a grep: a spec that goes red in the fast configuration for a
 * TIMING reason (a witness that samples motion, a frame budget, a dwell) is added here with the reason; a
 * spec that goes red for a LOGIC reason is fixed. The seed: every `*probe*` (perf / landing / pose / entry
 * probes), the motion-grammar guards, and the four the first broad sample named.
 */
export const TIMING_SPECS: ReadonlySet<string> = new Set([
  // the four the first broad sample named (28 specs at motion ×0.5, 2026-10-21)
  'console-aerial-mappers.spec.ts', // the transfer witness: endsOverGlass at tv4k
  'console-supercomputer.spec.ts', // the transfer witness: endsOverGlass at tv4k
  'console-action-price-fold.spec.ts', // T09 bench: a storyboard + the fold measured against the tokens' touchdowns (BY)
  'console-cursor.spec.ts', // «a face that jumped with no motion» — the cursor grammar's sampler
  'console-parliament-sitting-reward.spec.ts', // «the tick rides the touchdown» — a touchdown/tick window
  'console-plasma-fans.spec.ts', // «the Greens' +2 ticks a beat AFTER the rating» — the gap is `motionMs(90)`, 45 ms at ×0.5 (T09 regression, 2026-10-22: 43 ms vs the spec's 60)
  'console-flight-paint.spec.ts', // T12 / CA stand: the paint of every token sampled on its whole path (birth · approach · touchdown) against the rail, the strip and the plaques — motion itself
  'console-finale-podium.spec.ts', // T08 «the count arrives as light»: the ignition cascade's stagger, the hurry's share of a natural category, the ranking / crowning FLIPs at the full pace — motion itself
  // the full functional baseline on Chromium 156 (2026-10-22, four workers on the Steam Machine)
  'console-delta-card-advance.spec.ts', // «the whole leg must play»: span > 600 ms of the marker's glide — 518–534 ms at ×0.5
  'console-expedition-mechs.spec.ts', // the transfer witness: endsOverGlass at tv4k (the data's token born on its pay row as the composer leaves) — green at ×1
  'console-ichtiology-grant.spec.ts', // the transfer witness: endsOverGlass at tv4k (the +2 born on the printed animal) — red 2 / 2 at ×0.5, green 3 / 3 at ×1
  'console-habitat-science.spec.ts', // a DETACHED token's landing on the satellite where it stands — flaky at ×0.5, 3 / 3 at ×1
  'console-overclocked-equipment.spec.ts', // the transfer witness: the −3 off the rail and the +1 born on the printed «?» — red 2 / 2 at ×0.5, 5 / 5 at ×1
  'console-parliament-colonial.spec.ts', // «the read beat lasted» ≥ its floor — the ledger's read is motion-scaled; red 2 / 2 at ×0.5, green at ×1
  'console-parliament-reds-budget.spec.ts', // «the payout's +4 flew» — a flight sampled on the reward page; red 2 / 2 at ×0.5, green at ×1
  'console-parliament-research.spec.ts', // the walk's stage sampled at the reward page; red 2 / 2 at ×0.5, green at ×1
  'console-parliament-sitting-v4.spec.ts', // «ПОВЕСТКА is the segment lead plus the shared marker glide» — a duration; green at ×1
  'console-parliament-marsfirst-budget.spec.ts', // a CDP-screencast storyboard (a frame per beat) and the bot's city scene — load-sensitive at ×0.5 and ×1
  'console-parliament-renewal.spec.ts', // the renewal's tact sampled object by object (order, plaque release) — flaky beside a loaded box even at ×1: exclusive
  'console-parliament-urban.spec.ts', // «the arriving card names …» — read while the card is in flight; red 2 / 2 at ×0.5, green at ×1
  'console-planet-focus.spec.ts', // the camera's phases waited for by `waitForFunction` windows; red 2 / 2 at ×0.5, green at ×1
  'console-robotics-factory.spec.ts', // the transfer witness: a token born on the composer's pay row as it leaves (A) — flaky at ×0.5, 5 / 5 at ×1
  'console-x87-shipment-to-earth.spec.ts', // «the card lifted only after the shipment was absorbed» — an order in time; flaky at ×0.5, green at ×1
  'wheel-rework.spec.ts', // the quick wheel's press → hold → release grammar sampled after fixed holds — red 2 / 2 at ×0.5, green at ×1
  'hand-album-continuity.spec.ts', // the album's continuity witness (dock jumps between frames) — flaky at ×0.5, 8 / 8 at ×1
  'console-social-heating.spec.ts', // the Hydronetwork's RESULT layer stands a motion-scaled beat; at ×0.5 it comes and goes inside the commit's press
  'console-ma-states.spec.ts', // a storyboard of the milestone ceremony: at ×0.5 it has ENDED by the time the 4K «42-committing» frame is taken — green with only TM_E2E_MOTION=1
  // the motion-grammar guards
  'console-smoothness.spec.ts',
  'console-scene-transition.spec.ts',
  'console-surface-motion.spec.ts',
  'console-wheel-commit-geometry.spec.ts',
  'console-variant-settle.spec.ts',
  'console-delta-chip-anchor.spec.ts',
  'console-rail-landing.spec.ts',
  'console-play-landing-geometry.spec.ts',
  'console-start-motion.spec.ts',
  'console-hand-open-parity.spec.ts',
  // the probes (perf, landing, pose, entry, lifecycle)
  'console-colony-entry-probe.spec.ts',
  'console-colony-focus-probe.spec.ts',
  'console-colony-inspect-probe.spec.ts',
  'console-colony-trade-probe.spec.ts',
  'console-firstact-entry-probe.spec.ts',
  'console-firstact-lifecycle-probe.spec.ts',
  'console-longgame-perf-probe.spec.ts',
  'console-play-landing-probe.spec.ts',
  'console-played-perf-probe.spec.ts',
  'console-recv-perf-probe.spec.ts',
  'draft-finale-probe.spec.ts',
  'hand-album-probe.spec.ts',
  'hand-chrome-flash-probe.spec.ts',
  'hand-delivery-probe.spec.ts',
  'hand-dock-pose-transitions-probe.spec.ts',
  'hand-dock-probe.spec.ts',
  'hand-pose-sequence-probe.spec.ts',
  'hand-reveal-probe.spec.ts',
  'mat-stage-probe.spec.ts',
  'start-effect-flow-probe.spec.ts',
  'start-flow-polish-probe.spec.ts',
  'trade-fleet-probe.spec.ts',
]);

/** True for a spec file of the timing class (by its base name). */
export function isTimingSpec(file: string): boolean {
  const base = file.replace(/\\/g, '/').split('/').pop() ?? file;
  return TIMING_SPECS.has(base);
}
