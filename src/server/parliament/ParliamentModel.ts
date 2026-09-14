/*
 * SERVER → CLIENT projection of the Mars Parliament. Pure: reads the
 * parliament and the game, mutates nothing (guarded by tests). The viewer's
 * own projections (vote availability and per-slot consequences, party-action
 * tiles) are attached only to the viewer's model.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Color} from '../../common/Color';
import {PlayerId} from '../../common/Types';
import {
  ParliamentModel, ParliamentPhaseModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel, ParliamentSlotModel, PartyAccessModel,
  PartyActionModel, VoteOptionModel, VoteProjectionModel, ParliamentEnactedModel,
} from '../../common/models/ParliamentModel';
import {PartyName} from '../../common/turmoil/PartyName';
import {PARTY_EFFECT_DELEGATES, REDUX_PARTIES, ReduxParty, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {Delegate, Parliament, PARTY_ACTION_USES_PER_GENERATION, Slot} from './Parliament';
import {PARTY_EFFECTS} from './parties/PartyEffects';
import {SerializedPhaseSummary} from './SerializedParliament';

function colorOf(game: IGame, delegate: Delegate): Color | 'neutral' {
  return delegate === 'NEUTRAL' ? 'neutral' : game.getPlayerById(delegate).color;
}

function enactedModel(parliament: Parliament, instance: ResolutionInstanceId): ParliamentEnactedModel {
  const definition = parliament.resolutionOf(instance);
  return {instance, resolution: definition.id, party: definition.party};
}

export function getParliamentModel(game: IGame, viewer?: IPlayer): ParliamentModel | undefined {
  const parliament = game.parliament;
  if (parliament === undefined) {
    return undefined;
  }
  const winner = parliament.winner();
  const slots: Array<ParliamentSlotModel> = parliament.slots.map((slot, index) => {
    const definition = parliament.resolutionOf(slot.instance);
    const leader = parliament.leaderOf(slot);
    const model: ParliamentSlotModel = {
      instance: slot.instance,
      resolution: definition.id,
      party: definition.party,
      votes: slot.votes.map((vote) => ({owner: colorOf(game, vote.owner), seq: vote.seq})),
      totalVotes: slot.votes.length,
      isWinning: winner?.instance === slot.instance,
      tiePriority: index + 1,
      viewerVotes: viewer === undefined ? 0 : parliament.votesOf(viewer, slot),
    };
    if (leader !== undefined) {
      model.leader = colorOf(game, leader.owner);
    }
    return model;
  });

  const popularSupport: Record<string, number> = {};
  for (const party of REDUX_PARTIES) {
    popularSupport[party] = parliament.popularSupportOf(party);
  }

  const players: Array<ParliamentPlayerModel> = game.playersInGenerationOrder.map((player) => playerModel(parliament, player));

  const model: ParliamentModel = {
    slots,
    rulingParty: parliament.rulingParty(),
    popularSupport,
    players,
    deckSize: parliament.deck.length,
    discardSize: parliament.discard.length,
    neutralSupply: parliament.neutralSupply(),
    botMode: parliament.botMode,
  };
  if (parliament.enacted !== undefined) {
    model.enacted = enactedModel(parliament, parliament.enacted);
  }
  if (parliament.chairman !== undefined) {
    model.chairman = game.getPlayerById(parliament.chairman).color;
  }
  const quest = parliament.quest;
  if (quest !== undefined) {
    const progress: Record<string, number> = {};
    for (const [id, value] of quest.progress) {
      progress[game.getPlayerById(id).color] = value;
    }
    model.quest = {
      definition: quest.definition,
      source: quest.source,
      generation: quest.generation,
      progress,
      completedBy: quest.completedBy === undefined ? undefined : game.getPlayerById(quest.completedBy).color,
    };
  }
  if (parliament.phase !== undefined) {
    const p = parliament.phase;
    const phase: ParliamentPhaseModel = {generation: p.generation, final: p.final, step: p.step};
    if (p.summary !== undefined) {
      phase.winner = {instance: p.summary.winner.instance, player: p.summary.winner.player === undefined ? undefined : colorOf(game, p.summary.winner.player)};
    }
    if (p.effects?.pending !== undefined) {
      phase.pending = {player: game.getPlayerById(p.effects.pending.player).color, key: p.effects.pending.key};
    }
    model.phase = phase;
  }
  if (parliament.lastPhase !== undefined) {
    model.lastPhase = summaryModel(game, parliament, parliament.lastPhase);
  }
  if (viewer !== undefined) {
    model.viewer = {
      vote: voteModel(game, parliament, viewer),
      partyActions: partyActionModels(parliament, viewer),
    };
  }
  return model;
}

function playerModel(parliament: Parliament, player: IPlayer): ParliamentPlayerModel {
  const participates = parliament.participates(player);
  const access: Array<PartyAccessModel> = REDUX_PARTIES.map((party) => {
    const a = parliament.access(player, party);
    return {
      party,
      ruling: a.ruling,
      delegates: a.delegates,
      byDelegates: a.byDelegates,
      granted: a.granted,
      hasEffect: a.hasEffect,
      satisfiesRequirement: a.satisfiesRequirement,
    };
  });
  const partyActionUses: Partial<Record<PartyName, number>> = {};
  for (const party of REDUX_PARTIES) {
    const uses = parliament.partyActionUsesOf(player, party);
    if (uses > 0) {
      partyActionUses[party] = uses;
    }
  }
  return {
    color: player.color,
    participates,
    lobby: parliament.lobby.has(player.id),
    reserve: parliament.reserve(player),
    onResolutions: parliament.votesOf(player),
    chairman: parliament.chairman === player.id,
    agenda: parliament.agendaOf(player),
    influence: parliament.influence(player),
    access,
    partyActionUses,
    resolutionActionUses: parliament.resolutionActionUsesOf(player),
  };
}

/** What ONE more delegate of the viewer would do on each slot — a pure re-run of the leader / winner rules on a copy. */
function voteModel(game: IGame, parliament: Parliament, viewer: IPlayer): VoteOptionModel {
  const availability = parliament.canVote(viewer);
  const projections: Array<VoteProjectionModel> = parliament.slots.map((slot) => projectVote(game, parliament, viewer, slot));
  if (availability.ok) {
    return {available: true, reason: '', source: availability.source, cost: availability.cost, projections};
  }
  return {available: false, reason: availability.reason, source: availability.source, cost: availability.cost, projections};
}

function projectVote(game: IGame, parliament: Parliament, viewer: IPlayer, slot: Slot): VoteProjectionModel {
  // A throwaway parliament over copied slots: the rules run on the copy, the
  // live state is untouched.
  const copy = new Parliament(parliament.botMode, parliament.catalog);
  copy.slots = parliament.slots.map((s) => ({instance: s.instance, votes: s.votes.map((vote) => ({...vote}))}));
  copy.enacted = parliament.enacted;
  copy.voteSeq = parliament.voteSeq;
  const target = copy.slotByInstance(slot.instance);
  if (target === undefined) {
    throw new Error('slot vanished');
  }
  target.votes.push({owner: viewer.id, seq: ++copy.voteSeq});
  const leader = copy.leaderOf(target);
  const winner = copy.winner();
  const before = parliament.access(viewer, parliament.resolutionOf(slot.instance).party);
  const afterVotes = parliament.votesOf(viewer, slot) + 1;
  const projection: VoteProjectionModel = {
    instance: slot.instance,
    votesAfter: target.votes.length,
    viewerLeads: leader?.owner === viewer.id,
    becomesWinning: winner?.instance === slot.instance,
    unlocksEffect: !before.hasEffect && afterVotes >= PARTY_EFFECT_DELEGATES,
    unlocksRequirement: !before.satisfiesRequirement && afterVotes >= PARTY_EFFECT_DELEGATES,
  };
  if (leader !== undefined) {
    projection.leaderAfter = colorOf(game, leader.owner);
    if (leader.tieBreak !== undefined && leader.owner === viewer.id) {
      projection.tieNote = leader.tieBreak;
    }
  }
  if (winner?.instance === slot.instance && winner.tieBreak === 'slot-priority') {
    projection.tieNote = projection.tieNote ?? 'slot-priority';
  }
  return projection;
}

/** How many party actions the player could take right now (the action menu's own verdict, turn-independent). */
export function availablePartyActionCount(player: IPlayer): number {
  const parliament = player.game?.parliament;
  if (parliament === undefined) {
    return 0;
  }
  return partyActionModels(parliament, player).filter((action) => action.available).length;
}

function partyActionModels(parliament: Parliament, viewer: IPlayer): Array<PartyActionModel> {
  const models: Array<PartyActionModel> = [];
  for (const party of REDUX_PARTIES) {
    const definition = PARTY_EFFECTS[party];
    if (definition.actionId === undefined) {
      continue;
    }
    const hasAccess = parliament.hasPartyEffect(viewer, party);
    const usesLeft = parliament.partyActionUsesLeft(viewer, party);
    let available = hasAccess && usesLeft > 0;
    let reason: PartyActionModel['reason'] = '';
    if (!hasAccess) {
      reason = 'You do not have this party\'s effect';
    } else if (usesLeft <= 0) {
      reason = 'This party action was already used this generation';
    } else {
      const verdict = definition.canAct?.(viewer);
      if (verdict !== undefined && verdict.available === false) {
        available = false;
        reason = verdict.reason;
      }
    }
    models.push({
      id: definition.actionId,
      party,
      hasAccess,
      usesLeft,
      usesPerGeneration: PARTY_ACTION_USES_PER_GENERATION,
      available,
      reason,
      preview: definition.preview?.(viewer) ?? [],
    });
  }
  return models;
}

function summaryModel(game: IGame, parliament: Parliament, summary: SerializedPhaseSummary): ParliamentPhaseSummaryModel {
  const winnerDefinition = parliament.resolutionOf(summary.winner.instance);
  const model: ParliamentPhaseSummaryModel = {
    generation: summary.generation,
    final: summary.final,
    winner: {
      instance: summary.winner.instance,
      resolution: winnerDefinition.id,
      party: winnerDefinition.party,
      votes: summary.winner.votes,
      player: summary.winner.player === undefined ? undefined : colorOf(game, summary.winner.player),
      tieBreak: summary.winner.tieBreak,
    },
    support: summary.support.map((entry) => ({party: entry.party as ReduxParty, gained: entry.gained, total: entry.total, reason: entry.reason})),
    enacted: enactedModel(parliament, summary.enacted),
    refreshed: summary.refreshed.map((entry) => {
      const definition = parliament.resolutionOf(entry.instance);
      return {instance: entry.instance, resolution: definition.id, party: definition.party, neutralVotes: entry.neutralVotes};
    }),
    lobbyRefilled: summary.lobbyRefilled.map((id: PlayerId) => game.getPlayerById(id).color),
  };
  if (summary.agenda !== undefined) {
    model.agenda = {player: game.getPlayerById(summary.agenda.player).color, from: summary.agenda.from, to: summary.agenda.to, bonus: summary.agenda.bonus};
  }
  if (summary.discardedEnacted !== undefined) {
    model.discardedEnacted = enactedModel(parliament, summary.discardedEnacted);
  }
  return model;
}
