import {Expansion, GameModule} from '../cards/GameModule';
import {ICardRenderRoot} from '../cards/render/Types';
import {PartyActionId, QuestDefinition, ReduxParty, ResolutionId} from './ParliamentTypes';

/**
 * The printed face of a resolution card, as shipped to the client through
 * `genfiles/parliament.json` (the global-event pipeline's twin — see
 * `src/server/tools/export_card_rendering.ts`). Static, never game state.
 */
export type IClientResolution = {
  id: ResolutionId;
  module: GameModule;
  party: ReduxParty;
  copies: number;
  compatibility: Array<Expansion>;
  renderData: ICardRenderRoot;
  /** English i18n keys. */
  text: {
    name: string;
    /** The immediate effect («When enacted: …»); absent on a dummy. */
    effect?: string;
    passive?: string;
    action?: string;
    quest: string;
  };
  quest: QuestDefinition;
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
  };
  actionId?: PartyActionId;
  usesPerGeneration?: number;
};

export type ParliamentCatalog = {
  parties: Array<IClientPartyEffect>;
  resolutions: Array<IClientResolution>;
};
