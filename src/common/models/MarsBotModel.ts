import {BonusCardId, DifficultyLevel, TrackAction} from '../automa/AutomaTypes';
import {MarsBotTurn} from '../automa/MarsBotTurn';
import {Tag} from '../cards/Tag';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';

export type MarsBotTrackModel = {
  tags: ReadonlyArray<Tag>;
  position: number;
  maxPosition: number;
  layout: ReadonlyArray<TrackAction | undefined>;
  /** Regressed-from spaces still carrying the no-reactivation marker. */
  regressed: ReadonlyArray<number>;
};

/**
 * The public MarsBot state (everything here is open information on the
 * physical table): tracks, deck COUNTS (never contents/order), the open
 * discard piles, the played pile, floaters and the shipping storage.
 */
export type MarsBotModel = {
  difficulty: DifficultyLevel;
  tracks: ReadonlyArray<MarsBotTrackModel>;
  /** Face-down action deck — count only. */
  actionDeckSize: number;
  /** Face-down bonus deck — count only (order hidden). */
  bonusDeckSize: number;
  /** The open bonus discard pile. */
  bonusDiscard: ReadonlyArray<BonusCardId>;
  /** Destroyed bonus cards — removed from the game, publicly known. */
  destroyedBonusCards: ReadonlyArray<BonusCardId>;
  /** MarsBot's played project cards (face up). */
  playedPile: ReadonlyArray<CardName>;
  /** The card being resolved right now, if any (already revealed). */
  revealedCard?: {kind: 'project', name: CardName} | {kind: 'bonus', id: BonusCardId};
  /** The typed script of the last resolved bot turn — the turn-theater feed. */
  lastTurn?: MarsBotTurn;
  floaters: number;
  /** Colonies shipping-board storage areas (present only with Colonies). */
  shippingStorage?: Partial<Record<ColonyName, number>>;
  secondFleetUnlocked?: boolean;
  /** "MarsBot instantly wins" — the game entered the loss round. */
  instantWin?: boolean;
  /**
   * Delta Project (present only with the Hydronetwork): the bot's Power budget —
   * unconsumed Energy-track increments available for row advances + the
   * increments already consumed. Open information (both derive from the public
   * track position). The bot's track POSITION rides the ordinary per-player
   * `deltaProject` model like any player's.
   */
  deltaPower?: {available: number, consumed: number};
};
