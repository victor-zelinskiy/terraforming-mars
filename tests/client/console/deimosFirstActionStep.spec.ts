import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {PlayerInputModel, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {firstActionPartyStep, followUpStepStage, partyStepStageOf, taskFor} from '@/client/console/consoleTaskRouter';
import {delegateGrantFollowUpRow} from '@/client/console/consolePlayCardComposer';
import {accessReasonRows} from '@/client/console/parliament/consoleParliamentModel';

/**
 * TR83 THE DEIMOS GROUP — the client half: the first action's DELEGATE GRANT is a party step of the START (the banner's
 * road, generalized — one predicate), the first action's briefing says the vote follows the CONFIRM (not a play), and
 * the party dossier names who LIFTS the card requirement (the seat's own field) instead of «not met».
 */
const R = PartyName.REDS;
const BLUE: Color = 'blue';
const CORP = CardName.THE_DEIMOS_GROUP;

function grantPrompt(): SelectPartyModel {
  return {
    type: 'party', title: 'Select where to add 1 delegate', buttonLabel: 'Add',
    parties: [...REDUX_PARTIES].slice(0, 3),
    votePrompt: {source: 'grant', count: 1, printed: 1},
    choiceContext: {source: {kind: 'card', card: CORP}, mode: 'reward'},
  } as unknown as SelectPartyModel;
}

function access(over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party: R, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

const CTX = {party: R as ReduxParty, enactedEmpty: true, enactedName: undefined, inArea: true};

describe('The Deimos Group (TR83) — the first action\'s party step and the lifted requirement', () => {
  it('the delegate grant is a FIRST-ACTION PARTY STEP, like the banner pick — keyed on the marker; a plain vote / chairman pick is not', () => {
    expect(firstActionPartyStep(grantPrompt())).eq(true);
    expect(firstActionPartyStep({type: 'party', bannerPrompt: {source: 'first-action', parties: []}} as unknown as PlayerInputModel)).eq(true);
    expect(firstActionPartyStep({type: 'party', votePrompt: {source: 'action'}} as unknown as PlayerInputModel), 'the generation\'s own vote').eq(false);
    expect(firstActionPartyStep({type: 'party'} as unknown as PlayerInputModel), 'the chairman\'s seat pick').eq(false);
    expect(firstActionPartyStep(undefined)).eq(false);
  });

  it('the stage is the Parliament\'s own word «ГОЛОСОВАНИЕ»; the prompt is a PARTY task (never unknown)', () => {
    expect(partyStepStageOf(grantPrompt())).eq('Voting');
    expect(followUpStepStage('party', grantPrompt())).eq('Voting');
    expect(taskFor({waitingFor: grantPrompt()} as unknown as PlayerViewModel)?.kind).eq('party');
  });

  it('the briefing\'s «next» row: the vote follows the CONFIRM of the first action, not a play', () => {
    expect(delegateGrantFollowUpRow({count: 1}, 'confirm')).deep.eq({key: '1 delegate to a resolution, after confirming — chosen in the Parliament'});
    expect(delegateGrantFollowUpRow({count: 2}, 'confirm')).deep.eq({key: '${0} delegates to one resolution, after confirming — chosen in the Parliament', params: ['2']});
    expect(delegateGrantFollowUpRow({count: 1}), 'a card\'s play keeps its words').deep.eq({key: '1 delegate to a resolution, after the play — chosen in the Parliament'});
  });

  it('the dossier: a STANDING waiver names the giver — «lifted», never «not met»; the effect row is untouched', () => {
    const waiver = {source: {kind: 'corporation' as const, card: CORP, owner: BLUE}, oneShot: false};
    const rows = accessReasonRows(access(), {...CTX, waiver});
    expect(rows.map((r) => [r.key, r.params, r.tone])).deep.eq([
      ['You do not have it — two of your delegates on its resolution would grant it', [], 'lacks'],
      ['Card requirement of this party: lifted — ${0}', [CORP], 'note'],
    ]);
    // Met by a printed road too — the standing lift is still the reason the card never asks.
    const ruling = accessReasonRows(access({ruling: true, hasEffect: true, satisfiesRequirement: true}), {...CTX, waiver});
    expect(ruling.map((r) => r.key)).to.include('Card requirement of this party: lifted — ${0}');
    expect(ruling.map((r) => r.key)).not.to.include('Card requirement of this party: met');
  });

  it('the dossier: a ONE-PLAY waiver says «for one play» — and yields to «met» where a printed road meets it anyway', () => {
    const waiver = {source: {kind: 'card' as const, card: CardName.BACKROOM_DEAL, owner: BLUE}, oneShot: true};
    expect(accessReasonRows(access(), {...CTX, waiver}).map((r) => [r.key, r.params])).to.deep.include(
      ['Card requirement of this party: lifted for one play — ${0}', [CardName.BACKROOM_DEAL]]);
    const met = accessReasonRows(access({ruling: true, hasEffect: true, satisfiesRequirement: true}), {...CTX, waiver});
    expect(met.map((r) => r.key)).to.include('Card requirement of this party: met');
  });

  it('no waiver — the printed footnotes, unchanged', () => {
    expect(accessReasonRows(access({granted: ['Septem Tribus'], hasEffect: true}), CTX).map((r) => r.key)).deep.eq([
      'You have it: granted by ${0}', 'Card requirement of this party: not met — a granted effect does not count',
    ]);
  });
});
