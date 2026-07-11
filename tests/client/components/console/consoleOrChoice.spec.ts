import {expect} from 'chai';
import {buildOrItems, orItemResponse, buildTabbedTargets} from '@/client/console/consoleOrChoice';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

function leaf(title: unknown, metadata?: unknown) {
  return {type: 'option', title, metadata} as unknown;
}

describe('consoleOrChoice — premium or items', () => {
  it('builds a leaf option with its steal metadata chip + player colour', () => {
    const model = {
      type: 'or',
      options: [leaf('Steal 2 steel from Bot', {kind: 'steal', icon: 'steel', amount: 2, player: {color: 'red', current: 5, resulting: 3}})],
    } as unknown as OrOptionsModel;
    const items = buildOrItems(model);
    expect(items).to.have.length(1);
    expect(items[0].optionIndex).to.eq(0);
    expect(items[0].playerColor).to.eq('red');
    expect(items[0].nested).to.eq(undefined);
    expect(items[0].chips).to.have.length(1);
    expect(items[0].chips[0]).to.include({direction: 'cost', icon: 'steel', amount: 2, current: 5, resulting: 3});
  });

  it('derives the target colour from the option TITLE player token when metadata omits it', () => {
    // The chip metadata carries icon+amount (so the "3 → 1" preview renders) but
    // NO player.color — the colour dot must still resolve from the title's PLAYER
    // token so the target colour reads at a glance (the console bug: no dot).
    const title = {message: 'Steal 2 steel from ${0}', data: [{type: LogMessageDataType.PLAYER, value: 'red'}]};
    const model = {
      type: 'or',
      options: [leaf(title, {kind: 'steal', icon: 'steel', amount: 2})],
    } as unknown as OrOptionsModel;
    const items = buildOrItems(model);
    expect(items[0].playerColor).to.eq('red');
  });

  it('prefers the explicit metadata colour over the title token', () => {
    const title = {message: 'Steal from ${0}', data: [{type: LogMessageDataType.PLAYER, value: 'red'}]};
    const model = {
      type: 'or',
      options: [leaf(title, {kind: 'steal', icon: 'steel', amount: 2, player: {color: 'blue'}})],
    } as unknown as OrOptionsModel;
    expect(buildOrItems(model)[0].playerColor).to.eq('blue');
  });

  it('marks a NESTED-input option (a SelectPlayer sitting in the or) as nested', () => {
    const nestedPlayer = {type: 'player', title: 'Remove 3 M€ from a player', players: ['red', 'blue']};
    const model = {
      type: 'or',
      options: [nestedPlayer, leaf('Do not remove M€', {kind: 'skip'})],
    } as unknown as OrOptionsModel;
    const items = buildOrItems(model);
    expect(items[0].nested).to.eq(nestedPlayer);
    expect(items[1].nested).to.eq(undefined);
  });

  it('appends disabledOptions as greyed, non-selectable rows', () => {
    const model = {
      type: 'or',
      options: [leaf('Steal from Bot')],
      disabledOptions: [{title: 'Blue', reason: 'Resources are protected', metadata: {player: {color: 'blue'}}}],
    } as unknown as OrOptionsModel;
    const items = buildOrItems(model);
    expect(items).to.have.length(2);
    expect(items[1].disabled).to.eq(true);
    expect(items[1].reason).to.eq('Resources are protected');
    expect(items[1].optionIndex).to.eq(-1);
    expect(items[1].playerColor).to.eq('blue');
  });

  it('a leaf option submits {type:option}; a nested one submits the nested response', () => {
    const model = {
      type: 'or',
      options: [{type: 'player', title: 'x'}, leaf('y')],
    } as unknown as OrOptionsModel;
    const [nested, leafItem] = buildOrItems(model);
    expect(orItemResponse(leafItem)).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(orItemResponse(nested, {type: 'player', player: 'red'})).to.deep.eq({type: 'or', index: 0, response: {type: 'player', player: 'red'}});
  });
});

describe('consoleOrChoice — tabbed targets (Virus)', () => {
  it('flattens animal cards + plant players with byte-identical top-level responses', () => {
    const step = {
      kind: 'tabbedTargets',
      animal: {label: 'Remove animals', icon: 'animal', amount: 2, branchIndex: 0, input: {type: 'card', cards: [{name: 'Pets', resources: 3}]}},
      plant: {label: 'Remove plants', icon: 'plants', amount: 5, targets: [{color: 'red', name: 'Red', current: 6, resulting: 1, optionIndex: 1}]},
    } as unknown as TabbedTargetsStep;
    const targets = buildTabbedTargets(step);
    expect(targets).to.have.length(2);
    const animal = targets.find((t) => t.tab === 'animal')!;
    expect(animal.cardName).to.eq('Pets');
    expect(animal.impact).to.eq('3 → 1');
    expect(animal.icon).to.eq('animal'); // the impact names WHICH resource
    expect(animal.response).to.deep.eq({type: 'or', index: 0, response: {type: 'card', cards: ['Pets']}});
    const plant = targets.find((t) => t.tab === 'plant')!;
    expect(plant.playerColor).to.eq('red');
    expect(plant.impact).to.eq('6 → 1');
    expect(plant.icon).to.eq('plants');
    expect(plant.response).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
  });
});
