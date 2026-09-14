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
    effect?: string;
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
  /** Passive effect while enacted (iteration 0 ships none; the seam is the party-effect hook set). */
  passive?: undefined;
  action?: ResolutionAction;
}
