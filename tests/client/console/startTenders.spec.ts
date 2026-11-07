import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {TenderInSelectionModel} from '../../../src/common/models/PlayerInputModel';
import {
  pickRestructure, startTenderVerb, tenderCardStateOf, tenderExecutionOf, tenderPressResponse, tenderStepAskKey,
  tenderStepCommit, tenderStepDecline, tenderStepFor, tenderStepStatus, toggleKeep,
} from '../../../src/client/console/startTenders';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — the START window's pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §7–§8): how each kind
 * executes from the «НАСЛЕДИЕ» stage, the exact wire answer of every step, the bar's verb. The scene renders and
 * routes; nothing here touches the DOM.
 */
const held = (id: string, extra: Partial<TenderInSelectionModel> = {}): TenderInSelectionModel =>
  ({instance: `t0-${id}`, id, status: 'held', ...extra});

describe('startTenders — the start window from the legacy stage', () => {
  it('every kind knows HOW it executes: one press · a keep · the restructuring · never from here', () => {
    expect(tenderExecutionOf('openCall')).eq('simple');
    expect(tenderExecutionOf('broadPortfolio')).eq('simple');
    expect(tenderExecutionOf('researchSubsidy')).eq('simple');
    expect(tenderExecutionOf('gamble')).eq('simple');
    expect(tenderExecutionOf('additionalPrelude')).eq('simple');
    expect(tenderExecutionOf('preludeReview')).eq('keep-preludes');
    expect(tenderExecutionOf('projectReview')).eq('keep-projects');
    expect(tenderExecutionOf('restructuring')).eq('restructure');
    expect(tenderExecutionOf('programExtension')).eq('legacy');
    expect(tenderExecutionOf('extendedLegacy')).eq('legacy');
  });

  it('a one-press kind answers with its instance alone; a keep kind opens a step; a restructuring deals first, then opens', () => {
    expect(tenderPressResponse(held('openCall'))).deep.eq({type: 'tender', instance: 't0-openCall'});
    expect(tenderStepFor(held('openCall'))).is.undefined;
    expect(tenderPressResponse(held('preludeReview'))).is.undefined;
    expect(tenderStepFor(held('preludeReview'))).deep.eq({kind: 'keep', instance: 't0-preludeReview', id: 'preludeReview', pool: 'prelude', keep: undefined});
    expect(tenderStepFor(held('projectReview'))?.kind).eq('keep');
    // The restructuring: the first press DEALS (no step yet); once the server names the candidates the step opens.
    expect(tenderPressResponse(held('restructuring'))).deep.eq({type: 'tender', instance: 't0-restructuring'});
    expect(tenderStepFor(held('restructuring'))).is.undefined;
    const dealt = held('restructuring', {offer: [CardName.HELION, CardName.THORGATE]});
    expect(tenderPressResponse(dealt)).is.undefined;
    expect(tenderStepFor(dealt)).deep.eq({kind: 'restructure', instance: 't0-restructuring', id: 'restructuring', offer: [CardName.HELION, CardName.THORGATE], take: undefined, replace: undefined});
    // A legacy-window tender never answers from the start.
    expect(tenderPressResponse(held('programExtension'))).is.undefined;
    expect(tenderStepFor(held('programExtension'))).is.undefined;
  });

  it('a KEEP step: the same card again lets it go, another card takes the one place; the commit carries the keep (empty = redeal all)', () => {
    let step = tenderStepFor(held('preludeReview'))!;
    expect(tenderStepCommit(step)).deep.eq({type: 'tender', instance: 't0-preludeReview', keep: []});
    step = toggleKeep(step, CardName.LOAN);
    expect(step.kind === 'keep' && step.keep).eq(CardName.LOAN);
    step = toggleKeep(step, CardName.DONATION);
    expect(step.kind === 'keep' && step.keep).eq(CardName.DONATION);
    expect(tenderStepCommit(step)).deep.eq({type: 'tender', instance: 't0-preludeReview', keep: [CardName.DONATION]});
    step = toggleKeep(step, CardName.DONATION);
    expect(step.kind === 'keep' && step.keep).is.undefined;
    expect(tenderStepDecline(step)).is.undefined;
    expect(tenderStepAskKey(step)).include('prelude');
    expect(tenderStepStatus(step, (n) => n).key).include('Nothing kept');
  });

  it('the RESTRUCTURING step: a candidate sets the take, a lineage corporation the replace; RT only when both stand; LT declines', () => {
    let step = tenderStepFor(held('restructuring', {offer: [CardName.HELION, CardName.THORGATE]}))!;
    expect(tenderStepCommit(step)).is.undefined;
    step = pickRestructure(step, CardName.HELION, 'offer');
    expect(tenderStepCommit(step)).is.undefined;
    expect(tenderStepStatus(step, (n) => n)).deep.eq({key: 'Taking ${0} — choose the corporation it replaces', params: [CardName.HELION]});
    step = pickRestructure(step, CardName.CREDICOR, 'lineage');
    expect(tenderStepCommit(step)).deep.eq({type: 'tender', instance: 't0-restructuring', take: CardName.HELION, replace: CardName.CREDICOR});
    expect(tenderStepStatus(step, (n) => n)).deep.eq({key: '${0} replaces ${1}', params: [CardName.HELION, CardName.CREDICOR]});
    // The same key on the same object unpicks.
    step = pickRestructure(step, CardName.HELION, 'offer');
    expect(step.kind === 'restructure' && step.take).is.undefined;
    expect(tenderStepDecline(step)).deep.eq({type: 'tender', instance: 't0-restructuring', decline: true});
  });

  it('the bar\'s verb: «Исполнить» for a held start tender, the restructuring continues once dealt, a legacy tender is a named refusal, busy dims, done says nothing', () => {
    expect(startTenderVerb(held('openCall'), false)).deep.eq({label: 'Execute', enabled: true});
    expect(startTenderVerb(held('restructuring', {offer: [CardName.HELION]}), false)).deep.eq({label: 'Continue the restructuring', enabled: true});
    expect(startTenderVerb(held('programExtension'), false)).deep.eq({label: 'Execute', enabled: false, reason: 'Realized on the carryover step'});
    expect(startTenderVerb(held('openCall'), true)).deep.eq({label: 'Executing…', enabled: false});
    expect(startTenderVerb(held('openCall', {status: 'executed'}), false)).is.undefined;
    expect(startTenderVerb(held('openCall', {status: 'cashed'}), false)).is.undefined;
  });

  it('the certificate reads the holding\'s status', () => {
    expect(tenderCardStateOf('held')).eq('held');
    expect(tenderCardStateOf('executed')).eq('executed');
    expect(tenderCardStateOf('cashed')).eq('cashed');
  });
});
