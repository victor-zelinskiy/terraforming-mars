/*
 * «Разбор хода» — controller + reactive state.
 *
 * The review is a STATIC, structured summary of a turn that already happened
 * (opened from the compact turn card's «Осмотреть», the journal's «Осмотреть
 * ход», or auto-opened in the 'theater' presentation mode). There is no
 * pacing / playback / lingering — it is simply open or closed. Both surfaces
 * (desktop overlay / console fullscreen) render this SAME state.
 *
 * While it is open the presentation orchestrator (`presentationFlow.ts`) holds
 * mandatory surfaces + notification delivery (it is a foreground item). It is
 * READ-ONLY over an archived script — opening it never re-applies a visual
 * commit and never freezes live updates behind it.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {BotTurnReview, BotTurnReviewSource, buildBotTurnReview} from './botTurnReviewModel';

type BotTurnReviewState = {
  open: boolean;
  review: BotTurnReview | undefined;
  botColor: Color | '';
  botName: string;
  ctx: BonusCardContext;
  /**
   * "Показать на карте" peek: the overlay fades to near-transparent + becomes
   * click-through so the pulsing board cell is readable underneath. Any input
   * restores it.
   */
  peek: boolean;
  peekSpaceId: SpaceId | undefined;
  /** Bumped per open so surfaces reset their local presentation state. */
  nonce: number;
};

export const botTurnReviewState = reactive<BotTurnReviewState>({
  open: false,
  review: undefined,
  botColor: '',
  botName: '',
  ctx: {venus: false, colonies: false},
  peek: false,
  peekSpaceId: undefined,
  nonce: 0,
});

/** True while the review is open (holds mandatory surfaces + the pad). */
export function isBotTurnReviewOpen(): boolean {
  return botTurnReviewState.open;
}

let peekPulseTimer = 0;

function stopPeekPulse(): void {
  if (peekPulseTimer !== 0) {
    clearInterval(peekPulseTimer);
    peekPulseTimer = 0;
  }
}

/** Open the review of a turn (built once from the archived script). */
export function openBotTurnReview(source: BotTurnReviewSource): void {
  stopPeekPulse();
  botTurnReviewState.review = buildBotTurnReview(source);
  botTurnReviewState.open = true;
  botTurnReviewState.botColor = source.botColor;
  botTurnReviewState.botName = source.botName;
  botTurnReviewState.ctx = {...source.ctx};
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceId = undefined;
  botTurnReviewState.nonce++;
}

/**
 * Enter / leave "show on map" peek. Entering fades the overlay + pulses the
 * cell (re-pulsing on a light interval so the ring keeps drawing attention);
 * leaving restores the overlay. No new overlay is ever opened.
 */
export function setBotReviewPeek(active: boolean, spaceId?: SpaceId): void {
  stopPeekPulse();
  if (active && spaceId !== undefined) {
    botTurnReviewState.peek = true;
    botTurnReviewState.peekSpaceId = spaceId;
    highlightBoardSpace(spaceId);
    peekPulseTimer = window.setInterval(() => highlightBoardSpace(spaceId), 2000) as unknown as number;
    return;
  }
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceId = undefined;
}

/** Close the review (Close/Esc on desktop, B on console). Idempotent. */
export function closeBotTurnReview(): void {
  stopPeekPulse();
  botTurnReviewState.open = false;
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceId = undefined;
  botTurnReviewState.review = undefined;
}

/** Test-only full reset. */
export function resetBotTurnReview(): void {
  closeBotTurnReview();
  botTurnReviewState.botColor = '';
  botTurnReviewState.botName = '';
  botTurnReviewState.ctx = {venus: false, colonies: false};
  botTurnReviewState.nonce = 0;
}
