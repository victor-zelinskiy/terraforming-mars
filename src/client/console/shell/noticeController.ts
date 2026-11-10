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

export function createNoticeController() {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const notice = ref('');
  const noticeTimer = ref(undefined as number | undefined);

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function showNotice(key: string): void {
    notice.value = key;
    if (noticeTimer.value !== undefined) {
      window.clearTimeout(noticeTimer.value);
    }
    noticeTimer.value = window.setTimeout(() => {
      notice.value = '';
    }, motionMs(2400));
  }

  return {
    notice,
    noticeTimer,
    showNotice,
  };
}

export type NoticeController = ReturnType<typeof createNoticeController>;
