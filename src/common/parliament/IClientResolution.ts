import {Expansion, GameModule} from '../cards/GameModule';
import {ICardRenderRoot} from '../cards/render/Types';
import {PartyActionId, QuestDefinition, ReduxParty, ResolutionCode, ResolutionId} from './ParliamentTypes';
import {InfluenceScaledEffect} from './influenceScaling';
import {ResolutionLevy} from './resolutionLevy';
import {PartyReaction} from './partyReactions';
import {WinnerRewardDeclaration} from './winnerReward';
import {TileGrantDeclaration} from './tileGrant';
import {WorldParameterMove} from './parameterMove';

/**
 * The printed face of a resolution card, as shipped to the client through
 * `genfiles/parliament.json` (the global-event pipeline's twin — see
 * `src/server/tools/export_card_rendering.ts`). Static, never game state.
 */
export type IClientResolution = {
  id: ResolutionId;
  /** The printed catalog code (`RX##`) — the face's corner stamp, the art key, the search key. Absent on a never-dealt test / dev example. */
  code?: ResolutionCode;
  module: GameModule;
  party: ReduxParty;
  copies: number;
  compatibility: Array<Expansion>;
  renderData: ICardRenderRoot;
  /** English i18n keys. */
  text: {
    name: string;
    /** The immediate effect every participant receives at the enactment. */
    effect?: string;
    /** The winner-only part of the enactment (the player who won the vote). */
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
   * The quest's GOAL as a graphic (the same render DSL the faces draw): the
   * card's quest footnote, the workspace's quest block and the inspector all
   * read this ONE description, so the three can never drift apart.
   */
  questRenderData: ICardRenderRoot;
  /**
   * The parts of the enactment that SCALE WITH INFLUENCE — the same
   * declarations the server pays by (`influenceScaling.ts`), so every surface
   * computes the viewer's number from the one formula. Absent = nothing scales.
   */
  scaled?: ReadonlyArray<InfluenceScaledEffect>;
  /**
   * THE LEVY as data (`resolutionLevy.ts`) — the fixed sum every participant
   * loses FIRST (the Budgets). The same declaration the shared levy step
   * takes by; absent = nothing is taken.
   */
  levy?: ResolutionLevy;
  /**
   * The WINNER's tile as data (`winnerReward.ts`) — the same declaration the
   * winner's step places. Absent = no winner part, or one not declared as data.
   */
  winnerReward?: WinnerRewardDeclaration;
  /**
   * A TILE GRANTED BY THRESHOLD as data (`tileGrant.ts`) — Skyscrapers: one
   * city tile for the winner and for every seat at or above the influence
   * line, placed as a tier on the seat's own city. The same declaration the
   * step decides by. Absent = no such part.
   */
  tileGrant?: TileGrantDeclaration;
  /**
   * The WORLD's part as data (`parameterMove.ts`) — the global parameters the
   * enactment moves for the whole table, and whether anybody is credited for
   * them. The same declaration `worldSteps` pays by.
   */
  worldMoves?: ReadonlyArray<WorldParameterMove>;
  hasImmediate: boolean;
  hasWorldEffect: boolean;
  hasWinnerEffect: boolean;
  hasPassive: boolean;
  hasAction: boolean;
};

/** The printed PARTY EFFECT (the board's six banners), same pipeline. */
export type IClientPartyEffect = {
  party: ReduxParty;
  /** The passive effect's graphic (empty rows for an action-only party). */
  passiveRenderData: ICardRenderRoot;
  /** The action's graphic, when the party has one. */
  actionRenderData?: ICardRenderRoot;
  text: {
    /** English i18n key — the party's full rule. */
    rule: string;
    passive?: string;
    action?: string;
    /** The ONE short reading under the ruling party's graphic (the government block). */
    summary?: string;
  };
  actionId?: PartyActionId;
  usesPerGeneration?: number;
  /**
   * The passive's reactions as DATA (`partyReactions.ts`) — what the party
   * answers, and by how much, so a surface can state the answer BEFORE the
   * change that triggers it (a resolution's personal forecast). Absent for a
   * party whose passive nothing forecasts yet.
   */
  reactions?: ReadonlyArray<PartyReaction>;
};

/** The printed generation-1 quest of the empty ENACTED slot (rulebook p.9). */
export type IClientStarterQuest = {
  quest: QuestDefinition;
  /** English i18n key. */
  text: string;
  questRenderData: ICardRenderRoot;
};

export type ParliamentCatalog = {
  parties: Array<IClientPartyEffect>;
  resolutions: Array<IClientResolution>;
  /** Optional for a catalog generated before the quest graphics existed. */
  starterQuest?: IClientStarterQuest;
};
