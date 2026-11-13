/*
 * MaPreviewPopover — the hover preview of a MILESTONE / AWARD token of the journal feed (its host is `JournalMaChip`).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its four props — nothing
 * while hidden or unnamed; the kind on the class, the kicker and the icon; the name, the rule text and the art of the
 * static manifest; its place beside the anchor. It emits nothing and exposes nothing. The teleport is stubbed so the
 * popover is read where it is rendered (its target is the document's body); the bar icon is stubbed by name. No mount
 * below hands it a directive: the popover brings its own `v-i18n`. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {mount} from '@vue/test-utils';
import MaPreviewPopover from '@/client/components/journal/MaPreviewPopover.vue';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {maArtUrl} from '@/client/components/ma/maArt';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';

const IconStub = defineComponent({
  name: 'BarButtonIcon',
  props: {name: {type: String, required: true}},
  render() {
    return h('i', {'class': 'icon-stub', 'data-icon': this.name});
  },
});

type PopoverProps = {
  kind: 'milestone' | 'award',
  name?: MilestoneName | AwardName | '',
  visible?: boolean,
  anchor?: DOMRect,
};

/** The token's box on screen — the popover only reads its edges and its height. */
function anchorAt(left: number, top: number, width = 40, height = 20): DOMRect {
  return {
    x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
    toJSON() {
      return {};
    },
  };
}

function popover(props: PopoverProps) {
  return mount(MaPreviewPopover, {props, global: {stubs: {teleport: true, BarButtonIcon: IconStub}}});
}

function boxOf(wrapper: ReturnType<typeof popover>): CSSStyleDeclaration {
  return (wrapper.find('.journal-ma-preview').element as HTMLElement).style;
}

describe('MaPreviewPopover — the journal\'s milestone / award preview', () => {
  it('renders nothing while hidden or unnamed; shown, it is a tooltip bound for the body', async () => {
    const wrapper = popover({kind: 'milestone', name: 'Terraformer', visible: false, anchor: anchorAt(600, 300)});
    expect(wrapper.find('teleport-stub').attributes('to')).to.eq('body');
    expect(wrapper.find('.journal-ma-preview').exists(), 'hidden').to.eq(false);

    await wrapper.setProps({visible: true, name: ''});
    expect(wrapper.find('.journal-ma-preview').exists(), 'visible, but no name to show').to.eq(false);

    await wrapper.setProps({name: 'Terraformer'});
    const box = wrapper.find('.journal-ma-preview');
    expect(box.exists()).to.eq(true);
    expect(box.attributes('role')).to.eq('tooltip');
    expect(box.attributes('aria-hidden')).to.eq('true');
  });

  it('a milestone: the kind on the class, the kicker and the icon; the name, the rule text and the art of the manifest', () => {
    const wrapper = popover({kind: 'milestone', name: 'Terraformer', visible: true, anchor: anchorAt(600, 300)});
    expect(wrapper.find('.journal-ma-preview').classes()).to.include('journal-ma-preview--milestone');
    expect(wrapper.findComponent(IconStub).props('name')).to.eq('milestones');

    const kicker = wrapper.find('.journal-ma-preview__kicker');
    expect(kicker.attributes('tm-has-i18n'), 'translated by the popover\'s own v-i18n').to.eq('true');
    expect(kicker.text()).to.eq('Achievement');
    expect(wrapper.find('.journal-ma-preview__name').text()).to.eq('Terraformer');

    const description = getMilestone('Terraformer').description;
    expect(description).to.not.eq('');
    expect(wrapper.find('.journal-ma-preview__desc').text()).to.eq(description);
    expect(wrapper.find('.journal-ma-preview__art').attributes('style')).to.include(maArtUrl('Terraformer'));
  });

  it('an award: its own class, kicker, icon and rule text — and it follows the token it is pointed at', async () => {
    const wrapper = popover({kind: 'award', name: 'Landlord', visible: true, anchor: anchorAt(600, 300)});
    expect(wrapper.find('.journal-ma-preview').classes()).to.include('journal-ma-preview--award');
    expect(wrapper.findComponent(IconStub).props('name')).to.eq('awards');
    expect(wrapper.find('.journal-ma-preview__kicker').text()).to.eq('Award');
    expect(wrapper.find('.journal-ma-preview__desc').text()).to.eq(getAward('Landlord').description);

    await wrapper.setProps({name: 'Banker'});
    expect(wrapper.find('.journal-ma-preview__name').text()).to.eq('Banker');
    expect(wrapper.find('.journal-ma-preview__desc').text()).to.eq(getAward('Banker').description);
    expect(wrapper.find('.journal-ma-preview__art').attributes('style')).to.include(maArtUrl('Banker'));

    // A name the manifest does not know keeps the popover — with no rule text, never a throw.
    await wrapper.setProps({name: 'No such award' as AwardName});
    expect(wrapper.find('.journal-ma-preview__name').text()).to.eq('No such award');
    expect(wrapper.find('.journal-ma-preview__desc').text()).to.eq('');
  });

  it('stands to the LEFT of its anchor, centred on it; flips to the right and clamps to the viewport; no anchor — not displayed', async () => {
    const wrapper = popover({kind: 'milestone', name: 'Mayor', visible: true, anchor: anchorAt(600, 300)});
    // 300 wide, 14 off the anchor's left edge; ~132 tall, centred on the anchor's middle line.
    expect(boxOf(wrapper).left).to.eq('286px');
    expect(boxOf(wrapper).top).to.eq('244px');
    expect(boxOf(wrapper).width).to.eq('300px');

    // No room on the left: it goes to the anchor's right edge; a top above the viewport is clamped to the margin.
    await wrapper.setProps({anchor: anchorAt(100, 0)});
    expect(boxOf(wrapper).left).to.eq('154px');
    expect(boxOf(wrapper).top).to.eq('8px');

    await wrapper.setProps({anchor: undefined});
    expect(boxOf(wrapper).display).to.eq('none');
  });
});
