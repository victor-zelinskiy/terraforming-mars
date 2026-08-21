import {BonusCardId, TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpInfo, MarsBotTrackCube} from '../../../common/automa/MarsBotCorpData';
import {Tag} from '../../../common/cards/Tag';
import {FailedActionReason} from '../../../common/automa/MarsBotTurn';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {Space} from '../../boards/Space';
import {IProjectCard} from '../../cards/IProjectCard';
import type {BonusCardOutcome} from '../AutomaBonusCards';

/**
 * One MarsBot corporation's SERVER behavior — the printed rule boxes of the
 * physical card (Rule Book B "Adding Corporations"), co-located per
 * corporation in `src/server/automa/corps/MarsBot<Name>.ts`. The printed DATA
 * (identity, tags, draft priority, display sections) lives in the shared
 * `common/automa/MarsBotCorpData.ts`; this type adds only the behavior.
 *
 * Only the boxes the physical card prints are implemented — a corporation
 * with no Setup box has no `setup`, one with no Effect box has no
 * `onProjectCardResolving` (RB-B anatomy: "Not all corporations use all
 * fields"). Starting tags are NOT a hook: the framework resolves them
 * generically at selection time (RB-B Setup 4 applies to every corporation).
 */
export type MarsBotCorp = {
  readonly info: MarsBotCorpInfo;

  /** RB-B Setup 3: "Immediately resolve any instructions found in the Setup box of the card." */
  setup?(game: IGame): void;

  /**
   * The "Before Action Phase" box — runs every generation right before the
   * action phase, INCLUDING the first: "Ones marked 'Before Action Phase' are
   * also resolved after setup, before the first generation's Action Phase"
   * (RB-B p.3). Dispatched from the one research → action gate, guarded
   * once-per-generation by `AutomaState.corpBapGeneration`.
   */
  beforeActionPhase?(game: IGame): void;

  /**
   * The "Effect" box, for effects worded "When resolving a card …" — fired
   * for EVERY project card the bot resolves (its own turn flip, the
   * Research & Development draw, the Local Neural Instance fallback), BEFORE
   * tag processing. The wording is "when RESOLVING", not "when successfully
   * resolving": a Failed Action during the card's resolution never swallows
   * the corporation effect.
   */
  onProjectCardResolving?(game: IGame, card: IProjectCard): void;

  /**
   * A TILE was just placed on Mars by `player` (either seat — the bot's own
   * placements go through the same `Game.addTile`). Runs after the tile is on
   * the board and every card has reacted, so a corporation reacting to it
   * sees a finished placement. C10 reads both seats through this one hook.
   */
  onTilePlaced?(game: IGame, player: IPlayer, space: Space): void;

  /**
   * MarsBot RESOLVED one printed tag (`AutomaResolver.resolveTag`) — a tag of
   * a card it flipped, or one of its corporation's own starting tags. Runs
   * AFTER the tag did its own work (its track advanced, the space's icon
   * fired), so a corporation that reacts to a tag reacts to a finished event.
   */
  onTagResolved?(game: IGame, tag: Tag): void;

  /**
   * MarsBot received a MICROBE ADVANCEMENT that was not a resolved tag — the
   * Venus board's printed microbe cell (position 9 advances the Bio track BY a
   * microbe). RB-B's FAQ resolves it «as if a card with a microbe was played»,
   * which is why the sanctioned HUMAN reactors already fire there; a bot
   * corporation whose own clause watches microbes must not be deafer to that
   * event than its human twin is (C24 Splice).
   *
   * Dispatched ONLY from that cell. A microbe STARTING tag is a real
   * `resolveTag`, so it arrives through `onTagResolved` and must never also
   * come through here — that would pay twice for one microbe.
   */
  onMicrobeAdvancement?(game: IGame): void;

  /**
   * VP this corporation scores AT THE END OF THE GAME, on top of everything
   * the bot already scores (C25 Viron: 1 per blue card with a red arrow in its
   * played pile). Read-only: it is called from the scoring pass and must never
   * mutate state — re-derive from the pile, never keep a parallel tally.
   */
  endgameVictoryPoints?(game: IGame): number;

  /**
   * MarsBot just took a FAILED ACTION — dispatched from `failedAction`, the one
   * place every one of them goes through, AFTER the usual M€ so a corporation
   * that adds to it («in addition to the usual MC») reads a finished event.
   */
  onFailedAction?(game: IGame, reason: FailedActionReason): void;

  /**
   * VENUS just rose by `steps` — dispatched from `Game.increaseVenusScaleLevel`,
   * the engine's ONE choke point, from beside the HUMAN Aphrodite's own payout
   * so the two entities cannot drift. That call site sits OUTSIDE the
   * `phase !== SOLAR` guard, which is exactly why the printed parenthetical
   * «or the card Government Intervention» needs no special case: B16 raises
   * Venus with the phase forced to SOLAR to skip TR, and this still fires.
   */
  onVenusIncreased?(game: IGame, steps: number): void;

  /**
   * The ROUND START box, run once per generation immediately before the
   * Research Phase (`Game.gotoResearchPhase`). Generation 1 never reaches it:
   * the corporation is selected at that generation's research → action gate,
   * so its Setup box is what covers the opening round.
   */
  roundStart?(game: IGame): void;

  /**
   * A HUMAN played `card` (the bot's own flips never pass through `playCard`).
   * The one hook that lets a bot corporation watch the other side of the
   * table — C08's Jovian clause is written for both seats.
   */
  onHumanCardPlayed?(game: IGame, player: IPlayer, card: ICard): void;

  /**
   * A COLONY was just built by `builder` — either seat. Dispatched from BOTH
   * places a colony can be founded, each time beside the engine's own
   * «any player built a colony» loop (`Colony.addColony` for a human,
   * `AutomaColonies.botBuildColony` for the bot, which deliberately does not
   * go through the former: it ignores the printed reward). Inheriting those
   * two positions is what makes «when you or MarsBot build a colony» need no
   * branches of its own — C33 Poseidon, whose human twin's
   * `onColonyAddedByAnyPlayer` is the very hook those loops are calling.
   *
   * The corporation is seated BEFORE its own Setup box runs, so a colony the
   * setup builds arrives here too — the printed «including during setup of
   * this card» is free.
   */
  onColonyBuilt?(game: IGame, builder: IPlayer): void;

  /**
   * MarsBot just GAINED `amount` M€ (a positive `stock.add`, from anywhere:
   * a track cell, a covered bonus icon, a Failed Action, another corporation
   * effect). Runs INSIDE that gain, after the bot's balance changed — a
   * corporation may redirect where those M€ came from (C06's bank), never
   * whether the bot got them. Re-entrant: whatever it does may gain more.
   */
  onMegacreditsGained?(game: IGame, amount: number): void;

  /**
   * MarsBot's marker ADVANCED one space on `trackIndex` (the space it landed
   * on is `position`). Fires for EVERY successful advance — a card's printed
   * tag, a cascade, a corporation's own starting tag — and never for a
   * refused one (a maxed track is a Failed Action, not an advance). Runs
   * BEFORE the space's printed icon, like the cube hook beside it.
   */
  onTrackAdvance?(game: IGame, trackIndex: number, position: number): void;

  /**
   * The space MarsBot landed on is now FULLY RESOLVED — its printed icon has
   * run (and any cascade it opened has finished). The AFTER twin of
   * `onTrackAdvance` above, for a clause worded «when a track reaches #N,
   * AFTER resolving the effect …» (C29 Manutech).
   *
   * `position` is the space the marker came to REST on, captured before the
   * icon ran — a printed «advance» may since have carried the marker further,
   * and the trigger is the landing, not where the chain ended up.
   *
   * `depth` is the resolver's own cascade depth. A hook that advances a track
   * again MUST pass `depth + 1` to `AutomaResolver.advanceTrack`, or the
   * shared runaway guard restarts from zero and stops guarding.
   */
  onTrackSpaceResolved?(game: IGame, trackIndex: number, position: number, depth: number): void;

  /**
   * MarsBot's marker ADVANCED onto one of this corporation's cubes (RB-B
   * «Special Cubes on the MarsBot Player Mat»). Fires BEFORE the space's
   * printed icon and IN ADDITION to it — unless the hook returns
   * `'replaces-action'`, the card's explicit «instead of …» case (Helion's
   * white cube takes over the printed temperature raise).
   *
   * A cube fires at most ONCE per game: the framework marks it spent, and a
   * regressed track never re-arms it.
   */
  onTrackCubeTrigger?(game: IGame, cube: MarsBotTrackCube, printedAction: TrackAction | undefined): 'replaces-action' | void;

  /**
   * MarsBot is about to build on a cell ITS OWN player marker reserved (C18
   * Arcadian Communities). Asked by `Game.addTile` BEFORE the tile seats —
   * the only moment at which «was this area reserved?» is still answerable,
   * since seating the tile writes the same `space.player`.
   *
   * Returning `'pays'` opts the bot into the engine's EXISTING reserved-area
   * bonus (the human Arcadian's own 3 M€ line in `grantPlacementBonuses`), so
   * the payout, its scope, its ordering and its covering/Solar-phase
   * exclusions can never drift from the human card's.
   */
  onBuildOnOwnMarker?(game: IGame, space: Space): 'pays' | void;

  /**
   * Resolves one of this corporation's OWN bonus cards (`info.corpBonusCards`,
   * the B22–B32 family) when the bot flips it from its action deck. Routing
   * (discard / destroy / recurring holding) stays with the caller.
   */
  resolveBonusCard?(game: IGame, id: BonusCardId): BonusCardOutcome;
};
