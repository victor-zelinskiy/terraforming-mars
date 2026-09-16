import {Expansion, GameModule} from '../../../common/cards/GameModule';
import {ICardRenderRoot} from '../../../common/cards/render/Types';
import {QuestDefinition, ReduxParty, ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';
import {Message} from '../../../common/logs/Message';
import {EventSource} from '../../../common/events/EventSource';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {PlayerInput} from '../../PlayerInput';
import type {Parliament} from '../Parliament';
import type {Space} from '../../boards/Space';
import type {Resource} from '../../../common/Resource';
import type {EffectForecastFact, EffectForecastSource} from '../../../common/models/EffectForecastModel';
import type {EffectForecastGrant, EffectForecastTile} from '../../cards/EffectForecastContext';

/**
 * The context an enacted resolution's effect step runs in. `influence` is
 * the player's influence at enactment time (the winner's Agenda already
 * advanced — rulebook p.10 step 1 precedes step 3).
 */
export type EnactContext = {
  game: IGame;
  parliament: Parliament;
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
};

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
 * A PASSIVE effect while the resolution stands enacted — the SAME hook set
 * the party effects use, run for EVERY participant (an enacted resolution is
 * everyone's law), every mutation under the resolution's own event source.
 * `forecast` is MANDATORY: the effects framework's honesty law — a live hook
 * with no forecast twin is a silent lie in the play / action forecast.
 */
export type ResolutionPassive = {
  onTilePlaced?(player: IPlayer, space: Space): void;
  onTerraformRatingGained?(player: IPlayer, steps: number): void;
  onProductionChanged?(player: IPlayer, resource: Resource, delta: number): void;
  forecast(ctx: ResolutionForecastContext): Array<EffectForecastFact>;
};

export interface ResolutionDefinition {
  id: ResolutionId;
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
    passive?: string;
    action?: string;
    quest: string;
  };
  quest: QuestDefinition;
  /** A dummy: real party, real votes, real quest — no effect of its own. */
  dummy?: boolean;
  /** Per-player immediate effect (every participating player, generation order). */
  immediateSteps?: ReadonlyArray<EnactStep>;
  /** Winner-only effect (skipped for a neutral winner — rulebook FAQ p.18). */
  winnerSteps?: ReadonlyArray<EnactStep>;
  /** Passive effect while enacted (see {@link ResolutionPassive}) — the DEV passive example proves the seam. */
  passive?: ResolutionPassive;
  action?: ResolutionAction;
}
