/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE NOTICE CONTROLLER — the shell's one-line toast («not now» said where the player is looking): its text and the
 * timer that takes it away.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import {ref} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {useFlowScope} from '@/client/console/session/useFlowScope';

export function createNoticeController() {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and the toast's timer with it.
  const flow = useFlowScope('notice-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const notice = ref('');
  /** The standing toast's cancel (the scope owns the timer). */
  let cancelNotice: () => void = () => {};

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function showNotice(key: string): void {
    notice.value = key;
    cancelNotice();
    cancelNotice = flow.after(motionMs(2400), 'the notice\'s toast', () => {
      notice.value = '';
    });
  }

  return {
    notice,
    showNotice,
  };
}

export type NoticeController = ReturnType<typeof createNoticeController>;
