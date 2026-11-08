import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TENDER_COMPENSATION_MC, TenderId, tenderWindowOf} from '../../src/common/campaign/tenders';
import {TenderInSelectionModel} from '../../src/common/models/PlayerInputModel';
import {CarryoverTenderModel} from '../../src/common/campaign/CampaignModel';
import {
  StartPortfolioContext, ThresholdPortfolioContext, tenderExecutionOf, tenderModeStageKey, tenderPortfolio,
  tenderPortfolioCounts, tenderPressResponse, tenderRestructureDecline, tenderRestructureResponse, tenderReviewResponse,
  tenderSpeaksAt,
} from '../../src/client/console/campaign/tenderPortfolio';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE PORTFOLIO's pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16): every holding on each of
 * the two places with its STATE, its VERB, its READING in live numbers and its CONFIRM; the answers on the wire.
 */
const held = (id: TenderId, extra: Partial<TenderInSelectionModel> = {}): TenderInSelectionModel =>
  ({instance: `t-${id}`, id, status: 'held', window: tenderWindowOf(id), ...extra});

function startCtx(tenders: ReadonlyArray<TenderInSelectionModel>, extra: Partial<StartPortfolioContext> = {}): StartPortfolioContext {
  return {
    place: 'start', tenders, preludesDealt: 4, preludePick: 2, projectsDealt: 10, projectsMax: 10, cardCost: 3,
    lineage: [CardName.ECOLINE, CardName.MINING_GUILD], picksLive: false, ...extra,
  };
}

const carry = (id: TenderId, extra: Partial<CarryoverTenderModel> = {}): CarryoverTenderModel =>
  ({instance: `c-${id}`, id, status: 'held', window: tenderWindowOf(id), ...extra});

function thresholdCtx(tenders: ReadonlyArray<CarryoverTenderModel>, extra: Partial<ThresholdPortfolioContext> = {}): ThresholdPortfolioContext {
  return {place: 'threshold', tenders, limit: 2, handSize: 5, playedPreludes: 2, preludeLimit: 0, ...extra};
}

describe('tenderPortfolio — the one reader of a holding on the two places', () => {
  it('every kind knows HOW it executes at the start: one press · a review on its deal · the restructuring · never from here', () => {
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
    expect(tenderSpeaksAt('openCall', 'start')).is.true;
    expect(tenderSpeaksAt('openCall', 'threshold')).is.false;
    expect(tenderSpeaksAt('extendedLegacy', 'threshold')).is.true;
  });

  it('THE START: each certificate\'s state, verb, the step it lands on and the reading in the deal\'s own numbers', () => {
    const entries = tenderPortfolio(startCtx([
      held('openCall'), held('broadPortfolio'), held('additionalPrelude'), held('researchSubsidy'),
      held('preludeReview'), held('projectReview'), held('gamble'), held('restructuring'),
      held('extendedLegacy', {blocked: 'Its window was the legacy step before the finale'}),
      held('programExtension', {status: 'executed'}),
    ]));
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId.openCall).include({state: 'ready', verb: 'Execute', landsOn: 'prelude'});
    expect(byId.openCall.reading).deep.eq({key: 'Preludes in the deal: ${0} → ${1}', params: ['4', '6']});
    expect(byId.broadPortfolio).include({state: 'ready', verb: 'Execute', landsOn: 'projects'});
    expect(byId.broadPortfolio.reading.params).deep.eq(['10', '14', '10']);
    expect(byId.additionalPrelude.reading).deep.eq({key: 'Prelude picks: ${0} → ${1} of ${2}', params: ['2', '3', '4']});
    expect(byId.researchSubsidy.reading.params, 'the price after one more copy').deep.eq(['3', '2']);
    expect(byId.preludeReview).include({state: 'step', verb: 'Review', landsOn: 'prelude'});
    expect(byId.preludeReview.reading.params).deep.eq(['1', '4']);
    expect(byId.projectReview).include({state: 'step', verb: 'Review', landsOn: 'projects'});
    expect(byId.gamble).include({state: 'ready', verb: 'Execute', landsOn: 'prelude'});
    expect(byId.gamble.confirm, 'no live picks — no second press').is.undefined;
    expect(byId.restructuring).include({state: 'step', verb: 'Deal the candidates', landsOn: 'corp'});
    expect(byId.restructuring.reading.params).deep.eq(['2', '2']);
    expect(byId.extendedLegacy).include({state: 'blocked', verb: '', reason: 'Its window was the legacy step before the finale'});
    expect(byId.programExtension).include({state: 'executed', verb: ''});
    expect(tenderPortfolioCounts(entries)).deep.eq({executed: 1, open: 8, total: 10});
  });

  it('THE START: a gamble over LIVE picks asks for a second press; a dealt restructuring continues; a cashed one is done', () => {
    const entries = tenderPortfolio(startCtx([
      held('gamble'), held('restructuring', {offer: [CardName.THARSIS_REPUBLIC, CardName.HELION]}), held('openCall', {status: 'cashed'}),
    ], {picksLive: true}));
    expect(entries[0].confirm?.key).contains('press again');
    expect(entries[1]).include({state: 'step', verb: 'Continue the restructuring'});
    expect(entries[1].reading.key).contains('choose one');
    expect(entries[2]).include({state: 'cashed', verb: ''});
  });

  it('THE THRESHOLD: the legacy tenders read the seat and the band in the carryover\'s numbers; the start-window ones name their window', () => {
    const entries = tenderPortfolio(thresholdCtx([
      carry('extendedLegacy'), carry('programExtension'),
      carry('openCall', {blocked: 'Executed at the finale\'s start'}),
      carry('programExtension', {instance: 'c-pe-2', blocked: 'You played no prelude in that mission'}),
    ], {limit: 2, handSize: 5, playedPreludes: 2, preludeLimit: 0}));
    expect(entries[0]).include({state: 'ready', verb: 'Execute'});
    expect(entries[0].reading).deep.eq({key: 'Legacy seats: ${0} → ${1} · ${2} card(s) in hand', params: ['2', '3', '5']});
    expect(entries[0].confirm, 'five cards for three seats — no second press').is.undefined;
    expect(entries[1].reading.params).deep.eq(['0', '1', '2']);
    expect(entries[2]).include({state: 'blocked', reason: 'Executed at the finale\'s start'});
    expect(entries[3]).include({state: 'blocked', reason: 'You played no prelude in that mission'});
  });

  it('THE THRESHOLD\'s fool-proof: a seat nothing can fill opens only on a second press, and the line names the compensation', () => {
    const [two] = tenderPortfolio(thresholdCtx([carry('extendedLegacy')], {limit: 2, handSize: 2}));
    expect(two.state).eq('ready');
    expect(two.confirm?.params).deep.eq(['2', String(TENDER_COMPENSATION_MC)]);
    const [none] = tenderPortfolio(thresholdCtx([carry('extendedLegacy')], {limit: 2, handSize: 0}));
    expect(none.confirm?.params[0]).eq('0');
    const [plenty] = tenderPortfolio(thresholdCtx([carry('extendedLegacy')], {limit: 2, handSize: 3}));
    expect(plenty.confirm).is.undefined;
  });

  it('the answers on the wire — the one press, the review\'s keep, the restructuring\'s take / decline — and the modes\' stage names', () => {
    expect(tenderPressResponse({instance: 't1', id: 'openCall'})).deep.eq({type: 'tender', instance: 't1'});
    expect(tenderPressResponse({instance: 't2', id: 'restructuring'})).deep.eq({type: 'tender', instance: 't2'});
    expect(tenderPressResponse({instance: 't2', id: 'restructuring', offer: [CardName.HELION]}), 'dealt — the mode answers, not the press').is.undefined;
    expect(tenderPressResponse({instance: 't3', id: 'preludeReview'})).is.undefined;
    expect(tenderReviewResponse('t3', CardName.LOAN)).deep.eq({type: 'tender', instance: 't3', keep: [CardName.LOAN]});
    expect(tenderReviewResponse('t3', undefined), 'nothing kept — everything is redealt').deep.eq({type: 'tender', instance: 't3', keep: []});
    expect(tenderRestructureResponse('t2', CardName.HELION, CardName.ECOLINE)).deep.eq({type: 'tender', instance: 't2', take: CardName.HELION, replace: CardName.ECOLINE});
    expect(tenderRestructureDecline('t2')).deep.eq({type: 'tender', instance: 't2', decline: true});
    expect(tenderModeStageKey('review')).eq('Review');
    expect(tenderModeStageKey('restructure')).eq('Restructuring');
  });
});
