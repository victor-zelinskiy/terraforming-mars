import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {
  mergeTransferSpecs, transferWaveDelayMs, transferArcPlan, transferArcPoint, transferArcTop, transferCeilingFor, transferCeilingY,
  transferChipScaleAt, sourceSpawnPoint, cardResourceKey, extractPlayRewards,
  clampTransferPace, ResourceTransferSpec, TRANSFER_CONCURRENT_PACE, transferLaunchFor, transferSideArcPlan,
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

  it('the concurrent pace is a mild quickening, and stray values are clamped sane', () => {
    // The card-concurrency tempo: brisker, never a different animation.
    expect(TRANSFER_CONCURRENT_PACE).to.be.greaterThan(0.7).and.lessThan(1);
    expect(clampTransferPace(undefined)).to.eq(1);
    expect(clampTransferPace(TRANSFER_CONCURRENT_PACE)).to.eq(TRANSFER_CONCURRENT_PACE);
    // A pace can quicken, never freeze or teleport the wave.
    expect(clampTransferPace(0)).to.eq(0.5);
    expect(clampTransferPace(3)).to.eq(1);
    expect(clampTransferPace(Number.NaN)).to.eq(1);
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

  /*
   * A DEPARTURE FROM A RAIL ROW LEAVES SIDEWAYS (PL-104, the TR35 walk). The rail is a column of counters; a price
   * paid off it (PL-099's class) used the reward's toss and climbed over the rows above its own — TR35's titanium
   * token (the 3rd row, 1080: the digits ≈ 130,259 → the printed titanium icon ≈ 463,664) crossed the steel row and
   * topped out on the M€ plate before falling to the card.
   */
  describe('the side launch — a price leaving the rail never crosses another counter', () => {
    const row = {x: 130, y: 259};
    const icon = {x: 463, y: 664};
    const samples = (plan: ReturnType<typeof transferArcPlan>) => Array.from({length: 41}, (_, i) => transferArcPoint(plan, i / 40));

    it('the toss from that row DID climb over the rows above it (the defect, pinned)', () => {
      expect(transferArcTop(transferArcPlan(row, icon)), 'the apex stood ~100 px over its own row — the M€ plate').to.be.lessThan(row.y - 60);
    });

    it('the side arc starts on the row, ends on the icon, never rises above its row and leaves it HORIZONTALLY', () => {
      const plan = transferArcPlan(row, icon, 0, undefined, 'side');
      expect(plan).to.deep.eq(transferSideArcPlan(row, icon));
      expect(transferArcPoint(plan, 0)).to.deep.eq(row);
      expect(transferArcPoint(plan, 1)).to.deep.eq(icon);
      const points = samples(plan);
      expect(Math.min(...points.map((p) => p.y)), 'never above its own row').to.be.gte(row.y - 1e-9);
      points.slice(1).forEach((p, i) => expect(p.x, 'x only moves toward the target').to.be.gte(points[i].x));
      // Clear of a 70 px column while still inside its own row's band (a rail row is ~55 px tall at 1080).
      const out = points.find((p) => p.x >= row.x + 70);
      expect(out, 'the chip clears the column').to.not.eq(undefined);
      expect(out!.y - row.y, `…still within its own row when it does (${JSON.stringify(out)})`).to.be.lessThan(20);
    });

    it('a target ABOVE the row: the arc stays between the two heights (no overshoot either way)', () => {
      const up = {x: 900, y: 120};
      const points = samples(transferArcPlan(row, up, 0, undefined, 'side'));
      points.forEach((p) => expect(p.y).to.be.within(up.y - 1e-9, row.y + 1e-9));
    });

    it('which flights take it: a LOSS leaving a stock / production row with no run-level destination — nothing else', () => {
      expect(transferLaunchFor({channel: 'stock', direction: 'loss'}, false)).eq('side');
      expect(transferLaunchFor({channel: 'production', direction: 'loss'}, false)).eq('side');
      expect(transferLaunchFor({channel: 'stock', direction: 'gain'}, false), 'every gain keeps the toss').eq('toss');
      expect(transferLaunchFor({channel: 'stock'}, false), 'absent direction = gain').eq('toss');
      expect(transferLaunchFor({channel: 'card-resource', direction: 'loss'}, false), 'a spend off a card\'s face is not a rail row').eq('toss');
      expect(transferLaunchFor({channel: 'stock', direction: 'loss'}, true), 'a run-level destination stands in for the row').eq('toss');
    });
  });

  /*
   * THE CHIP STAYS ON SCREEN (docs/claude/gameplay-polish-ledger.md PL-012). A toss lifted over the higher endpoint
   * keeps rising past it, so every flight into the rail's top rows from lower on the screen left the viewport and
   * came back down onto its row — the reward was nowhere for a quarter of a second.
   */
  describe('the ceiling — an arc never leaves the screen', () => {
    const CEILING = 34; // a 48 px chip's bloomed half + air, as the director passes it
    // Where rewards are born (a card's printed icon, a colony stage's cell, a board hex) × the rail's rows, at 1080 logical.
    const SOURCES = [{x: 508, y: 765}, {x: 900, y: 600}, {x: 1500, y: 300}, {x: 700, y: 500}, {x: 960, y: 980}, {x: 300, y: 200}];
    const ROWS = [{x: 88, y: 88}, {x: 110, y: 150}, {x: 110, y: 205}, {x: 110, y: 425}];

    it('without a ceiling the toss into the top rows DID leave the screen (the defect, pinned)', () => {
      expect(transferArcTop(transferArcPlan({x: 508, y: 765}, {x: 88, y: 88}, -0.18))).to.be.lessThan(-60);
      expect(transferArcTop(transferArcPlan({x: 900, y: 600}, {x: 110, y: 150}))).to.be.lessThan(0);
    });

    it('with it, no arc of the sweep rises above the line — for every lift bias of a wave', () => {
      for (const from of SOURCES) {
        for (const to of ROWS) {
          for (const bias of [-0.18, 0, 0.18]) {
            const plan = transferArcPlan(from, to, bias, CEILING);
            expect(transferArcTop(plan), `${JSON.stringify(from)} → ${JSON.stringify(to)} bias ${bias}`).to.be.at.least(CEILING - 0.001);
            // …sampled too, so the closed form and the curve agree.
            for (let t = 0; t <= 1.0001; t += 0.02) {
              expect(transferArcPoint(plan, Math.min(1, t)).y).to.be.at.least(CEILING - 0.001);
            }
          }
        }
      }
    });

    it('an arc that already stays inside is byte for byte the one it always was', () => {
      // Low rows, short hops, a toss across the middle of the screen.
      for (const [from, to] of [[{x: 700, y: 900}, {x: 110, y: 425}], [{x: 300, y: 700}, {x: 110, y: 620}], [{x: 900, y: 800}, {x: 600, y: 760}]] as const) {
        expect(transferArcPlan(from, to, 0, CEILING)).to.deep.eq(transferArcPlan(from, to, 0));
      }
    });

    it('a flattened arc is still a TOSS: it starts at the source, ends on the row and passes above the straight line', () => {
      const from = {x: 508, y: 765};
      const to = {x: 88, y: 88};
      const plan = transferArcPlan(from, to, -0.18, CEILING);
      expect(transferArcPoint(plan, 0)).to.deep.eq(from);
      expect(transferArcPoint(plan, 1)).to.deep.eq(to);
      expect(transferArcPoint(plan, 0.5).y).to.be.lessThan((from.y + to.y) / 2);
      expect(transferArcTop(plan)).to.be.closeTo(CEILING, 0.001);
    });

    it('an endpoint already above the line cannot be helped — the plan is the unclamped one', () => {
      const from = {x: 700, y: 500};
      const to = {x: 120, y: 20};
      expect(transferArcPlan(from, to, 0, CEILING)).to.deep.eq(transferArcPlan(from, to, 0));
    });

    // WHICH line: the flight layer paints UNDER the cockpit's rails, so the line is the top rail's lower edge.
    it('both ends below the top rail: the ceiling is the rail\'s lower edge + the chip\'s bloomed half + air', () => {
      expect(transferCeilingY(48, 1, 42)).to.be.closeTo(42 + 27.36 + 6, 0.001);
      expect(transferCeilingFor({x: 508, y: 765}, {x: 88, y: 88}, 48, 1, 42)).to.eq(transferCeilingY(48, 1, 42));
    });

    it('a row tucked right under the rail: the top of the screen is the line — the toss must still reach it', () => {
      expect(transferCeilingFor({x: 508, y: 765}, {x: 88, y: 60}, 48, 1, 42)).to.eq(transferCeilingY(48, 1, 0));
    });

    it('an endpoint above every line: no ceiling at all', () => {
      expect(transferCeilingFor({x: 508, y: 765}, {x: 88, y: 10}, 48, 1, 42)).is.undefined;
    });

    it('the line scales with the profile (a 4K chip is twice the chip, its rail twice the rail)', () => {
      expect(transferCeilingY(96, 2, 84)).to.be.closeTo(84 + 54.72 + 12, 0.001);
    });

    it('the liner\'s own flight (the printed TR icon → the rating cell, 1080): the token stays under the rail', () => {
      const from = {x: 508, y: 765};
      const to = {x: 88, y: 88};
      const ceiling = transferCeilingFor(from, to, 48, 1, 42)!;
      const plan = transferArcPlan(from, to, -0.18, ceiling);
      // The chip's TOP edge at its largest never crosses the rail's lower edge.
      expect(transferArcTop(plan) - 48 * 0.5 * 1.14).to.be.at.least(42);
    });
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

    it('a BESPOKE card-target step flies even with NO gain chip behind it', () => {
      // Freyja Biodomes: the server states the move as the STEP (`selectCardStep`
      // with an amount) and emits no `'to a card'` chip, so the chip loop found
      // nothing and the resources landed with no flight at all. The resource is
      // the PICKED card's own type — microbe or animal depending on the choice,
      // which is exactly why no single icon could be stated up front.
      const steps: Array<ActionPreviewStep> = [{
        kind: 'input',
        amount: 2,
        input: {cards: [
          {name: CardName.VENUSIAN_INSECTS, resourceType: 'microbe'},
          {name: CardName.BIRDS, resourceType: 'animal'},
        ]} as never,
      }];
      const specs = extractPlayRewards({
        cardName: CardName.FREYJA_BIODOMES,
        effects: [gain('megacredits', 2, 'production')],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.VENUSIAN_INSECTS]}},
      });
      expect(specs).to.deep.eq([
        {channel: 'production', resource: 'megacredits', amount: 2},
        {channel: 'card-resource', resource: 'microbe', amount: 2, targetCard: CardName.VENUSIAN_INSECTS},
      ]);
    });

    it('the same step picking an ANIMAL card carries the animal, not a fixed icon', () => {
      const steps: Array<ActionPreviewStep> = [{
        kind: 'input',
        amount: 2,
        input: {cards: [
          {name: CardName.VENUSIAN_INSECTS, resourceType: 'microbe'},
          {name: CardName.BIRDS, resourceType: 'animal'},
        ]} as never,
      }];
      const specs = extractPlayRewards({
        cardName: CardName.FREYJA_BIODOMES,
        effects: [],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.BIRDS]}},
      });
      expect(specs).to.deep.eq([
        {channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS},
      ]);
    });

    it('a REPEAT-ACTION pick never flies — its candidates are actions, not targets', () => {
      const steps: Array<ActionPreviewStep> = [{
        kind: 'input',
        amount: 2,
        repeatAction: true,
        input: {cards: [{name: CardName.BIRDS, resourceType: 'animal'}]} as never,
      }];
      expect(extractPlayRewards({
        cardName: CardName.PROJECT_INSPECTION,
        effects: [],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.BIRDS]}},
      })).to.deep.eq([]);
    });

    it('a REMOVE pick (negative amount) is never a reward', () => {
      const steps: Array<ActionPreviewStep> = [{
        kind: 'input',
        amount: -2,
        input: {cards: [{name: CardName.BIRDS, resourceType: 'animal'}]} as never,
      }];
      expect(extractPlayRewards({
        cardName: CardName.PREDATORS,
        effects: [],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.BIRDS]}},
      })).to.deep.eq([]);
    });

    it('a chip-claimed step is not double-counted by the bespoke pass', () => {
      const steps: Array<ActionPreviewStep> = [
        {kind: 'input', input: {cards: [{name: CardName.TARDIGRADES, resourceType: 'microbe'}]} as never,
          amount: 3, cardResource: 'microbe'},
      ];
      const specs = extractPlayRewards({
        cardName: CardName.IMPORTED_NITROGEN,
        effects: [gain('microbe', 3, 'to a card')],
        steps,
        stepResponses: {0: {type: 'card', cards: [CardName.TARDIGRADES]}},
      });
      expect(specs).to.deep.eq([
        {channel: 'card-resource', resource: 'microbe', amount: 3, targetCard: CardName.TARDIGRADES},
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

    /*
     * The gain the player CHOSE — an OR step («получите любой стандартный
     * ресурс»). The branch's own chips cannot state it (the resource does not
     * exist at preview time), so the CHOSEN option's server-built
     * `OptionMetadata.effects` are the authoritative amount. Without this the
     * rail counters ticked with nothing flying to them.
     */
    describe('an OR step\'s chosen option', () => {
      const orStep = {
        kind: 'input' as const,
        input: {
          type: 'or',
          title: 'Gain a standard resource',
          buttonLabel: 'Gain',
          options: [
            {type: 'option', title: 'Gain 1 titanium', buttonLabel: 'Gain titanium',
              metadata: {kind: 'resourceGain', icon: 'titanium', amount: 1,
                effects: [{direction: 'gain', icon: 'titanium', amount: 1, current: 2, resulting: 3}]}},
            {type: 'option', title: 'Gain 1 energy production', buttonLabel: 'Gain',
              metadata: {kind: 'resourceGain', icon: 'energy', amount: 1,
                effects: [{direction: 'gain', icon: 'energy', amount: 1, note: 'production'}]}},
            {type: 'option', title: 'Raise Venus', buttonLabel: 'Raise',
              metadata: {kind: 'globalParameter', icon: 'venus', amount: 1,
                effects: [{direction: 'gain', icon: 'venus', amount: 1, unit: '%'}]}},
          ],
        },
      } as never;
      const extract = (response: unknown) => extractPlayRewards({
        cardName: CardName.ASTRODRILL, effects: [], steps: [orStep], stepResponses: {0: response},
      });

      it('flies the picked resource into STOCK', () => {
        expect(extract({type: 'or', index: 0, response: {type: 'option'}}))
          .to.deep.eq([{channel: 'stock', resource: 'titanium', amount: 1}]);
      });

      it('honours the option\'s own channel — a production note lands on production', () => {
        expect(extract({type: 'or', index: 1, response: {type: 'option'}}))
          .to.deep.eq([{channel: 'production', resource: 'energy', amount: 1}]);
      });

      it('a global-parameter option never flies (the HUD scale owns it)', () => {
        expect(extract({type: 'or', index: 2, response: {type: 'option'}})).to.deep.eq([]);
      });

      it('an UNANSWERED step carries nothing — never a guessed default', () => {
        expect(extract(undefined)).to.deep.eq([]);
      });
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
