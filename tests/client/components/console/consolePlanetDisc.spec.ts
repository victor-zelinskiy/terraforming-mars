/*
 * ConsolePlanetDisc — the ONE way a colony's planet art is rendered on every console surface (the overview tile's
 * medallion, the trade stage's hero, the dossier's centrepiece, a reaction's cause). A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): three props in, nothing emitted, nothing exposed — so the spec is what it
 * renders for its props, the ORBIT slot, and the root its hosts dress (every one of them hands it a class of its own
 * and reads the two light layers by name). The art key is the sibling module's (`consolePlanetDiscModel.ts` — a
 * `<script setup>` block exports no values).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';
import {planetArtClass} from '@/client/components/console/consolePlanetDiscModel';

function disc(props: {colony: string, lit?: boolean, size?: string}) {
  return mount(ConsolePlanetDisc, {props});
}

describe('ConsolePlanetDisc — the colony\'s planet', () => {
  it('the art key: the manifest\'s `.<Name>-background` rule, a multi-word name joined by a dash', () => {
    expect(planetArtClass('Europa')).to.eq('Europa-background');
    expect(planetArtClass('Leavitt II')).to.eq('Leavitt-II-background');
  });

  it('the template starts with its root: a decorative disc wearing the colony\'s art, the two light layers by name', async () => {
    const w = disc({colony: 'Europa'});
    const root = w.element as HTMLElement;
    expect(root.tagName.toLowerCase()).to.eq('div');
    expect(w.classes()).to.deep.eq(['con-planet', 'Europa-background']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    // The descend choreography animates these two by class — and the quiet dress has no rim.
    expect(Array.from(root.children).map((c) => c.className)).to.deep.eq(['con-planet__light', 'con-planet__terminator']);
    expect(root.style.getPropertyValue('--con-planet-size'), 'no size of its own: the host\'s token').to.eq('');

    // …and it FOLLOWS its colony: the same node, another art.
    await w.setProps({colony: 'Leavitt II'});
    expect(w.element, 'the same node').to.eq(root);
    expect(w.classes()).to.deep.eq(['con-planet', 'Leavitt-II-background']);
  });

  it('the full dress: `lit` adds the modifier and the atmosphere rim, and takes both back', async () => {
    const w = disc({colony: 'Titan', lit: true});
    expect(w.classes()).to.deep.eq(['con-planet', 'Titan-background', 'con-planet--lit']);
    expect(w.find('.con-planet__rim').exists()).to.eq(true);
    expect(w.find('.con-planet__rim').attributes('aria-hidden')).to.eq('true');

    await w.setProps({lit: false});
    expect(w.classes()).to.not.include('con-planet--lit');
    expect(w.find('.con-planet__rim').exists()).to.eq(false);
  });

  it('a `size` is the disc\'s own `--con-planet-size`; an empty one writes nothing', async () => {
    const w = disc({colony: 'Titan', size: '4rem'});
    const root = w.element as HTMLElement;
    expect(root.style.getPropertyValue('--con-planet-size')).to.eq('4rem');

    await w.setProps({size: ''});
    expect(root.style.getPropertyValue('--con-planet-size')).to.eq('');
  });

  it('the default slot is the ORBIT: a host\'s berth stands inside the disc, after the light', () => {
    const w = mount(ConsolePlanetDisc, {
      props: {colony: 'Titan', lit: true},
      slots: {default: () => h('i', {class: 'berth'})},
    });
    const children = Array.from(w.element.children).map((c) => (c as Element).className);
    expect(children).to.deep.eq(['con-planet__light', 'con-planet__terminator', 'con-planet__rim', 'berth']);
  });

  it('a host dresses the ROOT and reaches nothing: its class falls through, the ref carries no member', () => {
    const Host = defineComponent({
      render() {
        return h('div', [h(ConsolePlanetDisc, {ref: 'planet', class: 'con-coltile__planet', colony: 'Europa'})]);
      },
    });
    const host = mount(Host);
    const root = host.find('.con-planet');
    expect(root.classes(), 'the host\'s class lands on the disc itself').to.deep.eq(['con-planet', 'Europa-background', 'con-coltile__planet']);
    expect(Object.keys((host.vm.$refs.planet ?? {}) as object), 'no parent stands a ref on it: nothing is exposed').to.deep.eq([]);
    expect(host.findComponent(ConsolePlanetDisc).emitted(), 'it emits nothing').to.deep.eq({});
  });
});
