/*
 * CONSOLE PLAY PICK BRIDGE (Turmoil Redux RX36 Live Experiments) — an action
 * whose RESULT is a whole card play: «pay 6 M€ to play a card ignoring all
 * global parameter requirements». The law's stage shows the decision as a
 * SLOT («КАРТА»); A on it hands the pick to the console's ONE surface for
 * «play a card from your hand» — the hand ALBUM (a card from the hand is
 * chosen in the hand, at every depth) with the PLAY COMPOSER one level
 * deeper — hosted as a STEP of the asking stage (`card-actions ⊃ hand`).
 *
 * The bridge's difference from an ordinary play is exactly two facts, and the
 * surfaces read them from here (never a second copy of the album or of the
 * composer):
 *  · WHAT may be played — the law's PROMISED pick (`ResolutionPlayModel.input`,
 *    the live prompt's own shape with the law's waiver standing): the album's
 *    playable set and the composer's card model come from it, not from the
 *    live menu's «play a card» (which plays WITHOUT the law);
 *  · WHAT the play costs on top — the bill's M€ held back (`reserve`): the
 *    composer's payment reads the rail less it, and its preview is asked with
 *    the law named (`card-play-preview?law=` — the server's probe).
 *
 * The composer's confirm RESOLVES the bridge instead of submitting: the chosen
 * card, its payment and every composed answer go back to the asking stage,
 * which draws the card in its slot and sends ONE batch at its own commit
 * (`[menu option, projectCard, …the card's own answers]`). The callbacks live
 * OUTSIDE the reactive state (function identity — `consoleHandPick`'s idiom);
 * the asking stage stays MOUNTED for the pick's whole life, and a prompt that
 * moves on cancels the pick through the shell (`cancelConsolePlayPick` —
 * idempotent).
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {PreselectAddress} from '@/common/inputs/preselectAddress';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import type {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import type {RailReward} from '@/client/console/resourceTransfer/railReward';
import type {PlayReaction} from '@/client/console/played/receivingStageModel';

export type ConsolePlayPickRequest = {
  /** The PROMISED pick (the law's `ResolutionPlayModel.input`): every hand card, the law's candidates enabled. */
  input: SelectProjectCardToPlayModel;
  /** The M€ the law's bill takes BEFORE the card is paid — the composer's payment reads the rail less it. */
  reserve: number;
  /** The law asking — the preview's probe (`card-play-preview?law=`), the album's context chip. */
  resolution: ResolutionId;
  /** The crumb's stage while the album stands (an English key — `Selection`). */
  stage: string;
};

/** The landing scene's promise, taken from the composer at its confirm and handed on at the law's commit. */
export type ConsolePlayPickScene = {
  rewards?: ReadonlyArray<ResourceTransferSpec>;
  reactions?: ReadonlyArray<PlayReaction>;
  rail?: RailReward;
  spends?: RailReward;
  targetSpends?: ReadonlyArray<ResourceTransferSpec>;
  draws?: number;
};

/** What the composer RESOLVED — the play, composed; the asking stage posts it at its own commit. */
export type ConsolePlayPickResult = {
  cardName: CardName;
  payment: Payment;
  branchIndex: number;
  branchFor?: PreselectAddress;
  preResponses: ReadonlyArray<unknown>;
  optionResponse: unknown;
  stepResponses: ReadonlyArray<unknown>;
  /** The card's price as charged (the promised card model's `calculatedCost`) — the stage's ИТОГО. */
  cost: number;
  scene: ConsolePlayPickScene;
};

export const consolePlayPickState = reactive({
  active: false,
  request: undefined as ConsolePlayPickRequest | undefined,
});

let resolveCb: ((result: ConsolePlayPickResult) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isConsolePlayPickActive(): boolean {
  return consolePlayPickState.active;
}

/** The law a standing pick plays through (the preview's `law` parameter), if any. */
export function activePlayPickLaw(): ResolutionId | undefined {
  return consolePlayPickState.active ? consolePlayPickState.request?.resolution : undefined;
}

/** The M€ a standing pick holds back for the law's bill (0 outside a pick). */
export function activePlayPickReserve(): number {
  return consolePlayPickState.active ? Math.max(0, consolePlayPickState.request?.reserve ?? 0) : 0;
}

/** Hand the play to the album (the shell reacts to `active`: the hand stands up as a step of the asking stage). */
export function enterConsolePlayPick(
  request: ConsolePlayPickRequest,
  onResolve: (result: ConsolePlayPickResult) => void,
  onCancel?: () => void,
): void {
  consolePlayPickState.request = request;
  resolveCb = onResolve;
  cancelCb = onCancel;
  consolePlayPickState.active = true;
}

/** The composer confirmed — the composed play goes back to the asking stage. */
export function resolveConsolePlayPick(result: ConsolePlayPickResult): void {
  if (!consolePlayPickState.active) {
    return;
  }
  const cb = resolveCb;
  resetConsolePlayPick();
  cb?.(result);
}

/** B in the album / an external teardown: back to the asking stage, its slot as it was. */
export function cancelConsolePlayPick(): void {
  if (!consolePlayPickState.active) {
    return;
  }
  const cb = cancelCb;
  resetConsolePlayPick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetConsolePlayPick(): void {
  consolePlayPickState.active = false;
  consolePlayPickState.request = undefined;
  resolveCb = undefined;
  cancelCb = undefined;
}
