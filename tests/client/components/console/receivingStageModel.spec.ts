import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {buildPlayedZones, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL} from '@/client/components/console/consolePlayedModel';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  familyForCardType, receivingStackView, planReceivingStage, receivingMinis,
  foreignTargetMinis, splitPlayRewards, cardTargetGroups, RECEIVING_MAX_STRIPS,
} from '@/client/console/played/receivingStageModel';

function cards(...names: Array<CardName>): Array<CardModel> {
  return names.map((n) => ({name: n} as CardModel));
}

describe('receivingStageModel (the workspace receiving scene, pure)', () => {
  it('resolves the DESTINATION from the card TYPE — known before any commit', () => {
    expect(familyForCardType(CardType.AUTOMATED)).to.eq('automated');
    expect(familyForCardType(CardType.ACTIVE)).to.eq('active');
    expect(familyForCardType(CardType.EVENT)).to.eq('events');
    expect(familyForCardType(CardType.CORPORATION)).to.eq('corporation');
    expect(familyForCardType(undefined)).to.be.undefined;
  });

  describe('receivingStackView — the final silhouette, stable across the commit', () => {
    it('an empty stack: no strips, no previous top', () => {
      const v = receivingStackView([], CardName.TREES, RECEIVING_MAX_STRIPS);
      expect(v.strips).to.be.empty;
      expect(v.prevTop).to.be.undefined;
      expect(v.hiddenCount).to.eq(0);
    });

    it('one lying card is the previous top (its strip is the handoff seam)', () => {
      const v = receivingStackView(cards(CardName.BIRDS), CardName.TREES, RECEIVING_MAX_STRIPS);
      expect(v.prevTop).to.eq(CardName.BIRDS);
      expect(v.strips).to.be.empty;
    });

    it('caps the strips and reports the depth beyond them', () => {
      const lying = cards(
        CardName.ACQUIRED_COMPANY, CardName.ADAPTED_LICHEN, CardName.ALGAE, CardName.ARCHAEBACTERIA,
        CardName.BIRDS, CardName.BUSHES, CardName.CARTEL, CardName.COMET);
      const v = receivingStackView(lying, CardName.TREES, 3);
      expect(v.prevTop).to.eq(CardName.COMET);
      expect(v.strips).to.deep.eq([CardName.BIRDS, CardName.BUSHES, CardName.CARTEL]);
      expect(v.hiddenCount).to.eq(4);
    });

    it('is IDENTICAL whether or not the committed tableau already carries the incoming card', () => {
      const before = receivingStackView(cards(CardName.BIRDS, CardName.BUSHES), CardName.TREES, 5);
      const after = receivingStackView(cards(CardName.BIRDS, CardName.BUSHES, CardName.TREES), CardName.TREES, 5);
      expect(after).to.deep.eq(before);
    });
  });

  describe('planReceivingStage — destination-first composition', () => {
    it('a roomy stage keeps the large zoom and the full strip history', () => {
      const p = planReceivingStage({availW: 1400, availH: 720, stackCount: 4, uiScale: 1});
      expect(p.zoom).to.be.greaterThan(0.6);
      expect(p.maxStrips).to.eq(3); // stackCount-1, under the cap
      expect(p.cardH).to.be.closeTo(PLAYED_CARD_NATURAL_H * p.zoom, 0.001);
      expect(p.stripH).to.be.closeTo(PLAYED_PEEK_NATURAL * p.zoom, 0.001);
    });

    it('a LONG stack normalizes: strips are capped, never an endless column', () => {
      const p = planReceivingStage({availW: 1400, availH: 720, stackCount: 30, uiScale: 1});
      expect(p.maxStrips).to.be.at.most(RECEIVING_MAX_STRIPS);
      // The whole column always fits the budget (top-anchored, no scroll).
      const column = p.cardH + p.stripH * (p.maxStrips + 1) + 2 * p.sliverH;
      expect(column).to.be.at.most(720);
    });

    it('a SHALLOW stage trades history before it trades size (a scene, not a browser)', () => {
      const tall = planReceivingStage({availW: 1400, availH: 760, stackCount: 8, uiScale: 1});
      const short = planReceivingStage({availW: 1400, availH: 460, stackCount: 8, uiScale: 1});
      expect(short.maxStrips).to.be.at.most(tall.maxStrips);
      expect(short.zoom).to.be.at.most(tall.zoom);
      expect(short.zoom).to.be.greaterThan(0.4); // never microscopic
    });

    it('the visible composition is BOUNDED however deep the tableau grows', () => {
      const p100 = planReceivingStage({availW: 1400, availH: 720, stackCount: 100, miniCount: 5, uiScale: 1});
      const p20 = planReceivingStage({availW: 1400, availH: 720, stackCount: 20, miniCount: 5, uiScale: 1});
      expect(p100.maxStrips).to.be.at.most(RECEIVING_MAX_STRIPS);
      // The plan (and therefore the DOM the stage mounts) is IDENTICAL past
      // the cap — depth beyond it is a count, never more elements.
      expect(p100).to.deep.eq(p20);
    });

    it('minis fit by WIDTH on their own ladder — readable first, stepping down only under pressure', () => {
      const roomy = planReceivingStage({availW: 1500, availH: 720, stackCount: 4, miniCount: 4, uiScale: 1});
      const tight = planReceivingStage({availW: 860, availH: 720, stackCount: 4, miniCount: 7, uiScale: 1});
      expect(roomy.miniZoom).to.be.greaterThan(tight.miniZoom);
      expect(roomy.miniZoom).to.be.at.least(0.42);
      expect(tight.miniZoom).to.be.at.least(0.3); // the floor stands
      expect(roomy.miniBandH).to.be.closeTo(Math.round(PLAYED_PEEK_NATURAL * roomy.miniZoom), 1);
    });
  });

  describe('the compact periphery', () => {
    const zones = buildPlayedZones(cards(
      CardName.THARSIS_REPUBLIC, // corporation
      CardName.ALLIED_BANK, // prelude
      CardName.PREDATORS, // active
      CardName.TREES, // automated
      CardName.ASTEROID, // event
    ));

    it('every non-empty family EXCEPT the destination, in canonical order', () => {
      const minis = receivingMinis(zones, 'automated');
      expect(minis.map((m) => m.family)).to.deep.eq(['corporation', 'prelude', 'active', 'events']);
      expect(minis.every((m) => m.ownerColor === undefined)).to.be.true;
    });

    it('a mini is the TOP card\'s head band + bounded depth (events: the sleeve, no printed head)', () => {
      const minis = receivingMinis(zones, 'automated');
      const active = minis.find((m) => m.family === 'active');
      expect(active?.topName).to.eq(CardName.PREDATORS);
      expect(active?.depth).to.eq(0); // one card — no pile thickness
      const events = minis.find((m) => m.family === 'events');
      expect(events?.isEvents).to.be.true;
      expect(events?.topName).to.be.undefined;
      expect(events?.count).to.eq(1);
    });

    it('pile DEPTH is bounded at two edges whatever the count (never per-card)', () => {
      const deep = buildPlayedZones(cards(
        CardName.THARSIS_REPUBLIC,
        ...Array<CardName>(40).fill(CardName.TREES),
        CardName.PREDATORS,
      ));
      const minis = receivingMinis(deep, 'active');
      const automated = minis.find((m) => m.family === 'automated');
      expect(automated?.count).to.eq(40);
      expect(automated?.depth).to.eq(2);
      expect(automated?.topName).to.eq(CardName.TREES);
    });

    it('FOREIGN effect targets bring their owner in as the same compact primitive', () => {
      const players = [
        {color: 'red' as Color, name: 'Вы', tableau: cards(CardName.TREES)},
        {color: 'green' as Color, name: 'Соперник', tableau: cards(CardName.BIRDS, CardName.PREDATORS)},
      ] as unknown as Array<PublicPlayerModel>;
      const minis = foreignTargetMinis(players, 'red' as Color, [CardName.BIRDS], buildPlayedZones);
      expect(minis).to.have.length(1);
      expect(minis[0].ownerColor).to.eq('green');
      expect(minis[0].family).to.eq('active');
      expect(minis[0].id).to.eq('active:green');
      // No targets on a player → no mini for them.
      expect(foreignTargetMinis(players, 'red' as Color, [], buildPlayedZones)).to.be.empty;
    });
  });

  describe('effect delivery grouping', () => {
    const specs: Array<ResourceTransferSpec> = [
      {channel: 'stock', resource: 'plants', amount: 2},
      {channel: 'card-resource', resource: 'animal', amount: 1, targetCard: CardName.BIRDS},
      {channel: 'production', resource: 'megacredits', amount: 3},
      {channel: 'card-resource', resource: 'microbe', amount: 3, targetCard: CardName.TARDIGRADES},
      {channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: CardName.TARDIGRADES},
    ];

    it('splits the wave into the RAIL half and the CARD half', () => {
      const {railSpecs, cardSpecs} = splitPlayRewards(specs);
      expect(railSpecs.map((s) => s.channel)).to.deep.eq(['stock', 'production']);
      expect(cardSpecs).to.have.length(3);
    });

    it('groups card targets — SELF first, others in first-seen order, specs together', () => {
      const {cardSpecs} = splitPlayRewards(specs);
      const groups = cardTargetGroups(cardSpecs, CardName.TARDIGRADES);
      expect(groups.map((g) => g.target)).to.deep.eq([CardName.TARDIGRADES, CardName.BIRDS]);
      expect(groups[0].self).to.be.true;
      expect(groups[0].specs).to.have.length(2);
      expect(groups[1].self).to.be.false;
    });
  });
});
