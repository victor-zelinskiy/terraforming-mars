import {expect} from 'chai';
import {TENDER_COMPENSATION_MC} from '../../src/common/campaign/tenders';
import {ActivationFacts, legacyActivationPlan, startActivationPlan} from '../../src/client/console/campaign/tenderActivation';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE ACTIVATION SHEET's pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §20): every start tender
 * says WHAT IT GIVES in the table's live numbers (`from → to`), what it clears or costs, and its one verb; the
 * compensation it gives up is always named.
 */
const facts = (extra: Partial<ActivationFacts> = {}): ActivationFacts => ({
  preludesDealt: 4, preludePick: 2, projectsDealt: 10, projectsMax: 10, corporationsDealt: 2, lineage: 3, cardCost: 3,
  projectsPicked: 5, fundsLeft: 33, preludesPicked: 1, corporationPicked: false, ...extra,
});

const row = (plan: ReturnType<typeof startActivationPlan>, label: string) => plan.rows.find((r) => r.label === label);

describe('tenderActivation — the sheet speaks the table\'s numbers', () => {
  it('a deal that GROWS reads its deal before and after', () => {
    const open = startActivationPlan('openCall', facts());
    expect(open).include({kind: 'confirm', verb: 'Execute the tender'});
    expect(row(open, 'Preludes in the deal')).include({from: 4, to: 6, unit: 'prelude', tone: 'gain'});
    const broad = startActivationPlan('broadPortfolio', facts());
    expect(row(broad, 'Projects in the deal')).include({from: 10, to: 14});
    expect(row(broad, 'You can buy up to')).include({to: 10});
  });

  it('«Субсидия» reads the price, the purchase and the funds left — never below the 1 M€ floor', () => {
    const plan = startActivationPlan('researchSubsidy', facts());
    expect(row(plan, 'Price of a starting-hand card')).include({from: 3, to: 2, unit: 'mc'});
    expect(row(plan, 'Your purchase')).include({from: 15, to: 10});
    expect(row(plan, 'Funds left')).include({from: 33, to: 38});
    const floor = startActivationPlan('researchSubsidy', facts({cardCost: 1, projectsPicked: 0, fundsLeft: undefined}));
    expect(row(floor, 'Price of a starting-hand card')).include({from: 1, to: 1});
    expect(row(floor, 'Your purchase'), 'nothing picked — no purchase row').is.undefined;
    expect(row(floor, 'Funds left'), 'money unknown — no funds row').is.undefined;
  });

  it('a GAMBLE names what goes back to the deck and the picks it clears', () => {
    const plan = startActivationPlan('gamblePreludes', facts());
    expect(row(plan, 'Back to the deck')).include({to: 4, tone: 'cost'});
    expect(row(plan, 'A fresh deal')).include({to: 4, tone: 'gain'});
    expect(plan.notes.find((n) => n.tone === 'warn')).deep.include({key: 'Your ${0} picked prelude(s) go back too', params: ['1']});
    expect(startActivationPlan('gambleProjects', facts({projectsPicked: 0})).notes.some((n) => n.tone === 'warn'), 'no picks — nothing to warn').is.false;
  });

  it('the request names its tag on the sheet; the exchange and the restructuring hand over to their own surfaces', () => {
    const tag = startActivationPlan('targetedRequest', facts({tagCount: 2}));
    expect(tag).include({kind: 'tag', verb: 'Request the three cards'});
    expect(row(tag, 'Projects in the deal'), 'only as many as the deck holds').include({from: 10, to: 12});
    const review = startActivationPlan('preludeReview', facts({deckLeft: 3}));
    expect(review).include({kind: 'review', verb: 'Mark the cards to return'});
    expect(row(review, 'You may return up to')).include({to: 3});
    const restructure = startActivationPlan('restructuring', facts());
    expect(restructure).include({kind: 'restructure', verb: 'Deal the candidates'});
    expect(restructure.notes.some((n) => n.key.includes('cannot be undone') && n.tone === 'warn')).is.true;
  });

  it('every sheet names the compensation it gives up; the legacy tenders read the seat and the preludes', () => {
    for (const id of ['openCall', 'broadPortfolio', 'researchSubsidy', 'gamblePreludes', 'restructuring', 'projectReview'] as const) {
      expect(startActivationPlan(id, facts()).notes.at(-1)).deep.eq({key: 'Executed, it no longer pays its ${0} M€ compensation', params: [String(TENDER_COMPENSATION_MC)], tone: 'info'});
    }
    const seat = legacyActivationPlan('extendedLegacy', {limit: 2, handSize: 14, preludeLimit: 0, playedPreludes: 2});
    expect(seat.rows[0]).include({label: 'Legacy seats', from: 2, to: 3, unit: 'seat'});
    const prelude = legacyActivationPlan('programExtension', {limit: 2, handSize: 14, preludeLimit: 1, playedPreludes: 2});
    expect(prelude.rows[0]).include({label: 'Preludes into the finale', from: 1, to: 2});
  });
});
