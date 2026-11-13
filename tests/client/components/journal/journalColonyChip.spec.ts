/*
 * JournalColonyChip — the COLONY name token of the journal feed and the notifications (its host is
 * `JournalTokenRenderer`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one prop in, nothing
 * out, nothing exposed. What it renders for its name — the token (translated by the chip's own `v-i18n`) and, beside
 * it, the preview it feeds — and the hover: the preview opens only after the chip's delay (a wait of the flow kernel —
 * the spec drives the kernel's clock), anchored on the token's own box, and a leave closes it or takes the pending
 * open back. The preview is stubbed by name: the spec reads what the chip hands it.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import JournalColonyChip from '@/client/components/journal/JournalColonyChip.vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/** The chip's own hover delay (`HOVER_DELAY` in the component). */
const HOVER_DELAY = 160;

// The mini-card is `ColonyPreviewPopover`'s own subject; this spec reads what the chip HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PopoverStub = defineComponent({
  name: 'ColonyPreviewPopover',
  props: {
    name: {type: String, default: undefined},
    visible: {type: Boolean, default: false},
    anchor: {type: Object as PropType<DOMRect | undefined>, default: undefined},
  },
  render: () => h('i', {class: 'popover-stub'}),
});

function chip(name: ColonyName) {
  // No i18n plugin on purpose: the component imports its own `v-i18n`. Leaning on the global registration would be
  // a Vue warning here — and the warn handler fails the spec.
  return mount(JournalColonyChip, {props: {name}, global: {config: globalConfig.global.config, stubs: {ColonyPreviewPopover: PopoverStub}}});
}

/** The token's box on screen, as the chip will measure it. */
function standAt(token: Element, left: number, top: number): void {
  const width = 80;
  const height = 20;
  (token as HTMLElement).getBoundingClientRect = () => ({x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})});
}

describe('JournalColonyChip — the journal\'s colony token', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('renders the colony\'s token — focusable, its name translated by its own v-i18n — and a closed preview of that colony beside it; both follow the name', async () => {
    const w = chip(ColonyName.LUNA);
    const token = w.find('span.journal-token');
    expect(token.classes()).to.deep.eq(['journal-token', 'journal-token--colony']);
    expect(token.attributes('tabindex')).to.eq('0');
    expect(token.attributes('tm-has-i18n'), 'translated by the chip\'s own v-i18n').to.eq('true');
    expect(token.text()).to.eq('Luna');

    const preview = w.findComponent(PopoverStub);
    expect(preview.props()).to.deep.eq({name: ColonyName.LUNA, visible: false, anchor: undefined});
    // Two roots: the token, and the preview beside it (never inside the token's text).
    expect(token.find('.popover-stub').exists()).to.eq(false);

    await w.setProps({name: ColonyName.EUROPA});
    expect(w.find('span.journal-token').text()).to.eq('Europa');
    expect(preview.props('name')).to.eq(ColonyName.EUROPA);
  });

  it('a hover opens the preview after the chip\'s delay, anchored on the token\'s own box as it stands THEN; a leave closes it', async () => {
    const w = chip(ColonyName.TITAN);
    const token = w.find('span.journal-token');
    const preview = w.findComponent(PopoverStub);
    standAt(token.element, 600, 300);

    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 1);
    await nextTick();
    expect(preview.props('visible'), 'the delay has not run out').to.eq(false);
    expect(preview.props('anchor'), 'nothing is measured before the preview opens').to.eq(undefined);

    // The feed scrolled during the delay: the box is read when the preview opens, not when the hover began.
    standAt(token.element, 600, 240);
    clock.advance(1);
    await nextTick();
    expect(preview.props('visible')).to.eq(true);
    const anchor: DOMRect | undefined = preview.props('anchor');
    expect([anchor?.left, anchor?.top, anchor?.width, anchor?.height]).to.deep.eq([600, 240, 80, 20]);

    await token.trigger('mouseleave');
    expect(preview.props('visible')).to.eq(false);
  });

  it('a leave before the delay takes the pending open back; a second hover restarts the delay; focus and blur are the same two edges', async () => {
    const w = chip(ColonyName.GANYMEDE);
    const token = w.find('span.journal-token');
    const preview = w.findComponent(PopoverStub);

    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 10);
    await token.trigger('mouseleave');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'the open was taken back').to.eq(false);

    // Two enters in a row (the mouse, then the keyboard's focus) arm ONE open — at the second one's delay.
    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 10);
    await token.trigger('focus');
    clock.advance(HOVER_DELAY - 10);
    await nextTick();
    expect(preview.props('visible'), 'the first enter\'s open was replaced, the second is not due yet').to.eq(false);
    clock.advance(10);
    await nextTick();
    expect(preview.props('visible'), 'opened by focus').to.eq(true);

    await token.trigger('blur');
    expect(preview.props('visible'), 'closed by blur').to.eq(false);
  });
});
