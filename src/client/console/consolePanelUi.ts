/**
 * consolePanelUi — the ONE mirror through which a mounted console panel
 * publishes its live command contract to the shell's command bar
 * (docs/CONSOLE_TV_PREMIUM_PLAN.md §3.2: a hint lives EITHER on the object OR
 * in the bar — never in a panel-local footer AND the bar at once).
 *
 * The former per-panel `.con-*__foot` hint rows (TaskHost / Government
 * Support / Production Loss / Info Mode) are deleted; each panel now syncs
 * its contextual hints here (watch → setPanelCommands on mount/update,
 * clearPanelCommands on unmount), and ConsoleShell.commands() renders them
 * through the ONE ConsoleCommandBar.
 *
 * EVERY OWNER KEEPS ITS OWN CONTRACT (FREEZE ZERO — CI's autopilot on `a3c1a4cd33`, game 248). This was ONE slot, on
 * the belief that panels never coexist — but they do: the Info mode (Y) opens OVER a standing panel (the external draw's
 * take in the Parliament's stage). Its publication overwrote the take's, its close cleared the slot, and the take — whose
 * watcher publishes only when its own commands CHANGE — never published again: a bar reading «Парламент» and nothing
 * else over a take the player could no longer read a verb for, until the door answered it. Now a publication is kept
 * per owner until that owner clears it; the bar's branch asks the owner it shows (`panelCommands(owner)`), and the
 * mirror's `owner` / `commands` read the latest publication still standing.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {promptSequenceState, settleGreysControl} from '@/client/console/promptSequence';

type PanelOwner = 'taskHost' | 'govSupport' | 'productionLoss' | 'infoMode' | 'cardActions' | 'actionComposer' | 'effectDecision' |
  // The three dedicated COMPOSITE surfaces (Venus track bonus, Stormcraft's
  // spend-heat, the planetary-event thresholds).
  'spendHeat' | 'venusBonus' | 'aresGlobals' |
  // «Посмотри N карт колоды, оставь K» — the draw & select surface.
  'deckPick' |
  // «Добор карты» — the mandatory take of an external draw.
  'externalDraw' |
  // A hostile MarsBot effect the player must answer («выберите, что потеряете»).
  'botAttack' |
  // The post-game FINAL SCORING workspace (skip → action-list verbs).
  'endgame';

export const consolePanelUi = reactive({
  /** The latest publication still standing (its owner and its commands) — the mirror's top. */
  owner: undefined as PanelOwner | undefined,
  commands: [] as Array<ConsoleCommand>,
  /** Every standing publication, by owner. */
  byOwner: {} as Partial<Record<PanelOwner, Array<ConsoleCommand>>>,
  /** The owners in the order they first published (an update keeps its place — a panel under a cover never climbs over it). */
  order: [] as Array<PanelOwner>,
});

function syncTop(): void {
  const top = consolePanelUi.order[consolePanelUi.order.length - 1];
  consolePanelUi.owner = top;
  consolePanelUi.commands = top === undefined ? [] : [...(consolePanelUi.byOwner[top] ?? [])];
}

export function setPanelCommands(owner: PanelOwner, commands: ReadonlyArray<ConsoleCommand>): void {
  consolePanelUi.byOwner[owner] = [...commands];
  if (!consolePanelUi.order.includes(owner)) {
    consolePanelUi.order.push(owner);
  }
  syncTop();
}

export function clearPanelCommands(owner: PanelOwner): void {
  delete consolePanelUi.byOwner[owner];
  const at = consolePanelUi.order.indexOf(owner);
  if (at !== -1) {
    consolePanelUi.order.splice(at, 1);
  }
  syncTop();
}

/** The shell-side read: the panel's live contract, or undefined when the
 *  expected panel hasn't published (fallback to the static set).
 *
 *  While a freshly presented decision SETTLES (`promptSequence.ts` — the
 *  inertia guard after a chain of prompts), its deciding verbs read greyed:
 *  the shell swallows those presses in the same window, and a bar that kept
 *  them lit would promise a press that does nothing. One place for every
 *  prompt panel — no surface grows its own «not yet» state. */
export function panelCommands(owner: PanelOwner): ReadonlyArray<ConsoleCommand> | undefined {
  const commands = consolePanelUi.byOwner[owner];
  if (commands === undefined || commands.length === 0) {
    return undefined;
  }
  if (!promptSequenceState.settling || promptSequenceState.current === undefined) {
    return commands;
  }
  return commands.map((cmd) => settleGreysControl(cmd.control) ? {...cmd, enabled: false} : cmd);
}
