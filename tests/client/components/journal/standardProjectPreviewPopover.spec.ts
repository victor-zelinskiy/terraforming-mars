/*
 * StandardProjectPreviewPopover — the compact hover preview of a STANDARD-PROJECT / STANDARD-ACTION token of the
 * journal (its host is `JournalCardChip`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what
 * it renders for its four props — nothing while hidden; the project's pictogram, name and one-line effect of the shared
 * `standardProjectVisuals` table; the kicker that tells a project from an action; its place on the preferred side of the
 * anchor. It emits nothing and exposes nothing. The teleport is stubbed so the popover is read where it is rendered
 * (its target is the document's body). No mount below hands it a directive: the popover brings its own `v-i18n`. The
 * unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import StandardProjectPreviewPopover from '@/client/components/journal/StandardProjectPreviewPopover.vue';
import {standardProjectVisual} from '@/client/components/overview/standardProjectVisuals';
import {CardName} from '@/common/cards/CardName';

type PopoverProps = {
  name: CardName,
  visible?: boolean,
  anchor?: DOMRect,
  prefer?: 'left' | 'right',
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
  return mount(StandardProjectPreviewPopover, {props, global: {stubs: {teleport: true}}});
}

function boxOf(wrapper: ReturnType<typeof popover>): CSSStyleDeclaration {
  return (wrapper.find('.journal-sp-preview').element as HTMLElement).style;
}

describe('StandardProjectPreviewPopover — the journal\'s standard-project preview', () => {
  it('renders nothing while hidden; shown, it is a tooltip bound for the body with the project\'s pictogram, name and effect', async () => {
    const wrapper = popover({name: CardName.POWER_PLANT_STANDARD_PROJECT, anchor: anchorAt(600, 300)});
    expect(wrapper.find('teleport-stub').attributes('to')).to.eq('body');
    expect(wrapper.find('.journal-sp-preview').exists(), 'hidden by default').to.eq(false);

    await wrapper.setProps({visible: true});
    const box = wrapper.find('.journal-sp-preview');
    expect(box.attributes('role')).to.eq('tooltip');
    expect(box.attributes('aria-hidden')).to.eq('true');

    const visual = standardProjectVisual(CardName.POWER_PLANT_STANDARD_PROJECT);
    expect(wrapper.find('.journal-sp-preview__icon').classes()).to.include.members(visual.iconClass.split(' '));
    // The ":SP" suffix of the card's name is not shown.
    expect(wrapper.find('.journal-sp-preview__name').text()).to.eq('Power Plant');
    expect(wrapper.find('.journal-sp-preview__desc').text()).to.eq(visual.description);

    const kicker = wrapper.find('.journal-sp-preview__kicker');
    expect(kicker.attributes('tm-has-i18n'), 'translated by the popover\'s own v-i18n').to.eq('true');
    expect(kicker.text()).to.eq('Standard project');
  });

  it('a standard ACTION says so in its kicker; a card the table does not know keeps the generic pictogram and prints no effect line', async () => {
    const wrapper = popover({name: CardName.CONVERT_PLANTS, visible: true, anchor: anchorAt(600, 300)});
    expect(wrapper.find('.journal-sp-preview__kicker').text()).to.eq('Standard action');
    expect(wrapper.find('.journal-sp-preview__name').text()).to.eq('Convert Plants');
    expect(wrapper.find('.journal-sp-preview__desc').text()).to.eq(standardProjectVisual(CardName.CONVERT_PLANTS).description);

    await wrapper.setProps({name: CardName.ANTS});
    expect(wrapper.find('.journal-sp-preview__kicker').text()).to.eq('Standard project');
    expect(wrapper.find('.journal-sp-preview__name').text()).to.eq('Ants');
    expect(wrapper.find('.journal-sp-preview__icon').classes()).to.include('std-icon--generic');
    expect(wrapper.find('.journal-sp-preview__desc').exists()).to.eq(false);
  });

  it('prefers the LEFT of its anchor and flips when it would clip; `prefer="right"` mirrors that; no anchor — not displayed', async () => {
    const wrapper = popover({name: CardName.ASTEROID_STANDARD_PROJECT, visible: true, anchor: anchorAt(600, 300)});
    // 244 wide, 14 off the anchor's left edge; 96 tall, centred on the anchor's middle line.
    expect(boxOf(wrapper).left).to.eq('342px');
    expect(boxOf(wrapper).top).to.eq('262px');

    // No room on the left: the anchor's right edge; a top above the viewport is clamped to the margin.
    await wrapper.setProps({anchor: anchorAt(100, 0)});
    expect(boxOf(wrapper).left).to.eq('154px');
    expect(boxOf(wrapper).top).to.eq('8px');

    await wrapper.setProps({prefer: 'right'});
    expect(boxOf(wrapper).left, 'the right side by choice').to.eq('154px');
    // The right side would leave the viewport: back to the left.
    const farRight = window.innerWidth - 60;
    await wrapper.setProps({anchor: anchorAt(farRight, 300)});
    expect(boxOf(wrapper).left).to.eq(`${farRight - 14 - 244}px`);

    await wrapper.setProps({anchor: undefined});
    expect(boxOf(wrapper).display).to.eq('none');
  });
});
