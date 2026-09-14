/*
 * THE PARLIAMENT WORKSPACE'S PURE MODEL (Turmoil Redux).
 *
 * Two things, both DOM-free and unit-testable:
 *  · the VIEW — what the screen shows, joined from `GameModel.parliament`
 *    (live state + the viewer's projections) and the static client catalog
 *    (`genfiles/parliament.json`);
 *  · the PROMPT BRIDGE — where, inside the action menu the server sent, the
 *    vote and the party actions stand (found by their STRUCTURAL markers,
 *    never by title), and the byte-identical responses the workspace submits.
 * Availability is never re-derived here: a tile is available iff its option
 * is PRESENT in the server's menu (`ParliamentModel.viewer` carries the
 * honest reason when it is not).
 */
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerInputModel, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {
  ParliamentModel, ParliamentPlayerModel, PartyAccessModel, PartyActionModel, VoteProjectionModel,
} from '@/common/models/ParliamentModel';
import {IClientPartyEffect, IClientResolution} from '@/common/parliament/IClientResolution';
import {
  AGENDA_TRACK, AgendaStep, influenceAtAgenda, PARTY_ACTION_OWNER, PartyActionId, QuestDefinition, ReduxParty, REDUX_PARTIES, ResolutionId,
  ResolutionInstanceId,
} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';

export type ParliamentSlotVm = {
  instance: ResolutionInstanceId;
  resolutionId: ResolutionId;
  resolution: IClientResolution | undefined;
  party: ReduxParty;
  votes: ReadonlyArray<{owner: Color | 'neutral', seq: number}>;
  totalVotes: number;
  leader: Color | 'neutral' | undefined;
  isWinning: boolean;
  /** 1 = closest to ENACTED (wins ties). */
  tiePriority: number;
  viewerVotes: number;
  projection: VoteProjectionModel | undefined;
};

export type ParliamentPartyVm = {
  party: ReduxParty;
  effect: IClientPartyEffect | undefined;
  /** The effect's one-sentence rule (English i18n key) — what holding the party gives. */
  rule: string | undefined;
  support: number;
  /** The party has a resolution in the voting area (its support becomes votes when a card of it appears). */
  inArea: boolean;
  ruling: boolean;
  /** The VIEWER's access to this party's effect (undefined for a spectator). */
  access: PartyAccessModel | undefined;
  actionId: PartyActionId | undefined;
  action: PartyActionModel | undefined;
};

export type ParliamentTileVm = {
  id: 'vote' | PartyActionId;
  party: ReduxParty | undefined;
  /** English i18n key. */
  label: string;
  available: boolean;
  reason: string | Message;
  usesLeft: number | undefined;
  usesPerGeneration: number | undefined;
  preview: ReadonlyArray<ActionEffect>;
  /** The vote's delegate source and cost. */
  source: 'lobby' | 'reserve' | 'none' | undefined;
  cost: number | undefined;
};

export type ParliamentAgendaStepVm = {
  index: number;
  step: AgendaStep;
  /** Players whose marker stands on this step. */
  cubes: ReadonlyArray<Color>;
};

export type ParliamentQuestVm = {
  definition: QuestDefinition;
  /** English i18n key of the printed quest text. */
  text: string;
  source: 'starter' | ResolutionId;
  generation: number;
  progress: ReadonlyArray<{color: Color, value: number, participates: boolean}>;
  completedBy: Color | undefined;
};

export type ParliamentViewVm = {
  slots: ReadonlyArray<ParliamentSlotVm>;
  enacted: {instance: ResolutionInstanceId, resolutionId: ResolutionId, resolution: IClientResolution | undefined, party: ReduxParty} | undefined;
  rulingParty: ReduxParty;
  rulingEffect: IClientPartyEffect | undefined;
  quest: ParliamentQuestVm | undefined;
  chairman: Color | undefined;
  parties: ReadonlyArray<ParliamentPartyVm>;
  agenda: ReadonlyArray<ParliamentAgendaStepVm>;
  /** Players whose Agenda marker still stands at the start (position 0). */
  agendaStart: ReadonlyArray<Color>;
  players: ReadonlyArray<ParliamentPlayerModel & {name: string, influence: number}>;
  viewer: (ParliamentPlayerModel & {name: string}) | undefined;
  tiles: ReadonlyArray<ParliamentTileVm>;
  deckSize: number;
  discardSize: number;
  neutralSupply: number;
  botMode: ParliamentModel['botMode'];
};

/** The printed generation-1 quest of the empty ENACTED slot (English key). */
export const STARTER_QUEST_TEXT = 'Raise your heat production 3 steps';

export function questTextOf(source: 'starter' | ResolutionId): string {
  if (source === 'starter') {
    return STARTER_QUEST_TEXT;
  }
  return getResolution(source)?.text.quest ?? source;
}

/** The English key for a party's action tile. */
export function partyActionLabel(id: PartyActionId): string {
  switch (id) {
  case 'unity-trade': return 'Free trade';
  case 'scientists-lab': return 'Add 2 data or microbes';
  case 'industrialists-shift': return 'Shift production';
  case 'reds-recycle': return 'Draw 2, discard 2';
  }
}

export function buildParliamentView(model: ParliamentModel, viewer: Color | undefined, players: ReadonlyArray<PublicPlayerModel>): ParliamentViewVm {
  const nameOf = (color: Color): string => players.find((p) => p.color === color)?.name ?? color;
  const viewerModel = viewer === undefined ? undefined : model.players.find((p) => p.color === viewer);
  const viewerAccess = new Map<ReduxParty, PartyAccessModel>();
  for (const access of viewerModel?.access ?? []) {
    viewerAccess.set(access.party, access);
  }
  const actionsById = new Map<PartyActionId, PartyActionModel>();
  for (const action of model.viewer?.partyActions ?? []) {
    actionsById.set(action.id, action);
  }
  const projections = new Map<ResolutionInstanceId, VoteProjectionModel>();
  for (const projection of model.viewer?.vote.projections ?? []) {
    projections.set(projection.instance, projection);
  }
  const partiesInArea = new Set<ReduxParty>(model.slots.map((slot) => slot.party));

  const slots: Array<ParliamentSlotVm> = model.slots.map((slot) => ({
    instance: slot.instance,
    resolutionId: slot.resolution,
    resolution: getResolution(slot.resolution),
    party: slot.party,
    votes: slot.votes,
    totalVotes: slot.totalVotes,
    leader: slot.leader,
    isWinning: slot.isWinning,
    tiePriority: slot.tiePriority,
    viewerVotes: slot.viewerVotes,
    projection: projections.get(slot.instance),
  }));

  const parties: Array<ParliamentPartyVm> = REDUX_PARTIES.map((party) => {
    const actionId = (Object.keys(PARTY_ACTION_OWNER) as Array<PartyActionId>).find((id) => PARTY_ACTION_OWNER[id] === party);
    const effect = getPartyEffect(party);
    return {
      party,
      effect,
      rule: effect?.text.rule,
      support: model.popularSupport[party] ?? 0,
      inArea: partiesInArea.has(party),
      ruling: model.rulingParty === party,
      access: viewerAccess.get(party),
      actionId,
      action: actionId === undefined ? undefined : actionsById.get(actionId),
    };
  });

  const agenda: Array<ParliamentAgendaStepVm> = AGENDA_TRACK.map((step, i) => ({
    index: i + 1,
    step,
    cubes: model.players.filter((p) => p.participates && p.agenda === i + 1).map((p) => p.color),
  }));
  const agendaStart = model.players.filter((p) => p.participates && p.agenda === 0).map((p) => p.color);

  const tiles: Array<ParliamentTileVm> = [];
  const vote = model.viewer?.vote;
  if (vote !== undefined) {
    tiles.push({
      id: 'vote', party: undefined, label: 'Vote',
      available: vote.available, reason: vote.reason,
      usesLeft: undefined, usesPerGeneration: undefined, preview: [],
      source: vote.source, cost: vote.cost,
    });
  }
  for (const action of model.viewer?.partyActions ?? []) {
    tiles.push({
      id: action.id, party: action.party, label: partyActionLabel(action.id),
      available: action.available, reason: action.reason,
      usesLeft: action.usesLeft, usesPerGeneration: action.usesPerGeneration, preview: action.preview,
      source: undefined, cost: undefined,
    });
  }

  const questModel = model.quest;
  const quest: ParliamentQuestVm | undefined = questModel === undefined ? undefined : {
    definition: questModel.definition,
    text: questTextOf(questModel.source),
    source: questModel.source,
    generation: questModel.generation,
    progress: model.players.map((p) => ({color: p.color, value: questModel.progress[p.color] ?? 0, participates: p.participates})),
    completedBy: questModel.completedBy,
  };

  const enacted = model.enacted === undefined ? undefined : {
    instance: model.enacted.instance,
    resolutionId: model.enacted.resolution,
    resolution: getResolution(model.enacted.resolution),
    party: model.enacted.party,
  };

  return {
    slots,
    enacted,
    rulingParty: model.rulingParty,
    rulingEffect: getPartyEffect(model.rulingParty),
    quest,
    chairman: model.chairman,
    parties,
    agenda,
    agendaStart,
    players: model.players.map((p) => ({...p, name: nameOf(p.color), influence: p.influence})),
    viewer: viewerModel === undefined ? undefined : {...viewerModel, name: nameOf(viewerModel.color)},
    tiles,
    deckSize: model.deckSize,
    discardSize: model.discardSize,
    neutralSupply: model.neutralSupply,
    botMode: model.botMode,
  };
}

/** The base influence a marker at `position` grants (the label under the Agenda track). */
export function agendaInfluence(position: number): number {
  return influenceAtAgenda(position);
}

// ── THE PROMPT BRIDGE ─────────────────────────────────────────────────────────

export type ParliamentPromptBridge = {
  /** The vote (a `SelectParty` carrying `votePrompt`) — index in the action menu. */
  vote: {menuIndex: number, model: SelectPartyModel} | undefined;
  /** The party actions, by id — each the nested prompt carrying `partyActionPrompt`. */
  actions: Partial<Record<PartyActionId, {menuIndex: number, model: PlayerInputModel}>>;
  /** A stand-alone `SelectParty` for the chairman seat (`votePrompt.source === 'chairman-seat'`). */
  seat: SelectPartyModel | undefined;
};

export function parliamentPromptBridge(wf: PlayerInputModel | undefined): ParliamentPromptBridge {
  const bridge: ParliamentPromptBridge = {vote: undefined, actions: {}, seat: undefined};
  if (wf === undefined) {
    return bridge;
  }
  if (wf.type === 'party' && wf.votePrompt?.source === 'chairman-seat') {
    bridge.seat = wf;
    return bridge;
  }
  if (wf.type !== 'or') {
    return bridge;
  }
  wf.options.forEach((option, index) => {
    if (option.type === 'party' && option.votePrompt !== undefined && option.votePrompt.source !== 'chairman-seat') {
      bridge.vote = {menuIndex: index, model: option};
    }
    const marker = option.partyActionPrompt;
    if (marker !== undefined) {
      bridge.actions[marker.actionId] = {menuIndex: index, model: option};
    }
  });
  return bridge;
}

export function voteResponse(bridge: ParliamentPromptBridge, party: PartyName): InputResponse | undefined {
  if (bridge.vote === undefined || !bridge.vote.model.parties.includes(party)) {
    return undefined;
  }
  return {type: 'or', index: bridge.vote.menuIndex, response: {type: 'party', partyName: party}};
}

export function seatResponse(bridge: ParliamentPromptBridge, party: PartyName): InputResponse | undefined {
  if (bridge.seat === undefined || !bridge.seat.parties.includes(party)) {
    return undefined;
  }
  return {type: 'party', partyName: party};
}

/** The Industrialists' shift: the `and` of two `or` picks (decrease, increase), byte-identical to the live prompt. */
export function industrialistsResponse(bridge: ParliamentPromptBridge, decreaseIndex: number, increaseIndex: number): InputResponse | undefined {
  const entry = bridge.actions['industrialists-shift'];
  if (entry === undefined || entry.model.type !== 'and') {
    return undefined;
  }
  return {type: 'or', index: entry.menuIndex, response: {type: 'and', responses: [
    {type: 'or', index: decreaseIndex, response: {type: 'option'}},
    {type: 'or', index: increaseIndex, response: {type: 'option'}},
  ]}};
}

/** The Scientists' gift: the resource branch + the target card, one submit. */
export function scientistsResponse(bridge: ParliamentPromptBridge, branchIndex: number, card: CardName): InputResponse | undefined {
  const entry = bridge.actions['scientists-lab'];
  if (entry === undefined || entry.model.type !== 'or') {
    return undefined;
  }
  return {type: 'or', index: entry.menuIndex, response: {type: 'or', index: branchIndex, response: {type: 'card', cards: [card]}}};
}

/** The Reds' recycle: the CONFIRM (the draw is the commit; the discard follows as its own prompt). */
export function redsResponse(bridge: ParliamentPromptBridge): InputResponse | undefined {
  const entry = bridge.actions['reds-recycle'];
  if (entry === undefined) {
    return undefined;
  }
  return {type: 'or', index: entry.menuIndex, response: {type: 'option'}};
}

/** Chip reading of a vote projection — the consequences the vote stage lists (English keys). */
export function voteConsequences(projection: VoteProjectionModel | undefined, slot: ParliamentSlotVm, viewer: Color | undefined): Array<{key: string, tone: 'gain' | 'note' | 'warn'}> {
  const out: Array<{key: string, tone: 'gain' | 'note' | 'warn'}> = [];
  if (projection === undefined) {
    return out;
  }
  if (projection.becomesWinning && !slot.isWinning) {
    out.push({key: 'This resolution would become the winning one', tone: 'gain'});
  } else if (projection.becomesWinning) {
    out.push({key: 'This resolution stays the winning one', tone: 'note'});
  } else {
    out.push({key: 'This resolution would still not win', tone: 'warn'});
  }
  if (projection.viewerLeads && slot.leader !== viewer) {
    out.push({key: projection.tieNote === 'earlier-delegate' ? 'You would lead it — your first delegate came earlier' : 'You would lead this resolution', tone: 'gain'});
  } else if (projection.viewerLeads) {
    out.push({key: 'You keep the lead on this resolution', tone: 'note'});
  }
  if (projection.unlocksEffect) {
    out.push({key: 'Unlocks the party effect for you (2 delegates)', tone: 'gain'});
  }
  if (projection.unlocksRequirement) {
    out.push({key: 'Satisfies this party\'s card requirement for you', tone: 'gain'});
  }
  return out;
}
