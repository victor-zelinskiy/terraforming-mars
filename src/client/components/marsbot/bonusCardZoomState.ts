/*
 * Fullscreen inspect for an Automa BONUS card — the ONE place the card's FULL
 * rule text (all if/else branches + fate) lives. The review / notification /
 * journal show only the RESOLVED branch; the player opens this to read the
 * whole card. Module-reactive (survives the playerkey remount, like the review
 * state); mounted at App level (desktop) + inside ConsoleShell (console).
 */
import {reactive} from 'vue';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';

type BonusCardZoomState = {
  open: boolean;
  id: BonusCardId | undefined;
  ctx: BonusCardContext;
  nonce: number;
};

export const bonusCardZoomState = reactive<BonusCardZoomState>({
  open: false,
  id: undefined,
  ctx: {venus: false, colonies: false},
  nonce: 0,
});

export function isBonusCardZoomOpen(): boolean {
  return bonusCardZoomState.open;
}

export function openBonusCardZoom(id: BonusCardId, ctx: BonusCardContext): void {
  bonusCardZoomState.id = id;
  bonusCardZoomState.ctx = {...ctx};
  bonusCardZoomState.open = true;
  bonusCardZoomState.nonce++;
}

export function closeBonusCardZoom(): void {
  bonusCardZoomState.open = false;
  bonusCardZoomState.id = undefined;
}
