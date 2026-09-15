/*
 * THE PARLIAMENT WORKSPACE'S PURE MODEL (Turmoil Redux).
 *
 * Three things, all DOM-free and unit-testable:
 *  · the VIEW — what the screen shows, joined from `GameModel.parliament`
 *    (live state + the viewer's projections) and the static client catalog
 *    (`genfiles/parliament.json`): the voting slots, the government (enacted
 *    resolution · ruling party · chairman quest · chairman), the six parties
 *    with their ACCESS state, the Agenda track and the viewer's delegates;
 *  · the READINGS the surfaces derive from it — a party's one-line state and
 *    its access reasons (shared by the workspace's party detail, the
 *    Information strip and the fullscreen inspector, so the three can never
 *    disagree), the VOTE FORECAST (what one more delegate changes, from the
 *    server's own projection — never a client rule), the Agenda reading (the
 *    viewer's level, the next reward);
 *  · the PROMPT BRIDGE — where, inside the action menu the server sent, the
 *    vote and the party actions stand (found by their STRUCTURAL markers,
 *    never by title), and the byte-identical responses the surfaces submit.
 * Availability is never re-derived here: a vote or a party action is
 * available iff its option is PRESENT in the server's menu
 * (`ParliamentModel.viewer` carries the honest reason when it is not).
 */
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerInputModel, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {
  ParliamentModel, ParliamentPlayerModel, PartyAccessModel, PartyActionModel, VoteOptionModel, VoteProjectionModel,
} from '@/common/models/ParliamentModel';
import {IClientPartyEffect, IClientResolution} from '@/common/parliament/IClientResolution';
import {
  AGENDA_TRACK, AgendaStep, influenceAtAgenda, PARTY_ACTION_OWNER, PARTY_EFFECT_DELEGATES, PartyActionId, QuestDefinition,
  ReduxParty, REDUX_PARTIES, ResolutionId, ResolutionInstanceId,
} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution, getStarterQuest} from '@/client/parliament/ClientParliamentManifest';

export type ParliamentSlotVm = {
  instance: ResolutionInstanceId;
  resolutionId: ResolutionId;
  resolution: IClientResolution | undefined;
  party: ReduxParty;
  votes: ReadonlyArray<{owner: Color | 'neutral', seq: number}>;
  totalVotes: number;
  leader: Color | 'neutral' | undefined;
  /** The leader's own delegates on this card (0 without a leader). */
  leaderVotes: number;
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
  /** The goal as a graphic (the ONE drawing the face, the workspace and the inspector share). */
  renderData: ICardRenderRoot | undefined;
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
    return getStarterQuest()?.text ?? STARTER_QUEST_TEXT;
  }
  return getResolution(source)?.text.quest ?? source;
}

/** The quest's graphic from the catalog (undefined for a catalog generated before the graphics existed). */
export function questRenderDataOf(source: 'starter' | ResolutionId): ICardRenderRoot | undefined {
  if (source === 'starter') {
    return getStarterQuest()?.questRenderData;
  }
  return getResolution(source)?.questRenderData;
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

/**
 * The party's WHOLE printed formula as one render root — the passive rows
 * and the action rows (the face, the compact formula block and the action
 * menu's tile all draw from these same nodes; nothing composes a second one).
 */
export function partyFormulaRender(effect: IClientPartyEffect): ICardRenderRoot {
  if (effect.actionRenderData === undefined) {
    return effect.passiveRenderData;
  }
  return {
    ...effect.passiveRenderData,
    rows: [...effect.passiveRenderData.rows, ...effect.actionRenderData.rows],
  };
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
    leaderVotes: slot.leader === undefined ? 0 : slot.votes.filter((vote) => vote.owner === slot.leader).length,
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
    renderData: questRenderDataOf(questModel.source),
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

// ── PARTY STATE — one reading for the tile, the detail and the inspector ────

export type PartyStateKind =
  /** The Greens rule while nothing is enacted (rulebook p.8) — the FIRST generation's starting rule. */
  | 'ruling-default'
  /** The party's resolution is enacted — every player holds its effect. */
  | 'ruling'
  /** The viewer holds the effect through two own delegates on the party's resolution. */
  | 'delegates'
  /** The viewer holds the effect through a card grant. */
  | 'granted'
  /** The party is in the vote and the viewer has one delegate there (one more grants the effect). */
  | 'progress'
  /** The party is in the vote; the viewer has no delegate on it. */
  | 'in-area'
  /** The party has no resolution in the voting area. */
  | 'absent';

export type PartyStateVm = {
  kind: PartyStateKind;
  /** English i18n key (`${0}` = the viewer's delegates on the card, where the key has one). */
  label: string;
  params: ReadonlyArray<string>;
  tone: 'gold' | 'mint' | 'cyan' | 'dim';
  /** The viewer holds the effect for any reason. */
  held: boolean;
  /** The viewer's own delegates on the party's resolution. */
  delegates: number;
};

/**
 * WHY a party stands where it stands for the viewer — the browse tile's one
 * line. The reasons are checked in the order the RULES rank them: ruling
 * outranks delegates outranks a grant; a party outside the vote can only be
 * ruling or absent.
 */
export function partyStateOf(p: ParliamentPartyVm, enactedEmpty: boolean): PartyStateVm {
  const access = p.access;
  const delegates = access?.delegates ?? 0;
  if (p.ruling) {
    const byDefault = enactedEmpty && p.party === PartyName.GREENS;
    return {
      kind: byDefault ? 'ruling-default' : 'ruling',
      label: byDefault ? 'Rules by the starting rule' : 'Ruling',
      params: [],
      tone: 'gold',
      held: access?.hasEffect ?? true,
      delegates,
    };
  }
  if (access?.byDelegates) {
    return {kind: 'delegates', label: 'Your effect · 2 delegates', params: [], tone: 'mint', held: true, delegates};
  }
  if (access !== undefined && access.granted.length > 0) {
    return {kind: 'granted', label: 'Your effect · granted by a card', params: [], tone: 'mint', held: true, delegates};
  }
  if (p.inArea) {
    if (delegates > 0) {
      return {kind: 'progress', label: '${0} of 2 delegates', params: [String(delegates)], tone: 'cyan', held: false, delegates};
    }
    return {kind: 'in-area', label: 'In the vote', params: [], tone: 'cyan', held: false, delegates};
  }
  return {kind: 'absent', label: 'Not in the vote', params: [], tone: 'dim', held: false, delegates};
}

export type PartyActionStateKind = 'none' | 'available' | 'not-now' | 'used' | 'blocked' | 'no-access';

export type PartyActionStateVm = {
  kind: PartyActionStateKind;
  /** English i18n key of the state's short label. */
  label: string;
  /** The server's own reason (blocked / no access), when there is one. */
  reason: string | Message | undefined;
  usesLeft: number;
  usesPerGeneration: number;
};

/**
 * The party ACTION's state for the viewer — read off the server's own model
 * (`PartyActionModel`: access, uses, availability + reason). `canActNow` is
 * the EXECUTION GATE (the viewer's own action window) and only ever turns an
 * available action into «not now» — it never masks a real reason.
 */
export function partyActionStateOf(p: ParliamentPartyVm, canActNow: boolean): PartyActionStateVm {
  const action = p.action;
  if (p.actionId === undefined || action === undefined) {
    return {kind: 'none', label: '', reason: undefined, usesLeft: 0, usesPerGeneration: 0};
  }
  const base = {usesLeft: action.usesLeft, usesPerGeneration: action.usesPerGeneration};
  if (!action.hasAccess) {
    return {kind: 'no-access', label: 'No access', reason: action.reason, ...base};
  }
  if (action.usesLeft <= 0) {
    return {kind: 'used', label: 'Already used', reason: undefined, ...base};
  }
  if (!action.available) {
    return {kind: 'blocked', label: 'Unavailable', reason: action.reason, ...base};
  }
  if (!canActNow) {
    return {kind: 'not-now', label: 'Not now', reason: undefined, ...base};
  }
  return {kind: 'available', label: 'Available', reason: undefined, ...base};
}

export type AccessReasonRow = {
  /** English i18n key (`${0}` = a name, where the key has one). */
  key: string;
  params: ReadonlyArray<string>;
  /** `holds` — a reason the viewer HAS the effect; `lacks` — why not (and what would grant it); `note` — the requirement footnote. */
  tone: 'holds' | 'lacks' | 'note';
};

/**
 * WHY the viewer holds (or does not hold) a party's effect — by the CURRENT
 * game state, never a general rule. Every live basis is listed (a ruling party
 * whose resolution the viewer also has two delegates on lists both — the
 * effect still applies once), and the footnote tells the card REQUIREMENT
 * apart from the effect (a card grant satisfies the effect, never the
 * requirement — rulebook FAQ p.19).
 */
export function accessReasonRows(
  access: PartyAccessModel | undefined,
  ctx: {party: ReduxParty, enactedEmpty: boolean, enactedName: string | undefined, inArea: boolean},
): Array<AccessReasonRow> {
  if (access === undefined) {
    return [];
  }
  const out: Array<AccessReasonRow> = [];
  if (access.ruling) {
    if (ctx.enactedEmpty && ctx.party === PartyName.GREENS) {
      out.push({key: 'You have it: the Greens rule by the starting rule while no resolution is enacted', params: [], tone: 'holds'});
    } else if (ctx.enactedName !== undefined) {
      out.push({key: 'You have it: the party rules — ${0} is enacted', params: [ctx.enactedName], tone: 'holds'});
    } else {
      out.push({key: 'You have it: the party rules', params: [], tone: 'holds'});
    }
  }
  if (access.byDelegates) {
    out.push({key: 'You have it: two of your delegates are on its resolution', params: [], tone: 'holds'});
  }
  for (const source of access.granted) {
    out.push({key: 'You have it: granted by ${0}', params: [source], tone: 'holds'});
  }
  if (out.length === 0) {
    if (access.delegates > 0) {
      out.push({key: 'You do not have it yet — one more delegate on its resolution would grant it', params: [], tone: 'lacks'});
    } else if (ctx.inArea) {
      out.push({key: 'You do not have it — two of your delegates on its resolution would grant it', params: [], tone: 'lacks'});
    } else {
      out.push({key: 'You do not have it — the party has no resolution in the vote', params: [], tone: 'lacks'});
    }
  }
  if (access.satisfiesRequirement) {
    out.push({key: 'Card requirement of this party: met', params: [], tone: 'note'});
  } else if (access.hasEffect) {
    out.push({key: 'Card requirement of this party: not met — a granted effect does not count', params: [], tone: 'note'});
  }
  return out;
}

// ── THE VOTE FORECAST — what ONE more delegate of the viewer changes ─────────

export type VoteForecastVm = {
  source: 'lobby' | 'reserve' | 'none';
  cost: number;
  votesBefore: number;
  votesAfter: number;
  viewerVotesBefore: number;
  viewerVotesAfter: number;
  leaderBefore: Color | 'neutral' | undefined;
  leaderAfter: Color | 'neutral' | undefined;
  /** `take` — the viewer becomes the leader; `keep` — stays; `none` — somebody else keeps it. */
  leadChange: 'take' | 'keep' | 'none';
  winningBefore: boolean;
  winningAfter: boolean;
  /** `become` — the card becomes the winning one; `stay` — stays; `none` — still not winning. */
  winChange: 'become' | 'stay' | 'none';
  tieNote: 'earlier-delegate' | 'slot-priority' | undefined;
  unlocksEffect: boolean;
  unlocksRequirement: boolean;
};

/**
 * The forecast of the viewer's next delegate on `slot`, from the server's own
 * projection (a pure re-run of the leader / winner rules on a copy — the
 * client derives no rule). Undefined for a spectator or without a projection.
 * A forecast describes the CURRENT distribution: it never promises the
 * generation's outcome (other players still vote).
 */
export function voteForecastOf(slot: ParliamentSlotVm, viewer: Color | undefined, vote: VoteOptionModel | undefined): VoteForecastVm | undefined {
  const projection = slot.projection;
  if (projection === undefined || viewer === undefined || vote === undefined) {
    return undefined;
  }
  const leaderAfter = projection.leaderAfter;
  const leadChange: VoteForecastVm['leadChange'] = projection.viewerLeads ? (slot.leader === viewer ? 'keep' : 'take') : 'none';
  const winChange: VoteForecastVm['winChange'] = projection.becomesWinning ? (slot.isWinning ? 'stay' : 'become') : 'none';
  return {
    source: vote.source,
    cost: vote.source === 'reserve' ? vote.cost : 0,
    votesBefore: slot.totalVotes,
    votesAfter: projection.votesAfter,
    viewerVotesBefore: slot.viewerVotes,
    viewerVotesAfter: slot.viewerVotes + 1,
    leaderBefore: slot.leader,
    leaderAfter,
    leadChange,
    winningBefore: slot.isWinning,
    winningAfter: projection.becomesWinning,
    winChange,
    tieNote: projection.tieNote,
    unlocksEffect: projection.unlocksEffect,
    unlocksRequirement: projection.unlocksRequirement,
  };
}

export type VoteAccessVm = {
  threshold: number;
  /** The viewer's own delegates on the card now. */
  before: number;
  /** …and after this vote. */
  after: number;
  /** The effect is ALREADY the viewer's for another reason (the party rules / a card grant) — a delegate changes nothing about it. */
  heldByOther: boolean;
  /** English i18n key naming that other reason (undefined when none). */
  reason: string | undefined;
};

/**
 * THE VIEWER'S ACCESS to the card's party effect, before and after ONE more
 * own delegate — the fact the vote mode states beside the vote, apart from
 * «if enacted, everyone gets it». Held through the ruling party or a card
 * grant, the effect is the viewer's already and the delegate adds nothing to
 * it (the card REQUIREMENT still counts delegates — the inspector's note).
 */
export function voteAccessOf(slot: ParliamentSlotVm | undefined, party: ParliamentPartyVm | undefined, afterMine: number | undefined, beforeMine?: number): VoteAccessVm {
  const threshold = PARTY_EFFECT_DELEGATES;
  // `beforeMine` is the count the vote mode SHOWS as «before» (a snapshot taken
  // at the submit — the live model has already moved on once the answer is in).
  const before = beforeMine ?? slot?.viewerVotes ?? 0;
  const after = Math.max(before, afterMine ?? before + 1);
  const access = party?.access;
  if (access !== undefined && access.hasEffect && !access.byDelegates) {
    return {
      threshold, before, after, heldByOther: true,
      reason: access.ruling ? 'already yours: the party rules' : 'already yours: granted by a card',
    };
  }
  return {threshold, before, after, heldByOther: false, reason: undefined};
}

/**
 * Chip reading of a forecast — the consequence rows the vote stage lists
 * (English keys). `compact` is the ONE-LINE focus rail's vocabulary: the same
 * facts in short phrases (the full sentences live in the vote stage), so the
 * rail never cuts a consequence in half on a narrow profile.
 */
export function voteForecastRows(forecast: VoteForecastVm | undefined, compact = false): Array<{key: string, tone: 'gain' | 'note' | 'warn'}> {
  const out: Array<{key: string, tone: 'gain' | 'note' | 'warn'}> = [];
  if (forecast === undefined) {
    return out;
  }
  switch (forecast.winChange) {
  case 'become':
    if (forecast.tieNote === 'slot-priority') {
      out.push({key: compact ? 'wins on the tie' : 'Becomes the winning resolution — the tie goes to the slot closer to Enacted', tone: 'gain'});
    } else {
      out.push({key: compact ? 'becomes the winner' : 'Becomes the winning resolution', tone: 'gain'});
    }
    break;
  case 'stay':
    out.push({key: compact ? 'stays the winner' : 'Stays the winning resolution', tone: 'note'});
    break;
  default:
    out.push({key: compact ? 'not winning' : 'Still not the winning resolution', tone: 'warn'});
  }
  switch (forecast.leadChange) {
  case 'take':
    if (forecast.tieNote === 'earlier-delegate') {
      out.push({key: compact ? 'you lead: earlier delegate' : 'You take the lead — your first delegate came earlier', tone: 'gain'});
    } else {
      out.push({key: compact ? 'you take the lead' : 'You take the lead on this resolution', tone: 'gain'});
    }
    break;
  case 'keep':
    out.push({key: compact ? 'you keep the lead' : 'You keep the lead on this resolution', tone: 'note'});
    break;
  default:
    if (forecast.leaderAfter !== undefined && forecast.leaderAfter !== 'neutral') {
      out.push({key: compact ? 'another player leads' : 'Another player still leads this resolution', tone: 'warn'});
    }
  }
  if (forecast.unlocksEffect) {
    out.push({key: compact ? 'party effect: yours' : 'Unlocks the party effect for you (2 delegates)', tone: 'gain'});
  }
  if (forecast.unlocksRequirement) {
    out.push({key: compact ? 'party requirement: met' : 'Satisfies this party\'s card requirement for you', tone: 'gain'});
  }
  return out;
}

// ── THE AGENDA READING ─────────────────────────────────────────────────────

export type AgendaVm = {
  steps: ReadonlyArray<ParliamentAgendaStepVm & {
    /** The influence LEVEL this step sets (influence steps only). */
    level: number | undefined;
    viewerHere: boolean;
    /** The step the viewer's NEXT advance lands on. */
    viewerNext: boolean;
  }>;
  start: ReadonlyArray<Color>;
  viewerPosition: number;
  /** The viewer's TOTAL influence (track level + card bonuses) — the server's number. */
  viewerInfluence: number;
  /** The track's own level at the viewer's position (what the Agenda alone grants). */
  viewerLevel: number;
  /** The reward of the viewer's next advance (undefined at the end of the track). */
  nextStep: AgendaStep | undefined;
};

export function agendaViewOf(view: ParliamentViewVm): AgendaVm {
  const viewer = view.viewer;
  const position = viewer?.agenda ?? 0;
  const next = position < AGENDA_TRACK.length ? position + 1 : undefined;
  return {
    steps: view.agenda.map((entry) => ({
      ...entry,
      level: entry.step.kind === 'influence' ? entry.step.influence : undefined,
      viewerHere: viewer !== undefined && viewer.participates && entry.index === position,
      viewerNext: viewer !== undefined && viewer.participates && entry.index === next,
    })),
    start: view.agendaStart,
    viewerPosition: position,
    viewerInfluence: viewer?.influence ?? 0,
    viewerLevel: influenceAtAgenda(position),
    nextStep: next === undefined ? undefined : AGENDA_TRACK[next - 1],
  };
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

/** The party actions the server offers RIGHT NOW (present in the live action menu). */
export function offeredPartyActions(bridge: ParliamentPromptBridge): ReadonlySet<PartyActionId> {
  return new Set((Object.keys(bridge.actions) as Array<PartyActionId>).filter((id) => bridge.actions[id] !== undefined));
}

/** The party whose effect is asked about in the inspector: two delegates is the threshold the rulebook prints. */
export const PARTY_EFFECT_THRESHOLD = PARTY_EFFECT_DELEGATES;
