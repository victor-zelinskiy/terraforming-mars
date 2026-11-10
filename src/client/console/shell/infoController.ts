/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE INFORMATION MODE CONTROLLER — the shell's side of the Information Workspace (`infoModeState`): entering and
 * leaving it, its route (go / back), the inspected seat's extras and the zone context a screen is asked with.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import {computed} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {goBoardHome} from '@/client/console/consoleWorkspaceStack';
import {consoleState} from '@/client/console/consoleRouter';
import {infoModeState, openInfoMode, closeInfoMode, settleInfoModeClose, restoreConsoleSnapshot} from '@/client/console/infoModeState';
import {resetExtrasExplorer} from '@/client/console/consoleExtrasExplorer';
import {resetEffectsExplorer} from '@/client/console/consoleEffectsExplorer';
import {resetInfoActions} from '@/client/console/infoActionsUi';
import {infoExtrasChips} from '@/client/console/infoExtrasChips';
import {marsBotExtrasContext, MarsBotExtrasContext} from '@/client/components/console/marsBotRailModel';
import {InfoRouteId, infoRouteApplies, infoRouteBack, infoZoneForRoute} from '@/client/console/infoRoute';
import {resetScoreExplorer} from '@/client/console/consoleScoreExplorer';
import {playInspectedReturnMotion} from '@/client/console/inspectSwitchMotion';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type InfoPort = {
  closePlayedOverlay(): void,
  readonly placementActive: boolean,
  playedOpen: boolean,
  readonly playerView: PlayerViewModel,
  readonly thisPlayer: PublicPlayerModel,
};

export function createInfoController(shell: InfoPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The game-shape context of the bot's extras classification (which
   *  zero-count sources EXIST: Venus / colony tiles in play) — ONE
   *  derivation for the rail, the ring and the extras explorer. */
  const botExtrasCtx = computed((): MarsBotExtrasContext => {
    return marsBotExtrasContext(shell.playerView.game);
  });

  /** `--info` must persist through the CLOSING transition — see the
   *  template note and infoModeState.closing. */
  const infoWorkspaceUp = computed((): boolean => {
    return infoModeState.open || infoModeState.closing;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── Information Workspace (read-only; never submits; Y toggles) ─────
  function toggleInfoMode(): void {
    if (infoModeState.open) {
      const wasInspectingOther = infoModeState.playerColor !== undefined &&
        infoModeState.playerColor !== shell.thisPlayer.color;
      const snap = closeInfoMode();
      if (snap !== undefined) {
        // The snapshot's cell-focus flag maps onto INSPECTION MODE (P27).
        consoleState.inspecting = restoreConsoleSnapshot(snap);
      }
      // A placement prompt that arrived WHILE Info Mode was open must not
      // be restored away from — the board is the mandatory surface.
      if (shell.placementActive) {
        goBoardHome();
        consoleState.inspecting = false;
      }
      // The rail atomically returned to the viewer's own seat (railPlayer
      // follows `open`) — a soft settle dip acknowledges the context
      // coming home while the workspace departs. Only when it actually
      // changes seats (closing on the own dossier stays perfectly still).
      if (wasInspectingOther) {
        playInspectedReturnMotion();
      }
      return;
    }
    consoleState.quick = undefined;
    // The board-home «Разыграно» table yields — the workspace has its own
    // embedded played detail (X), so a stale overlay must not linger under
    // the dim (the two would share the singleton category state).
    if (shell.playedOpen) {
      shell.closePlayedOverlay();
    }
    resetScoreExplorer(); // a fresh visit never resumes a stale VP cursor
    resetExtrasExplorer(); // …nor a stale extras type/card cursor
    resetEffectsExplorer(); // …nor a stale effects cursor / open detail
    resetInfoActions(); // …nor a stale «Действия» cursor (TR60)
    openInfoMode(shell.thisPlayer.color, consoleState.inspecting);
  }

  /** after-leave of the workspace's dismiss transition — release the
   *  `--info` stacking state (kept alive through the fade; see the
   *  conMainClasses note). */
  function onInfoModeLeaveSettled(): void {
    settleInfoModeClose();
  }

  /** The inspected seat's satellite chips (the ring's per-chip stops). */
  function infoExtrasChipList(): ReadonlyArray<{key: string, label: string}> {
    const viewed = shell.playerView.players.find((p) => p.color === infoModeState.playerColor) ??
      shell.playerView.thisPlayer;
    const automa = viewed.isMarsBot === true ? shell.playerView.game.automa : undefined;
    return infoExtrasChips(viewed, automa, botExtrasCtx.value);
  }

  /** The inspected participant's KIND — the capability table's input. */
  function infoViewedKind(): 'human' | 'bot' {
    const isBot = shell.playerView.players
      .find((p) => p.color === infoModeState.playerColor)?.isMarsBot === true;
    return isBot && shell.playerView.game.automa !== undefined ? 'bot' : 'human';
  }

  /** The context of the summary zone table: the GAME shape (campaign
   *  missions) + the inspected SEAT's satellite presence — an empty
   *  extras column keeps no ring stop. */
  /**
   * ⚠️ THE GAME HALF OF THIS TABLE IS ANSWERED TWICE — here (the shell NAVIGATES
   * the ring) and in `ConsoleInfoMode.zoneCtx` (the panel DRAWS it). They must
   * carry the same terms or the cursor walks straight past a zone that is on
   * screen: «ПАРЛАМЕНТ» shipped that way for exactly one run — drawn by the
   * panel, invisible to the ring, so A could never reach it.
   */
  function infoZoneCtx(): {campaign: boolean, extras: boolean, parliament: boolean} {
    return {
      campaign: shell.playerView.game.gameOptions.campaign !== undefined,
      extras: infoExtrasChipList().length > 0,
      parliament: shell.playerView.game.parliament !== undefined,
    };
  }

  /**
   * Navigate to a semantic route (the ring's A, the bot hub's entries, a
   * satellite cell press). Asked for the CURRENT route it returns ONE
   * level (the tree's parent). Entering a route the CURRENT participant
   * cannot serve is refused — the fallback exists for a seat switch
   * ARRIVING on a route, never as a place to walk into.
   */
  function infoGo(route: InfoRouteId): void {
    if (infoModeState.route === route) {
      infoBack();
      return;
    }
    if (!infoRouteApplies(route, infoViewedKind())) {
      return;
    }
    infoModeState.route = route;
  }

  /** B — one logical level up the route tree; at the summary it closes
   *  the whole overlay (and restores the captured context). */
  function infoBack(): void {
    const parent = infoRouteBack(infoModeState.route);
    if (parent === undefined) {
      toggleInfoMode();
      return;
    }
    // The ring lands on the zone the player descended from — the
    // workspace «carried object survives B» rule.
    const zone = infoZoneForRoute(infoModeState.route);
    infoModeState.route = parent;
    if (parent === 'summary' && zone !== undefined) {
      infoModeState.summaryFocus = zone;
    }
  }

  return {
    botExtrasCtx,
    infoWorkspaceUp,
    toggleInfoMode,
    onInfoModeLeaveSettled,
    infoExtrasChipList,
    infoViewedKind,
    infoZoneCtx,
    infoGo,
    infoBack,
  };
}

export type InfoController = ReturnType<typeof createInfoController>;
