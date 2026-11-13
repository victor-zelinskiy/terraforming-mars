/*
 * ColonyPreviewPopover — the hover preview of a colony token: a read-only colony mini-card bound for the body. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): three props in, nothing out, nothing exposed —
 * the spec is what it renders for them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {simpleColonyModel} from '@/common/models/ColonyModel';
import ColonyPreviewPopover from '@/client/components/journal/ColonyPreviewPopover.vue';

// The tile is the colonies overlay's own subject; this spec reads what the popover HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const TileStub = defineComponent({
  name: 'ColonyTile',
  props: ['colony', 'mode', 'selectable'],
  render: () => h('i', {class: 'tile-stub'}),
});

// The popover's own numbers (its positioning math): the mini-card, the gap to the token, the viewport margin.
const WIDTH = 286;
const HEIGHT = 360;
const GAP = 14;
const MARGIN = 8;

/** The token's bounding rect, in viewport coordinates. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

// The teleport is stubbed so the popover is read where it is rendered (its target is the document's body).
function popover(props: Record<string, unknown>) {
  return mount(ColonyPreviewPopover, {props, global: {config: globalConfig.global.config, stubs: {teleport: true, ColonyTile: TileStub}}});
}

describe('ColonyPreviewPopover — the hover preview of a colony token', () => {
  it('renders nothing while hidden or with no colony named; shown, it is a tooltip bound for the body', async () => {
    const w = popover({name: ColonyName.LUNA, anchor: rect(600, 300, 80, 20)});
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.journal-colony-preview').exists(), 'hidden by default').to.eq(false);

    await w.setProps({visible: true});
    const tip = w.find('.journal-colony-preview');
    expect(tip.attributes('role')).to.eq('tooltip');
    expect(tip.attributes('aria-hidden')).to.eq('true');
    expect(w.findAll('.journal-colony-preview > .tile-stub')).to.have.length(1);

    await w.setProps({name: undefined});
    expect(w.find('.journal-colony-preview').exists(), 'visible, but nothing to preview').to.eq(false);
  });

  it('the tile is a static view of the named colony — track at its start, nobody on it, not selectable — and follows the name', async () => {
    const w = popover({name: ColonyName.LUNA, visible: true, anchor: rect(600, 300, 80, 20)});
    expect(w.findComponent(TileStub).props()).to.deep.eq({colony: simpleColonyModel(ColonyName.LUNA), mode: 'view', selectable: false});

    await w.setProps({name: ColonyName.EUROPA});
    expect(w.findComponent(TileStub).props('colony')).to.deep.eq(simpleColonyModel(ColonyName.EUROPA));
  });

  it('stands LEFT of its token, centred on it; flips to the right when the left has no room; never leaves the viewport', async () => {
    const w = popover({name: ColonyName.LUNA, visible: true, anchor: rect(600, 300, 80, 20)});
    const place = () => (w.find('.journal-colony-preview').element as HTMLElement).style;
    expect(place().left).to.eq(`${600 - GAP - WIDTH}px`);
    expect(place().top).to.eq(`${300 + 10 - HEIGHT / 2}px`);
    expect(place().display).to.eq('');

    await w.setProps({anchor: rect(100, 300, 80, 20)});
    expect(place().left, 'no room on the left — right of the token').to.eq(`${180 + GAP}px`);

    await w.setProps({anchor: rect(600, 0, 80, 20)});
    expect(place().top, 'a token at the top edge').to.eq(`${MARGIN}px`);

    await w.setProps({anchor: undefined});
    expect(place().display, 'no token to stand beside').to.eq('none');
  });
});
