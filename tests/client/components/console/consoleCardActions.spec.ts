import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {ActionPreview, ActionEffect} from '@/common/models/ActionPreviewModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {CardResource} from '@/common/CardResource';
import {
  buildConsoleActionsModel,
  cycleAvailability,
  cycleActivation,
  defaultCardActionsFilter,
} from '@/client/console/consoleCardActions';

function effect(direction: 'cost' | 'gain', icon: string, amount: number): ActionEffect {
  return {direction, icon, amount};
}

function node(cardName: string, i: number, text: string) {
  return {key: cardName + '#' + i, actionNode: undefined, renderRoot: undefined, text};
}

function entry(
  cardName: string,
  status: ActionStatus,
  nodeTexts: ReadonlyArray<string>,
  opts?: {reasons?: ReadonlyArray<UnplayableReason>, softReason?: UnplayableReason},
): ActionEntry {
  return {
    group: {
      key: cardName,
      cardName: cardName as CardName,
      isCorporation: false,
      isDisabled: false,
      nodes: nodeTexts.map((t, i) => node(cardName, i, t)),
    },
    cardName: cardName as CardName,
    isCorporation: false,
    state: {
      status,
      activatable: status === 'available',
      reasons: opts?.reasons ?? [],
      softReason: opts?.softReason,
    },
  };
}

function preview(cardName: string, branches: ActionPreview['branches']): ActionPreview {
  return {card: cardName as CardName, isCorporation: false, kind: 'declarative', branches};
}

const NO_PREVIEWS = new Map<CardName, ActionPreview>();
const NO_RESOURCES = new Map<CardName, {type: CardResource, count: number}>();

describe('consoleCardActions model', () => {
  it('builds one available tile for a single-branch action', () => {
    const entries = [entry('Solo', 'available', ['use'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Solo' as CardName, preview('Solo', [
        {index: -1, title: 'use', available: true, renderKeys: [], effects: [effect('gain', 'megacredits', 3)], steps: []},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    expect(model.groups).to.have.length(1);
    expect(model.groups[0].tiles).to.have.length(1);
    const tile = model.groups[0].tiles[0];
    expect(tile.status).to.eq('available');
    expect(tile.gainEffects).to.have.length(1);
    expect(model.totalTiles).to.eq(1);
    expect(model.availableTiles).to.eq(1);
  });

  it('refines a multi-branch card per VARIANT: one available, one blocked', () => {
    const entries = [entry('Catapult', 'available', ['plants', 'steel'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Catapult' as CardName, preview('Catapult', [
        {index: 0, title: 'plants', available: true, renderKeys: [],
          effects: [effect('cost', 'plants', 1), effect('gain', 'megacredits', 7)], steps: []},
        {index: 1, title: 'steel', available: false, unavailableReason: 'Not enough steel', renderKeys: [],
          effects: [effect('cost', 'steel', 1), effect('gain', 'megacredits', 7)], steps: []},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    // Both variants shown under the group; the card itself is "available".
    expect(model.groups).to.have.length(1);
    expect(model.groups[0].status).to.eq('available');
    const [t0, t1] = model.groups[0].tiles;
    expect(t0.status).to.eq('available');
    expect(t0.costEffects.map((e) => e.icon)).to.deep.eq(['plants']);
    expect(t1.status).to.eq('rules');
    expect(t1.reason?.message).to.eq('Not enough steel');
    // Counts are BY VARIANT: 2 total, 1 available, 1 unavailable.
    const avail = model.availabilityChips;
    expect(avail.find((c) => c.value === 'all')?.count).to.eq(2);
    expect(avail.find((c) => c.value === 'available')?.count).to.eq(1);
    expect(avail.find((c) => c.value === 'unavailable')?.count).to.eq(1);
    expect(model.availableTiles).to.eq(1);
  });

  it('the availability filter narrows a group to its matching variant(s)', () => {
    const entries = [entry('Catapult', 'available', ['plants', 'steel'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Catapult' as CardName, preview('Catapult', [
        {index: 0, title: 'plants', available: true, renderKeys: [], effects: [], steps: []},
        {index: 1, title: 'steel', available: false, unavailableReason: 'x', renderKeys: [], effects: [], steps: []},
      ])],
    ]);
    const onlyAvail = buildConsoleActionsModel(entries, previews, NO_RESOURCES, {availability: 'available', activation: 'all'});
    expect(onlyAvail.groups).to.have.length(1);
    expect(onlyAvail.groups[0].tiles).to.have.length(1);
    expect(onlyAvail.groups[0].tiles[0].status).to.eq('available');

    const onlyUnavail = buildConsoleActionsModel(entries, previews, NO_RESOURCES, {availability: 'unavailable', activation: 'all'});
    expect(onlyUnavail.groups[0].tiles).to.have.length(1);
    expect(onlyUnavail.groups[0].tiles[0].status).to.eq('rules');
  });

  it('hides activated actions by default and shows them under the activation filter', () => {
    const entries = [
      entry('Fresh', 'available', ['use']),
      entry('Used', 'activated', ['use'], {softReason: {type: 'rule', message: 'used'}}),
    ];
    const dormant = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, defaultCardActionsFilter());
    expect(dormant.groups.map((g) => g.cardName)).to.deep.eq(['Fresh']);
    // Both dimensions are counted by variant, own-dimension excluded.
    expect(dormant.activationChips.find((c) => c.value === 'activated')?.count).to.eq(1);

    const activated = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'activated'});
    expect(activated.groups.map((g) => g.cardName)).to.deep.eq(['Used']);
  });

  it('sorts available groups before blocked groups (stable within a band)', () => {
    const entries = [
      entry('Blocked', 'rules', ['use'], {reasons: [{type: 'rule', message: 'no'}]}),
      entry('Ready', 'available', ['use']),
    ];
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'all'});
    expect(model.groups.map((g) => g.cardName)).to.deep.eq(['Ready', 'Blocked']);
  });

  it('carries the stored card-resource count onto the group', () => {
    const entries = [entry('Bacteria', 'available', ['add'])];
    const resources = new Map<CardName, {type: CardResource, count: number}>([
      ['Bacteria' as CardName, {type: 'Microbe' as CardResource, count: 3}],
    ]);
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, resources, defaultCardActionsFilter());
    expect(model.groups[0].cardResource).to.deep.eq({type: 'Microbe', count: 3});
  });

  it('produces a flat focus order over the visible tiles', () => {
    const entries = [entry('A', 'available', ['x', 'y']), entry('B', 'available', ['z'])];
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, defaultCardActionsFilter());
    expect(model.flatKeys).to.deep.eq(['A#0', 'A#1', 'B#0']);
  });

  it('cycles the two filter dimensions', () => {
    expect(cycleAvailability('all', 1)).to.eq('available');
    expect(cycleAvailability('all', -1)).to.eq('unavailable');
    expect(cycleActivation('dormant', 1)).to.eq('activated');
    expect(cycleActivation('dormant', -1)).to.eq('all');
  });
});
