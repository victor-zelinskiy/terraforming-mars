/*
 * @console-shared LIVE — console native stands on this file.
 *
 * STAGED PLAY — the cell pick as the LAST REVERSIBLE STEP of playing a
 * tile-placing card (docs/TILE_PLAY_STAGED_COMMIT.md).
 *
 * «Разыграть» on a card whose preview carries a `StagedPlacementModel` submits
 * NOTHING: the composer's assembled batch is parked here, the workspace yields
 * to the board, and the board runs an ordinary placement pick fed by the staged
 * payload (a synthetic SelectSpace-shaped prompt — same binder, same reticle,
 * same dossier). Only the cell CONFIRM posts — the one batch, with the chosen
 * space appended as its tail (`fixed` placements post the batch unchanged; the
 * server places the reserved cell itself). B before that restores the composer
 * with every capture intact; nothing was ever sent, so the cancel has no
 * consequences BY CONSTRUCTION.
 *
 * This module owns only the state + its tiny lifecycle; the shell owns every
 * decision (what yields, what restores, what submits) — mirroring the other
 * client-side placement hand-offs (convert-plants, a task's nested space).
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {StagedPlacementModel} from '@/common/models/ActionPreviewModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  beginPanelRewardHold,
  releasePanelRewardHold,
  runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {measureBoardHexRect} from '@/client/console/tilePlacement/consoleTilePlacement';

/**
 * The composer's raw capture snapshot — written by ConsolePlayCardConfirm at
 * the staged confirm, applied back by it after the preview reload when the
 * player returns with B. Deliberately OPAQUE to everyone else: the composer
 * writes it and the composer reads it, so no inverse mapping of the wire
 * payload ever exists to drift.
 */
export type PlayComposerDraft = {
  cardName: CardName;
  selectedPos: number | undefined;
  capturedPre: Record<number, unknown>;
  capturedOption: unknown;
  captured: Record<number, unknown>;
  amounts: Record<string, number>;
  floaters: Record<string, number>;
  picks: Record<string, string>;
  multiPicks: Record<string, ReadonlyArray<string>>;
  payCounts: Record<string, number>;
  playedTargetResults: Record<string, unknown>;
  focusIdx: number;
};

export type StagedPlayArm = {
  /**
   * WHICH staged flow this is — a card PLAY (the hand composer: the batch's
   * head plays a project card) or a blue-card ACTION (the ДЕЙСТВИЯ КАРТ
   * composer: the head activates an action). The board half is identical;
   * the flows differ in what B restores and how a world move reconciles
   * (an action's card is ALWAYS in the tableau, so tableau membership can
   * never witness «our commit landed» there).
   */
  flow: 'play' | 'action';
  cardName: CardName;
  isEvent: boolean;
  /** The complete batch the composer assembled (`buildPlayCardBatch` /
   *  `buildActionBatch`'s own wire shape — opaque here) — posted verbatim at
   *  the cell confirm (+ the space tail for a non-fixed placement). */
  batch: ReadonlyArray<unknown>;
  placement: StagedPlacementModel;
  /** The play's immediate gains (composer-extracted) — the card-seal beat's
   *  reward wave. Play flow only. */
  rewards?: ReadonlyArray<ResourceTransferSpec>;
  draws: number;
  deckCheck: boolean;
  /** PLAY flow restore: the shell's own pending descriptor… */
  pending?: {cardName: CardName, input: SelectProjectCardToPlayModel};
  /** …and the play composer's capture snapshot. */
  draft?: PlayComposerDraft;
  /** ACTION flow restore: which action to re-seat + the action composer's own
   *  opaque capture snapshot (written and read only by ConsoleActionComposer). */
  actionRestore?: {cardName: CardName, nodeIndex: number, composer: unknown};
  /** Whether entering staged play moved a workspace stack aside (and so
   *  whether B must bring one back). */
  yieldedStack: boolean;
};

export const stagedPlayState = reactive({
  arm: undefined as StagedPlayArm | undefined,
  /** The batch is on the wire (or being physically presented). Set at the cell
   *  confirm; cleared by the transport abort battery on a refusal (back to the
   *  locked cell, still cancellable) or by the shell's finalize on success. */
  committing: false,
});

export function stagedPlayActive(): boolean {
  return stagedPlayState.arm !== undefined;
}

export function armStagedPlay(arm: StagedPlayArm): void {
  stagedPlayState.arm = arm;
  stagedPlayState.committing = false;
}

export function markStagedPlayCommitting(): void {
  stagedPlayState.committing = true;
}

/** A refused/lost submit — the placement rolls back to its locked cell and the
 *  staged play stays live (the player may retry or B out). Called from the
 *  transport abort battery. */
export function abortStagedPlayCommit(): void {
  stagedPlayState.committing = false;
  pendingSeal = undefined;
}

/** The staged play is over (committed and applied, or cancelled). */
export function clearStagedPlay(): void {
  stagedPlayState.arm = undefined;
  stagedPlayState.committing = false;
}

// ── THE CARD-SEAL REWARD WAVE (stage-4 §8-bis, minimal form) ────────────────
//
// The card's OWN immediate gains (production / stock — the composer-extracted
// `rewards`) must not snap silently while the flow ends on the board: their
// visual source is the PLACED TILE («всё, что дала карта, рождается НА тайле»).
// Armed at the cell confirm; the hold is seeded in the transport's synchronous
// seed block (same law as every reward hold); the wave flies from the tile
// after the placement hero's own beats, each counter ticking at its chip's
// touchdown. The full card-seal choreography (the plaque + the action-commit
// impulse) layers on top of this later — the wave's origin contract is already
// the tile.

type StagedSeal = {spaceId: string, specs: ReadonlyArray<ResourceTransferSpec>};
let pendingSeal: StagedSeal | undefined;

// ── THE PARKED PIN (the interleaved-prompt class) ───────────────────────────
//
// The commit's response can come back WITHOUT our tile: a threshold bonus
// ocean jumped the queue ahead of the card's own placement (raising
// temperature past 0°C — Nuclear Zone, Comet, …), and the server PARKED the
// addressed cell behind it (`deferredInputBatch`; the self model carries the
// fact as `stagedPlacementPending`). The flow is COMMITTED — the workspace is
// gone for good, B restores nothing — but the presentation stays owed: the
// card-seal wave may only fly once the pinned tile actually lands, and must
// release honestly if the server drops the pin (the placement re-asked live).
// The pin MIRRORS the server fact — it resolves on version moves, never on a
// client clock.

export type StagedPinInfo = {cardName: CardName, spaceId: string, tileType?: TileType};

export const stagedPinState = reactive({
  pin: undefined as StagedPinInfo | undefined,
});

/** The commit landed but the cell is parked behind an interloper prompt. */
export function beginStagedPin(pin: StagedPinInfo): void {
  stagedPinState.pin = pin;
}

export function stagedPinParked(): boolean {
  return stagedPinState.pin !== undefined;
}

/** The pinned placement LANDED (the server's drain auto-placed it) — the
 *  seal wave is free to fly from the tile. */
export function resolveStagedPinLanded(): void {
  stagedPinState.pin = undefined;
}

/** The server DROPPED the pin (the placement is being re-asked live): release
 *  the held rewards honestly — counters tick in place, no flight from a tile
 *  that never landed. The live re-ask then runs today's ordinary flow. */
export function resolveStagedPinDropped(): void {
  stagedPinState.pin = undefined;
  const seal = pendingSeal;
  pendingSeal = undefined;
  if (seal !== undefined) {
    for (const spec of seal.specs) {
      releasePanelRewardHold(spec);
    }
  }
}

/** Called at the cell confirm, BEFORE the submit — the wave's plan. */
export function armStagedSeal(spaceId: string): void {
  const specs = (stagedPlayState.arm?.rewards ?? []).filter((s) => s.amount > 0);
  pendingSeal = specs.length > 0 ? {spaceId, specs} : undefined;
}

/** Transport seed block (synchronous with the commit — see seedRewardHolds). */
export function seedStagedPlayRewardHold(): void {
  if (pendingSeal !== undefined) {
    beginPanelRewardHold(pendingSeal.specs);
  }
}

/** Fly the card's gains FROM the placed tile into the rail. Runs after the
 *  tile hero's own reward beats; degrades to an honest immediate release when
 *  the hex cannot be measured (never a stuck hold). */
export function runStagedSealWave(): Promise<void> {
  if (stagedPinState.pin !== undefined) {
    // The pinned placement has not landed yet (parked behind an interloper
    // prompt) — the wave stays OWED, holds intact. It flies on the response
    // that resolves the pin (or releases honestly on a dropped pin).
    return Promise.resolve();
  }
  const seal = pendingSeal;
  pendingSeal = undefined;
  if (seal === undefined) {
    return Promise.resolve();
  }
  const rect = measureBoardHexRect(seal.spaceId);
  if (rect === undefined) {
    for (const spec of seal.specs) {
      releasePanelRewardHold(spec);
    }
    return Promise.resolve();
  }
  return runResourceTransfers({
    specs: seal.specs,
    source: {point: {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2}},
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
}

/** Is a seal wave still owed? (The transport's fallback path asks.) */
export function stagedSealPending(): boolean {
  return pendingSeal !== undefined;
}
