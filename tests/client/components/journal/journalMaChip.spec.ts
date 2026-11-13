/*
 * JournalMaChip — the MILESTONE / AWARD name token of the journal feed and the notifications (its host is
 * `JournalTokenRenderer`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for
 * its two props — the token (its kind on the class, the name translated by the chip's own `v-i18n`) and, beside it,
 * the preview it feeds — and the hover: the preview opens only after the chip's delay (a wait of the flow kernel — the
 * spec drives the kernel's clock), anchored on the token's own box, and a leave closes it or takes the pending open
 * back. It emits nothing and exposes nothing. The preview is stubbed by name: the spec reads what the chip hands it.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import JournalMaChip from '@/client/components/journal/JournalMaChip.vue';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/** The chip's own hover delay (`HOVER_DELAY` in the component). */
const HOVER_DELAY = 160;

const PopoverStub = defineComponent({
  name: 'MaPreviewPopover',
  props: {
    kind: {type: String, required: true},
    name: {type: String, default: ''},
    visible: {type: Boolean, default: false},
    anchor: {type: Object as PropType<DOMRect | undefined>, default: undefined},
  },
  render() {
    return h('i', {class: 'popover-stub'});
  },
});

function chip(kind: 'milestone' | 'award', name: MilestoneName | AwardName) {
  return mount(JournalMaChip, {
    props: {kind, name},
    global: {config: globalConfig.global.config, stubs: {MaPreviewPopover: PopoverStub}},
  });
}

/** The token's box on screen, as the chip will measure it. */
function standAt(token: Element, left: number, top: number): void {
  const width = 80;
  const height = 20;
  (token as HTMLElement).getBoundingClientRect = () => ({
    x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
    toJSON() {
      return {};
    },
  });
}

describe('JournalMaChip — the journal\'s milestone / award token', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('renders the token of its kind — focusable, its name translated by its own v-i18n — and a closed preview beside it', () => {
    const wrapper = chip('milestone', 'Terraformer');
    const token = wrapper.find('span.journal-token');
    expect(token.classes()).to.deep.eq(['journal-token', 'journal-token--milestone']);
    expect(token.attributes('tabindex')).to.eq('0');
    expect(token.attributes('tm-has-i18n'), 'translated by the chip\'s own v-i18n').to.eq('true');
    expect(token.text()).to.eq('Terraformer');

    const preview = wrapper.findComponent(PopoverStub);
    expect(preview.props('kind')).to.eq('milestone');
    expect(preview.props('name')).to.eq('Terraformer');
    expect(preview.props('visible')).to.eq(false);
    expect(preview.props('anchor')).to.eq(undefined);
    wrapper.unmount();

    const award = chip('award', 'Banker');
    expect(award.find('span.journal-token').classes()).to.deep.eq(['journal-token', 'journal-token--award']);
    expect(award.findComponent(PopoverStub).props('kind')).to.eq('award');
    expect(award.findComponent(PopoverStub).props('name')).to.eq('Banker');
    award.unmount();
  });

  it('a hover opens the preview after the chip\'s delay, anchored on the token\'s own box; a leave closes it', async () => {
    const wrapper = chip('milestone', 'Terraformer');
    const token = wrapper.find('span.journal-token');
    const preview = wrapper.findComponent(PopoverStub);
    standAt(token.element, 600, 300);

    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 1);
    await nextTick();
    expect(preview.props('visible'), 'the delay has not run out').to.eq(false);

    clock.advance(1);
    await nextTick();
    expect(preview.props('visible')).to.eq(true);
    const anchor = preview.props('anchor');
    expect(anchor?.left).to.eq(600);
    expect(anchor?.top).to.eq(300);
    expect(anchor?.width).to.eq(80);
    expect(anchor?.height).to.eq(20);

    await token.trigger('mouseleave');
    expect(preview.props('visible')).to.eq(false);
    wrapper.unmount();
  });

  it('a leave before the delay takes the pending open back; the keyboard\'s focus and blur are the same two edges', async () => {
    const wrapper = chip('award', 'Banker');
    const token = wrapper.find('span.journal-token');
    const preview = wrapper.findComponent(PopoverStub);

    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 10);
    await token.trigger('mouseleave');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'the open was taken back').to.eq(false);

    await token.trigger('focus');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'opened by focus').to.eq(true);

    await token.trigger('blur');
    expect(preview.props('visible'), 'closed by blur').to.eq(false);
    wrapper.unmount();
  });
});
