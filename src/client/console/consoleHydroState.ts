/*
 * Console-native Hydronetwork UI state (the console-only layer OVER the shared
 * hydroNetworkState plan brain). Module-level reactive so the shell's command
 * bar — the truth of the current context — can read WHICH hydro surface owns
 * input (the confirm modal / the help panel / the main screen) and whether the
 * primary verb is live, without poking component refs from a computed.
 *
 * The `mode / bonusChoice / primaryEnabled / pickKind` fields are MIRRORS the
 * section component syncs from its live model — the bar never guesses.
 *
 * Transient by design: reset on entering/leaving the hydro section and on
 * submit. Never persisted.
 */
import {reactive} from 'vue';

export const consoleHydroUi = reactive({
  /** The console-native confirmation modal («Укрепить гидросеть») is open. */
  confirmOpen: false,
  /** The help / lore panel (X = Подробнее) is open. */
  helpOpen: false,
  /** Mirror: the section's current mode (plan a future stage / inspect a past one). */
  mode: 'plan' as 'plan' | 'details',
  /** Mirror: the selected stage offers a bonus choice (LB/RB are live). */
  bonusChoice: false,
  /** Mirror: A does something meaningful right now (confirm / pick / choose). */
  primaryEnabled: false,
  /** Mirror: the pending pos 7/9 pick kind (names the pick sheet honestly). */
  pickKind: undefined as 'reuse-action' | 'animal-target' | undefined,
});

export function resetConsoleHydroUi(): void {
  consoleHydroUi.confirmOpen = false;
  consoleHydroUi.helpOpen = false;
  consoleHydroUi.mode = 'plan';
  consoleHydroUi.bonusChoice = false;
  consoleHydroUi.primaryEnabled = false;
  consoleHydroUi.pickKind = undefined;
}
