import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import GlobalEvent from '@/client/components/turmoil/GlobalEvent.vue';
import {getGlobalEventOrThrow} from '@/client/turmoil/ClientGlobalEventManifest';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';

/*
 * A global event's face (classic Turmoil): the two delegates, the name, the render data and the description — read
 * once, off the client manifest, for the name it is handed. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): three props, a default slot, no emits, nothing exposed. Its three children are
 * stubbed under the names its template uses: their own rendering is theirs.
 *
 * THE GUARD: an unknown name throws while the component is set up. In `data()` that throw unwound the mount (and a
 * parent's patch); in `setup` Vue REPORTS it — `errorCaptured` / `app.config.errorHandler` / the console — and goes on
 * with a component that declared nothing. The last test pins the report.
 */

const PartyStub = defineComponent({
  name: 'CardParty',
  props: {party: {type: String, required: true}},
  render() {
    return h('i', {'class': 'party-stub', 'data-party': this.party});
  },
});

const RenderDataStub = defineComponent({
  name: 'CardRenderData',
  props: {renderData: {type: Object as PropType<ICardRenderRoot>, required: true}},
  render: () => h('i', {class: 'render-data-stub'}),
});

const DescriptionStub = defineComponent({
  name: 'CardDescription',
  props: {item: {type: String, required: true}},
  render() {
    return h('i', {'class': 'description-stub', 'data-item': this.item});
  },
});

const global = {...globalConfig.global, stubs: {CardParty: PartyStub, CardRenderData: RenderDataStub, CardDescription: DescriptionStub}};

describe('GlobalEvent', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GlobalEvent, {
      ...globalConfig,
      props: {
        globalEventName: GlobalEventName.GLOBAL_DUST_STORM,
        type: 'current',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows the event the manifest holds under its name: the revealed and the current delegate, the name, the render data, the description — in the dress of its `type`', () => {
    const event = getGlobalEventOrThrow(GlobalEventName.GLOBAL_DUST_STORM);
    const wrapper = mount(GlobalEvent, {global, props: {globalEventName: GlobalEventName.GLOBAL_DUST_STORM, type: 'coming'}});
    expect(wrapper.classes()).to.deep.eq(['global-event', 'global-event--coming']);

    const parties = wrapper.findAllComponents(PartyStub);
    expect(parties.map((p) => [p.classes().find((k) => k.startsWith('card-party--')), p.props('party')]))
      .to.deep.eq([['card-party--revealed', event.revealedDelegate], ['card-party--current', event.currentDelegate]]);
    expect(wrapper.find('.global-event-title > .global-event-name').text()).to.eq(GlobalEventName.GLOBAL_DUST_STORM);
    expect(wrapper.findComponent(RenderDataStub).props('renderData')).to.deep.eq(event.renderData);
    expect(wrapper.findComponent(DescriptionStub).props('item')).to.eq(event.description);
    expect(wrapper.find('.global-event-distance').exists(), 'no distance label unless asked for').to.eq(false);
  });

  it('`showDistance` adds its class and the label of the `type`; the default slot stands last in the root', async () => {
    const wrapper = mount(GlobalEvent, {
      global,
      props: {globalEventName: GlobalEventName.GLOBAL_DUST_STORM, type: 'distant', showDistance: true},
      slots: {default: () => h('b', {class: 'from-host'})},
    });
    expect(wrapper.classes()).to.deep.eq(['global-event', 'global-event--distant', 'global-event--show-distance']);
    expect(wrapper.find('.global-event > .global-event-distance').text()).to.eq('distant');
    expect(wrapper.element.lastElementChild?.className).to.eq('from-host');

    // The dress follows the props (the event itself was read once, at set-up).
    await wrapper.setProps({type: 'current', showDistance: false});
    expect(wrapper.classes()).to.deep.eq(['global-event', 'global-event--current']);
    expect(wrapper.find('.global-event-distance').exists()).to.eq(false);
  });

  it('an unknown name, arriving in a parent\'s PATCH: the guard\'s error is REPORTED to the app\'s error handler, once, from the mount — the card renders nothing and the parent\'s patch goes through', async () => {
    // (Never thrown from the set-up: what a throwing set-up leaves behind differs by runtime — the virtual DOM
    // renders nothing, a Vapor component of a development build goes on to render, and under a virtual-DOM parent the
    // interop fails that parent's patch with a second error. The component reports from its mount and guards its root.)
    // (Mounted as the ROOT, test-utils itself re-throws what the app's handler was handed during the mount — so the
    // event stands under a host that is already mounted, the way `Turmoil` and the log panel stand it.)
    const reported: Array<{message: string, info: string}> = [];
    const Host = defineComponent({
      props: {name: {type: String as PropType<GlobalEventName>, default: undefined}},
      render() {
        return h('div', [
          this.name === undefined ? null : h(GlobalEvent, {globalEventName: this.name, type: 'current'}),
          h('b', {class: 'after-the-event'}, this.name),
        ]);
      },
    });
    const host = mount(Host, {
      global: {
        ...global,
        config: {
          errorHandler: (err: unknown, _instance: unknown, info: string) => {
            reported.push({message: err instanceof Error ? err.message : String(err), info});
          },
          // The event goes on with nothing declared, and Vue says so in warnings: not this test's subject.
          warnHandler: () => {},
        },
      },
    });
    expect(host.find('.after-the-event').text()).to.eq('');

    await host.setProps({name: 'No Such Event' as GlobalEventName});
    expect(reported).to.deep.eq([{message: 'Can\'t find card No Such Event', info: 'mounted hook'}]);
    expect(host.find('.after-the-event').text(), 'the sibling AFTER the event was patched').to.eq('No Such Event');
    expect(host.find('.global-event').exists(), 'nothing of the event was declared').to.eq(false);
  });
});
