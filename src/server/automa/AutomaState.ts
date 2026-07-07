import {CardName} from '../../common/cards/CardName';
import {ColonyName} from '../../common/colonies/ColonyName';
import {SpaceId} from '../../common/Types';
import {BonusCardId, DifficultyLevel} from '../../common/automa/AutomaTypes';
import {MarsBotTurn} from '../../common/automa/MarsBotTurn';
import type {MarsBotTurnRecording} from './AutomaTurnLog';
import {GameOptions} from '../game/GameOptions';
import {MarsBotBoard} from './MarsBotBoard';
import {THARSIS_MARSBOT_BOARD} from './boards/TharsisMarsBot';
import {VENUS_TRACK} from './boards/VenusMarsBot';

/**
 * One card of the MarsBot action deck: either a face-down project card or a MarsBot
 * bonus card. The deck CONTENTS are private information (physical face-down deck) —
 * they are serialized for the save file but must never reach a client model.
 */
export type AutomaActionCard =
  | {kind: 'project', name: CardName}
  | {kind: 'bonus', id: BonusCardId};

export type SerializedAutomaState = {
  difficulty: DifficultyLevel;
  /** One entry per MarsBot track, in board order. */
  tracks: Array<{position: number, regressed: Array<number>}>;
  actionDeck: Array<AutomaActionCard>;
  playedPile: Array<CardName>;
  bonusDeck: Array<BonusCardId>;
  bonusDiscard: Array<BonusCardId>;
  destroyedBonusCards: Array<BonusCardId>;
  recurringBonusCards: Array<BonusCardId>;
  setAsideBonusCards: Array<BonusCardId>;
  floaters: number;
  shippingStorage: Partial<Record<ColonyName, number>>;
  secondFleetUnlocked: boolean;
  neuralInstanceSpaceId?: SpaceId;
  hardClaimCheckedGeneration: number;
  revealedCard?: AutomaActionCard;
  instantWin?: boolean;
  turnCounter?: number;
  lastTurn?: MarsBotTurn;
  /** Recent resolved turn scripts (bounded) — replayable from the journal. */
  turnHistory?: Array<MarsBotTurn>;
  /** Delta Project: Power-Track increments already consumed for row advances (absent = 0, old saves). */
  deltaPowerConsumed?: number;
  /** Delta Project: the last generation the once-per-generation resolution ran (absent = 0, old saves). */
  deltaResolvedGeneration?: number;
};

/**
 * The whole MarsBot (official Automa) runtime state. Lives on `game.automa`
 * (undefined ⇒ ordinary game, zero behavior change anywhere).
 *
 * MarsBot's M€ supply and TR deliberately do NOT live here — the bot is a real
 * `Player` in `game.players` (flagged `isMarsBot`), so `botPlayer.megaCredits` /
 * `botPlayer.terraformRating` reuse every existing pathway (steal/remove targeting,
 * TR track, award funding costs for the human, endgame scoring).
 */
export class AutomaState {
  public actionDeck: Array<AutomaActionCard> = [];
  public playedPile: Array<CardName> = [];
  public bonusDeck: Array<BonusCardId> = [];
  public bonusDiscard: Array<BonusCardId> = [];
  /** Destroyed bonus cards are removed from the game permanently — never reshuffled. */
  public destroyedBonusCards: Array<BonusCardId> = [];
  /** Cards reshuffled into the action deck at the start of every generation (B16, later B19/B20). */
  public recurringBonusCards: Array<BonusCardId> = [];
  /** Colonies: B19/B20 wait here until their unlock rule moves them to `recurringBonusCards`. */
  public setAsideBonusCards: Array<BonusCardId> = [];
  public floaters: number = 0;
  /** Colonies shipping board storage areas (absent key = 0 resources). */
  public shippingStorage: Partial<Record<ColonyName, number>> = {};
  public secondFleetUnlocked: boolean = false;
  public neuralInstanceSpaceId: SpaceId | undefined = undefined;
  /** Hard difficulty: the last generation the first-turn milestone-pressure check ran. */
  public hardClaimCheckedGeneration: number = 0;
  /** The card currently being resolved (survives a mid-turn human sub-prompt + save). */
  public revealedCard: AutomaActionCard | undefined = undefined;
  /** "If the game enters round 20 (18 with Prelude), you instantly lose" — MarsBot won on the clock. */
  public instantWin: boolean = false;
  /** Monotonic turn number — the id of `lastTurn` (client replay/dedup key). */
  public turnCounter: number = 0;
  /**
   * Delta Project (Solo reference card): how many Power-Track increments the bot
   * has already consumed for Delta row advances. Available power is
   * `energyTrack.position − deltaPowerConsumed` — the consumption counter is the
   * digital equivalent of "Remove 1-4 resources to represent consumed Power"
   * and deliberately never mutates the official Energy track (regressing it is
   * the HUMAN-attack mechanic and would corrupt official MarsBot logic).
   */
  public deltaPowerConsumed: number = 0;
  /** Delta Project: the last generation the once-per-generation resolution ran (mirrors hardClaimCheckedGeneration). */
  public deltaResolvedGeneration: number = 0;
  /** The typed script of the last resolved turn (feeds the client turn theater). */
  public lastTurn: MarsBotTurn | undefined = undefined;
  /**
   * Recent resolved turn scripts, oldest → newest (bounded by
   * `MAX_TURN_HISTORY`). Consecutive bot turns can resolve inside one human
   * input, so `lastTurn` alone would lose the intermediate scripts; the tail
   * also keeps recent turns replayable (journal «Осмотреть ход») after a reload.
   */
  public turnHistory: Array<MarsBotTurn> = [];
  /**
   * The in-flight recording of the CURRENT turn (owned by AutomaTurnLog).
   * Transient by construction — a turn resolves synchronously inside one
   * server call, so this never has to survive a save (and is deliberately
   * not serialized).
   */
  public turnRecording: MarsBotTurnRecording | undefined = undefined;

  private constructor(
    public readonly difficulty: DifficultyLevel,
    public readonly board: MarsBotBoard) {
  }

  /** The track set is derived from the game options: Tharsis + the Venus track when Venus Next is on. */
  private static boardFor(gameOptions: GameOptions): MarsBotBoard {
    const tracks = gameOptions.venusNextExtension ?
      [...THARSIS_MARSBOT_BOARD, VENUS_TRACK] :
      [...THARSIS_MARSBOT_BOARD];
    return new MarsBotBoard(tracks);
  }

  public static newInstance(difficulty: DifficultyLevel, gameOptions: GameOptions): AutomaState {
    return new AutomaState(difficulty, AutomaState.boardFor(gameOptions));
  }

  public serialize(): SerializedAutomaState {
    const result: SerializedAutomaState = {
      difficulty: this.difficulty,
      tracks: this.board.tracks.map((t) => ({position: t.position, regressed: Array.from(t.regressedPositions)})),
      actionDeck: [...this.actionDeck],
      playedPile: [...this.playedPile],
      bonusDeck: [...this.bonusDeck],
      bonusDiscard: [...this.bonusDiscard],
      destroyedBonusCards: [...this.destroyedBonusCards],
      recurringBonusCards: [...this.recurringBonusCards],
      setAsideBonusCards: [...this.setAsideBonusCards],
      floaters: this.floaters,
      shippingStorage: {...this.shippingStorage},
      secondFleetUnlocked: this.secondFleetUnlocked,
      hardClaimCheckedGeneration: this.hardClaimCheckedGeneration,
      turnCounter: this.turnCounter,
      deltaPowerConsumed: this.deltaPowerConsumed,
      deltaResolvedGeneration: this.deltaResolvedGeneration,
    };
    if (this.neuralInstanceSpaceId !== undefined) {
      result.neuralInstanceSpaceId = this.neuralInstanceSpaceId;
    }
    if (this.revealedCard !== undefined) {
      result.revealedCard = this.revealedCard;
    }
    if (this.instantWin) {
      result.instantWin = true;
    }
    if (this.lastTurn !== undefined) {
      result.lastTurn = this.lastTurn;
    }
    if (this.turnHistory.length > 0) {
      result.turnHistory = [...this.turnHistory];
    }
    return result;
  }

  public static deserialize(d: SerializedAutomaState, gameOptions: GameOptions): AutomaState {
    const state = new AutomaState(d.difficulty, AutomaState.boardFor(gameOptions));
    if (d.tracks.length !== state.board.tracks.length) {
      throw new Error(`Corrupt automa save: ${d.tracks.length} serialized tracks, expected ${state.board.tracks.length}`);
    }
    d.tracks.forEach((t, i) => {
      state.board.tracks[i].position = t.position;
      state.board.tracks[i].regressedPositions = new Set(t.regressed);
    });
    state.actionDeck = [...d.actionDeck];
    state.playedPile = [...d.playedPile];
    state.bonusDeck = [...d.bonusDeck];
    state.bonusDiscard = [...d.bonusDiscard];
    state.destroyedBonusCards = [...d.destroyedBonusCards];
    state.recurringBonusCards = [...d.recurringBonusCards];
    state.setAsideBonusCards = [...d.setAsideBonusCards];
    state.floaters = d.floaters;
    state.shippingStorage = {...d.shippingStorage};
    state.secondFleetUnlocked = d.secondFleetUnlocked;
    state.neuralInstanceSpaceId = d.neuralInstanceSpaceId;
    state.hardClaimCheckedGeneration = d.hardClaimCheckedGeneration;
    state.revealedCard = d.revealedCard;
    state.instantWin = d.instantWin ?? false;
    state.turnCounter = d.turnCounter ?? 0;
    state.lastTurn = d.lastTurn;
    state.turnHistory = d.turnHistory !== undefined ? [...d.turnHistory] : [];
    state.deltaPowerConsumed = d.deltaPowerConsumed ?? 0;
    state.deltaResolvedGeneration = d.deltaResolvedGeneration ?? 0;
    return state;
  }
}
