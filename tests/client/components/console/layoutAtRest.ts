/*
 * THE LAYOUT PROFILE AT REST — the one environment every surface spec of the client suite measures in.
 *
 * `consoleLayoutProfile` rests at `standard`, scale 1, until something installs it — and in the unit suite nothing
 * does. A spec that steps the display setting used to «restore» it with `setConsoleProfileOverride('auto')`; but
 * «auto» is not the rest state: it hands the choice to the heuristic, which reads jsdom's 1024 × 768 viewport and
 * answers `handheld`. Module state is shared by the whole bundle, so every spec that ran AFTER such a restore rendered
 * its HANDHELD layout (the target zone showed one owner group, with tabs, where the spec counted two) — invisible for
 * as long as the suite's order happened to hide it, red the day the order moved (2026-11-12; the pair was red on the
 * previous runner too).
 *
 *  · a spec that CHANGES the profile calls `restLayoutProfile()` in its `afterEach`;
 *  · a spec whose assertions DEPEND on the layout calls it in its `beforeEach` — it states the environment it
 *    measures in instead of inheriting whatever ran before it.
 */
import {consoleLayoutState, setConsoleProfileOverride} from '@/client/console/consoleLayoutProfile';

const PROFILE_CLASS = /^con-profile-/;

export function restLayoutProfile(): void {
  // Clears the stored pick and the `forced` flag (and, as its side effect, lets the heuristic choose — undone below).
  setConsoleProfileOverride('auto');
  Object.assign(consoleLayoutState, {profile: 'standard', forced: false, uiScale: 1, reason: 'standard: baseline'});
  const html = document.documentElement;
  for (const name of [...html.classList]) {
    if (PROFILE_CLASS.test(name)) {
      html.classList.remove(name);
    }
  }
  html.style.removeProperty('--con-ui-scale');
}
