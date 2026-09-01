import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';

/*
 * A NESTED-INPUT OR-BRANCH IS A DOOR, NOT A DEAD END.
 *
 * «Хищники» in a MarsBot game: the removal picker the server builds is an
 * `OrOptions` whose FIRST option is the card `SelectCard` and whose second is the
 * bot's storage/M€ proxy (`RemoveResourcesFromCard.execute`). The composer used
 * to render that first row DISABLED with «недоступно на этом экране», so the only
 * reachable target was the bot — the card's whole point (take an animal from an
 * opponent) was gone the moment a bot sat at the table.
 *
 * The shape is generic (any `OrOptions` carrying an input option), so these specs
 * assert the CONTRACT: the branch descends, the answer NESTS byte-identically
 * into `{type:'or', index, response:<nested>}`, and B walks back exactly one
 * logical level.
 */

const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 1},
  cardsInHand: [],
};

/** A view whose OPPONENT holds the animal card — the removal reaches across the
 *  table, which is exactly the target the bug hid. */
function viewWithOpponentCard(name: string, resources: number): any {
  return {
    ...PLAYER_VIEW,
    players: [
      {color: 'blue', name: 'Me', tableau: []},
      {color: 'red', name: 'victor', tableau: [{name, resources}]},
    ],
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

function factory(preview: any, cardName: string, view: any) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: view, entry: entryFor(cardName), preview, nodeIndex: 0},
  });
}

/** The picker `RemoveResourcesFromCard` builds when a MarsBot is a legal target:
 *  [the card SelectCard, the bot's player-row]. */
function removalOr(cards: ReadonlyArray<{name: string, resources?: number}>) {
  return {
    type: 'or',
    title: 'Select card to remove 1 animal',
    buttonLabel: 'Save',
    options: [
      {type: 'card', title: 'Select card to remove 1 animal', buttonLabel: 'Remove resource(s)', cards, min: 1, max: 1},
      {
        type: 'option', title: 'Remove 1 animal from Bot', buttonLabel: 'Remove',
        metadata: {kind: 'resourceRemoval', icon: 'animal', amount: 1, player: {color: 'red', current: 96, resulting: 95}},
      },
    ],
  };
}

function predatorsPreview(cards: ReadonlyArray<{name: string, resources?: number}>) {
  return {
    card: 'Predators', isCorporation: false, kind: 'bespoke',
    branches: [{
      index: -1, title: '', available: true, renderKeys: [], effects: [],
      steps: [{kind: 'input', input: removalOr(cards), amount: -1, cardResource: 'animal'}],
    }],
  };
}

describe('ConsoleActionComposer — a nested-input or-branch', () => {
  it('the card branch is PICKABLE (never «недоступно на этом экране») and marked as a door', async () => {
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();

    const rows = vm.listItems;
    expect(rows).to.have.length(2);
    // THE BUG: the branch that reaches the opponent's card was rendered disabled
    // with a reason the rules never gave.
    expect(rows[0].disabled, 'the card branch stays selectable').to.eq(false);
    expect(rows[0].reason, 'and invents no refusal').to.eq('');
    expect(rows[0].nested, 'it is a door — it opens a pick of its own').to.eq(true);
    // …and the bot row is an ordinary leaf beside it.
    expect(rows[1].nested ?? false).to.eq(false);
    expect(w.findAll('.con-composer__opt-chevron')).to.have.length(1);
    w.unmount();
  });

  it('picking it DESCENDS into the embedded played-target step and nests the answer', async () => {
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(0);
    await w.vm.$nextTick();

    // The SAME surface a bare card pick opens — a bot row above it is no reason
    // for pointing at a card to feel different.
    expect(vm.sub.kind).to.eq('playedTarget');
    expect(w.find('.con-ptsel').exists(), 'the embedded step is open').to.eq(true);

    vm.confirmPlayedTarget();
    await w.vm.$nextTick();
    // BYTE PARITY with the live prompt: the card pick nests into the branch.
    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 0, response: {type: 'card', cards: ['Birds']}});
    expect(vm.sub, 'the descent closes on its answer').to.eq(undefined);
    // …and the collapsed row names the CARD, not the question it answered.
    expect(vm.chosenLabel(vm.allChoices[0])).to.eq('Birds');
    expect(vm.chosenImpact(vm.allChoices[0])).to.eq('4 → 3');
    w.unmount();
  });

  it('B out of the descent returns to the BRANCH LIST — one logical level', async () => {
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(0);
    await w.vm.$nextTick();

    vm.handleIntent({kind: 'press', button: 'back'});
    await w.vm.$nextTick();
    expect(vm.sub.kind, 'back lands on the or-list, not out of the pick').to.eq('list');
    expect(vm.sub.index, 'with the cursor on the branch it opened').to.eq(0);
    expect(vm.captured[0], 'and nothing was captured on the way').to.eq(undefined);
    w.unmount();
  });

  it('a FLAT nested list answers when the candidates are not on any tableau', async () => {
    // Nobody's tableau holds «Birds» here, so the descent is the premium list
    // rather than the tableau step — and it still nests byte-identically.
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', PLAYER_VIEW);
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(0);
    await w.vm.$nextTick();

    expect(vm.sub.kind).to.eq('orNested');
    expect(vm.listItems.map((it: any) => it.key)).to.deep.eq(['Birds']);
    // The step's own delta reaches the nested rows: a removal reads `4 → 3`.
    expect(vm.listItems[0].impact).to.eq('4 → 3');
    vm.pickListItem(0);
    await w.vm.$nextTick();
    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 0, response: {type: 'card', cards: ['Birds']}});
    w.unmount();
  });

  it('the LEAF branch beside it still submits its bare option response', async () => {
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(1);
    await w.vm.$nextTick();

    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(vm.sub).to.eq(undefined);
    w.unmount();
  });

  it('an answered branch wears the ANSWER mark, not the door chevron', async () => {
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(0);
    await w.vm.$nextTick();
    vm.confirmPlayedTarget();
    await w.vm.$nextTick();
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();

    const row = w.findAll('.con-composer__opt')[0];
    expect(row.find('.con-composer__opt-check').exists(), 'the answered branch reads as answered').to.eq(true);
    expect(row.find('.con-composer__opt-chevron').exists(), 'and no longer as an unopened door').to.eq(false);
    w.unmount();
  });

  it('a branch this screen cannot draw keeps its honest refusal', async () => {
    // A nested `SelectAmount` has no host here. It must NOT become a door onto
    // an empty list — a row that opens into nothing is a worse lie than one that
    // says the screen cannot serve it.
    const preview = {
      card: 'Predators', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{
          kind: 'input',
          input: {
            type: 'or', title: 'Choose', buttonLabel: 'Save',
            options: [
              {type: 'amount', title: 'How many?', buttonLabel: 'Save', min: 1, max: 3, maxByDefault: false},
              {type: 'option', title: 'Remove 1 animal from Bot', buttonLabel: 'Remove'},
            ],
          },
        }],
      }],
    };
    const w = factory(preview, 'Predators', PLAYER_VIEW);
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();

    expect(vm.listItems[0].disabled).to.eq(true);
    expect(vm.listItems[0].nested, 'it is not advertised as a door').to.eq(false);
    expect(vm.listItems[0].reason).to.not.eq('');
    vm.pickListItem(0);
    await w.vm.$nextTick();
    expect(vm.sub.kind, 'and A on it does nothing').to.eq('list');
    w.unmount();
  });

  it('answering the leaf AFTER a nested answer forgets the nested one', async () => {
    // Two answers to one question must never coexist: the row would name a card
    // while the capture takes from the bot.
    const w = factory(predatorsPreview([{name: 'Birds', resources: 4}]), 'Predators', viewWithOpponentCard('Birds', 4));
    await w.vm.$nextTick();
    const vm = w.vm as any;
    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(0);
    await w.vm.$nextTick();
    vm.confirmPlayedTarget();
    await w.vm.$nextTick();

    vm.openChoice(vm.allChoices[0]);
    await w.vm.$nextTick();
    vm.pickListItem(1);
    await w.vm.$nextTick();

    expect(vm.captured[0]).to.deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    expect(vm.chosenLabel(vm.allChoices[0]), 'the row names the bot option, not the old card')
      .to.eq('Remove 1 animal from Bot');
    w.unmount();
  });
});
