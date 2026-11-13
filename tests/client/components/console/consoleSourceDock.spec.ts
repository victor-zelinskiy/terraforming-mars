/*
 * ConsoleSourceDock — the console's ONE answer to «why did this prompt come to me?» (WHICH source a prompt has is the
 * pure `promptSource.ts`, spec'd under the server runner). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its props — the card's face in the dock's slot, the plate of a
 * source that is no card, the one-line chip, a board cell named by the map — and the `under` slot. It emits nothing
 * and exposes nothing. The card face is stubbed by the name the template uses. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {CardName} from '@/common/cards/CardName';
import {PromptSourceView} from '@/client/console/promptSource';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {cardNumberDisplayState} from '@/client/components/premiumCard/cardNumberDisplay';
import ConsoleSourceDock from '@/client/components/console/ConsoleSourceDock.vue';

const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object as PropType<{name: CardName}>, required: true}},
  render() {
    return h('i', {'class': 'card-stub'});
  },
});

type Props = {view: PromptSourceView, compact?: boolean, chip?: boolean, motionAnchor?: string, boardName?: BoardName};

function dockOf(props: Props, under?: string) {
  return mount(ConsoleSourceDock, {
    global: {...globalConfig.global, stubs: {Card: CardStub, BonusCardFace: true, PremiumCard: true}},
    props,
    slots: under === undefined ? {} : {under: () => h('b', {class: 'under-probe'}, under)},
  });
}

const CARD: PromptSourceView = {card: CardName.BIRDS, kindKey: 'Card', inspectable: true};
const COLONY: PromptSourceView = {kindKey: 'Colony', name: 'Ganymede', inspectable: false};

describe('ConsoleSourceDock — the source of a prompt, one grammar', () => {
  const numbers = cardNumberDisplayState.enabled;
  afterEach(() => {
    cardNumberDisplayState.enabled = numbers;
  });

  it('a CARD source: the label and the real face in the dock\'s slot — the motion anchor on that slot, never on the dock; no plate', async () => {
    const w = dockOf({view: CARD, compact: true});
    const root = w.find('div.con-src');
    expect(root.classes().filter((c) => c.startsWith('con-src--')), 'compact, and neither a chip, a plate nor a hazard').to.deep.eq(['con-src--compact']);
    expect(w.find('.con-src__label').text()).to.eq('Source');
    expect(w.find('.con-src__card > .card-stub').exists()).to.eq(true);
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: CardName.BIRDS});
    expect(w.find('.con-src__card').attributes('data-motion-anchor'), 'a dock nobody carries into stays unmarked').to.eq(undefined);
    expect(w.find('.con-src__plate').exists()).to.eq(false);

    await w.setProps({motionAnchor: 'card:' + CardName.BIRDS});
    expect(w.find('.con-src__card').attributes('data-motion-anchor')).to.eq('card:' + CardName.BIRDS);
    expect(root.attributes('data-motion-anchor')).to.eq(undefined);
  });

  it('a source that is NO card keeps the dock\'s shape: a plate with its kind and its name, its rule, its tone — and what the host hangs under it', () => {
    const w = dockOf({view: {...COLONY, ruleKey: 'Colony bonus', tone: 'hazard'}}, '+2');
    const root = w.find('div.con-src');
    expect(root.classes()).to.include.members(['con-src--plate', 'con-src--hazard']);
    expect(root.classes()).to.not.include('con-src--compact');
    expect(w.find('.con-src__label').text()).to.eq('Source');
    expect(w.find('.con-src__card').exists()).to.eq(false);
    expect(w.findComponent(CardStub).exists()).to.eq(false);
    expect(w.find('.con-src__plate-kind').text()).to.eq('Colony');
    expect(w.find('.con-src__plate-sep').exists()).to.eq(true);
    expect(w.find('.con-src__plate-name').text()).to.eq('Ganymede');
    expect(w.find('.con-src__plate-cell').exists(), 'no cell, no printed icons').to.eq(false);
    expect(w.find('.con-src__rule').text()).to.eq('Colony bonus');
    expect(w.find('div.con-src > .under-probe').text(), 'the `under` slot stands in the dock, after the source').to.eq('+2');

    const bare = dockOf({view: {kindKey: 'Card', inspectable: false}});
    expect(bare.find('.con-src__plate-kind').text()).to.eq('Card');
    expect(bare.find('.con-src__plate-sep').exists(), 'a source with no name prints no separator over nothing').to.eq(false);
    expect(bare.find('.con-src__plate-name').exists()).to.eq(false);
    expect(bare.find('.con-src__rule').exists()).to.eq(false);
  });

  it('the CHIP is one line: no label, no face, no rule — the card is NAMED on the plate, and a nameless source reads by its kind', () => {
    const w = dockOf({view: {...CARD, ruleKey: 'A rule'}, chip: true});
    expect(w.find('div.con-src').classes()).to.include.members(['con-src--chip', 'con-src--plate']);
    expect(w.find('.con-src__label').exists()).to.eq(false);
    expect(w.find('.con-src__card').exists()).to.eq(false);
    expect(w.findComponent(CardStub).exists(), 'the chip names, never draws').to.eq(false);
    expect(w.find('.con-src__plate-kind').text()).to.eq('Source');
    expect(w.find('.con-src__plate-name').text()).to.eq(CardName.BIRDS);
    expect(w.find('.con-src__rule').exists()).to.eq(false);

    const nameless = dockOf({view: {kindKey: 'Mars Hydronetwork', inspectable: false}, chip: true});
    expect(nameless.find('.con-src__plate-kind').text()).to.eq('Source');
    expect(nameless.find('.con-src__plate-name').text(), 'a chip always says something').to.eq('Mars Hydronetwork');
  });

  it('a BOARD CELL is named by the map where the board is known, wears its printed icons — and the catalog code follows the one flag', async () => {
    const cell: PromptSourceView = {
      kindKey: 'Board cell', name: 'Placement bonus', inspectable: false, code: 'RX01',
      cell: {space: SpaceName.NOCTIS_CITY, icons: ['resource_icon--plants', 'resource_icon--steel']},
    };
    const proper = getSpecialCellInfo(SpaceName.NOCTIS_CITY, BoardName.THARSIS)?.title;
    expect(proper, 'the map prints a name for this cell').to.be.a('string');

    cardNumberDisplayState.enabled = false;
    const w = dockOf({view: cell});
    expect(w.find('.con-src__plate-name').text(), 'without the board: the server\'s own name').to.eq('Placement bonus');
    const icons = w.findAll('[data-source-cell] > i.con-src__plate-ico.resource_icon');
    expect(icons.map((i) => i.classes().filter((c) => c.startsWith('resource_icon--')))).to.deep.eq([['resource_icon--plants'], ['resource_icon--steel']]);
    expect(w.find('.con-src__plate-code').exists(), 'the number is an opt-in').to.eq(false);

    await w.setProps({boardName: BoardName.THARSIS});
    expect(w.find('.con-src__plate-name').text()).to.eq(proper);

    cardNumberDisplayState.enabled = true;
    await nextTick();
    expect(w.find('.con-src__plate-code').text()).to.eq('RX01');
    expect(w.find('.con-src__plate-code').attributes('data-source-code')).to.eq('RX01');
  });
});
