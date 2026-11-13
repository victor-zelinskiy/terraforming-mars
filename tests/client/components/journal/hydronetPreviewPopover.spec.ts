/*
 * HydronetPreviewPopover — the compact hover preview of the Hydronetwork journal token: a tooltip bound for the body
 * with the subsystem's icon, title and one-line rule. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): three props in, nothing out, nothing exposed — the spec is what it renders for them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {HYDRO_PREVIEW} from '@/client/components/hydronetwork/hydroPreview';
import HydronetPreviewPopover from '@/client/components/journal/HydronetPreviewPopover.vue';

// The icon is the overview bar's own subject; this spec reads which one the popover asks for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const IconStub = defineComponent({
  name: 'BarButtonIcon',
  props: ['name'],
  render: () => h('i', {class: 'icon-stub'}),
});

// The popover's own numbers (its positioning math): the plate, the gap to the token, the viewport margin.
const WIDTH = 264;
const HEIGHT = 104;
const GAP = 14;
const MARGIN = 8;

/** The token's bounding rect, in viewport coordinates. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

// The teleport is stubbed so the popover is read where it is rendered (its target is the document's body). No i18n
// plugin on purpose: the component imports its own `v-i18n` — the global one is not there to lean on.
function popover(props: Record<string, unknown>) {
  return mount(HydronetPreviewPopover, {props, global: {config: globalConfig.global.config, stubs: {teleport: true, BarButtonIcon: IconStub}}});
}

describe('HydronetPreviewPopover — the hover preview of the Hydronetwork token', () => {
  it('renders nothing until it is visible; visible, it is a tooltip bound for the body with the icon, the title and the rule', async () => {
    const w = popover({anchor: rect(600, 300, 80, 20)});
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.journal-sp-preview').exists(), 'hidden by default').to.eq(false);

    await w.setProps({visible: true});
    const tip = w.find('.journal-sp-preview');
    expect(tip.classes()).to.deep.eq(['journal-sp-preview', 'journal-sp-preview--hydro']);
    expect(tip.attributes('role')).to.eq('tooltip');
    expect(tip.attributes('aria-hidden')).to.eq('true');
    expect(tip.findAll('.journal-sp-preview__corner')).to.have.length(2);
    expect(w.findAll('.journal-sp-preview__icon--hydro > .icon-stub')).to.have.length(1);
    expect(w.findComponent(IconStub).props('name')).to.eq('hydronetwork');

    // The copy is the SHARED source's, translated by the popover's own `v-i18n`.
    const lines = ['kicker', 'name', 'desc'].map((part) => tip.find(`.journal-sp-preview__body > .journal-sp-preview__${part}`));
    expect(lines.map((line) => line.attributes('tm-has-i18n'))).to.deep.eq(['true', 'true', 'true']);
    expect(lines.map((line) => line.text())).to.deep.eq([$t('Hydronetwork'), $t(HYDRO_PREVIEW.titleKey), $t(HYDRO_PREVIEW.descriptionKey)]);
  });

  it('by default it stands LEFT of its token, centred on it, and flips to the right when the left has no room', async () => {
    const w = popover({visible: true, anchor: rect(600, 300, 80, 20)});
    const place = () => (w.find('.journal-sp-preview').element as HTMLElement).style;
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

  it('`prefer: right` stands RIGHT of the token, and flips to the left when the right has no room', async () => {
    const w = popover({visible: true, prefer: 'right', anchor: rect(300, 300, 80, 20)});
    const place = () => (w.find('.journal-sp-preview').element as HTMLElement).style;
    expect(place().left).to.eq(`${380 + GAP}px`);

    const nearRightEdge = window.innerWidth - 100;
    await w.setProps({anchor: rect(nearRightEdge, 300, 80, 20)});
    expect(place().left, 'no room on the right — left of the token').to.eq(`${nearRightEdge - GAP - WIDTH}px`);
  });
});
