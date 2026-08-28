import {expect} from 'chai';
import {buildOrItems, orItemResponse, buildTabbedTargets} from '@/client/console/consoleOrChoice';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Color} from '@/common/Color';

function leaf(title: unknown, metadata?: unknown) {
  return {type: 'option', title, metadata} as unknown;
}

describe('consoleOrChoice — premium or items', () => {
  /**
   * THE ENGINE'S OWN CAUTION MUST SURVIVE THE BUILDER.
   *
   * `RemoveAnyPlants` marks its self-removal option with `removeOwnPlants` —
   * the single place the rules engine says «this hurts YOU». This builder
   * dropped it for its whole life, so the console received the warning and
   * rendered nothing; downstream it survived only as a boolean that demanded a
   * SECOND key press without ever saying why. Being asked to confirm twice with
   * no reason given reads as the UI being clumsy, not as a caution — it costs
   * trust and prevents nothing.
   */
  it('carries a per-option warning through, as a SENTENCE not a key', () => {
    const model = {
      type: 'or',
      options: [
        {type: 'option', title: 'Remove 2 plants from you', warnings: ['removeOwnPlants']},
        {type: 'option', title: 'Remove 2 plants from Red'},
      ],
    } as unknown as OrOptionsModel;
    const items = buildOrItems(model);
    expect(items[0].warnings, 'the caution survives').to.not.eq(undefined);
    expect(items[0].warnings?.[0], 'and it is words, never the raw key')
      .to.eq('Warning: this will remove your own plants');
    expect(items[0].warnings?.[0]).to.not.eq('removeOwnPlants');
    expect(items[1].warnings, 'an unmarked option stays silent').to.eq(undefined);
  });

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

  it('renders a PLAYER animal target (MarsBot proxy) in the animal tab, alongside cards', () => {
    const step = {
      kind: 'tabbedTargets',
      animal: {
        label: 'Animals', icon: 'animal', amount: 2, branchIndex: 0,
        input: {type: 'card', cards: [{name: 'Pets', resources: 3}]},
        targets: [{color: 'neutral', name: 'MarsBot', current: 4, resulting: 2, optionIndex: 1}],
      },
    } as unknown as TabbedTargetsStep;
    const targets = buildTabbedTargets(step);
    expect(targets).to.have.length(2); // the Pets card + the MarsBot player-row
    const bot = targets.find((t) => t.playerColor === 'neutral')!;
    expect(bot.tab).to.eq('animal');
    expect(bot.impact).to.eq('4 → 2');
    expect(bot.icon).to.eq('animal');
    expect(bot.response).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
  });

  it('handles an animal tab with ONLY a player target (lone bot, no animal cards)', () => {
    const step = {
      kind: 'tabbedTargets',
      animal: {label: 'Animals', icon: 'animal', amount: 2, targets: [{color: 'neutral', name: 'MarsBot', current: 3, resulting: 1, optionIndex: 0}]},
    } as unknown as TabbedTargetsStep;
    const targets = buildTabbedTargets(step);
    expect(targets).to.have.length(1);
    expect(targets[0].playerColor).to.eq('neutral');
    expect(targets[0].response).to.deep.eq({type: 'or', index: 0, response: {type: 'option'}});
  });

  /**
   * A CARD TARGET MUST NAME ITS VICTIM.
   *
   * Every plant row is a PLAYER target, so it always carried a colour + a name;
   * the animal rows are CARD targets, whose model is a bare `SelectCardModel`,
   * and they shipped as a card name with nothing beside it. The list then read
   * «убрать 2 животных с "Пингвинов"» without saying whose penguins — and Virus
   * takes from ANY player, so one of those cards can be the viewer's own.
   */
  it('carries the OWNER of an animal CARD target (colour dot + name + self flag)', () => {
    const step = {
      kind: 'tabbedTargets',
      animal: {
        label: 'Animals', icon: 'animal', amount: 2, branchIndex: 0,
        input: {type: 'card', cards: [{name: 'Penguins', resources: 3}, {name: 'Pets', resources: 1}]},
      },
      plant: {label: 'Plants', icon: 'plants', amount: 5, targets: [{color: 'red', name: 'Red', current: 6, resulting: 1, optionIndex: 1}]},
    } as unknown as TabbedTargetsStep;
    const owners: Record<string, {color: Color, name: string, self: boolean}> = {
      Penguins: {color: 'red' as Color, name: 'Red', self: false},
      Pets: {color: 'blue' as Color, name: 'Me', self: true},
    };
    const targets = buildTabbedTargets(step, (name) => owners[name]);
    const penguins = targets.find((t) => t.cardName === 'Penguins')!;
    expect(penguins.playerColor).to.eq('red');
    expect(penguins.ownerName).to.eq('Red');
    expect(penguins.ownerSelf).to.eq(false);
    const pets = targets.find((t) => t.cardName === 'Pets')!;
    expect(pets.ownerName).to.eq('Me');
    expect(pets.ownerSelf).to.eq(true);
    // …and the card MODEL rides along: the sub-list advertises «ОСМОТРЕТЬ», and
    // the inspector opens over a model, not a name.
    expect(pets.card).to.deep.eq({name: 'Pets', resources: 1});
    expect(targets.find((t) => t.tab === 'plant')!.card).to.eq(undefined);
    // The owner is DECORATION on the response — the submitted bytes are the
    // same with or without a resolver.
    expect(targets.map((t) => t.response)).to.deep.eq(buildTabbedTargets(step).map((t) => t.response));
  });

  it('leaves a card target ownerless when the host cannot resolve it (no crash, no fake owner)', () => {
    const step = {
      kind: 'tabbedTargets',
      animal: {label: 'Animals', icon: 'animal', amount: 2, branchIndex: 0, input: {type: 'card', cards: [{name: 'Pets', resources: 1}]}},
    } as unknown as TabbedTargetsStep;
    const targets = buildTabbedTargets(step, () => undefined);
    expect(targets[0].playerColor).to.eq(undefined);
    expect(targets[0].ownerName).to.eq(undefined);
    expect(targets[0].ownerSelf).to.eq(undefined);
  });
});
