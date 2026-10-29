import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {TABLE_TARGET_BOT_KEY} from '@/client/console/played/tableTargetZone';

/*
 * «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28). «Хищники» with MarsBot at the table: the server's removal
 * `OrOptions` [the players' card pick, the bot] carries `tableTargetPrompt`, and the composer answers it on ONE
 * screen — the bot a group beside the players, no list «карты / бот» before the cards. The wire answer is the
 * historical one, byte for byte; B from the zone goes back to the composer (there is no list above it any more).
 */

const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

function view(): any {
  return {
    id: 'p1',
    thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
    players: [
      {color: 'blue', name: 'Me', tableau: []},
      {color: 'red', name: 'victor', tableau: [{name: 'Birds', resources: 4}]},
      {color: 'green', name: 'MarsBot', isMarsBot: true, tableau: []},
    ],
    game: {generation: 1},
    cardsInHand: [],
  };
}

function entryFor(cardName: string) {
  return {
    group: {key: cardName, cardName, isCorporation: false, isDisabled: false, nodes: [{key: cardName + '#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
    cardName,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  } as any;
}

function removal(withCards: boolean) {
  const options: Array<any> = [];
  if (withCards) {
    options.push({type: 'card', title: 'Select card to remove 1 animal', buttonLabel: 'Remove resource(s)', cards: [{name: 'Birds', resources: 4}], min: 1, max: 1});
  }
  options.push({
    type: 'option', title: 'Remove 1 animal from MarsBot', buttonLabel: 'Remove',
    metadata: {kind: 'resourceRemoval', icon: 'animal', amount: 1, player: {color: 'green', current: 2, resulting: 1, changes: []}},
  });
  return {
    type: 'or', title: 'Select card to remove 1 animal', buttonLabel: 'Save', options,
    tableTargetPrompt: {...(withCards ? {cardBranch: 0} : {}), botBranch: withCards ? 1 : 0, bot: {color: 'green', storage: 'colony', colony: 'Miranda'}},
  };
}

function preview(withCards = true) {
  return {
    card: 'Predators', isCorporation: false, kind: 'bespoke',
    branches: [{
      index: -1, title: '', available: true, renderKeys: [], effects: [],
      steps: [{kind: 'input', input: removal(withCards), amount: -1, cardResource: 'animal'}],
    }],
  };
}

function factory(withCards = true) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: view(), entry: entryFor('Predators'), preview: preview(withCards), nodeIndex: 0},
  });
}

describe('ConsoleActionComposer — the table\'s targets are ONE zone', () => {
  it('A on the row opens the zone directly: the players\' group AND the bot\'s, no list, no door', async () => {
    const w = factory();
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    expect(vm.sub.kind, 'the zone, never the «карты / бот» list').to.eq('playedTarget');
    expect(w.find('.con-composer__sublist').exists()).to.eq(false);
    const owners = vm.playedTargetModel.owners;
    expect(owners.map((o: any) => o.id)).to.deep.eq(['red', 'green']);
    expect(owners[1].bot, 'the bot is a group of the zone').to.eq(true);
    expect(owners[1].candidates[0].cardName).to.eq(TABLE_TARGET_BOT_KEY);
    expect(w.findAll('.con-ptsel__owner')).to.have.length(2);
    const tile = w.find('[data-ptsel-bot]');
    expect(tile.exists(), 'the bot stands as a TILE, never a card face').to.eq(true);
    expect(tile.find('[data-ptsel-bot-delta]').text().replace(/\s+/g, ' ')).to.eq('2 → 1');
    expect(tile.find('[data-ptsel-bot-storage]').attributes('data-ptsel-bot-storage')).to.eq('colony');
    w.unmount();
  });

  it('a card answers into the card branch — byte for byte', async () => {
    const w = factory();
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.sub = {...vm.sub, focus: {ownerId: 'red', index: 0}};
    vm.confirmPlayedTarget();
    await w.vm.$nextTick();
    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 0, response: {type: 'card', cards: ['Birds']}});
    expect(vm.chosenLabel(vm.allChoices[0])).to.eq('Birds');
    expect(vm.chosenImpact(vm.allChoices[0])).to.eq('4 → 3');
    w.unmount();
  });

  it('the bot\'s tile answers into the bot branch — the bare option, as the list sent it', async () => {
    const w = factory();
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.sub = {...vm.sub, focus: {ownerId: 'green', index: 0}};
    vm.confirmPlayedTarget();
    await w.vm.$nextTick();
    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(vm.sub).to.eq(undefined);
    expect(vm.chosenImpact(vm.allChoices[0]), 'the row keeps the bot\'s reading').to.eq('2 → 1');
    // Re-entry lands ON the bot's tile.
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    expect(vm.sub.focus.ownerId).to.eq('green');
    w.unmount();
  });

  it('B from the zone goes up to the composer — there is no list above it', async () => {
    const w = factory();
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.handleIntent({kind: 'press', button: 'back'});
    await w.vm.$nextTick();
    expect(vm.sub).to.eq(undefined);
    expect(vm.captured[0]).to.eq(undefined);
    w.unmount();
  });

  it('a lone bot: the zone holds ONE group — the bot\'s tile', async () => {
    const w = factory(false);
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    expect(vm.sub.kind).to.eq('playedTarget');
    expect(vm.playedTargetModel.owners.map((o: any) => o.id)).to.deep.eq(['green']);
    vm.confirmPlayedTarget();
    await w.vm.$nextTick();
    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 0, response: {type: 'option'}});
    w.unmount();
  });
});
