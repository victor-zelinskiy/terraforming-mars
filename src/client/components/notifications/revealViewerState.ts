import {reactive} from 'vue';
import {RevealMeta} from '@/client/components/notifications/notificationTypes';

/**
 * Module-level state for the read-only REVEALED-CARDS viewer (the modal that
 * shows the cards a player publicly revealed/showed). Module-scoped — like
 * `journalState` — so it survives the playerkey remount and can be opened from
 * EITHER a notification CTA or a journal reveal row. The viewer itself
 * (`RevealedCardsModal.vue`) is mounted at App level and reads this.
 */
export const revealViewerState = reactive<{open: boolean; reveal: RevealMeta | undefined}>({
  open: false,
  reveal: undefined,
});

/** Open the read-only viewer for a public reveal/show. */
export function openRevealViewer(reveal: RevealMeta): void {
  revealViewerState.reveal = reveal;
  revealViewerState.open = true;
}

export function closeRevealViewer(): void {
  revealViewerState.open = false;
}
