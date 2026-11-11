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
import {startBoardHighlightPulse, stopBoardHighlightPulse} from '@/client/components/journal/boardCellHighlight';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {BotTurnReview, BotTurnReviewSource, buildBotTurnReview} from './botTurnReviewModel';
import {turnDedupeKey} from './marsBotTurnView';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

/** Which boundary a turn-nav step hit (no earlier / no later turn), or none. */
export type BotReviewEdge = '' | 'no-prev' | 'no-next';

type BotTurnReviewState = {
  open: boolean;
  review: BotTurnReview | undefined;
  /**
   * The archive key of the turn currently shown (`${color}:${gen}:${id}`) —
   * the anchor for LB/RB turn navigation. Derived from the source's own turn.
   */
  key: string;
  botColor: Color | '';
  botName: string;
  ctx: BonusCardContext;
  /**
   * "Показать на карте" peek: the overlay fades to near-transparent + becomes
   * click-through so the pulsing board cells are readable underneath. ALL the
   * turn's placed tiles pulse (not just the first), and any input restores it.
   */
  peek: boolean;
  peekSpaceIds: ReadonlyArray<SpaceId>;
  /**
   * A transient boundary notice for turn navigation (LB/RB at the first / last
   * archived turn). The global notification layer is HELD while the review is
   * the foreground item, so this rides review-LOCAL state instead — each
   * surface renders it as a small premium toast, re-armed via `edgeNonce`.
   */
  edge: BotReviewEdge;
  edgeNonce: number;
  /** Bumped per open so surfaces reset their local presentation state. */
  nonce: number;
};

export const botTurnReviewState = reactive<BotTurnReviewState>({
  open: false,
  review: undefined,
  key: '',
  botColor: '',
  botName: '',
  ctx: {venus: false, colonies: false},
  peek: false,
  peekSpaceIds: [],
  edge: '',
  edgeNonce: 0,
  nonce: 0,
});

/** True while the review is open (holds mandatory surfaces + the pad). */
export function isBotTurnReviewOpen(): boolean {
  return botTurnReviewState.open;
}

/** The standing edge notice's disarm — a guaranteed RELEASE of the session: the notice always comes down. */
let disarmEdge: (() => void) | undefined;

function stopEdgeTimer(): void {
  if (disarmEdge !== undefined) {
    disarmEdge();
    disarmEdge = undefined;
  }
}

/** Open the review of a turn (built once from the archived script). */
export function openBotTurnReview(source: BotTurnReviewSource): void {
  stopBoardHighlightPulse();
  stopEdgeTimer();
  botTurnReviewState.review = buildBotTurnReview(source);
  botTurnReviewState.open = true;
  botTurnReviewState.key = turnDedupeKey(source.turn, source.botColor);
  botTurnReviewState.botColor = source.botColor;
  botTurnReviewState.botName = source.botName;
  botTurnReviewState.ctx = {...source.ctx};
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceIds = [];
  botTurnReviewState.edge = '';
  botTurnReviewState.nonce++;
}

/**
 * Flash a transient boundary notice (LB/RB hit the first / last archived turn).
 * Auto-clears; re-arming while it is up bumps `edgeNonce` so a repeated press
 * replays the surface toast animation.
 */
export function flashBotReviewEdge(edge: Exclude<BotReviewEdge, ''>): void {
  stopEdgeTimer();
  botTurnReviewState.edge = edge;
  botTurnReviewState.edgeNonce++;
  disarmEdge = consoleSessionScope().guarantee(2400, 'the bot review\'s edge notice', () => {
    botTurnReviewState.edge = '';
    disarmEdge = undefined;
  });
}

/**
 * Enter / leave "show on map" peek. Entering fades the overlay + keeps ALL the
 * referenced cells pulsing (the shared persistent pulse re-arms until stopped);
 * leaving restores the overlay. No new overlay is ever opened.
 */
export function setBotReviewPeek(active: boolean, spaceIds?: ReadonlyArray<SpaceId>): void {
  if (active && spaceIds !== undefined && spaceIds.length > 0) {
    botTurnReviewState.peek = true;
    botTurnReviewState.peekSpaceIds = spaceIds;
    startBoardHighlightPulse(spaceIds);
    return;
  }
  stopBoardHighlightPulse();
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceIds = [];
}

/** Close the review (Close/Esc on desktop, B on console). Idempotent. */
export function closeBotTurnReview(): void {
  stopBoardHighlightPulse();
  stopEdgeTimer();
  botTurnReviewState.open = false;
  botTurnReviewState.peek = false;
  botTurnReviewState.peekSpaceIds = [];
  botTurnReviewState.edge = '';
  botTurnReviewState.review = undefined;
}

/** Test-only full reset. */
export function resetBotTurnReview(): void {
  closeBotTurnReview();
  botTurnReviewState.key = '';
  botTurnReviewState.botColor = '';
  botTurnReviewState.botName = '';
  botTurnReviewState.ctx = {venus: false, colonies: false};
  botTurnReviewState.edge = '';
  botTurnReviewState.edgeNonce = 0;
  botTurnReviewState.nonce = 0;
}
