import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {GlobalParameter} from '../GlobalParameter';
import {Resource} from '../Resource';
import {Tag} from '../cards/Tag';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';
import {EventTrigger, JournalActionCategory} from '../events/GameEvent';

/**
 * «A CARD REACTED» — the server's record of WHICH card's printed effect fired
 * and WHAT it paid (Turmoil Redux TR80 Hartlan Heating — the «CARD REACTION:
 * ONE FRAMEWORK» iteration, 2026-10-26). The console's one reaction scene
 * plays it: the reacting card rises, the tokens are born on its printed
 * effect icons and fly to where the resource lives, the counters tick on
 * touchdown — for the owner's own press and on every other viewer's screen
 * alike. Nobody infers «Hartlan fired» from a counter's delta, and the
 * forecast (the promise BEFORE the press) stays what it is: this is the truth
 * AFTER it. docs/claude/console/card-reaction.md.
 *
 * ONE writer: `EventRecorder` — a passive-effect scope (`withEffect`) whose
 * hook produced at least one impact (sync or through a deferred action
 * restored under the same scope) publishes its record on the FIRST impact and
 * appends every later one. A hook that only logged, or did nothing, leaves no
 * record — like its lazy `effect-triggered` marker.
 */
export type CardReactionImpact =
  | {kind: 'stock', resource: Resource, amount: number, to: Color}
  | {kind: 'production', resource: Resource, amount: number, to: Color}
  | {kind: 'card-resource', resource: CardResource, amount: number, target: CardName, to: Color}
  | {kind: 'draw', amount: number, to: Color}
  | {kind: 'tr', amount: number, to: Color}
  | {kind: 'global', parameter: GlobalParameter, amount: number, to: Color};

/**
 * WHAT WOKE THE EFFECT — stated by the trigger site that knows it (`Player.onCardPlayed` → the played card;
 * `Game.addTile` → the tile and its cell; a non-card tag; a scale step). Absent on a channel whose site states none.
 */
export type CardReactionCause = {
  card?: CardName;
  tag?: Tag;
  tile?: TileType;
  space?: SpaceId;
  parameter?: GlobalParameter;
};

/** THE ROOT the reaction stands under: the chain's correlationId (the SAME id a draw batch's `actionId` carries), the acting seat, the action's category. */
export type CardReactionRoot = {
  actionId?: number;
  player?: Color;
  category?: JournalActionCategory;
};

/**
 * ONE REACTION (`GameModel.cardReactions`): a bounded ring, never serialized,
 * each client consuming a record once by `seq`. A restart loses the
 * animation, never the rule (the journal keeps the line). The
 * `scaleStepRewards` precedent — but written by the recorder for EVERY card
 * effect, so a new reactor's record comes for free.
 */
export type CardReactionRecord = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  root: CardReactionRoot;
  /** The reacting card's owner — the seat whose printed effect fired (a law's: the seat it paid). */
  owner: Color;
  /**
   * WHAT reacted: a tableau card, a corporation — or an ENACTED RESOLUTION (Turmoil Redux, iteration 4 of the
   * framework, 2026-10-27): the law's passive fired on the seat's own move (Forestry Support's groves, Development
   * Craze's second payout) and is played by the same scene — the law's face rises, or the law standing on screen
   * (the government's card, a composer's law hero) reacts in its place.
   */
  kind: 'card' | 'corporation' | 'resolution' | 'party';
  /**
   * The face's key: the card's name — or, for a `resolution` record, the catalog `ResolutionId`, for a `party`
   * record the `PartyName`, in the same slot (the premium faces' own convention — `resolutionPremiumVm` /
   * `partyPremiumVm` key a law's and a party's charter face by that id; neither collides with a CardName).
   */
  card: CardName;
  /** The channel the live hook fired on — the forecast fact's `source.channel`, so the two match one-to-one. */
  channel: EventTrigger;
  /** The printed effect block the record belongs to, when the card declares it (the forecast's `printedEffect`). */
  printedEffect?: number;
  cause?: CardReactionCause;
  /** What landed, in the order it landed — each with its recipient (an attack pays a rival). */
  impacts: Array<CardReactionImpact>;
};

/** The ring's depth: a play waking several reactors, each a record, must survive one poll. */
export const CARD_REACTION_RING_DEPTH = 16;
