import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {EffectForecastFact} from '@/common/models/EffectForecastModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {buildPlayedZones, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL} from '@/client/components/console/consolePlayedModel';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  familyForCardType, receivingStackView, planReceivingStage, receivingMinis,
  foreignTargetMinis, splitPlayRewards, cardTargetGroups, playCardReactions, RECEIVING_MAX_STRIPS,
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
      // The 1080 band's zone: the top rung fits with every strip of a four-card stack (PL-126 raised the ladder).
      const p = planReceivingStage({availW: 1400, availH: 950, stackCount: 4, uiScale: 1});
      expect(p.zoom).to.eq(1);
      expect(p.maxStrips).to.eq(3); // stackCount-1, under the cap
      expect(p.cardH).to.be.closeTo(PLAYED_CARD_NATURAL_H * p.zoom, 0.001);
      expect(p.stripH).to.be.closeTo(PLAYED_PEEK_NATURAL * p.zoom, 0.001);
    });

    it('a stage short on height trades HISTORY for the protagonist first (two strips at the larger rung beat three at a smaller one), and the narrow Deck zone trades the rung for the SHELF', () => {
      const short = planReceivingStage({availW: 1400, availH: 720, stackCount: 4, uiScale: 1});
      expect(short.zoom).to.eq(0.9);
      expect(short.maxStrips).to.eq(2);
      // An empty destination in a 1000 px zone with five minis: the slot at 1.0 would push the floor-rung shelf
      // past the width — the rung steps down until the row fits, instead of the minis overflowing honestly.
      const narrow = planReceivingStage({availW: 1000, availH: 560, stackCount: 0, miniCount: 5, uiScale: 1});
      expect(narrow.zoom).to.be.lessThan(1);
      expect(narrow.slotW + 2 * 44 + 5 * narrow.miniW + 4 * 28).to.be.at.most(1000 - 24 + 5);
      // …and the same zone with no minis keeps the top rung: nothing stood beside the protagonist.
      expect(planReceivingStage({availW: 1000, availH: 560, stackCount: 0, miniCount: 0, uiScale: 1}).zoom).to.eq(1);
    });

    it('THE PROTAGONIST IS A THIRD OF THE ZONE (PL-126): the front card stands at least a third of the stage\'s height on the 1080 band and on the TV zone alike, the whole column inside the budget, the shelf inside the width', () => {
      for (const [availW, availH, uiScale, label] of [[1750, 950, 1, 'fhd'], [3500, 1900, 2, 'tv4k'], [1000, 560, 1, 'deck']] as const) {
        for (const stackCount of [0, 1, 4, 12]) {
          const p = planReceivingStage({availW, availH, stackCount, miniCount: 5, uiScale});
          expect(p.cardH, `${label} · ${stackCount} in the stack`).to.be.at.least(availH / 3);
          const column = p.cardH + p.stripH * (p.maxStrips + (stackCount > 0 ? 1 : 0)) + 2 * p.sliverH;
          expect(column, `${label} · the column fits`).to.be.at.most(availH);
          const row = p.slotW + 2 * 44 * uiScale + 5 * p.miniW + 4 * 28 * uiScale;
          expect(row, `${label} · the shelf row fits`).to.be.at.most(availW);
        }
      }
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

  describe('the table\'s answer on the cards (К-S1 — PL-124): the forecast\'s promise as reaction specs', () => {
    const fact = (over: Partial<EffectForecastFact>): EffectForecastFact => ({
      id: 'blue-Vector Computations-1',
      source: {kind: 'card', name: CardName.VECTOR_COMPUTATIONS, owner: 'blue' as Color, channel: 'card-played'},
      certainty: 'exact',
      recipient: {kind: 'you'},
      timing: 'immediate',
      effects: [{direction: 'gain', icon: 'data', amount: 2, current: 0, resulting: 2, note: 'on this card'}],
      reason: 'You play a card with a science tag',
      reasonTag: Tag.SCIENCE,
      ...over,
    } as EffectForecastFact);

    it('an EXACT fact addressed to «you» from a CARD: one card-resource spec on the holder, with the tag that woke it', () => {
      expect(playCardReactions([fact({})])).to.deep.eq([{
        spec: {channel: 'card-resource', resource: 'data', amount: 2, targetCard: CardName.VECTOR_COMPUTATIONS},
        tag: Tag.SCIENCE,
      }]);
    });

    it('a hook that names no tag: the spec alone (the chip is born on the card)', () => {
      const [reaction] = playCardReactions([fact({reasonTag: undefined})]);
      expect(reaction.tag).to.be.undefined;
      expect(reaction.spec.targetCard).to.eq(CardName.VECTOR_COMPUTATIONS);
    });

    it('NEVER a question, a deferred payout, an unknown, another seat\'s gain, a party\'s or a rule\'s source', () => {
      expect(playCardReactions([fact({certainty: 'asks'})])).to.deep.eq([]);
      expect(playCardReactions([fact({certainty: 'deferred', timing: 'after-placement'})])).to.deep.eq([]);
      expect(playCardReactions([fact({certainty: 'unknown', effects: []})])).to.deep.eq([]);
      expect(playCardReactions([fact({recipient: {kind: 'player', color: 'red' as Color}})])).to.deep.eq([]);
      expect(playCardReactions([fact({source: {kind: 'party', name: 'Greens', owner: 'blue' as Color, channel: 'tr-increase'} as EffectForecastFact['source']})])).to.deep.eq([]);
    });

    it('only the «on this card» gains of a real card resource — a stock chip, a draw, an untyped resource and a loss are not a holder\'s', () => {
      const mixed = fact({effects: [
        {direction: 'gain', icon: 'megacredits', amount: 2, current: 0, resulting: 2},
        {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'},
        {direction: 'gain', icon: 'resources', amount: 1, note: 'on this card'},
        {direction: 'cost', icon: 'data', amount: 1, note: 'on this card'},
        {direction: 'gain', icon: 'microbe', amount: 1, current: 1, resulting: 2, note: 'on this card'},
      ]});
      expect(playCardReactions([mixed]).map((r) => r.spec)).to.deep.eq([
        {channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: CardName.VECTOR_COMPUTATIONS},
      ]);
    });

    it('keeps the forecast\'s order (the server\'s reactor order) and tolerates no forecast at all', () => {
      const second = fact({id: 'blue-Decomposers-2', source: {kind: 'card', name: CardName.DECOMPOSERS, owner: 'blue' as Color, channel: 'card-played'}, reasonTag: undefined,
        effects: [{direction: 'gain', icon: 'microbe', amount: 1, current: 0, resulting: 1, note: 'on this card'}]});
      expect(playCardReactions([fact({}), second]).map((r) => r.spec.targetCard)).to.deep.eq([CardName.VECTOR_COMPUTATIONS, CardName.DECOMPOSERS]);
      expect(playCardReactions(undefined)).to.deep.eq([]);
    });
  });
});
