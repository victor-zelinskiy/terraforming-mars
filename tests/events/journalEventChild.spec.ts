import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {TileType} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {ColonyName} from '@/common/colonies/ColonyName';
import {buildEventChildren, impactChips, JournalImpactChip} from '@/client/components/journal/journalEventChild';

function ev(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number}): GameEvent {
  return {generation: 1, phase: Phase.ACTION, visibility: 'analytics', impact: {}, ...partial} as GameEvent;
}

describe('journal event-driven children', () => {
  it('labels a space-bonus gain as "Cell bonus" with the resource impact', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
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
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'oceanBonus'}, player: 'red', impact: {stock: {megacredits: 2}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Ocean bonus'});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '+2'});
  });

  it('folds an effect-trigger marker + its impact into one source → impact row (Pets)', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'effect-triggered', source: {kind: 'card', card: CardName.PETS}, player: 'blue', correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'card-resource-changed', source: {kind: 'card', card: CardName.PETS}, player: 'blue', impact: {cardResources: [{cardResource: CardResource.ANIMAL, target: CardName.PETS, amount: 1}]}, correlationId: 1, parentId: 2}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.length).to.eq(1);
    expect(rows[0].source).to.deep.eq({kind: 'card', card: CardName.PETS});
    expect(rows[0].player).to.eq('blue'); // opponent's effect → recipient shown
    expect(rows[0].chips[0]).to.deep.include({icon: CardResource.ANIMAL, text: '+1'});
  });

  it('renders a tile placement with its space + tile label', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
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
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {megacredits: -25}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows[0].source).to.deep.eq({kind: 'label', label: 'Payment'});
    expect(rows[0].chips[0]).to.deep.include({icon: 'megacredits', text: '−25'});
  });

  it('labels a colony trade fee, reward and owner bonus DISTINCTLY (not all "Europa")', () => {
    const events: Array<GameEvent> = [
      ev({id: 1, type: 'action', source: {kind: 'colony', name: ColonyName.EUROPA}, player: 'red', correlationId: 1}),
      ev({id: 2, type: 'resource-changed', source: {kind: 'payment'}, player: 'red', impact: {stock: {energy: -3}}, correlationId: 1, parentId: 1}),
      ev({id: 3, type: 'resource-changed', source: {kind: 'colony', name: ColonyName.EUROPA, benefit: 'trade'}, player: 'red', impact: {stock: {plants: 1}}, correlationId: 1, parentId: 1}),
      ev({id: 4, type: 'resource-changed', source: {kind: 'colony', name: ColonyName.EUROPA, benefit: 'colonyBonus'}, player: 'red', impact: {stock: {megacredits: 1}}, correlationId: 1, parentId: 1}),
    ];
    const rows = buildEventChildren(events, 1, 'red');
    expect(rows.map((r) => r.source)).to.deep.eq([
      {kind: 'label', label: 'Payment'},
      {kind: 'label', label: 'Trade income'},
      {kind: 'label', label: 'Colony bonus'},
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
      ev({id: 1, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', correlationId: 1}),
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
});
