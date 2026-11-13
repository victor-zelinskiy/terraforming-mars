/*
 * EffectPreviewPopover — the floating passive-effect BLOCK of one card, shown while the effect chip of a «сработал
 * эффект» notification is hovered (its host is `NotificationCard`). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). Three props in (the card's name, the chip's rect, the visibility), no emit, nothing
 * exposed; the spec is what it renders for them and where it stands. A Vue warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {playerEffectGroups} from '@/client/components/effects/effectExtraction';
import EffectPreviewPopover from '@/client/components/notifications/EffectPreviewPopover.vue';

// The block's drawing is the «Эффекты» overlay's own subject; this spec reads what the popover HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const BlockStub = defineComponent({
  name: 'EffectBlock',
  props: ['group'],
  render: () => h('i', {class: 'block-stub'}),
});

function popover(props: {name?: CardName, anchor?: DOMRect, visible?: boolean}) {
  return mount(EffectPreviewPopover, {
    props,
    global: {
      // The teleport is stubbed so the popover is read where it is rendered (its target is the document's body).
      stubs: {teleport: true, EffectBlock: BlockStub},
      config: globalConfig.global.config,
    },
  });
}

/** The hovered chip's rect — 40 × 20 at the given corner. */
function rect(left: number, top: number): DOMRect {
  const width = 40;
  const height = 20;
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

describe('EffectPreviewPopover — the effect chip\'s hover block', () => {
  it('renders nothing while hidden — shown, it hands the block the card\'s ONE group, however many effects the card grants', async () => {
    const w = popover({name: CardName.SPACE_STATION, anchor: rect(600, 200), visible: false});
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.effect-preview-popover').exists()).to.eq(false);

    await w.setProps({visible: true});
    expect(w.findAll('.effect-preview-popover')).to.have.length(1);
    const single = playerEffectGroups([{name: CardName.SPACE_STATION}])[0];
    expect(w.findComponent(BlockStub).props('group').cardName).to.eq(CardName.SPACE_STATION);
    expect(w.findComponent(BlockStub).props('group').effects).to.have.length(single.effects.length);

    await w.setProps({name: CardName.CARBON_NANOSYSTEMS});
    expect(w.findAllComponents(BlockStub), 'two effects — still one block').to.have.length(1);
    expect(w.findComponent(BlockStub).props('group').cardName).to.eq(CardName.CARBON_NANOSYSTEMS);
    expect(w.findComponent(BlockStub).props('group').effects).to.have.length(2);
  });

  it('a card with no passive effect, or no card at all, shows nothing even while visible', async () => {
    const w = popover({name: CardName.ANTS, anchor: rect(600, 200), visible: true});
    expect(playerEffectGroups([{name: CardName.ANTS}])).to.have.length(0);
    expect(w.find('.effect-preview-popover').exists()).to.eq(false);

    await w.setProps({name: CardName.SPACE_STATION});
    expect(w.find('.effect-preview-popover').exists()).to.eq(true);

    await w.setProps({name: undefined});
    expect(w.find('.effect-preview-popover').exists()).to.eq(false);
  });

  it('stands 320 wide to the LEFT of its anchor — to the right when the left has no room — and inside the viewport\'s height', async () => {
    const w = popover({name: CardName.SPACE_STATION, anchor: rect(600, 200), visible: true});
    const placed = (): Array<string> => {
      const style = (w.find('.effect-preview-popover').element as HTMLElement).style;
      return [style.left, style.top, style.width];
    };
    // 600 − 320 − 12 to the left; 6 above the chip's top.
    expect(placed()).to.deep.eq(['268px', '194px', '320px']);

    // No 12 px of margin left of it: it goes right of the chip (its right edge + 12), never past the viewport.
    await w.setProps({anchor: rect(100, 200)});
    expect(placed()).to.deep.eq([`${Math.min(152, window.innerWidth - 332)}px`, '194px', '320px']);

    // Clamped to the viewport's height: 12 from the top, 80 from the bottom.
    await w.setProps({anchor: rect(600, 2)});
    expect(placed()[1]).to.eq('12px');
    await w.setProps({anchor: rect(600, 100000)});
    expect(placed()[1]).to.eq(`${window.innerHeight - 80}px`);
  });

  it('without an anchor it is not placed at all', () => {
    const w = popover({name: CardName.SPACE_STATION, visible: true});
    const style = (w.find('.effect-preview-popover').element as HTMLElement).style;
    expect([style.left, style.top, style.width]).to.deep.eq(['', '', '']);
  });
});
