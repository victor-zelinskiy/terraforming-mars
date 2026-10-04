import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {TileType} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {ColonyName} from '@/common/colonies/ColonyName';
import {buildEventChildren, impactChips, JournalImpactChip, parliamentSourceLabel} from '@/client/components/journal/journalEventChild';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';

function ev(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number}): GameEvent {
  return {generation: 1, phase: Phase.ACTION, visibility: 'analytics', impact: {}, ...partial} as GameEvent;
}

describe('journal event-driven children', () => {
  it('labels a space-bonus gain as "Cell bonus" with the resource impact', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'spaceBonus'}, player: 'red', impact: {stock: {plants: 2}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Cell bonus'});
    expect(rows[0].player).to.be.undefined; // same as root actor → no recipient chip
    expect(rows[0].chips[0]).to.deep.include({icon: 'plants', text: '+2'});
  });

  it('labels ocean-adjacency M€ as "Ocean bonus"', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'oceanBonus'}, player: 'red', impact: {stock: {megacredits: 2}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Ocean bonus'});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '+2'});
  });

  it('folds an effect-trigger marker + its impact into one source → impact row (Pets)', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'effect-triggered', source: {kind: 'card', card: CardName.PETS}, player: 'blue', correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'card-resource-changed', source: {kind: 'card', card: CardName.PETS}, player: 'blue', impact: {cardResources: [{cardResource: CardResource.ANIMAL, target: CardName.PETS, amount: 1}]}, correlationId: 1, parentId: 2}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].source).to.deep.eq({kind: 'card', card: CardName.PETS});
    expect(rows[0].player).to.eq('blue'); // opponent's effect → recipient shown
    expect(rows[0].chips[0]).to.deep.include({icon: CardResource.ANIMAL, text: '+1'});
  });

  it('a payout a RULE counted (TR21: «for 3 adjacent cities») keeps its reason and its card on a row of its own', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.ARBORETUM}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'card-resource-changed', source: {kind: 'card', card: CardName.ARBORETUM}, player: 'red', correlationId: 1, parentId: 1,
        impact: {cardResources: [{cardResource: CardResource.DATA, target: CardName.VECTOR_COMPUTATIONS, amount: 3, basis: {count: 3, unitKey: 'adjacent {city|cities}'}}]}}),
      // An ordinary addition of the same card's source stays its own, merged row.
      ev({id: 3, type: 'card-resource-changed', source: {kind: 'card', card: CardName.ARBORETUM}, player: 'red', correlationId: 1, parentId: 1,
        impact: {cardResources: [{cardResource: CardResource.DATA, target: CardName.VECTOR_COMPUTATIONS, amount: 1}]}}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    const counted = rows.find((r) => r.basis !== undefined);
    expect(counted?.basis).to.deep.eq({count: 3, unitKey: 'adjacent {city|cities}', onCard: CardName.VECTOR_COMPUTATIONS});
    expect(counted?.chips).to.deep.eq([{icon: CardResource.DATA, text: '+3'}]);
    expect(rows.filter((r) => r.basis === undefined && r.chips.some((c) => c.text === '+1'))).to.have.length(1);
  });

  it('renders a tile placement with its space + tile label', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'tile-placed', player: 'red', impact: {tilesPlaced: 1}, space: '03', tile: TileType.CITY, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].space).to.eq('03');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Placement'});
    expect(rows[0].tileLabel).to.be.a('string');
  });

  it('shows the action card itself as the source of its own result', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.MEDIA_GROUP}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'card', card: CardName.MEDIA_GROUP}, player: 'red', impact: {stock: {megacredits: 3}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'card', card: CardName.MEDIA_GROUP});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '+3'});
  });

  it('labels a payment-sourced spend as "Payment"', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {megacredits: -25}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Payment'});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '−25'});
  });

  it('labels a colony trade fee, reward and owner bonus DISTINCTLY, GAINS before the fee', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'colony', name: ColonyName.EUROPA}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {energy: -3}}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'resource-changed', source: {kind: 'colony', name: ColonyName.EUROPA, benefit: 'trade'}, player: 'red', impact: {stock: {plants: 1}}, correlationId: 1, parentId: 1}),
      ev({id: 4, type: 'resource-changed', source: {kind: 'colony', name: ColonyName.EUROPA, benefit: 'colonyBonus'}, player: 'red', impact: {stock: {megacredits: 1}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    // Gains (trade income, colony bonus) come FIRST; the energy fee is shown last.
    expect(rows.map((r) => r.source)).to.deep.eq([
      {kind: 'label', label: 'Trade income'},
      {kind: 'label', label: 'Colony bonus'},
      {kind: 'label', label: 'Payment'},
    ]);
  });

  it('orders rows GAINS-first: own card result → indirect gain → payment', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.MEDIA_GROUP}, player: 'red', correlationId: 1}),
      // Chronologically the payment fires first, then a bonus, then the card result —
      // but the display must reorder them by gain priority.
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {megacredits: -6}}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'resource-changed', source: {kind: 'spaceBonus'}, player: 'red', impact: {stock: {plants: 1}}, correlationId: 1, parentId: 1}),
      ev({id: 4, type: 'resource-changed', source: {kind: 'card', card: CardName.MEDIA_GROUP}, player: 'red', impact: {stock: {megacredits: 3}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.map((r) => r.source)).to.deep.eq([
      {kind: 'card', card: CardName.MEDIA_GROUP}, // the card's OWN result first
      {kind: 'label', label: 'Cell bonus'}, // then the indirect gain
      {kind: 'label', label: 'Payment'}, // the cost last
    ]);
  });

  it('shows the colony NAME for a card-built colony bonus (group header is the card)', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.MEDIA_GROUP}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'production-changed', source: {kind: 'colony', name: ColonyName.LUNA, benefit: 'build'}, player: 'red', impact: {production: {megacredits: 2}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: ColonyName.LUNA});
  });

  it('BUNDLES a multi-resource payment into ONE "Payment" row', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.METHANE_FROM_TITAN}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {megacredits: -1}}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {titanium: -9}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Payment'});
    expect(rows[0].chips.map((c) => c.text)).to.deep.eq(['−1', '−9']);
    expect(rows[0].chips.map((c) => c.icon)).to.deep.eq(['megacredits', 'titanium']);
  });

  it('MERGES one card\'s multiple production gains into ONE source row', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.METHANE_FROM_TITAN}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'production-changed', source: {kind: 'card', card: CardName.METHANE_FROM_TITAN}, player: 'red', impact: {production: {plants: 2}}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'production-changed', source: {kind: 'card', card: CardName.METHANE_FROM_TITAN}, player: 'red', impact: {production: {heat: 2}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].source).to.deep.eq({kind: 'card', card: CardName.METHANE_FROM_TITAN});
    expect(rows[0].chips).to.have.length(2);
    expect(rows[0].chips.every((c) => c.production === true)).to.be.true;
  });

  it('does NOT merge different recipients, nor different buckets (City SP)', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'tile-placed', player: 'red', impact: {tilesPlaced: 1}, space: '03', tile: TileType.CITY, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'resource-changed', source: {kind: 'spaceBonus'}, player: 'red', impact: {stock: {plants: 2}}, correlationId: 1, parentId: 1}),
      ev({id: 4, type: 'resource-changed', source: {kind: 'oceanBonus'}, player: 'red', impact: {stock: {megacredits: 2}}, correlationId: 1, parentId: 1}),
      ev({id: 5, type: 'effect-triggered', source: {kind: 'card', card: CardName.PETS}, player: 'blue', correlationId: 1, parentId: 1}),
      ev({id: 6, type: 'card-resource-changed', source: {kind: 'card', card: CardName.PETS}, player: 'blue', impact: {cardResources: [{cardResource: CardResource.ANIMAL, target: CardName.PETS, amount: 1}]}, correlationId: 1, parentId: 5}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    // placement, cell bonus, ocean bonus, Victor's Pets — FOUR distinct rows.
    expect(rows.length).to.eq(4);
    expect(rows.map((r) => r.source)).to.deep.eq([
      {kind: 'label', label: 'Placement'},
      {kind: 'label', label: 'Cell bonus'},
      {kind: 'label', label: 'Ocean bonus'},
      {kind: 'card', card: CardName.PETS},
    ]);
    expect(rows[3].player).to.eq('blue'); // Victor — recipient shown, NOT merged into red's rows
  });

  it('impactChips renders discounts and production deltas', () => {
    const discount: ReadonlyArray<JournalImpactChip> = impactChips({megacreditsSaved: 2});
    expect(discount[0]).to.deep.include({icon: 'megacredits', text: '−2'});
    const prod = impactChips({production: {energy: 1}});
    expect(prod[0]).to.deep.include({icon: 'energy', text: '+1', production: true});
  });

  it('a DISCOUNT of an enacted RESOLUTION (Turmoil Redux) is a discount row labelled by the law\'s printed name — never a bare id', () => {
    const law = allResolutions().find((r) => r.copies > 0);
    if (law === undefined) {
      throw new Error('the catalog ships no dealt resolution');
    }
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.MINE, owner: 'red'}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'discount-applied', source: {kind: 'resolution', id: law.id, owner: 'red'}, player: 'red', target: {card: CardName.MINE},
        impact: {megacreditsSaved: 3}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].bucket).to.eq('discount');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: law.text.name});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '−3', saved: true});
  });

  it('the greenery revision\'s TR (Turmoil Redux) is a row named «Greenery tile» — the institution speaks only for a rule with no name of its own', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CONVERT_PLANTS}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'tr-changed', source: {kind: 'parliament', rule: 'greenery-tile'}, player: 'red', impact: {tr: 1}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'tr-changed', source: {kind: 'parliament'}, player: 'red', impact: {tr: 1}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.map((r) => r.source), 'two sources, never merged into one «parliament» row').to.deep.eq([
      {kind: 'label', label: 'Greenery tile'},
      {kind: 'label', label: 'Mars Parliament'},
    ]);
    expect(rows[0].chips[0]).to.deep.include({icon: 'tr', text: '+1'});
    expect(parliamentSourceLabel({kind: 'parliament', rule: 'greenery-tile'})).to.eq('Greenery tile');
    expect(parliamentSourceLabel({kind: 'parliament'})).to.eq('Mars Parliament');
  });

  describe('a SKIPPED effect (`effect-skipped`) — named, last, never summed', () => {
    const PLAY = ev({id: 1, type: 'action', source: {kind: 'card', card: CardName.SUPREME_EXPERTISE}, player: 'red', correlationId: 1});

    it('reads LAST, whenever it was recorded — the closing note of the play', () => {
      const events: Array<GameEvent> = [
        PLAY,
        ev({id: 4, type: 'effect-skipped', source: {kind: 'card', card: CardName.SUPREME_EXPERTISE}, player: 'red', visibility: 'journal', correlationId: 1, parentId: 1,
          impact: {skipped: {label: 'Add resources to a card', reason: 'No eligible card', effect: {direction: 'gain', icon: 'data', amount: 4, note: 'to a card'}}}}),
        ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {megacredits: -12}}, correlationId: 1, parentId: 1}),
        ev({id: 3, type: 'resource-changed', source: {kind: 'spaceBonus'}, player: 'red', impact: {stock: {plants: 2}}, correlationId: 1, parentId: 1}),
      ];
      const rows = buildEventChildren(events, 1, 'red');
      // Recorded FIRST, read LAST: after the gain, after the cost.
      expect(rows.map((r) => r.bucket)).to.deep.eq(['spaceBonus', 'payment', 'skipped']);
      expect(rows.flatMap((r) => r.chips).some((c) => c.icon === 'data'), 'the lost «+4» is never a chip').to.eq(false);
    });

    it('is its own row: the source, the label, the cause and the lost magnitude beside — never in — the chips', () => {
      const events: Array<GameEvent> = [
        PLAY,
        ev({id: 3, type: 'effect-skipped', source: {kind: 'card', card: CardName.SUPREME_EXPERTISE}, player: 'red', visibility: 'journal', correlationId: 1, parentId: 1,
          impact: {skipped: {label: 'Add resources to a card', reason: 'No eligible card', effect: {direction: 'gain', icon: 'data', amount: 4, note: 'to a card'}}}}),
      ];
      const rows = buildEventChildren(events, 1, 'red');
      const skip = rows.find((r) => r.bucket === 'skipped');
      expect(skip).to.deep.eq({
        source: {kind: 'card', card: CardName.SUPREME_EXPERTISE},
        player: undefined,
        bucket: 'skipped',
        chips: [],
        skipped: {label: 'Add resources to a card', reason: 'No eligible card', chip: {icon: 'data', text: '+4'}},
      });
    });

    it('a production attack keeps its production frame and its minus; an either/or effect has no chip', () => {
      const events: Array<GameEvent> = [
        PLAY,
        ev({id: 2, type: 'effect-skipped', player: 'red', correlationId: 1, parentId: 1,
          impact: {skipped: {label: 'Reduce another player\'s production', reason: 'No valid target available', effect: {direction: 'cost', icon: 'heat', amount: 2, note: 'production'}}}}),
        ev({id: 3, type: 'effect-skipped', player: 'red', correlationId: 1, parentId: 1,
          impact: {skipped: {label: 'Steal resources from another player', reason: 'No valid target available'}}}),
      ];
      const rows = buildEventChildren(events, 1, 'red');
      expect(rows.map((r) => r.skipped)).to.deep.eq([
        {label: 'Reduce another player\'s production', reason: 'No valid target available', chip: {icon: 'heat', text: '−2', production: true}},
        {label: 'Steal resources from another player', reason: 'No valid target available'},
      ]);
    });

    it('two lost effects are two rows, and another player\'s lost effect carries its owner', () => {
      const lost = (id: number, player: 'red' | 'blue') => ev({id, type: 'effect-skipped', source: {kind: 'colony', name: ColonyName.TITAN, benefit: 'colonyBonus'}, player, correlationId: 1, parentId: 1,
        impact: {skipped: {label: 'Add resources to a card', reason: 'No eligible card', effect: {direction: 'gain', icon: 'floater', amount: 1, note: 'to a card'}}}});
      const rows = buildEventChildren([PLAY, lost(2, 'red'), lost(3, 'blue')], 1, 'red');
      expect(rows).to.have.lengthOf(2);
      expect(rows.map((r) => r.player)).to.deep.eq([undefined, 'blue']);
    });
  });
});
