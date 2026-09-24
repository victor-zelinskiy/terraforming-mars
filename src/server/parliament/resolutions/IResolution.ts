import {Expansion, GameModule} from '../../../common/cards/GameModule';
import {ICardRenderRoot} from '../../../common/cards/render/Types';
import {QuestDefinition, ReduxParty, ResolutionCode, ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect} from '../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../common/parliament/resolutionLevy';
import {WinnerRewardDeclaration} from '../../../common/parliament/winnerReward';
import {WorldParameterMove} from '../../../common/parliament/parameterMove';
import type {SerializedEnactOutcome} from '../SerializedParliament';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';
import {Message} from '../../../common/logs/Message';
import {EventSource} from '../../../common/events/EventSource';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {PlayerInput} from '../../PlayerInput';
import type {Parliament} from '../Parliament';
import type {Space} from '../../boards/Space';
import type {IProjectCard} from '../../cards/IProjectCard';
import type {Resource} from '../../../common/Resource';
import type {EffectForecastFact, EffectForecastSource} from '../../../common/models/EffectForecastModel';
import type {EffectForecastGrant, EffectForecastTile} from '../../cards/EffectForecastContext';
import type {BoardFact, BoardFactDelta} from '../../../common/boards/BoardInformationFacts';
import type {SpaceId} from '../../../common/Types';

/**
 * The context an enacted resolution's effect step runs in. `influence` is
 * the player's influence at enactment time (the winner's Agenda already
 * advanced — rulebook p.10 step 1 precedes step 3).
 */
export type EnactContext = {
  game: IGame;
  parliament: Parliament;
  /**
   * The seat the step runs for. In a WORLD step (`worldSteps`) there is no
   * seat: this is the engine HANDLE (the first player in generation order),
   * never the author of what the step does — a world step attributes nothing
   * to it, and its records carry no player.
   */
  player: IPlayer;
  /** The player who won the resolution, or undefined when the neutral player did. */
  winner: IPlayer | undefined;
  influence: number;
  /** The event source every mutation of this effect must carry. */
  source: EventSource;
  /**
   * Resumable scratch space shared by the steps of ONE player's effect —
   * persisted with the phase progress, so a later step (or a reload) sees
   * what an earlier step decided. Keys are the effect's own.
   */
  state: Record<string, unknown>;
  /**
   * RECORD what the step actually did (or why it did nothing) — at the moment
   * of the mutation, from inside the prompt's answer when the step asked. The
   * driver stamps the player and the step key; the record lands in the phase
   * summary the client presents (the enactment stage, the results scene) and
   * is never recomputed from a later state.
   */
  report(outcome: EnactOutcome): void;
};

/** A step's outcome as the step reports it (the driver adds `player`, `step` and `part`). */
export type EnactOutcome = Omit<SerializedEnactOutcome, 'player' | 'step' | 'part'>;

/**
 * ONE resumable step of an enactment effect. THE CONTRACT: a step either
 * MUTATES (returns undefined) or ASKS (returns a prompt whose callback does
 * the mutating). Never both — the driver rebuilds a pending step's prompt on
 * reload by calling `run` again, so anything `run` did before returning the
 * prompt would happen twice.
 */
export type EnactStep = {
  key: string;
  run(ctx: EnactContext): PlayerInput | undefined;
};

export type ResolutionActionAvailability = {available: true} | {available: false; reason: string | Message};

export type ResolutionAction = {
  usesPerGeneration(player: IPlayer): number;
  /** Ignoring uses — the parliament checks those. */
  canAct(player: IPlayer): ResolutionActionAvailability;
  execute(player: IPlayer): PlayerInput | undefined;
  preview(player: IPlayer): ReadonlyArray<ActionEffect>;
};

/**
 * What a passive effect's FORECAST reads — the same grants and tiles the live
 * hooks will see, and the builders every table reactor uses (the effects
 * framework's own vocabulary, handed in so a resolution file imports no engine
 * module). `source(channel)` is this resolution on the channel the live hook
 * fires on — a fact and its `effect-triggered` event match one-to-one.
 */
export type ResolutionForecastContext = {
  player: IPlayer;
  grants: ReadonlyArray<EffectForecastGrant>;
  tiles: ReadonlyArray<EffectForecastTile>;
  source(channel: EffectForecastSource['channel']): EffectForecastSource;
  exact(source: EffectForecastSource, effects: ReadonlyArray<ActionEffect>, title: string, opts?: {id?: string}): EffectForecastFact;
  deferred(source: EffectForecastSource, effects: ReadonlyArray<ActionEffect>, title: string, opts?: {id?: string}): EffectForecastFact;
  stockGain(resource: Resource, amount: number): ActionEffect;
  productionChange(resource: Resource, delta: number): ActionEffect;
  drawGain(count: number): ActionEffect;
};

/**
 * What the engine knows about the placement whose bonuses it just paid, told
 * to the `onTilePlaced` hook (`Game.grantPlacementBonuses` runs it AFTER the
 * cell's printed bonuses and the adjacency bonuses). `coveringExistingTile`:
 * the tile landed ON another tile (an Ares ocean cover), so the cell's PRINTED
 * bonuses were NOT paid — a hook that repeats the payout must not invent them.
 */
export type TilePlacementBonusContext = {
  coveringExistingTile: boolean;
};

/**
 * What a tile passive's DOSSIER twin reads (`ResolutionPassive.placementFacts`):
 * the cell the player points at, the placement's shape — the same flags the
 * party facts read — and the facts the preview ALREADY states for the cell
 * for the placing player (its printed bonuses, its ocean adjacency), so a
 * passive that repeats or answers them promises the very numbers the commit
 * will pay. `gain` builds a fact of the resolution: titled by its name, in
 * the placement-effect section, described by the rule.
 */
export type ResolutionPlacementContext = {
  player: IPlayer;
  space: Space;
  /** The cell is on Mars (never a reserved area off Mars). */
  onMars: boolean;
  /** A tile lands (a camp move / a marker pick places none — and runs no tile hook). */
  placesTile: boolean;
  /**
   * The engine will RUN the enacted passive's `onTilePlaced` for this
   * placement: a tile actually lands AND the phase is not the World
   * Government's (which grants no placement bonuses and fires no parliament
   * hook at all). Derived once by the engine — a tile passive asks THIS, never
   * a guess assembled from the flags around it.
   */
  firesTilePassive: boolean;
  /** The commit pays the cell's placement bonuses (no cover, not the World Government's phase). */
  grantsPlacementBonus: boolean;
  countsAsCity: boolean;
  /** The cell's own immediate GAIN facts for the placing player, as the preview computed them. */
  facts: ReadonlyArray<BoardFact>;
  /**
   * Build one fact OF THIS RESOLUTION: titled by its name (the law is the
   * cause — without it the bonus does not exist), in the placement-effect
   * section, with the law's own sentence. `params` fills that sentence's
   * `${n}` slots (an arithmetic breakdown, the ocean fact's precedent);
   * `spaces` names the CELLS that make the fact true, so the board lights
   * exactly the neighbours that will pay.
   */
  gain(id: string, delta: BoardFactDelta, description?: string, opts?: {
    params?: ReadonlyArray<string>;
    spaces?: ReadonlyArray<SpaceId>;
  }): BoardFact;
};

/**
 * A PASSIVE effect while the resolution stands enacted — the SAME hook set
 * the party effects use, run for EVERY participant (an enacted resolution is
 * everyone's law), every mutation under the resolution's own event source.
 * `forecast` is MANDATORY: the effects framework's honesty law — a live hook
 * with no forecast twin is a silent lie in the play / action forecast.
 */
export type ResolutionPassive = {
  onTilePlaced?(player: IPlayer, space: Space, placement: TilePlacementBonusContext): void;
  /**
   * The DOSSIER twin of `onTilePlaced` — what the passive will pay for the
   * cell under the cursor, stated in the placement panel BEFORE the commit
   * (the board's own honesty law: a tile hook without it lets the dossier
   * promise less than the commit pays). MANDATORY beside `onTilePlaced`
   * (the contract guard).
   */
  placementFacts?(ctx: ResolutionPlacementContext): Array<BoardFact>;
  onTerraformRatingGained?(player: IPlayer, steps: number): void;
  onProductionChanged?(player: IPlayer, resource: Resource, delta: number): void;
  /**
   * A DISCOUNT on PLAYING `card` (Heat Capture: 3 M€ less on a Building tag) —
   * the M€ the law takes off the printed cost, 0 when it does not apply. Asked
   * by the ONE price function (`Player.getCardCostBreakdown`, through
   * `ParliamentHandler.cardDiscount`) for every participant holding the law,
   * and itemized there under the resolution's own source — never folded into
   * the cardless remainder, so the payment head, the forecast's discount group,
   * the `discount-applied` event and the journal all NAME the law. Pure: it
   * reads the card and the player, never mutates, never logs.
   *
   * Its forecast twin IS that breakdown (`discountsOf` reads the same function
   * at the same moment the price does), so `forecast` states nothing for it —
   * a fact here would print the same 3 M€ a second time, in a group meant for
   * triggers, with no `effect-triggered` event to match it.
   */
  cardDiscount?(player: IPlayer, card: IProjectCard): number;
  /**
   * A BONUS ON THE VALUE of a payment resource (Metal Research: each unit of
   * steel and titanium is worth 1 M€ more) — the M€ the law ADDS to what one
   * unit of `resource` buys, 0 when it does not apply. Asked by the ONE value
   * accessor (`Player.getSteelValue` / `getTitaniumValue`, through
   * `ParliamentHandler.resourceValueBonus`) for every participant holding
   * the law, ON THE READ: the player's serialized value field is NEVER
   * written by a law (a write would have to be remembered, undone by a floor
   * that knows nothing about whose unit it removes, and re-done on a reload
   * — an invisible drift of the price). The bonus therefore stacks additively
   * with the cards that raise the value, survives a save by construction, and
   * leaves with the law the instant another card takes the ENACTED slot.
   * Pure: it reads the player and the resource, never mutates, never logs.
   *
   * Its forecast twin is the RATE where the decision is made (the rail's
   * value badge, the payment panel's «×N» — both read the model's live value),
   * so `forecast` states nothing for it, as for `cardDiscount`.
   */
  resourceValueBonus?(player: IPlayer, resource: Resource): number;
  forecast(ctx: ResolutionForecastContext): Array<EffectForecastFact>;
};

export interface ResolutionDefinition {
  id: ResolutionId;
  /**
   * The printed catalog code (`RX##` — see `ResolutionCode`): the face's
   * corner stamp, the art key and the search key. A REAL resolution declares
   * one by hand; a never-dealt test / dev example has none. Unique across the catalog.
   */
  code?: ResolutionCode;
  module: GameModule;
  party: ReduxParty;
  /** Physical copies in the deck (0 = catalogued but never dealt — test-only). */
  copies: number;
  compatibility?: ReadonlyArray<Expansion>;
  renderData: ICardRenderRoot;
  text: {
    name: string;
    /** The immediate effect every participant receives at the enactment. */
    effect?: string;
    /** The WINNER-ONLY part of the enactment (`winnerSteps`) — its own block in the inspector. */
    winner?: string;
    /**
     * The part the enactment does to the TABLE, once and for nobody (`worldSteps`
     * / `worldMoves`) — its own block in the inspector, never a clause of
     * `effect`: what the law does to the planet is not what it pays a seat.
     */
    world?: string;
    passive?: string;
    action?: string;
    quest: string;
  };
  quest: QuestDefinition;
  /**
   * The parts of the enactment that SCALE WITH INFLUENCE. The step that pays
   * one reads its amount through `scaledAmount(effect, ctx.influence)` — the
   * same declaration the client estimates from (exported to the manifest),
   * so a face, a vote surface, a picker and the payout can never disagree.
   */
  scaled?: ReadonlyArray<InfluenceScaledEffect>;
  /**
   * THE LEVY — a fixed sum every participant LOSES at the enactment BEFORE
   * anything is paid (the Budgets' «Lose 10 M€», `resolutionLevy.ts`). Its
   * step is the family's ONE shared executor (`levyStep`), declared FIRST in
   * `immediateSteps` (the printed order is the executed order); the guard
   * refuses a levy without its step and a levy step without its declaration.
   * Exported to the manifest: the vote panel's net line, the sitting's
   * reading, the results and the stand read the same sum the step takes.
   */
  levy?: ResolutionLevy;
  /**
   * The WINNER's part as data (`winnerReward.ts`) — the tile `winnerSteps`
   * places. Exported to the manifest, so the vote surface, the inspector, the
   * results and the playground read the same declaration the step pays by
   * (what the tile is, which parameter its own placement moves).
   */
  winnerReward?: WinnerRewardDeclaration;
  /**
   * WHAT THE ENACTMENT DOES TO THE TABLE, as data (`parameterMove.ts`) — the
   * global parameters a WORLD step moves and whether anybody is credited for
   * them (Gas Export: oxygen −1, Venus +2, «no one gets the TR for this»).
   * Exported to the manifest, so the vote reading, the sitting's stage, the
   * results and the playground state the move from the same declaration
   * `worldSteps` pays by. Declared BESIDE `worldSteps`, never instead of it.
   */
  worldMoves?: ReadonlyArray<WorldParameterMove>;
  /** Per-player immediate effect (every participating player, generation order). */
  immediateSteps?: ReadonlyArray<EnactStep>;
  /**
   * A PLAN OF STEPS PER PLAYER — for an effect whose steps depend on the
   * player's own table (Colonial Affairs: one step per colony tile the player
   * has a cube on, k pairs for Pluto). The driver asks it for every
   * participant and walks the answer exactly as it walks `immediateSteps`;
   * the keys it returns are DETERMINISTIC over the game state the plan reads
   * (the table cannot change between the steps of one sitting), so a reload
   * inside any step rebuilds the same plan and finds its own key. Read
   * through `immediateStepsOf` — never the two fields by hand.
   */
  immediateStepsFor?: (player: IPlayer, parliament: Parliament, game: IGame) => ReadonlyArray<EnactStep>;
  /**
   * THE WORLD'S OWN PART — run ONCE PER ENACTMENT, not once per seat: after
   * every participant's immediate steps and before the winner's. It has no
   * player (the law lowered the oxygen, nobody did), so its records carry no
   * seat and every viewer reads them; the driver hands the step a HANDLE
   * player only because the engine's parameter API takes one (the precedent
   * of the World Government, `SnowCover` and `MagneticFieldStimulationDelays`
   * — the first player in generation order), and attributes nothing to them.
   * Idempotent through the phase's own `applied` list, so a reload in the
   * middle of an enactment never moves the planet twice.
   *
   * A world step obeys the SAME contract as any other: it MUTATES or it ASKS,
   * and it reports exactly once — including the branch where the parameter is
   * already at its limit and nothing happens (a skip NAMES itself; relying on
   * the engine's own silent early return is the defect this comment exists
   * to prevent).
   */
  worldSteps?: ReadonlyArray<EnactStep>;
  /** Winner-only effect (skipped for a neutral winner — rulebook FAQ p.18). */
  winnerSteps?: ReadonlyArray<EnactStep>;
  /** Passive effect while enacted (see {@link ResolutionPassive}) — the DEV passive example proves the seam. */
  passive?: ResolutionPassive;
  action?: ResolutionAction;
}

/**
 * THE IMMEDIATE STEPS OF `definition` FOR `player` — the static list, or the
 * per-player plan when the definition declares one (a plan outranks the
 * list: a card declares one or the other). The ONE reader of the two fields:
 * the driver, the contract guard and the fixture builders all walk this.
 */
export function immediateStepsOf(definition: ResolutionDefinition, player: IPlayer, parliament: Parliament, game: IGame): ReadonlyArray<EnactStep> {
  if (definition.immediateStepsFor !== undefined) {
    return definition.immediateStepsFor(player, parliament, game);
  }
  return definition.immediateSteps ?? [];
}

/** Does the definition pay every participant something at the enactment (a list or a plan)? */
export function hasImmediateSteps(definition: ResolutionDefinition): boolean {
  return (definition.immediateSteps?.length ?? 0) > 0 || definition.immediateStepsFor !== undefined;
}

/** Does the enactment change the TABLE once, for nobody in particular? */
export function hasWorldSteps(definition: ResolutionDefinition): boolean {
  return (definition.worldSteps?.length ?? 0) > 0;
}
