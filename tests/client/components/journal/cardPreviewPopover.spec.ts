/*
 * CardPreviewPopover — the hover preview of a card token: a tooltip bound for the body that stands beside the token
 * that asked for it. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): four props in, nothing
 * out, nothing exposed — the spec is what it renders for them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';

// The face is the premium renderer — its own subject; this spec reads the model the popover HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: ['card'],
  render: () => h('i', {class: 'card-stub'}),
});

// The popover's own numbers (its positioning math): the scaled-down card, the gap to the token, the viewport margin.
const WIDTH = 240;
const HEIGHT = 336;
const GAP = 14;
const MARGIN = 8;

/** The token's bounding rect, in viewport coordinates. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

// The teleport is stubbed so the popover is read where it is rendered (its target is the document's body).
function popover(props: Record<string, unknown>) {
  return mount(CardPreviewPopover, {props, global: {config: globalConfig.global.config, stubs: {teleport: true, Card: CardStub}}});
}

describe('CardPreviewPopover — the hover preview of a card token', () => {
  it('renders nothing until it is visible; visible, it is a tooltip bound for the body that holds the card by its name', async () => {
    const w = popover({name: CardName.ANTS, anchor: rect(600, 300, 80, 20)});
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.journal-card-preview').exists(), 'hidden by default').to.eq(false);

    await w.setProps({visible: true});
    const tip = w.find('.journal-card-preview');
    expect(tip.attributes('role')).to.eq('tooltip');
    expect(tip.attributes('aria-hidden')).to.eq('true');
    expect(w.findAll('.journal-card-preview > .journal-card-preview__inner > .card-stub')).to.have.length(1);
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: CardName.ANTS});

    await w.setProps({name: CardName.BIRDS});
    expect(w.findComponent(CardStub).props('card'), 'it follows the name').to.deep.eq({name: CardName.BIRDS});

    await w.setProps({visible: false});
    expect(w.find('.journal-card-preview').exists()).to.eq(false);
  });

  it('a live card model wins over the name — the face shows what the caller holds, its resources included', () => {
    const live: CardModel = {name: CardName.BIRDS, resources: 3};
    const w = popover({name: CardName.ANTS, card: live, visible: true, anchor: rect(600, 300, 80, 20)});
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: CardName.BIRDS, resources: 3});
  });

  it('stands LEFT of its token, centred on it; flips to the right when the left has no room; never leaves the viewport', async () => {
    const w = popover({name: CardName.ANTS, visible: true, anchor: rect(600, 300, 80, 20)});
    const place = () => (w.find('.journal-card-preview').element as HTMLElement).style;
    expect(place().left).to.eq(`${600 - GAP - WIDTH}px`);
    expect(place().top).to.eq(`${300 + 10 - HEIGHT / 2}px`);
    expect(place().display).to.eq('');

    await w.setProps({anchor: rect(100, 300, 80, 20)});
    expect(place().left, 'no room on the left — right of the token').to.eq(`${180 + GAP}px`);

    await w.setProps({anchor: rect(600, 0, 80, 20)});
    expect(place().top, 'a token at the top edge').to.eq(`${MARGIN}px`);

    await w.setProps({anchor: rect(600, window.innerHeight - 20, 80, 20)});
    expect(place().top, 'a token at the bottom edge').to.eq(`${window.innerHeight - HEIGHT - MARGIN}px`);

    await w.setProps({anchor: undefined});
    expect(place().display, 'no token to stand beside').to.eq('none');
  });
});
