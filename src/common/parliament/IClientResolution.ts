import {Expansion, GameModule} from '../cards/GameModule';
import {ICardRenderRoot} from '../cards/render/Types';
import {PartyActionId, QuestDefinition, ReduxParty, ResolutionCode, ResolutionId} from './ParliamentTypes';
import {InfluenceScaledEffect} from './influenceScaling';
import {WinnerRewardDeclaration} from './winnerReward';

/**
 * The printed face of a resolution card, as shipped to the client through
 * `genfiles/parliament.json` (the global-event pipeline's twin — see
 * `src/server/tools/export_card_rendering.ts`). Static, never game state.
 */
export type IClientResolution = {
  id: ResolutionId;
  /** The printed catalog code (`RX##`) — the face's corner stamp, the art key, the search key. Absent on a dummy / dev example. */
  code?: ResolutionCode;
  module: GameModule;
  party: ReduxParty;
  copies: number;
  compatibility: Array<Expansion>;
  renderData: ICardRenderRoot;
  /** English i18n keys. */
  text: {
    name: string;
    /** The immediate effect every participant receives at the enactment; absent on a dummy. */
    effect?: string;
    /** The winner-only part of the enactment (the player who won the vote). */
    winner?: string;
    passive?: string;
    action?: string;
    quest: string;
  };
  quest: QuestDefinition;
  /**
   * The quest's GOAL as a graphic (the same render DSL the faces draw): the
   * card's quest corner, the workspace's quest block and the inspector all
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
   * The WINNER's tile as data (`winnerReward.ts`) — the same declaration the
   * winner's step places. Absent = no winner part, or one not declared as data.
   */
  winnerReward?: WinnerRewardDeclaration;
  /** A DUMMY carries a party, votes and a quest — and no effect of its own. */
  dummy: boolean;
  hasImmediate: boolean;
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
