import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, PartyAccessModel, PartyActionModel, VoteOptionModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {
  accessReasonRows, agendaViewOf, buildParliamentView, offeredPartyActions, ParliamentPartyVm, ParliamentSlotVm, parliamentPromptBridge,
  partyActionStateOf, partyFormulaRender, partyStateOf, voteAccessOf, voteForecastOf, voteForecastRows, voteVerbOf,
} from '@/client/console/parliament/consoleParliamentModel';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/**
 * THE PARLIAMENT WORKSPACE'S READINGS (Turmoil Redux, the UI rework): a
 * party's one-line state and its access reasons, the vote forecast, the
 * Agenda reading — pure derivations over the server's own model, guarded
 * here so the workspace, the Information strip and the inspector can never
 * disagree about the same fact.
 */

function access(over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party: PartyName.GREENS, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function party(over: Partial<ParliamentPartyVm> = {}): ParliamentPartyVm {
  return {
    party: PartyName.GREENS, effect: getPartyEffect(PartyName.GREENS), rule: 'r', support: 0, inArea: false, ruling: false,
    access: undefined, actionId: undefined, action: undefined, ...over,
  };
}

function action(over: Partial<PartyActionModel> = {}): PartyActionModel {
  return {id: 'reds-recycle', party: PartyName.REDS, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: true, reason: '', preview: [], ...over};
}

describe('consoleParliamentModel — the party state', () => {
  it('the Greens rule BY THE STARTING RULE while nothing is enacted; a ruling party otherwise', () => {
    expect(partyStateOf(party({ruling: true, access: access({ruling: true, hasEffect: true})}), true).kind).to.eq('ruling-default');
    expect(partyStateOf(party({ruling: true, access: access({ruling: true, hasEffect: true})}), false).kind).to.eq('ruling');
    expect(partyStateOf(party({party: PartyName.REDS, ruling: true}), true).kind).to.eq('ruling');
  });

  it('ranks the bases the rules rank: ruling › two delegates › a grant › progress › in the vote › absent', () => {
    expect(partyStateOf(party({inArea: true, access: access({delegates: 2, byDelegates: true, hasEffect: true})}), true).kind).to.eq('delegates');
    expect(partyStateOf(party({access: access({granted: ['Card'], hasEffect: true})}), true).kind).to.eq('granted');
    const progress = partyStateOf(party({inArea: true, access: access({delegates: 1})}), true);
    expect(progress.kind).to.eq('progress');
    expect(progress.params).to.deep.eq(['1']);
    expect(partyStateOf(party({inArea: true}), true).kind).to.eq('in-area');
    expect(partyStateOf(party(), true).kind).to.eq('absent');
  });

  it('the action state reads the server verdict; the turn only ever turns «available» into «not now»', () => {
    const p = party({party: PartyName.REDS, actionId: 'reds-recycle', action: action()});
    expect(partyActionStateOf(p, true).kind).to.eq('available');
    expect(partyActionStateOf(p, false).kind).to.eq('not-now');
    expect(partyActionStateOf(party({party: PartyName.REDS, actionId: 'reds-recycle', action: action({usesLeft: 0})}), false).kind).to.eq('used');
    expect(partyActionStateOf(party({party: PartyName.REDS, actionId: 'reds-recycle', action: action({available: false, reason: 'No card'})}), true).kind).to.eq('blocked');
    expect(partyActionStateOf(party({party: PartyName.REDS, actionId: 'reds-recycle', action: action({hasAccess: false, available: false})}), true).kind).to.eq('no-access');
    expect(partyActionStateOf(party(), true).kind).to.eq('none');
  });
});

describe('consoleParliamentModel — access reasons by the CURRENT state', () => {
  it('names the starting rule for the Greens in the first generation, and the enacted resolution otherwise', () => {
    const start = accessReasonRows(access({ruling: true, hasEffect: true, satisfiesRequirement: true}), {party: PartyName.GREENS, enactedEmpty: true, enactedName: undefined, inArea: false});
    expect(start[0].key).to.contain('starting rule');
    const enacted = accessReasonRows(access({party: PartyName.REDS, ruling: true, hasEffect: true, satisfiesRequirement: true}), {party: PartyName.REDS, enactedEmpty: false, enactedName: 'Reds Motion I', inArea: false});
    expect(enacted[0].key).to.contain('${0} is enacted');
    expect(enacted[0].params).to.deep.eq(['Reds Motion I']);
  });

  it('lists EVERY live basis (no double effect — one row each) and the requirement footnote', () => {
    const rows = accessReasonRows(access({ruling: true, byDelegates: true, delegates: 2, granted: ['Septem Tribus'], hasEffect: true, satisfiesRequirement: true}),
      {party: PartyName.GREENS, enactedEmpty: false, enactedName: 'Greens Motion I', inArea: true});
    expect(rows.filter((r) => r.tone === 'holds').length).to.eq(3);
    expect(rows[rows.length - 1].key).to.eq('Card requirement of this party: met');
  });

  it('a grant holds the effect but NOT the card requirement', () => {
    const rows = accessReasonRows(access({granted: ['Council Seat'], hasEffect: true, satisfiesRequirement: false}), {party: PartyName.GREENS, enactedEmpty: false, enactedName: 'X', inArea: false});
    expect(rows.map((r) => r.tone)).to.deep.eq(['holds', 'note']);
    expect(rows[1].key).to.contain('does not count');
  });

  it('says what WOULD grant it: one more delegate, two delegates, or nothing while the party is out of the vote', () => {
    expect(accessReasonRows(access({delegates: 1}), {party: PartyName.GREENS, enactedEmpty: false, enactedName: 'X', inArea: true})[0].key).to.contain('one more delegate');
    expect(accessReasonRows(access(), {party: PartyName.GREENS, enactedEmpty: false, enactedName: 'X', inArea: true})[0].key).to.contain('two of your delegates');
    expect(accessReasonRows(access(), {party: PartyName.GREENS, enactedEmpty: false, enactedName: 'X', inArea: false})[0].key).to.contain('no resolution in the vote');
  });
});

describe('consoleParliamentModel — the vote forecast', () => {
  const me = 'blue' as Color;
  const vote: VoteOptionModel = {available: true, reason: '', source: 'reserve', cost: 5, projections: []};
  const slot = (over: Partial<Parameters<typeof voteForecastOf>[0]> = {}): Parameters<typeof voteForecastOf>[0] => ({
    instance: 'RDX_REDS_1#0', resolutionId: 'RDX_REDS_1', resolution: undefined, party: PartyName.REDS,
    votes: [{owner: 'red' as Color, seq: 1}], totalVotes: 1, leader: 'red' as Color, leaderVotes: 1, isWinning: false, tiePriority: 2, viewerVotes: 0,
    projection: {instance: 'RDX_REDS_1#0', votesAfter: 2, leaderAfter: 'red' as Color, viewerLeads: false, becomesWinning: true, unlocksEffect: false, unlocksRequirement: false, tieNote: 'slot-priority'},
    ...over,
  });

  it('reads the server projection: source, cost, before → after, lead and win changes', () => {
    const f = voteForecastOf(slot(), me, vote);
    expect(f).to.not.eq(undefined);
    expect(f?.source).to.eq('reserve');
    expect(f?.cost).to.eq(5);
    expect(f?.votesBefore).to.eq(1);
    expect(f?.votesAfter).to.eq(2);
    expect(f?.leadChange).to.eq('none');
    expect(f?.winChange).to.eq('become');
    const rows = voteForecastRows(f);
    expect(rows[0].tone).to.eq('gain');
    expect(rows[0].key).to.contain('tie');
    expect(rows.some((r) => r.key.includes('Another player still leads'))).to.eq(true);
  });

  it('a free lobby delegate costs nothing; taking the lead with the earlier delegate is named', () => {
    const f = voteForecastOf(slot({projection: {instance: 'RDX_REDS_1#0', votesAfter: 2, leaderAfter: me, viewerLeads: true, becomesWinning: false, unlocksEffect: true, unlocksRequirement: true, tieNote: 'earlier-delegate'}}),
      me, {...vote, source: 'lobby', cost: 0});
    expect(f?.cost).to.eq(0);
    expect(f?.leadChange).to.eq('take');
    expect(f?.winChange).to.eq('none');
    const keys = voteForecastRows(f).map((r) => r.key);
    expect(keys[0]).to.eq('Still not the winning resolution');
    expect(keys[1]).to.contain('first delegate came earlier');
    expect(keys).to.include('Unlocks the party effect for you (2 delegates)');
  });

  it('is undefined for a spectator / without a projection', () => {
    expect(voteForecastOf(slot(), undefined, vote)).to.eq(undefined);
    expect(voteForecastOf(slot({projection: undefined}), me, vote)).to.eq(undefined);
    expect(voteForecastRows(undefined)).to.deep.eq([]);
  });

  it('the one-line rail states the SAME facts in its compact vocabulary (same order, same tones)', () => {
    for (const projection of [
      slot().projection,
      {instance: 'RDX_REDS_1#0', votesAfter: 2, leaderAfter: me, viewerLeads: true, becomesWinning: false, unlocksEffect: true, unlocksRequirement: true, tieNote: 'earlier-delegate' as const},
    ]) {
      const f = voteForecastOf(slot({projection}), me, vote);
      const full = voteForecastRows(f);
      const compact = voteForecastRows(f, true);
      expect(compact.map((r) => r.tone)).to.deep.eq(full.map((r) => r.tone));
      expect(compact.every((r, i) => r.key !== full[i].key && r.key.length < full[i].key.length)).to.eq(true);
    }
    const tie = voteForecastRows(voteForecastOf(slot(), me, vote), true).map((r) => r.key);
    expect(tie).to.deep.eq(['wins on the tie', 'another player leads']);
  });
});

describe('consoleParliamentModel — the viewer\'s access beside the vote', () => {
  const slotWith = (viewerVotes: number): ParliamentSlotVm => ({
    instance: 'RDX_REDS_1#0', resolutionId: 'RDX_REDS_1', resolution: undefined, party: PartyName.REDS,
    votes: [], totalVotes: viewerVotes, leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1, viewerVotes, projection: undefined,
  });

  it('counts the viewer\'s own delegates toward the threshold: 1 of 2 → 2 of 2 unlocks', () => {
    const a = voteAccessOf(slotWith(1), party({party: PartyName.REDS, inArea: true, access: access({party: PartyName.REDS, delegates: 1})}), 2);
    expect(a).to.deep.include({threshold: 2, before: 1, after: 2, heldByOther: false, reason: undefined});
    const b = voteAccessOf(slotWith(0), party({party: PartyName.REDS, inArea: true, access: access({party: PartyName.REDS})}), 1);
    expect(b.before).to.eq(0);
    expect(b.after).to.eq(1);
  });

  it('an effect held through the RULING party or a CARD GRANT is already the viewer\'s — the delegate changes nothing about it', () => {
    const ruling = voteAccessOf(slotWith(0), party({party: PartyName.REDS, ruling: true, access: access({party: PartyName.REDS, ruling: true, hasEffect: true})}), 1);
    expect(ruling.heldByOther).to.eq(true);
    expect(ruling.reason).to.contain('the party rules');
    const granted = voteAccessOf(slotWith(0), party({party: PartyName.REDS, access: access({party: PartyName.REDS, granted: ['Septem Tribus'], hasEffect: true})}), 1);
    expect(granted.heldByOther).to.eq(true);
    expect(granted.reason).to.contain('granted by a card');
    // …but an effect held BY DELEGATES is exactly what the vote is about.
    const byDelegates = voteAccessOf(slotWith(2), party({party: PartyName.REDS, inArea: true, access: access({party: PartyName.REDS, delegates: 2, byDelegates: true, hasEffect: true})}), 3);
    expect(byDelegates.heldByOther).to.eq(false);
    expect(byDelegates.before).to.eq(2);
  });

  it('never counts backwards: the after side is at least the before side', () => {
    const a = voteAccessOf(slotWith(2), party({party: PartyName.REDS, inArea: true}), 1);
    expect(a.after).to.eq(2);
    expect(voteAccessOf(undefined, undefined, undefined)).to.deep.include({before: 0, after: 1, heldByOther: false});
  });

  it('reads «before» from the vote mode\'s snapshot once the answer is in — the live model has already moved on', () => {
    // The live slot already counts the landed delegate (1); the snapshot taken at the submit says 0.
    expect(voteAccessOf(slotWith(1), party({party: PartyName.REDS, inArea: true}), 1, 0)).to.deep.include({before: 0, after: 1});
    // Without a snapshot the live count is the before side.
    expect(voteAccessOf(slotWith(1), party({party: PartyName.REDS, inArea: true}), 2).before).to.eq(1);
  });
});

describe('consoleParliamentModel — the Agenda reading and the view', () => {
  function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
    return {
      slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 9, discardSize: 0, neutralSupply: 14, botMode: 'none',
      players: [{
        color: 'blue' as Color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda: 3, influence: 2,
        access: [], partyActionUses: {}, resolutionActionUses: 0,
      }],
      viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []}, partyActions: []},
      ...over,
    };
  }

  it('reads the viewer\'s position as a LEVEL and names the next step\'s reward', () => {
    const view = buildParliamentView(model(), 'blue' as Color, [{color: 'blue' as Color, name: 'Blue'} as never]);
    const agenda = agendaViewOf(view);
    expect(agenda.viewerPosition).to.eq(3);
    expect(agenda.viewerLevel).to.eq(2);
    expect(agenda.viewerInfluence).to.eq(2);
    expect(agenda.nextStep).to.deep.eq({kind: 'tr'});
    expect(agenda.steps.find((s) => s.index === 3)?.viewerHere).to.eq(true);
    expect(agenda.steps.find((s) => s.index === 4)?.viewerNext).to.eq(true);
    expect(agenda.steps.find((s) => s.index === 1)?.level).to.eq(1);
  });

  it('at the end of the track there is no next step', () => {
    const m = model();
    const view = buildParliamentView({...m, players: [{...m.players[0], agenda: 12}]}, 'blue' as Color, []);
    expect(agendaViewOf(view).nextStep).to.eq(undefined);
  });

  it('the starter quest carries its graphic from the catalog', () => {
    const view = buildParliamentView(model({quest: {definition: {goal: {kind: 'production', resource: 'heat' as never}, count: 3}, source: 'starter', generation: 1, progress: {}}}), 'blue' as Color, []);
    expect(view.quest?.text).to.eq('Raise your heat production 3 steps');
    expect(view.quest?.renderData?.rows.length).to.be.greaterThan(0);
  });

  it('a party\'s formula is ONE root — the passive rows followed by the action rows', () => {
    const scientists = getPartyEffect(PartyName.SCIENTISTS);
    expect(scientists).to.not.eq(undefined);
    if (scientists === undefined) {
      return;
    }
    const merged = partyFormulaRender(scientists);
    expect(merged.rows.length).to.eq(scientists.passiveRenderData.rows.length + (scientists.actionRenderData?.rows.length ?? 0));
    // An action-only party's ACTION rows are in `actionRenderData` (the action menu's tile draws exactly those).
    expect(getPartyEffect(PartyName.REDS)?.actionRenderData?.rows.length).to.be.greaterThan(0);
    expect(getPartyEffect(PartyName.INDUSTRIALISTS)?.actionRenderData?.rows.length).to.be.greaterThan(0);
    expect(getPartyEffect(PartyName.UNITY)?.actionRenderData?.rows.length).to.be.greaterThan(0);
  });

  it('the bridge lists the party actions the menu OFFERS right now', () => {
    const wf = {
      type: 'or', title: 'Take action', buttonLabel: '', options: [
        {type: 'option', title: 'x', buttonLabel: '', partyActionPrompt: {party: PartyName.REDS, actionId: 'reds-recycle', stage: 'confirm', usesLeft: 1, usesPerGeneration: 1}},
        {type: 'party', title: 'Vote', buttonLabel: '', parties: [PartyName.REDS], votePrompt: {source: 'lobby', cost: 0}},
      ],
    } as unknown as PlayerInputModel;
    const bridge = parliamentPromptBridge(wf);
    expect([...offeredPartyActions(bridge)]).to.deep.eq(['reds-recycle']);
    expect(bridge.vote?.menuIndex).to.eq(1);
    expect(offeredPartyActions(parliamentPromptBridge(undefined)).size).to.eq(0);
    const reds: ReduxParty = PartyName.REDS;
    expect(reds).to.eq('Reds');
  });
});

describe('consoleParliamentModel — «send the delegate» from the fullscreen inspector', () => {
  const base: Parameters<typeof voteVerbOf>[0] = {
    participates: true,
    tile: {available: true, source: 'lobby', cost: 0},
    refusalText: '',
    offered: true,
    canActNow: true,
    offeredParties: [PartyName.REDS, PartyName.GREENS],
    party: PartyName.REDS,
    turnText: 'TURN',
    notOfferedText: 'NOT OFFERED',
  };

  it('a legal vote: available, from the source the server names, at the server\'s price (free from the lobby)', () => {
    expect(voteVerbOf(base)).to.deep.eq({available: true, gate: undefined, source: 'lobby', cost: 0, reason: undefined});
  });

  it('a reserve delegate carries the server\'s cost — never a hardcoded price', () => {
    expect(voteVerbOf({...base, tile: {available: true, source: 'reserve', cost: 7}})).to.deep.include({available: true, source: 'reserve', cost: 7});
    expect(voteVerbOf({...base, tile: {available: true, source: 'lobby', cost: 7}})?.cost, 'the lobby is free whatever the tile says').to.eq(0);
  });

  it('a RULE refusal (no delegates, not enough M€) outranks the turn and speaks the server\'s own reason', () => {
    const refused = voteVerbOf({...base, canActNow: false, offered: false, tile: {available: false, source: 'none', cost: 0}, refusalText: 'No delegates left'});
    expect(refused).to.deep.eq({available: false, gate: 'rule', source: 'none', cost: 0, reason: 'No delegates left'});
  });

  it('off-turn (or the option not in the live menu) is the calm TURN gate, keeping the source and price readable', () => {
    expect(voteVerbOf({...base, canActNow: false, tile: {available: true, source: 'reserve', cost: 5}})).to.deep.eq({available: false, gate: 'turn', source: 'reserve', cost: 5, reason: 'TURN'});
    expect(voteVerbOf({...base, offered: false})).to.deep.include({available: false, gate: 'turn'});
  });

  it('a card the live prompt no longer offers is refused by name, never sent', () => {
    expect(voteVerbOf({...base, offeredParties: [PartyName.GREENS]})).to.deep.include({available: false, gate: 'rule', reason: 'NOT OFFERED'});
  });

  it('no verb at all for a seat outside the parliament or without a vote option', () => {
    expect(voteVerbOf({...base, participates: false})).to.eq(undefined);
    expect(voteVerbOf({...base, tile: undefined})).to.eq(undefined);
  });
});
