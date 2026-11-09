import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TENDER_IDS, TenderId, tenderWindowOf} from '../../src/common/campaign/tenders';
import {TenderInSelectionModel} from '../../src/common/models/PlayerInputModel';
import {CarryoverTenderModel} from '../../src/common/campaign/CampaignModel';
import {
  StartPortfolioContext, ThresholdPortfolioContext, TenderStandingPage, tenderDoorList, tenderExecutionOf, tenderPageNoteKey,
  tenderPageOf, tenderPortfolio, tenderPortfolioCounts, tenderPressResponse, tenderReadyHere, tenderRestructureKeep,
  tenderRestructureResponse, tenderExchangeResponse, tenderSpeaksAt, tenderSpeaksOnPage,
} from '../../src/client/console/campaign/tenderPortfolio';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE TENDER DOOR's pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16 · §19): every holding on each
 * of the two places, with the PAGE it executes on, its STATE on the page the player stands on (ready · elsewhere ·
 * blocked · executed · cashed), the NOTE that says why it cannot go here, the READING in live numbers; the door's order;
 * the answers on the wire.
 */
const held = (id: TenderId, extra: Partial<TenderInSelectionModel> = {}): TenderInSelectionModel =>
  ({instance: `t-${id}`, id, status: 'held', window: tenderWindowOf(id), ...extra});

function startCtx(tenders: ReadonlyArray<TenderInSelectionModel>, page: TenderStandingPage, extra: Partial<StartPortfolioContext> = {}): StartPortfolioContext {
  return {
    place: 'start', tenders, page, preludesDealt: 4, preludePick: 2, projectsDealt: 10, projectsMax: 10, cardCost: 3,
    lineage: [CardName.ECOLINE, CardName.MINING_GUILD], corporationsDealt: 2, ...extra,
  };
}

const carry = (id: TenderId, extra: Partial<CarryoverTenderModel> = {}): CarryoverTenderModel =>
  ({instance: `c-${id}`, id, status: 'held', window: tenderWindowOf(id), ...extra});

function thresholdCtx(tenders: ReadonlyArray<CarryoverTenderModel>, extra: Partial<ThresholdPortfolioContext> = {}): ThresholdPortfolioContext {
  return {place: 'threshold', tenders, limit: 2, handSize: 5, playedPreludes: 2, preludeLimit: 0, ...extra};
}

const ALL_START: ReadonlyArray<TenderId> = [
  'openCall', 'broadPortfolio', 'targetedRequest', 'researchSubsidy', 'preludeReview', 'projectReview',
  'gamblePreludes', 'gambleProjects', 'gambleCorporations', 'restructuring',
];

describe('tenderPortfolio — the tender door: where each tender speaks, and why not here', () => {
  it('every kind knows HOW it executes and on WHICH PAGE — the page whose cards it changes', () => {
    expect(tenderExecutionOf('openCall')).eq('simple');
    expect(tenderExecutionOf('gambleCorporations')).eq('simple');
    expect(tenderExecutionOf('targetedRequest')).eq('choose-tag');
    expect(tenderExecutionOf('preludeReview')).eq('keep-preludes');
    expect(tenderExecutionOf('projectReview')).eq('keep-projects');
    expect(tenderExecutionOf('restructuring')).eq('restructure');
    expect(tenderExecutionOf('programExtension')).eq('legacy');
    expect(tenderExecutionOf('extendedLegacy')).eq('legacy');
    const pages = Object.fromEntries(TENDER_IDS.map((id) => [id, tenderPageOf(id)]));
    expect(pages).deep.eq({
      programExtension: 'legacy', extendedLegacy: 'legacy',
      openCall: 'prelude', preludeReview: 'prelude', gamblePreludes: 'prelude',
      broadPortfolio: 'projects', researchSubsidy: 'projects', projectReview: 'projects', targetedRequest: 'projects', gambleProjects: 'projects',
      gambleCorporations: 'corp', restructuring: 'any',
    });
    // «any» = every DEAL page of the start, never its summary (the lineage the restructuring rewrites is on the dock).
    expect(tenderSpeaksOnPage('any', 'ceo')).is.true;
    expect(tenderSpeaksOnPage('any', 'summary')).is.false;
    expect(tenderSpeaksOnPage('prelude', 'projects')).is.false;
    expect(tenderSpeaksAt('openCall', 'start')).is.true;
    expect(tenderSpeaksAt('extendedLegacy', 'threshold')).is.true;
  });

  it('THE OWNER\'S LAW (2026-11-09): nothing executes before its page — a prelude gamble on the CORPORATION page is «elsewhere», named', () => {
    const corp = Object.fromEntries(tenderPortfolio(startCtx(ALL_START.map((id) => held(id)), 'corp')).map((e) => [e.id, e]));
    expect(corp.gamblePreludes).include({state: 'elsewhere', note: 'Executes on the prelude step'});
    expect(corp.openCall).include({state: 'elsewhere', note: 'Executes on the prelude step'});
    expect(corp.broadPortfolio).include({state: 'elsewhere', note: 'Executes on the project step'});
    expect(corp.gambleCorporations).include({state: 'ready'});
    expect(corp.gambleCorporations.note).is.undefined;
    expect(corp.restructuring).include({state: 'ready'});
    const prelude = tenderPortfolio(startCtx(ALL_START.map((id) => held(id)), 'prelude'));
    expect(prelude.filter((e) => e.state === 'ready').map((e) => e.id).sort())
      .deep.eq(['gamblePreludes', 'openCall', 'preludeReview', 'restructuring']);
    const projects = tenderPortfolio(startCtx(ALL_START.map((id) => held(id)), 'projects'));
    expect(projects.filter((e) => e.state === 'ready').map((e) => e.id).sort())
      .deep.eq(['broadPortfolio', 'gambleProjects', 'projectReview', 'researchSubsidy', 'restructuring', 'targetedRequest']);
    const summary = tenderPortfolio(startCtx(ALL_START.map((id) => held(id)), 'summary'));
    expect(tenderReadyHere(summary), 'the summary executes nothing — the list says where each goes').eq(0);
    expect(summary.find((e) => e.id === 'restructuring')?.note).eq(tenderPageNoteKey('any'));
  });

  it('THE READINGS speak the deal\'s own numbers; the server\'s refusal outranks the page; a done one is done', () => {
    const entries = tenderPortfolio(startCtx([
      held('openCall'), held('broadPortfolio'), held('researchSubsidy'), held('gamblePreludes'),
      held('restructuring', {offer: [CardName.THARSIS_REPUBLIC, CardName.HELION]}),
      held('extendedLegacy', {blocked: 'Executed at the finale\'s start'}),
      held('projectReview', {blocked: 'Too few projects are left in the deck'}),
      held('targetedRequest', {status: 'executed'}), held('gambleProjects', {status: 'cashed'}),
    ], 'projects', {cardCost: 2}));
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId.openCall.reading).deep.eq({key: 'Preludes in the deal: ${0} → ${1}', params: ['4', '6']});
    expect(byId.broadPortfolio.reading.params).deep.eq(['10', '14', '10']);
    expect(byId.researchSubsidy.reading.params, 'never below the 1 M€ floor').deep.eq(['2', '1']);
    expect(byId.gamblePreludes.reading).deep.eq({key: 'Redeal all ${0} preludes', params: ['4']});
    expect(byId.restructuring.reading.key).contains('choose one');
    expect(byId.extendedLegacy).include({state: 'blocked', note: 'Executed at the finale\'s start'});
    expect(byId.projectReview, 'its page — but the deck refuses').include({state: 'blocked', note: 'Too few projects are left in the deck'});
    expect(byId.targetedRequest.state).eq('executed');
    expect(byId.gambleProjects.state).eq('cashed');
    expect(tenderPortfolioCounts(entries)).deep.eq({executed: 1, open: 5, total: 9});
  });

  it('THE DOOR\'s ORDER: the ones that execute HERE first, then elsewhere, blocked, executed, cashed — acquisition order within each', () => {
    const entries = tenderPortfolio(startCtx([
      held('gambleProjects', {status: 'cashed'}), held('openCall'), held('broadPortfolio', {status: 'executed'}),
      held('gamblePreludes', {blocked: 'Too few preludes are left in the deck'}), held('targetedRequest'), held('preludeReview'),
      held('researchSubsidy'),
    ], 'projects'));
    expect(tenderDoorList(entries).map((e) => `${e.id}:${e.state}`)).deep.eq([
      'targetedRequest:ready', 'researchSubsidy:ready',
      'openCall:elsewhere', 'preludeReview:elsewhere',
      'gamblePreludes:blocked',
      'broadPortfolio:executed',
      'gambleProjects:cashed',
    ]);
    expect(tenderReadyHere(entries)).eq(2);
  });

  it('THE THRESHOLD: the legacy tenders read the seat and the preludes in the carryover\'s numbers; the server names every refusal', () => {
    const entries = tenderPortfolio(thresholdCtx([
      carry('extendedLegacy'), carry('programExtension'),
      carry('openCall', {blocked: 'Executed at the finale\'s start'}),
      carry('programExtension', {instance: 'c-pe-2', blocked: 'Every prelude you played already travels into the finale'}),
    ], {limit: 2, handSize: 5, playedPreludes: 2, preludeLimit: 1}));
    expect(entries[0]).include({state: 'ready', page: 'legacy'});
    expect(entries[0].reading).deep.eq({key: 'Legacy seats: ${0} → ${1} · ${2} card(s) in hand', params: ['2', '3', '5']});
    expect(entries[1].reading).deep.eq({key: 'Preludes into the finale: ${0} → ${1} of the ${2} you played', params: ['1', '2', '2']});
    expect(entries[2]).include({state: 'blocked', note: 'Executed at the finale\'s start'});
    expect(entries[3]).include({state: 'blocked', note: 'Every prelude you played already travels into the finale'});
    expect(tenderDoorList(entries).map((e) => e.instance)).deep.eq(['c-extendedLegacy', 'c-programExtension', 'c-openCall', 'c-pe-2']);
  });

  it('the answers on the wire — the one press, the exchange\'s returned cards, the restructuring\'s take / keep', () => {
    expect(tenderPressResponse({instance: 't1', id: 'openCall'})).deep.eq({type: 'tender', instance: 't1'});
    expect(tenderPressResponse({instance: 't2', id: 'restructuring'})).deep.eq({type: 'tender', instance: 't2'});
    expect(tenderPressResponse({instance: 't2', id: 'restructuring', offer: [CardName.HELION]}), 'dealt — the mode answers, not the press').is.undefined;
    expect(tenderPressResponse({instance: 't3', id: 'preludeReview'})).is.undefined;
    expect(tenderExchangeResponse('t3', [CardName.LOAN, CardName.DONATION])).deep.eq({type: 'tender', instance: 't3', release: [CardName.LOAN, CardName.DONATION]});
    expect(tenderRestructureResponse('t2', CardName.HELION, CardName.ECOLINE)).deep.eq({type: 'tender', instance: 't2', take: CardName.HELION, replace: CardName.ECOLINE});
    expect(tenderRestructureKeep('t2'), 'the lineage kept — never a decline once dealt').deep.eq({type: 'tender', instance: 't2', keep: true});
  });
});
