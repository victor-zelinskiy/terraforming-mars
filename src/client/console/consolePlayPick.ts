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
 *
 * THE LAW'S LANDING (PL-726): the card the law's commit plays lands INSIDE the
 * law's stage — the played-hero scene's `workspace` host, its receiving stage
 * mounted in the stage's decision column (`ConsolePartyActionComposer`), the
 * workspace folding only once the scene has told its story. `landing` is the
 * one fact every reader asks: the composer (mount the stage), the shell (owe
 * the fold, end the scene's way), the conclusion policy (the flow still owes).
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
import type {ArmedPlayEffectModel} from '@/common/models/ArmedPlayEffectModel';
import type {StagedColonyModel, StagedPlacementModel, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import type {PlayComposerDraft} from '@/client/console/stagedPlay';

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
  /**
   * The play's OWN moves on the rail's rows (its price, its chips — `actionKnownRailMoves`): what the law's bill
   * token is checked against beside itself (PL-725 — the bill departs first, the card's price ticks at the landing).
   */
  known?: Readonly<Record<string, number>>;
};

/** THE LAW'S LANDING (PL-726): which card the law's commit is playing, through which law. */
export type ConsoleLawPlayLanding = {
  card: CardName;
  resolution: ResolutionId;
};

/**
 * EVERYTHING ELSE THE COMPOSER DECIDED (the design rule of 2026-10-20: a play made THROUGH the law keeps every
 * pre-select and every reversible step an ordinary play has). The composer's own DOORS ride the result untouched — the
 * staged cell (the board pick is the play's last reversible step), the staged vote and colony (a step that opens inside
 * the stage), the cell's card target, the armed effects the play spends, a composed repeat (Project Inspection) — so the
 * law's commit can stage them exactly where an ordinary play would: AT its commit, before anything is sent.
 */
export type ConsolePlayPickComposed = {
  staged?: StagedPlacementModel;
  stagedVote?: StagedVoteModel;
  stagedColony?: StagedColonyModel;
  stagedCardTarget?: CardName;
  armedSpends?: ReadonlyArray<ArmedPlayEffectModel>;
  repeat?: ConsoleRepeatPickResult;
  /** The play composer's capture snapshot (its B-restore of a staged door). */
  composerDraft?: PlayComposerDraft;
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
  /** The composer's doors and its composed repeat — staged at the law's commit, never dropped (see the type). */
  composed?: ConsolePlayPickComposed;
};

/**
 * What a LAW's play hands the host at its commit (RX36): the composed card (the landing's promise) and the law's own
 * price — the host flies the law's token off the rail into the law's printed cost before the card's own shipment.
 */
export type LawPlayDetail = {
  play?: ConsolePlayPickResult;
  lawBill?: {resolution: ResolutionId, megacredits: number};
};

/** The law's composed play kept OUTSIDE the stage (a staged cell yields the stage away, a park remounts it). */
export type ConsoleLawPlayDraft = {
  resolution: ResolutionId;
  result: ConsolePlayPickResult;
};

/** Does the composed play carry a REVERSIBLE door the law's commit must stage (a cell, a vote, a colony)? */
export function lawPlayStagedDoor(result: ConsolePlayPickResult | undefined): 'cell' | 'resolution' | 'colony' | undefined {
  const composed = result?.composed;
  if (composed === undefined || composed.repeat !== undefined || composed.composerDraft === undefined) {
    return undefined;
  }
  if (composed.staged !== undefined) {
    return 'cell';
  }
  if (composed.stagedVote !== undefined) {
    return 'resolution';
  }
  return composed.stagedColony !== undefined ? 'colony' : undefined;
}

export const consolePlayPickState = reactive({
  active: false,
  request: undefined as ConsolePlayPickRequest | undefined,
  /** The law's commit is landing its card INSIDE the stage (PL-726) — from the arm to the scene's end. */
  landing: undefined as ConsoleLawPlayLanding | undefined,
  /** The law's composed play, kept for the stage that shows it (a remount re-seats the slot from here). */
  draft: undefined as ConsoleLawPlayDraft | undefined,
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

/** The law's commit arms its card's landing INSIDE the stage (PL-726) — the shell, beside `armPlayedHero`. */
export function beginLawPlayLanding(landing: ConsoleLawPlayLanding): void {
  consolePlayPickState.landing = {...landing};
}

/** The scene told its story (or was refused) — the stage owes nothing more. Idempotent. */
export function endLawPlayLanding(): void {
  consolePlayPickState.landing = undefined;
}

/** The landing standing for this law (any law when omitted) — undefined outside one. */
export function lawPlayLandingOf(resolution?: ResolutionId): ConsoleLawPlayLanding | undefined {
  const landing = consolePlayPickState.landing;
  return landing !== undefined && (resolution === undefined || landing.resolution === resolution) ? landing : undefined;
}

/** The slot filled (or re-filled) — the stage's composed play survives the stage's own unmount. */
export function rememberLawPlay(resolution: ResolutionId, result: ConsolePlayPickResult): void {
  consolePlayPickState.draft = {resolution, result};
}

/** The composed play kept for this law — undefined when there is none. */
export function lawPlayDraftOf(resolution: ResolutionId | undefined): ConsolePlayPickResult | undefined {
  const draft = consolePlayPickState.draft;
  return draft !== undefined && resolution !== undefined && draft.resolution === resolution ? draft.result : undefined;
}

/** The law's flow is over (committed and done, cancelled out, a new game) — nothing is kept. Idempotent. */
export function clearLawPlayDraft(): void {
  consolePlayPickState.draft = undefined;
}
