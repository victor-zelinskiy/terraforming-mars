/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE JOURNAL CONTROLLER — the shell's side of the journal panel: when it may show, what hard-blocks it, opening it
 * at a notification and the colony inspection it hosts.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {consoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {ColonyName} from '@/common/colonies/ColonyName';
import {consoleState} from '@/client/console/consoleRouter';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {journalState, openJournalToEvent} from '@/client/components/journal/journalState';
import type {NoticeController} from '@/client/console/shell/noticeController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type JournalPort = {
  closeColonyInspect(): void,
  readonly compositeSurfaceActive: boolean,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  readonly hostTask: ConsoleTask | undefined,
  readonly placementActive: boolean,
  readonly shellTaskActive: boolean,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  readonly startSceneServes: boolean,
  taskSpacePending: {index: number, spacePrompt: PlayerInputModel} | undefined,
};

export function createJournalController(shell: JournalPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A colony name opened READ-ONLY from the journal (X on a colony row). */
  const journalColonyInspect = ref(undefined as ColonyName | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── the console-native journal (View — board home only) ────────────
  /** The journal surface renders (it replaces the right info panel). */
  const journalPanelVisible = computed((): boolean => {
    return journalState.open && consoleState.section === 'board';
  });

  /**
   * A surface that NEEDS the pad / the board arrived — the journal yields
   * (placement, an active task / start scene / reveal). A DEFERRED task
   * (amber chip) leaves the player free, so the journal stays available.
   */
  const journalHardBlocked = computed((): boolean => {
    return shell.placementActive ||
      shell.consoleRevealMode !== undefined ||
      (shell.startSceneServes && !consoleState.task.deferred) ||
      (shell.hostTask !== undefined && !consoleState.task.deferred && shell.taskSpacePending === undefined) ||
      shell.shellTaskActive ||
      // …and the DEDICATED COMPOSITES, which own the pad exactly like the host
      // (their branches sit ABOVE it in the routing chain). Left out, the
      // journal stayed open over «Разместите бонус шкалы Венеры» and kept the
      // pad it needs.
      shell.compositeSurfaceActive;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── the console-native journal (View — board home only) ─────────────
  function toggleJournal(): void {
    if (journalState.open) {
      closeJournal();
      return;
    }
    // Board home only (safe context policy): a placement / another
    // section keeps the pad on its own task — honest notice, no toggle.
    if (shell.placementActive) {
      shell.showNotice('Finish your current action first');
      return;
    }
    if (consoleState.section !== 'board') {
      shell.showNotice('The journal is available from the main board');
      return;
    }
    journalState.open = true;
  }

  function closeJournal(): void {
    journalState.open = false;
    // A read-only colony dossier only exists ON TOP of the journal — it must
    // not outlive it (e.g. a mandatory surface closes the journal underneath).
    if (journalColonyInspect.value !== undefined) {
      shell.closeColonyInspect();
    }
  }

  // A toast's X-HOLD detail: the journal AT the toast's own root event (the
  // full causal chain). Same availability policy as the View toggle — the
  // journal only opens from the board home and never over a live placement;
  // a refusal names itself instead of silently eating the hold.
  function openJournalToNotification(card: LiveNotification): void {
    if (card.correlationId === undefined) {
      return;
    }
    if (shell.placementActive) {
      shell.showNotice('Finish your current action first');
      return;
    }
    if (consoleState.section !== 'board') {
      shell.showNotice('The journal is available from the main board');
      return;
    }
    openJournalToEvent(card.correlationId, card.generation);
    // The journal now tells the story — the toast's job is done. (The
    // journal-open watcher drops the queued ordinary cards the same way.)
    dismissNotification(card.id);
  }

  /** X on a JOURNAL colony row — open the READ-ONLY dossier over the journal. */
  function openJournalColonyInspect(name: ColonyName): void {
    journalColonyInspect.value = name;
    consoleColoniesUi.inspectOpen = true;
  }

  return {
    journalColonyInspect,
    journalPanelVisible,
    journalHardBlocked,
    toggleJournal,
    closeJournal,
    openJournalToNotification,
    openJournalColonyInspect,
  };
}

export type JournalController = ReturnType<typeof createJournalController>;
