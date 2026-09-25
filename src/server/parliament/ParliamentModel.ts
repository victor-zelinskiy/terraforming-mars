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
  ParliamentModel, ParliamentPhaseModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel, ParliamentRenewalEventModel, ParliamentSlotModel,
  PartyAccessModel, PartyActionModel, ResolutionActionModel, VoteOptionModel, VoteProjectionModel, ParliamentEnactedModel, ParliamentEnactOutcomeModel,
} from '../../common/models/ParliamentModel';
import {PartyName} from '../../common/turmoil/PartyName';
import {PARTY_EFFECT_DELEGATES, REDUX_PARTIES, ReduxParty, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {Delegate, Parliament, PARTY_ACTION_USES_PER_GENERATION, Slot} from './Parliament';
import {PARTY_EFFECTS} from './parties/PartyEffects';
import {parliamentGateAwaiting} from './ParliamentPhase';
import {SerializedEnactOutcome, SerializedPhaseSummary} from './SerializedParliament';
import {Resource} from '../../common/Resource';
import {declaredCountIds, declaredLevyResources, declaredSequelProductions, declaresColonyBonuses, declaresHandLevel, resolutionCount} from './resolutions/ResolutionCounts';

function colorOf(game: IGame, delegate: Delegate): Color | 'neutral' {
  return delegate === 'NEUTRAL' ? 'neutral' : game.getPlayerById(delegate).color;
}

/**
 * The effect's recorded outcomes, players named by colour (the wire never
 * carries a PlayerId). A WORLD record has no seat at all (`part: 'world'` —
 * the planet moved for everybody) and travels with none.
 */
function outcomeModels(game: IGame, outcomes: ReadonlyArray<SerializedEnactOutcome> | undefined): Array<ParliamentEnactOutcomeModel> | undefined {
  if (outcomes === undefined || outcomes.length === 0) {
    return undefined;
  }
  return outcomes.map((o) => {
    const {player, ...rest} = o;
    return player === undefined ? {...rest} : {...rest, player: game.getPlayerById(player).color};
  });
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

  const players: Array<ParliamentPlayerModel> = game.playersInGenerationOrder.map((player) => playerModel(game, parliament, player));

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
      // The sitting SO FAR, in the one shape the finished phase leaves behind.
      phase.summary = summaryModel(game, parliament, p.summary);
    }
    if (p.step === 'assembly' || p.step === 'adjourn') {
      phase.awaiting = parliamentGateAwaiting(game, p.step);
    }
    if (p.effects?.pending !== undefined) {
      const asked = game.getPlayerById(p.effects.pending.player);
      phase.pending = {player: asked.color, key: p.effects.pending.key};
      const input = asked.getWaitingFor()?.type;
      if (input !== undefined) {
        phase.pending.input = input;
      }
    } else if (p.step === 'effects' && p.effects?.scan !== undefined) {
      // A STEP'S DEFERRED TAIL IS ASKING (the 0 °C ocean of the winner's temperature step — Mohole Contest;
      // Europa's ocean under the winner's colony; the floaters of Titan's bonus): the step itself MUTATED
      // (no `pending`), the engine's own follow-up now waits for the seat the step ran for — the reaction
      // window (`scan`) names that seat and that step. Published under the same `pending`, so every other
      // seat reads the honest wait («blue is placing») and the seat itself reads a step of the sitting, never
      // an ask from nowhere. A gate prompt is never a tail (the step would not be `effects`); a stale menu of
      // the harness has no place here either — only a prompt that is not the phase's own gate counts.
      const asked = game.getPlayerById(p.effects.scan.player);
      const wf = asked.getWaitingFor();
      if (wf !== undefined && wf.parliamentPhasePrompt === undefined) {
        phase.pending = {player: asked.color, key: p.effects.scan.key, input: wf.type};
      }
    }
    const outcomes = outcomeModels(game, p.summary?.outcomes);
    if (outcomes !== undefined) {
      phase.outcomes = outcomes;
    }
    model.phase = phase;
  }
  if (parliament.lastPhase !== undefined) {
    model.lastPhase = summaryModel(game, parliament, parliament.lastPhase);
  }
  if (parliament.phaseHistory.length > 0) {
    model.phaseHistory = parliament.phaseHistory.map((summary) => summaryModel(game, parliament, summary));
  }
  if (parliament.lastAdvance !== undefined) {
    const advance = parliament.lastAdvance;
    model.lastAdvance = {
      seq: advance.seq,
      player: game.getPlayerById(advance.player).color,
      from: advance.from,
      to: advance.to,
      bonus: advance.bonus,
      reason: advance.reason,
      generation: advance.generation,
    };
  }
  if (viewer !== undefined) {
    model.viewer = {
      vote: voteModel(game, parliament, viewer),
      partyActions: partyActionModels(parliament, viewer),
    };
    const resolutionAction = resolutionActionModel(parliament, viewer);
    if (resolutionAction !== undefined) {
      model.viewer.resolutionAction = resolutionAction;
    }
  }
  return model;
}

function playerModel(game: IGame, parliament: Parliament, player: IPlayer): ParliamentPlayerModel {
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
  const model: ParliamentPlayerModel = {
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
  // The counted terms of the catalog's effects, read from the seat's tableau
  // by the ONE shared predicate — every surface computes the seat's number
  // from these (never from a tag count of its own).
  const countIds = participates ? declaredCountIds(parliament.catalog) : [];
  if (countIds.length > 0) {
    model.counts = countIds.map((id) => resolutionCount(player, id));
  }
  // …and the PRODUCTIONS a sequential effect divides (Climate Research's heat
  // production): the same reading the payout will stand on.
  const productions = participates ? declaredSequelProductions(parliament.catalog) : [];
  if (productions.length > 0) {
    const reads: Partial<Record<Resource, number>> = {};
    for (const resource of productions) {
      reads[resource] = player.production.get(resource);
    }
    model.production = reads;
  }
  // …and the SUPPLY a LEVY takes from (the Budgets' M€): the same number the
  // levy step will read, so the panel's shortfall warning and the payout agree.
  const levied = participates ? declaredLevyResources(parliament.catalog) : [];
  if (levied.length > 0) {
    const reads: Partial<Record<Resource, number>> = {};
    for (const resource of levied) {
      reads[resource] = player.stock.get(resource);
    }
    model.stock = reads;
  }
  // …and the COLONY LEDGER a resolution paying «all your colony bonuses»
  // multiplies (Colonial Affairs): the tiles the seat has a cube on, in the
  // table's order, each with its PRINTED colony bonus as a grant — the
  // server's rule of what a colony bonus is, so the client never derives the
  // list from the colonies model.
  if (participates && declaresColonyBonuses(parliament.catalog)) {
    model.colonyBonuses = game.colonies
      .filter((colony) => colony.colonies.includes(player.id))
      .map((colony) => ({colony: colony.name, grant: colony.colonyBonusGrant(), description: colony.metadata.colony.description}));
  }
  // …and the HAND a LEVEL part tops up (Joint Research's «until you have 6 +
  // influence in hand»): the same count the step will read — cards withheld in
  // a pending intake are not in the hand, exactly as the step sees it.
  if (participates && declaresHandLevel(parliament.catalog)) {
    model.hand = player.cardsInHand.length;
  }
  return model;
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

/**
 * How many actions of the Parliament the player could take right now — the
 * party actions and the enacted resolution's action alike (the action menu's
 * own verdict, turn-independent): the wheel's count of actions reads this.
 */
export function availablePartyActionCount(player: IPlayer): number {
  const parliament = player.game?.parliament;
  if (parliament === undefined) {
    return 0;
  }
  const parties = partyActionModels(parliament, player).filter((action) => action.available).length;
  return parties + (resolutionActionModel(parliament, player)?.available === true ? 1 : 0);
}

/**
 * THE ENACTED RESOLUTION'S ACTION for the viewer (Turmoil Redux — Open IP
 * Trade): the party action model's twin. Undefined while no enacted law has
 * an action; otherwise the same verdict ladder as a party's — access (the
 * seat participates), the uses left, the action's own gate with its reason.
 */
function resolutionActionModel(parliament: Parliament, viewer: IPlayer): ResolutionActionModel | undefined {
  const enacted = parliament.enactedDefinition();
  const action = enacted?.action;
  if (enacted === undefined || action === undefined) {
    return undefined;
  }
  const hasAccess = parliament.participates(viewer);
  const usesLeft = parliament.resolutionActionUsesLeft(viewer);
  let available = hasAccess && usesLeft > 0;
  let reason: ResolutionActionModel['reason'] = '';
  if (!hasAccess) {
    reason = 'MarsBot takes no part in the parliament';
  } else if (usesLeft <= 0) {
    reason = 'This resolution action was already used this generation';
  } else {
    const verdict = action.canAct(viewer);
    if (verdict.available === false) {
      available = false;
      reason = verdict.reason;
    }
  }
  return {
    resolution: enacted.id,
    party: enacted.party,
    hasAccess,
    usesLeft,
    usesPerGeneration: action.usesPerGeneration(viewer),
    available,
    reason,
    preview: action.preview(viewer),
  };
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
    ...(summary.seq === undefined ? {} : {seq: summary.seq}),
    ...(summary.correlationId === undefined ? {} : {correlationId: summary.correlationId}),
    winner: {
      instance: summary.winner.instance,
      resolution: winnerDefinition.id,
      party: winnerDefinition.party,
      votes: summary.winner.votes,
      player: summary.winner.player === undefined ? undefined : colorOf(game, summary.winner.player),
      tieBreak: summary.winner.tieBreak,
      ...(summary.winner.slot === undefined ? {} : {slot: summary.winner.slot}),
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
  if (summary.discarded !== undefined) {
    model.discarded = summary.discarded.map((instance) => {
      const definition = parliament.resolutionOf(instance);
      return {instance, resolution: definition.id, party: definition.party};
    });
  }
  const outcomes = outcomeModels(game, summary.outcomes);
  if (outcomes !== undefined) {
    model.outcomes = outcomes;
  }
  if (summary.discardedEnacted !== undefined) {
    model.discardedEnacted = enactedModel(parliament, summary.discardedEnacted);
  }
  if (summary.returned !== undefined) {
    model.returned = summary.returned.map((entry) => ({owner: colorOf(game, entry.owner), count: entry.count}));
  }
  if (summary.renewal !== undefined) {
    model.renewal = summary.renewal.map((event): ParliamentRenewalEventModel => {
      switch (event.kind) {
      case 'leave': {
        const definition = parliament.resolutionOf(event.instance);
        return {
          kind: 'leave', instance: event.instance, resolution: definition.id, party: definition.party, slot: event.slot,
          returned: event.returned.map((entry) => ({owner: colorOf(game, entry.owner), count: entry.count})),
        };
      }
      case 'reject': {
        const definition = parliament.resolutionOf(event.instance);
        return {kind: 'reject', instance: event.instance, resolution: definition.id, party: definition.party, slot: event.slot, reason: event.reason};
      }
      case 'deal': {
        const definition = parliament.resolutionOf(event.instance);
        return {kind: 'deal', instance: event.instance, resolution: definition.id, party: definition.party, slot: event.slot, source: event.source};
      }
      case 'support':
        return {kind: 'support', party: event.party as ReduxParty, instance: event.instance, count: event.count};
      case 'lobby':
        return {kind: 'lobby', player: game.getPlayerById(event.player).color};
      case 'reshuffle':
        return {kind: 'reshuffle', size: event.size};
      case 'empty':
        return {kind: 'empty', slot: event.slot};
      }
    });
  }
  return model;
}
