/*
 * ConsoleTileProxy — the ONE anatomy of a tile that lands (edge · art · touch), shared by the Mars landing layer and
 * the colony city layer. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one prop, no emits,
 * and ONE exposed member — its parents stand a ref on it only for its ELEMENT, read by the one name `rootEl` (a Vapor
 * child's ref answers no `$el` — R12, components/rootEl.ts) and handed to `tileProxyEls` (the sibling
 * `consoleTileProxyModel.ts`, where the value export moved — R25). So the spec is: what it renders for its prop, that the root takes what a parent
 * lets fall through (the template starts with its root — R24), and that a parent's ref resolves its parts.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleTileProxy from '@/client/components/console/tilePlacement/ConsoleTileProxy.vue';
import {tileProxyEls} from '@/client/components/console/tilePlacement/consoleTileProxyModel';

/** A parent standing a ref on the proxy, the way both layers do. */
function mountUnderHost(attachTo?: HTMLElement) {
  const Host = defineComponent({
    render() {
      return h('div', {class: 'host'}, [h(ConsoleTileProxy, {ref: 'tile', artClass: 'board-space-tile--city'})]);
    },
  });
  return mount(Host, {...globalConfig, attachTo});
}

describe('ConsoleTileProxy — the flying tile\'s anatomy', () => {
  it('renders the edge and the art in the board\'s own tile class, and a bare touch overlay', async () => {
    const wrapper = mount(ConsoleTileProxy, {...globalConfig, props: {artClass: 'board-space-tile--greenery'}});

    expect(wrapper.classes(), 'the root is the tile itself').to.deep.eq(['con-tileplace__tile']);
    expect(Array.from(wrapper.element.children).map((el) => (el as Element).className)).to.deep.eq([
      'con-tileplace__edge board-space-tile--greenery',
      'con-tileplace__art board-space-tile--greenery',
      'con-tileplace__touch',
    ]);

    await wrapper.setProps({artClass: 'board-space-tile--ocean'});
    expect(wrapper.find('.con-tileplace__edge').classes()).to.include('board-space-tile--ocean');
    expect(wrapper.find('.con-tileplace__art').classes()).to.deep.eq(['con-tileplace__art', 'board-space-tile--ocean']);
  });

  it('takes the class and the attributes a parent lets fall through onto its root', () => {
    const wrapper = mount(ConsoleTileProxy, {
      ...globalConfig,
      props: {artClass: 'board-space-tile--city'},
      attrs: {'class': 'con-tileplace__tile--remote', 'data-colony-city-proxy': ''},
    });

    expect(wrapper.element.nodeType, 'the template starts with its root — an element, never a fragment\'s anchor').to.eq(1);
    expect(wrapper.classes()).to.deep.eq(['con-tileplace__tile', 'con-tileplace__tile--remote']);
    expect(wrapper.attributes('data-colony-city-proxy')).to.eq('');
  });

  it('exposes its root and nothing else — a parent\'s ref answers `rootEl`, and `tileProxyEls` resolves the parts off it', () => {
    const stand = document.createElement('div');
    document.body.appendChild(stand);
    try {
      const wrapper = mountUnderHost(stand);
      const ref = wrapper.vm.$refs.tile as {rootEl?: HTMLElement | null};

      expect(Object.keys(ref), 'the ref carries the root and no other member of the component').to.deep.eq(['rootEl']);
      expect(ref.rootEl, 'the ref answers the root element').to.eq(wrapper.find('.con-tileplace__tile').element);

      const parts = tileProxyEls(ref.rootEl);
      expect(parts?.tile).to.eq(ref.rootEl);
      expect(parts?.edge?.className).to.eq('con-tileplace__edge board-space-tile--city');
      expect(parts?.art?.className).to.eq('con-tileplace__art board-space-tile--city');
      expect(parts?.touch?.className).to.eq('con-tileplace__touch');
    } finally {
      stand.remove();
    }
  });

  it('`tileProxyEls` answers nothing for a proxy that is not in the document', () => {
    const wrapper = mountUnderHost();
    const ref = wrapper.vm.$refs.tile as {rootEl?: HTMLElement | null};

    expect(ref.rootEl?.isConnected, 'mounted detached').to.eq(false);
    expect(tileProxyEls(ref.rootEl)).to.eq(undefined);
    expect(tileProxyEls(null)).to.eq(undefined);
    expect(tileProxyEls(undefined)).to.eq(undefined);
  });
});
