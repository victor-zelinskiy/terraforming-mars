/*
 * PremiumMechanicsPanel — the inset mechanics plate of the premium face: one engraved row (group) per DSL root row,
 * the play-rail before the on-play zone, the «ИЛИ» divider between alternative groups. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md). ONE prop (the mechanics view-model), no emit, nothing exposed; the spec is
 * what it renders for that model — and the addresses the fullscreen annotation layer and the action commit anchor to
 * (`data-graphic-id` on a row, `data-graphic-node` on a node).
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, toRaw} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {Tag} from '@/common/cards/Tag';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {nodeGraphicToken} from '@/common/cards/render/cardGraphicIds';
import {ICardRenderItem} from '@/common/cards/render/Types';
import {translateText} from '@/client/directives/i18n';
import {MechGroup, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';

// A node's drawing is PremiumMechNode's own subject; this spec reads what the panel HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const NodeStub = defineComponent({
  name: 'PremiumMechNode',
  props: ['node'],
  render: () => h('i', {class: 'node-stub'}),
});

const SCIENCE: ICardRenderItem = {is: 'item', type: CardRenderItemType.TAG, amount: 1, tag: Tag.SCIENCE};
const MEGACREDITS: ICardRenderItem = {is: 'item', type: CardRenderItemType.MEGACREDITS, amount: 3};
const PLANTS: ICardRenderItem = {is: 'item', type: CardRenderItemType.PLANTS, amount: 1};

function mechanics(groups: ReadonlyArray<MechGroup>, playStart: number): MechanicsVM {
  return {groups, density: 'normal', score: 0, textOnly: false, playStart};
}

function panel(vm: MechanicsVM) {
  return mount(PremiumMechanicsPanel, {
    ...globalConfig,
    props: {mechanics: vm},
    global: {...globalConfig.global, stubs: {PremiumMechNode: NodeStub}},
  });
}

describe('PremiumMechanicsPanel — the mechanics plate', () => {
  const EFFECT: MechGroup = {kind: 'effect', nodes: [SCIENCE], weight: 1, graphicId: 'effect-0'};
  const PLAY: MechGroup = {kind: 'plain', nodes: [MEGACREDITS, PLANTS], weight: 2, graphicId: 'row-1'};

  it('one engraved row per group, in the model\'s order — each wearing its kind and its graphic address', () => {
    const w = panel(mechanics([EFFECT, PLAY, {kind: 'production', nodes: [PLANTS], weight: 1}], 1));
    expect(w.classes()).to.include('pcard__mech');
    const groups = w.findAll('.pcard-mech-group');
    expect(groups).to.have.length(3);
    expect(groups.map((g) => g.classes().filter((c) => c.startsWith('pcard-mech-group--')))).to.deep.eq([
      ['pcard-mech-group--effect'], ['pcard-mech-group--plain'], ['pcard-mech-group--production'],
    ]);
    expect(groups.map((g) => g.attributes('data-graphic-id'))).to.deep.eq(['effect-0', 'row-1', undefined]);
  });

  it('hands every node to its drawing BY REFERENCE, under the node\'s exact-anchor address', () => {
    const w = panel(mechanics([EFFECT, PLAY], 1));
    const nodes = w.findAllComponents(NodeStub);
    expect(nodes).to.have.length(3);
    expect(nodes.map((n) => n.props('node'))).to.deep.eq([SCIENCE, MEGACREDITS, PLANTS]);
    // (`toRaw`: the mount hands its props over as a reactive proxy — the object behind it is the model's own.)
    expect(toRaw(nodes[0].props('node')), 'the manifest\'s own object — never a copy').to.eq(SCIENCE);
    // The shared derivation (cardGraphicIds) — the same token the card-information blocks link to.
    expect(nodes.map((n) => n.attributes('data-graphic-node'))).to.deep.eq([
      nodeGraphicToken(SCIENCE), nodeGraphicToken(MEGACREDITS), nodeGraphicToken(PLANTS),
    ]);
    expect(nodeGraphicToken(SCIENCE)).to.eq('tag-' + Tag.SCIENCE);
    expect(w.findAll('.pcard-mech-group')[1].findAll('.node-stub'), 'the row keeps its own nodes').to.have.length(2);
  });

  it('the PLAY-RAIL opens the on-play zone once, right before the model\'s `playStart` — and no zone means no rail', async () => {
    const w = panel(mechanics([EFFECT, PLAY], 1));
    const rails = w.findAll('.pcard-play-rail');
    expect(rails).to.have.length(1);
    expect(rails[0].attributes('aria-hidden')).to.eq('true');
    expect(rails[0].findAll('.pcard-play-rail__line')).to.have.length(2);
    expect(rails[0].find('.pcard-play-rail__emblem').exists()).to.eq(true);
    const groups = w.findAll('.pcard-mech-group');
    expect(rails[0].element.previousElementSibling, 'after the effect').to.eq(groups[0].element);
    expect(rails[0].element.nextElementSibling, 'before the on-play row').to.eq(groups[1].element);

    // `playStart === groups.length` is the model's «no play zone» (a pure effect / action card, a Parliament graphic).
    await w.setProps({mechanics: mechanics([EFFECT, PLAY], 2)});
    expect(w.find('.pcard-play-rail').exists()).to.eq(false);
    expect(w.findAll('.pcard-mech-group')).to.have.length(2);
  });

  it('an ALTERNATIVE group is joined by the «ИЛИ» divider, and the winner\'s clause is set apart', () => {
    const w = panel(mechanics([
      {kind: 'action', nodes: [MEGACREDITS], weight: 1},
      {kind: 'action', nodes: [PLANTS], weight: 1, orJoin: true},
      {kind: 'plain', nodes: [SCIENCE], weight: 1, winnerRow: true},
    ], 3));
    const dividers = w.findAll('.pcard-mech-or');
    expect(dividers).to.have.length(1);
    expect(dividers[0].text()).to.eq(translateText('OR'));
    const groups = w.findAll('.pcard-mech-group');
    expect(dividers[0].element.nextElementSibling, 'the divider stands before the alternative').to.eq(groups[1].element);
    expect(groups.map((g) => g.classes().includes('pcard-mech-group--after-or'))).to.deep.eq([false, true, false]);
    expect(groups.map((g) => g.classes().includes('pcard-mech-group--winner'))).to.deep.eq([false, false, true]);
  });
});
