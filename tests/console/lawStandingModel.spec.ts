import {expect} from 'chai';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {lawStandingOf, LawStandingInput} from '@/client/console/parliament/lawStandingModel';
import {actionBillPrice} from '@/common/parliament/actionBill';

/**
 * «WHILE ENACTED» (P77 · DH — the owner's frame: Trade Industries' vote panel over an EMPTY plate). Every law that acts
 * or stands says what it gives the reading's seat, in the seat's own numbers through the declaration's own function, or
 * in the law's rule where no number exists — read off the REAL manifest, so a declaration that changes is read here too.
 */
const BLUE = 'blue' as Color;

function seat(agenda: number): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [], partyActionUses: {}, resolutionActionUses: 0, counts: [],
  };
}
function model(agenda: number): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players: [seat(agenda)], deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none'};
}
function standing(id: string, agenda: number, extra: Partial<LawStandingInput> = {}) {
  const resolution = getResolution(id as never);
  expect(resolution, `${id} is in the manifest`).not.to.eq(undefined);
  return lawStandingOf({resolution, model: model(agenda), subject: BLUE, rival: false, belowPayout: (resolution!.scaled ?? []).length > 0, ...extra});
}

describe('lawStandingModel — what a law gives the seat while it stands', () => {
  it('Trade Industries (RX28): the plate\'s voice is the bill at the seat\'s influence → the fleet; the win takes 2 M€ off', () => {
    const resolution = getResolution('RDX_UNITY_TRADE_INDUSTRIES' as never)!;
    const s = standing('RDX_UNITY_TRADE_INDUSTRIES', 0);
    expect(s?.kicker, 'nothing paid at the enactment — no sub-kicker, the standing IS the voice').to.eq(undefined);
    const bill = s?.action?.bill;
    expect(bill?.printed).to.eq(12);
    expect(bill?.price).to.eq(actionBillPrice(resolution.actionBill!, influenceAtAgenda(0)).price);
    expect(s?.action?.gains.map((g) => g.icon)).to.deep.eq(['trade-fleet']);
    expect(bill?.priceIfWin, 'the winner\'s step lifts the influence — a lower price').to.be.lessThan(bill!.price);
    expect(s?.passive).to.eq(undefined);
  });

  it('Manufacturing Run (RX37): the count for the seat and the win\'s count where the step crosses the line; its rule', () => {
    const low = standing('RDX_INDUSTRIALISTS_MANUFACTURING_RUN', 0);
    expect(low?.action?.uses.declared).to.eq(true);
    expect(low?.action?.uses.now).to.eq(2);
    expect(low?.action?.rule, 'no bill — the rule says what the action does').to.contain('floaters');
    const high = standing('RDX_INDUSTRIALISTS_MANUFACTURING_RUN', 5);
    expect(high?.action?.uses.now).to.eq(3);
    expect(high?.action?.uses.ifWin, 'already at 3 — the win changes nothing').to.eq(undefined);
  });

  it('R&D Funding (RX26): the science tags lent at the seat\'s influence (+ the win\'s), and the repeat action once a generation', () => {
    const s = standing('RDX_SCIENTISTS_RD_FUNDING', 2);
    expect(s?.passive).to.deep.include({kind: 'tagsPerInfluence', tag: Tag.SCIENCE, now: influenceAtAgenda(2)});
    expect(s?.action?.uses).to.deep.include({now: 1, declared: false});
    expect(s?.action?.rule).to.contain('second time');
  });

  it('Heat Capture (RX14) / Water Export (RX33): the discount and the viewer\'s cards it would cheapen — under the payout, with its kicker', () => {
    const hand = [[Tag.BUILDING], [Tag.SCIENCE], [Tag.BUILDING, Tag.CITY], [Tag.EARTH]];
    const heat = standing('RDX_REDS_HEAT_CAPTURE', 1, {hand});
    expect(heat?.kicker, 'the plate reads the payout above — the standing names itself').to.eq('While enacted');
    expect(heat?.passive).to.deep.eq({kind: 'cardDiscount', amount: 3, tags: [Tag.BUILDING], inHand: 2});
    const water = standing('RDX_REDS_WATER_EXPORT', 1, {hand});
    expect(water?.passive).to.deep.include({kind: 'cardDiscount', amount: 3, inHand: 1});
    const rival = standing('RDX_REDS_HEAT_CAPTURE', 1, {hand, rival: true});
    expect(rival?.passive, 'another seat\'s hand is not public').to.deep.eq({kind: 'cardDiscount', amount: 3, tags: [Tag.BUILDING]});
  });

  it('Metal Research (RX19): each metal\'s value before → after and the stock it lifts (the viewer\'s own reading only)', () => {
    const stock = {steel: 4, titanium: 1, steelValue: 2, titaniumValue: 3};
    const s = standing('RDX_INDUSTRIALISTS_METAL_RESEARCH', 1, {stock});
    expect(s?.passive).to.deep.eq({kind: 'resourceValue', rows: [{resource: 'steel', now: 2, after: 3}, {resource: 'titanium', now: 3, after: 4}], stockGain: 5});
    const rival = standing('RDX_INDUSTRIALISTS_METAL_RESEARCH', 1, {stock, rival: true});
    expect(rival?.passive).to.not.have.property('stockGain');
    const spectator = standing('RDX_INDUSTRIALISTS_METAL_RESEARCH', 1);
    expect(spectator?.passive?.kind, 'no stock to read — the rule, never a client constant').to.eq('rule');
  });

  it('a passive with no term reads its rule; UNMI Veto\'s passive has its own live line — no second one', () => {
    expect(standing('RDX_MARS_URBAN_DEVELOPMENT', 1)?.passive).to.deep.eq({kind: 'rule', text: 'After you play a Building tag, draw a card.'});
    expect(standing('RDX_REDS_UNMI_VETO', 1)).to.eq(undefined);
    expect(standing('RDX_GREENS_AQUIFER_CONTEST', 1), 'a law that neither acts nor stands').to.eq(undefined);
  });
});
