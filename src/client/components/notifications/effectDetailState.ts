import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';

/**
 * Module-level state for the per-effect DETAIL modal opened from a
 * «сработал эффект» notification. Module-scoped (survives the playerkey remount)
 * so the App-level `EffectDetailOverlay` can be driven from the notification card.
 * Shows ONE card's passive effect — its graphic, description + per-game stats
 * (reusing the Эффекты overlay's `EffectDetailsPanel`), styled like the
 * additional-resources modal.
 */
export const effectDetailState = reactive<{open: boolean; cardName: CardName | undefined; ownerColor: Color | undefined}>({
  open: false,
  cardName: undefined,
  ownerColor: undefined,
});

export function openEffectDetail(cardName: CardName, ownerColor: Color | undefined): void {
  effectDetailState.cardName = cardName;
  effectDetailState.ownerColor = ownerColor;
  effectDetailState.open = true;
}

export function closeEffectDetail(): void {
  effectDetailState.open = false;
}
