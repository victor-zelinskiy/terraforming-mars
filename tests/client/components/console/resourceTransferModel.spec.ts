import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {
  mergeTransferSpecs, transferWaveDelayMs, transferArcPlan, transferArcPoint,
  transferChipScaleAt, sourceSpawnPoint, cardResourceKey, extractPlayRewards,
  ResourceTransferSpec,
} from '@/client/console/resourceTransfer/resourceTransferModel';

describe('resourceTransferModel (pure math of the shared resource-transfer language)', () => {
  it('merges identical game changes, never different channels or targets', () => {
    const specs: Array<ResourceTransferSpec> = [
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 3},
      {channel: 'production', resource: 'megacredits', amount: 1},
      {channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: CardName.ANTS},
      {channel: 'card-resource', resource: 'microbe', amount: 2, targetCard: CardName.TARDIGRADES},
      {channel: 'stock', resource: 'heat', amount: 0},
    ];
    const merged = mergeTransferSpecs(specs);
    expect(merged).to.deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 5},
      {channel: 'production', resource: 'megacredits', amount: 1},
      {channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: CardName.ANTS},
      {channel: 'card-resource', resource: 'microbe', amount: 2, targetCard: CardName.TARDIGRADES},
    ]);
  });

  it('the wave stagger stays readable for a few chips and compresses for many', () => {
    expect(transferWaveDelayMs(0, 3)).to.eq(0);
    expect(transferWaveDelayMs(1, 3)).to.eq(110);
    // 8 rewards never stretch into a parade: the LAST launch stays ≈½ s.
    expect(transferWaveDelayMs(7, 8)).to.be.at.most(500);
    // Delays are monotone within a wave.
    for (let i = 1; i < 8; i++) {
      expect(transferWaveDelayMs(i, 8)).to.be.greaterThan(transferWaveDelayMs(i - 1, 8));
    }
  });

  it('the arc starts at the source, ends on the target, and lifts through an apex', () => {
    const from = {x: 700, y: 500};
    const to = {x: 120, y: 140};
    const plan = transferArcPlan(from, to);
    expect(transferArcPoint(plan, 0)).to.deep.eq(from);
    expect(transferArcPoint(plan, 1)).to.deep.eq(to);
    const mid = transferArcPoint(plan, 0.5);
    expect(mid.y).to.be.lessThan((from.y + to.y) / 2); // a toss, not a slide
  });

  it('the lift bias separates parallel arcs of one wave deterministically', () => {
    const from = {x: 700, y: 500};
    const to = {x: 120, y: 140};
    const a = transferArcPoint(transferArcPlan(from, to, -0.18), 0.5);
    const b = transferArcPoint(transferArcPlan(from, to, 0.18), 0.5);
    expect(Math.abs(a.y - b.y)).to.be.greaterThan(4); // visibly distinct apexes
  });

  it('the chip scale blooms for reading, then approaches under natural', () => {
    expect(transferChipScaleAt(0)).to.be.lessThan(0.6);
    expect(transferChipScaleAt(0.22)).to.be.greaterThan(1);
    expect(transferChipScaleAt(1)).to.be.closeTo(0.9, 0.001);
    for (let t = 0; t <= 1; t += 0.05) {
      expect(transferChipScaleAt(t)).to.be.within(0.4, 1.2);
    }
  });

  it('spawn points spread across the card lower band, centred and bounded', () => {
    const rect = {x: 100, y: 100, w: 200, h: 300};
    const single = sourceSpawnPoint(rect, 0, 1);
    expect(single.x).to.eq(200); // the lone reward hatches centre
    expect(single.y).to.be.greaterThan(100 + 300 * 0.5); // the mechanics band
    const first = sourceSpawnPoint(rect, 0, 3);
    const last = sourceSpawnPoint(rect, 2, 3);
    expect(first.x).to.be.lessThan(last.x); // spread, never one pixel
    expect(first.x).to.be.greaterThan(rect.x);
    expect(last.x).to.be.lessThan(rect.x + rect.w);
  });

  it('normalizes CardResource values to icon keys', () => {
    expect(cardResourceKey('Microbe')).to.eq('microbe');
    expect(cardResourceKey('Venusian habitat')).to.eq('venusian-habitat');
  });

  describe('extractPlayRewards (the played-card client)', () => {
    const gain = (icon: string, amount: number, note?: string, unit?: string): ActionEffect =>
      ({direction: 'gain', icon, amount, note, unit});

    it('carries stock + production gains, drops costs / TR / draws / global params', () => {
      const specs = extractPlayRewards({
        cardName: CardName.INSULATION,
        effects: [
          gain('megacredits', 3),
          gain('energy', 2),
          gain('energy', 1, 'production'),
          {direction: 'cost', icon: 'steel', amount: 2},
          gain('tr', 1),
          gain('cards', 2),
          gain('oxygen', 1, undefined, '%'),
        ],
        steps: [],
        stepResponses: {},
      });
      expect(specs).to.deep.eq([
        {channel: 'stock', resource: 'megacredits', amount: 3},
        {channel: 'stock', resource: 'energy', amount: 2},
        {channel: 'production', resource: 'energy', amount: 1},
      ]);
    });

    it('stock and production of the SAME resource stay two separate transfers', () => {
      const specs = extractPlayRewards({
        cardName: CardName.INSULATION,
        effects: [gain('megacredits', 3), gain('megacredits', 1, 'production')],
        steps: [],
        stepResponses: {},
      });
      expect(specs).to.have.length(2);
      expect(specs[0].channel).to.eq('stock');
      expect(specs[1].channel).to.eq('production');
    });

    it('an "on this card" gain targets the played card itself', () => {
      const specs = extractPlayRewards({
        cardName: CardName.BIRDS,
        effects: [gain('animal', 1, 'on this card')],
        steps: [],
        stepResponses: {},
      });
      expect(specs).to.deep.eq([
        {channel: 'card-resource', resource: 'animal', amount: 1, targetCard: CardName.BIRDS},
      ]);
    });

    it('a "to a card" gain lands on its PRE-SELECTED host, steps claimed in order', () => {
      const steps: Array<ActionPreviewStep> = [
        {kind: 'input', input: {} as never, amount: 3, cardResource: 'microbe'},
        {kind: 'input', input: {} as never, amount: 2, cardResource: 'animal'},
      ];
      const specs = extractPlayRewards({
        cardName: CardName.IMPORTED_NITROGEN,
        effects: [
          gain('plants', 4),
          gain('microbe', 3, 'to a card'),
          gain('animal', 2, 'to a card'),
        ],
        steps,
        stepResponses: {
          0: {type: 'card', cards: [CardName.TARDIGRADES]},
          1: {type: 'card', cards: [CardName.BIRDS]},
        },
      });
      expect(specs).to.deep.eq([
        {channel: 'stock', resource: 'plants', amount: 4},
        {channel: 'card-resource', resource: 'microbe', amount: 3, targetCard: CardName.TARDIGRADES},
        {channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS},
      ]);
    });

    it('an unanswered "to a card" pick still transfers (target undefined → satellite)', () => {
      const specs = extractPlayRewards({
        cardName: CardName.IMPORTED_NITROGEN,
        effects: [gain('microbe', 3, 'to a card')],
        steps: [{kind: 'input', input: {} as never, amount: 3, cardResource: 'microbe'}],
        stepResponses: {},
      });
      expect(specs).to.deep.eq([
        {channel: 'card-resource', resource: 'microbe', amount: 3, targetCard: undefined},
      ]);
    });

    it('a copy-production pick folds the CHOSEN card units into production transfers', () => {
      const steps: Array<ActionPreviewStep> = [{
        kind: 'input',
        input: {} as never,
        copyProductionBox: {
          [CardName.MINE]: {megacredits: 0, steel: 1, titanium: 0, plants: 0, energy: -1, heat: 2},
        },
      }];
      const specs = extractPlayRewards({
        cardName: CardName.ROBOTIC_WORKFORCE,
        effects: [],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.MINE]}},
      });
      // Positive copied units only — a negative rides the ordinary commit.
      expect(specs).to.deep.eq([
        {channel: 'production', resource: 'steel', amount: 1},
        {channel: 'production', resource: 'heat', amount: 2},
      ]);
    });

    it('a card with NO immediate resource gain extracts nothing (no empty beat)', () => {
      const specs = extractPlayRewards({
        cardName: CardName.VIRUS,
        effects: [gain('tr', 1), {direction: 'cost', icon: 'megacredits', amount: 5}],
        steps: [],
        stepResponses: {},
      });
      expect(specs).to.deep.eq([]);
    });
  });
});
